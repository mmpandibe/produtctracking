import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DataStore, type SprintStats } from '../../core/data-store';
import type { Issue, Roadmap, Sprint } from '../../core/models';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { TicketForm } from '../tickets/ticket-form';
import { priorityOf, tint, typeOf } from '../tickets/ticket-meta';
import { RoadmapForm } from './roadmap-form';
import { roadmapStatusOf } from './roadmap-meta';
import { SprintForm } from './sprint-form';
import { ReadablePipe } from '../../shared/readable';
import { MoveMenu } from '../../shared/move-menu';

interface Section {
  id: string; // sprint id or 'backlog'
  sprint?: Sprint;
  issues: Issue[];
  stats: SprintStats;
}

const PRODUCT_KEY = 'npro-backlog-product';

/** Step 5: plan work — backlog grooming, sprints (create / start / complete), story points. */
@Component({
  selector: 'app-backlog-page',
  imports: [ReadablePipe, MoveMenu, DatePipe, DecimalPipe, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, Avatar, Icon, Modal, PageHeader, TicketForm, SprintForm, RoadmapForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './backlog-page.html',
})
export class BacklogPage {
  protected readonly store = inject(DataStore);
  private readonly router = inject(Router);
  protected readonly typeOf = typeOf;
  protected readonly priorityOf = priorityOf;
  protected readonly tint = tint;

  protected readonly products = computed(() => this.store.products().filter((p) => !p.archived));
  private readonly chosenProduct = signal(readProduct());
  /** The product being planned (falls back to the first active product) */
  protected readonly productId = computed(() => {
    const id = this.chosenProduct();
    return this.products().some((p) => p.id === id) ? id : (this.products()[0]?.id ?? '');
  });
  protected readonly product = computed(() => this.store.products().find((p) => p.id === this.productId()));
  /** Role rights on the selected product (Step 12) */
  protected readonly canRoadmaps = computed(() => this.store.canDo('roadmaps', this.productId()));
  protected readonly canSprints = computed(() => this.store.canDo('sprints', this.productId()));
  protected readonly query = signal('');
  protected readonly collapsed = signal<Set<string>>(new Set());
  protected readonly showCompleted = signal(false);
  protected readonly showRoadmaps = signal(true);
  protected readonly roadmapStatusOf = roadmapStatusOf;

  // Roadmaps
  protected readonly roadmapFormOpen = signal(false);
  protected readonly editingRoadmap = signal<Roadmap | undefined>(undefined);
  protected readonly deletingRoadmap = signal<Roadmap | undefined>(undefined);
  protected readonly roadmapRows = computed(() => {
    this.store.issues();
    this.store.sprints();
    return this.store
      .roadmaps()
      .filter((r) => r.productId === this.productId())
      .sort((a, b) => (a.startDate ?? a.createdAt).localeCompare(b.startDate ?? b.createdAt))
      .map((r) => ({
        roadmap: r,
        progress: this.store.roadmapProgress(r.id),
        sprints: this.store.sprints().filter((sp) => sp.roadmapId === r.id),
        overdue: !!r.dueDate && r.status !== 'completed' && r.status !== 'cancelled' && Date.parse(r.dueDate) < Date.now(),
      }));
  });

  // Dialogs
  protected readonly sprintFormOpen = signal(false);
  protected readonly editingSprint = signal<Sprint | undefined>(undefined);
  protected readonly completing = signal<Sprint | undefined>(undefined);
  protected readonly completeTarget = signal('backlog');
  protected readonly deletingSprint = signal<Sprint | undefined>(undefined);
  protected readonly ticketFormOpen = signal(false);
  protected readonly newTicketSprint = signal<string>('');
  protected readonly editingPoints = signal<string | null>(null);
  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;
  private justDragged = false;

  protected readonly activeSprint = computed(() => this.store.sprints().find((sp) => sp.productId === this.productId() && sp.state === 'active'));
  protected readonly plannedSprints = computed(() =>
    this.store
      .sprints()
      .filter((sp) => sp.productId === this.productId() && sp.state === 'planned')
      .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')),
  );
  protected readonly completedSprints = computed(() =>
    this.store
      .sprints()
      .filter((sp) => sp.productId === this.productId() && sp.state === 'closed')
      .sort((a, b) => (b.completedAt ?? b.endDate ?? '').localeCompare(a.completedAt ?? a.endDate ?? '')),
  );
  protected readonly velocity = computed(() => {
    this.store.sprints();
    return this.store.velocity(this.productId());
  });

  /** Active sprint, planned sprints (by start date), then the backlog */
  protected readonly sections = computed<Section[]>(() => {
    const pid = this.productId();
    const q = this.query().trim().toLowerCase();
    const issues = this.store.issues().filter((i) => i.productId === pid);
    const match = (i: Issue) => !q || i.key.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q);
    const rows = (sprintId: string | undefined) =>
      issues
        .filter((i) => (i.sprintId || undefined) === sprintId && match(i))
        .sort((a, b) => this.store.rankOf(a) - this.store.rankOf(b));
    const sprints = [...(this.activeSprint() ? [this.activeSprint()!] : []), ...this.plannedSprints()];
    return [
      ...sprints.map((sp) => ({ id: sp.id, sprint: sp, issues: rows(sp.id), stats: this.store.sprintStats(pid, sp.id) })),
      { id: 'backlog', issues: rows(undefined), stats: this.store.sprintStats(pid, undefined) },
    ];
  });

  protected setProduct(id: string) {
    this.chosenProduct.set(id);
    try {
      localStorage.setItem(PRODUCT_KEY, id);
    } catch {
      // per-viewer convenience only
    }
  }

  protected toggle(id: string) {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected statusOf(i: Issue) {
    return this.store.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId);
  }

  protected isDone(i: Issue) {
    return this.statusOf(i)?.category === 'done';
  }

  protected daysLeft(sp: Sprint) {
    if (!sp.endDate) return undefined;
    return Math.ceil((Date.parse(sp.endDate) - Date.now()) / 86400000);
  }

  // ---- Drag & drop ----

  protected drop(e: CdkDragDrop<Section>) {
    const issue = e.item.data as Issue;
    const target = e.container.data;
    if (e.previousContainer === e.container && e.previousIndex === e.currentIndex) return;
    const others = target.issues.filter((i) => i.id !== issue.id);
    const sprintId = target.sprint?.id;
    this.store.moveToSprint(issue.id, sprintId, others[e.currentIndex - 1], others[e.currentIndex]);
    if (e.previousContainer !== e.container) this.showToast(`${issue.key} moved to ${target.sprint?.name ?? 'Backlog'}`);
  }

  /** Sprint / backlog targets for the move menu (2.5.7 alternative to dragging) */
  protected readonly moveTargets = computed(() => this.sections().map((s) => ({ id: s.id, label: s.sprint?.name ?? 'Backlog' })));

  protected moveRow(i: Issue, sec: Section, to: string) {
    const idx = sec.issues.findIndex((x) => x.id === i.id);
    if (to === 'up' || to === 'down') {
      const others = sec.issues.filter((x) => x.id !== i.id);
      const pos = to === 'up' ? idx - 1 : idx + 1;
      this.store.moveToSprint(i.id, sec.sprint?.id, others[pos - 1], others[pos]);
      return;
    }
    const target = this.sections().find((s) => s.id === to);
    if (!target) return;
    const last = target.issues.filter((x) => x.id !== i.id).at(-1);
    this.store.moveToSprint(i.id, target.sprint?.id, last, undefined);
    this.showToast(`${i.key} moved to ${target.sprint?.name ?? 'Backlog'}`);
  }

  protected dragEnded() {
    this.justDragged = true;
    setTimeout(() => (this.justDragged = false), 50);
  }

  protected open(i: Issue) {
    if (this.justDragged) return;
    void this.router.navigate(['/tickets', i.key]);
  }

  // ---- Story points (inline) ----

  protected savePoints(i: Issue, raw: string) {
    this.editingPoints.set(null);
    const v = raw.trim() === '' ? undefined : Math.max(0, Math.round(Number(raw)));
    if (v !== undefined && Number.isNaN(v)) return;
    if (v !== i.storyPoints) this.store.updateIssue(i.id, { storyPoints: v });
  }

  // ---- Roadmap actions ----

  protected roadmapName(id: string | undefined) {
    return id ? this.store.roadmaps().find((r) => r.id === id)?.name : undefined;
  }

  protected createRoadmap() {
    this.editingRoadmap.set(undefined);
    this.roadmapFormOpen.set(true);
  }

  protected editRoadmap(r: Roadmap) {
    this.editingRoadmap.set(r);
    this.roadmapFormOpen.set(true);
  }

  protected confirmDeleteRoadmap() {
    const r = this.deletingRoadmap();
    if (r) {
      this.store.deleteRoadmap(r.id);
      this.showToast(`${r.name} deleted · its sprints are kept`);
    }
    this.deletingRoadmap.set(undefined);
  }

  // ---- Sprint actions ----

  protected createSprint() {
    this.editingSprint.set(undefined);
    this.sprintFormOpen.set(true);
  }

  protected editSprint(sp: Sprint) {
    this.editingSprint.set(sp);
    this.sprintFormOpen.set(true);
  }

  protected startSprint(sp: Sprint) {
    if (this.activeSprint()) {
      this.showToast(`Complete ${this.activeSprint()!.name} before starting another sprint`);
      return;
    }
    if (this.store.startSprint(sp.id)) this.showToast(`${sp.name} started`);
  }

  protected askComplete(sp: Sprint) {
    this.completing.set(sp);
    this.completeTarget.set(this.plannedSprints()[0]?.id ?? 'backlog');
  }

  protected confirmComplete() {
    const sp = this.completing();
    if (!sp) return;
    const target = this.completeTarget() === 'backlog' ? undefined : this.completeTarget();
    const moved = this.store.completeSprint(sp.id, target);
    const where = target ? this.store.sprintById(target)?.name : 'the backlog';
    this.completing.set(undefined);
    this.showToast(`${sp.name} completed` + (moved ? ` · ${moved} unfinished ticket${moved === 1 ? '' : 's'} moved to ${where}` : ''));
  }

  protected confirmDeleteSprint() {
    const sp = this.deletingSprint();
    if (sp && this.store.deleteSprint(sp.id)) this.showToast(`${sp.name} deleted · its tickets are back in the backlog`);
    this.deletingSprint.set(undefined);
  }

  protected createTicketIn(sectionId: string) {
    this.newTicketSprint.set(sectionId === 'backlog' ? '' : sectionId);
    this.ticketFormOpen.set(true);
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3200);
  }
}

function readProduct() {
  try {
    return localStorage.getItem(PRODUCT_KEY) ?? '';
  } catch {
    return '';
  }
}
