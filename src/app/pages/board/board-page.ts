import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DataStore } from '../../core/data-store';
import type { Issue, WorkflowStatus } from '../../core/models';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { TicketForm } from '../tickets/ticket-form';
import { ISSUE_TYPES, priorityOf, tint, typeOf } from '../tickets/ticket-meta';
import { ReadablePipe } from '../../shared/readable';
import { MoveMenu } from '../../shared/move-menu';

interface Column {
  status: WorkflowStatus;
  cards: Issue[];
}

/** Step 4: Kanban board. Columns come from the workflow; dragging a card changes its status. */
@Component({
  selector: 'app-board-page',
  imports: [ReadablePipe, MoveMenu, DatePipe, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, Avatar, Icon, PageHeader, TicketForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-page.html',
})
export class BoardPage {
  protected readonly store = inject(DataStore);
  private readonly router = inject(Router);
  protected readonly types = ISSUE_TYPES;
  protected readonly typeOf = typeOf;
  protected readonly priorityOf = priorityOf;
  protected readonly tint = tint;

  // Filters
  protected readonly productFilter = signal('');
  /** 'active' = tickets in any active sprint · '' = all · 'backlog' = no sprint · or a sprint id */
  protected readonly sprintFilter = signal('active');
  protected readonly assigneeFilter = signal('');
  protected readonly typeFilter = signal('');
  protected readonly query = signal('');
  protected readonly hideEmpty = signal(false);

  // UI state
  protected readonly dragging = signal(false);
  private justDragged = false;
  protected readonly formOpen = signal(false);
  protected readonly newStatus = signal<string | undefined>(undefined);
  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  /** Columns: the chosen product's workflow, or every status across workflows */
  protected readonly statuses = computed(() => {
    if (this.productFilter()) return this.store.workflowFor(this.productFilter()).statuses;
    const seen = new Map<string, WorkflowStatus>();
    for (const w of this.store.workflows()) for (const s of w.statuses) if (!seen.has(s.id)) seen.set(s.id, s);
    return [...seen.values()];
  });

  protected readonly sprintOptions = computed(() => {
    const p = this.productFilter();
    return this.store
      .sprints()
      .filter((sp) => sp.state !== 'closed' && (!p || sp.productId === p))
      .map((sp) => ({ ...sp, label: `${sp.name}${sp.state === 'active' ? ' (active)' : ''}` }));
  });

  private readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const me = this.store.currentUser().id;
    const sprints = new Map(this.store.sprints().map((sp) => [sp.id, sp]));
    const archived = new Set(this.store.products().filter((p) => p.archived).map((p) => p.id));
    return this.store.issues().filter((i) => {
      if (this.productFilter() ? i.productId !== this.productFilter() : archived.has(i.productId)) return false;
      const sf = this.sprintFilter();
      if (sf === 'active' && sprints.get(i.sprintId ?? '')?.state !== 'active') return false;
      if (sf === 'backlog' && i.sprintId) return false;
      if (sf && sf !== 'active' && sf !== 'backlog' && i.sprintId !== sf) return false;
      const a = this.assigneeFilter();
      if (a === 'me' && i.assigneeId !== me) return false;
      if (a === 'none' && i.assigneeId) return false;
      if (a && a !== 'me' && a !== 'none' && i.assigneeId !== a) return false;
      if (this.typeFilter() && i.type !== this.typeFilter()) return false;
      if (q && !i.key.toLowerCase().includes(q) && !i.summary.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  protected readonly columns = computed<Column[]>(() => {
    const byStatus = new Map<string, Issue[]>();
    for (const i of this.filtered()) (byStatus.get(i.statusId) ?? byStatus.set(i.statusId, []).get(i.statusId)!).push(i);
    return this.statuses()
      .map((status) => ({ status, cards: (byStatus.get(status.id) ?? []).sort((a, b) => this.store.rankOf(a) - this.store.rankOf(b)) }))
      .filter((c) => !this.hideEmpty() || c.cards.length > 0);
  });

  protected readonly total = computed(() => this.filtered().length);

  /** Per-ticket counts for the card footer */
  private readonly counts = computed(() => {
    const c: Record<string, { comments: number; files: number; children: number }> = {};
    const get = (id: string) => (c[id] ??= { comments: 0, files: 0, children: 0 });
    for (const x of this.store.comments()) get(x.issueId).comments++;
    for (const x of this.store.attachments()) get(x.issueId).files++;
    for (const x of this.store.issues()) if (x.parentId) get(x.parentId).children++;
    return c;
  });

  protected countsOf(i: Issue) {
    return this.counts()[i.id] ?? { comments: 0, files: 0, children: 0 };
  }

  protected isOverdue(i: Issue, s: WorkflowStatus) {
    return !!i.dueDate && s.category !== 'done' && new Date(i.dueDate) < new Date(new Date().toDateString());
  }

  protected value(e: Event) {
    return (e.target as HTMLSelectElement).value;
  }

  protected setProduct(id: string) {
    this.productFilter.set(id);
    // Keep the sprint filter valid for the chosen product
    const sf = this.sprintFilter();
    if (sf && sf !== 'active' && sf !== 'backlog' && !this.sprintOptions().some((sp) => sp.id === sf)) this.sprintFilter.set('active');
  }

  protected drop(e: CdkDragDrop<Column>) {
    const issue = e.item.data as Issue;
    const target = e.container.data;
    if (e.previousContainer === e.container && e.previousIndex === e.currentIndex) return;
    // Neighbours in the target column after the drop (without the dragged card)
    const others = target.cards.filter((c) => c.id !== issue.id);
    const before = others[e.currentIndex - 1];
    const after = others[e.currentIndex];
    const ok = this.store.moveIssue(issue.id, target.status.id, before, after);
    if (!ok) {
      this.showToast(`The workflow doesn't allow moving ${issue.key} to ${target.status.name}`);
    } else if (e.previousContainer !== e.container) {
      this.showToast(`${issue.key} moved to ${target.status.name}`);
    }
  }

  /** Statuses this card may move to (2.5.7 alternative to dragging) */
  protected moveTargets(i: Issue) {
    return this.store.allowedStatuses(i).map((s) => ({ id: s.id, label: s.name }));
  }

  /** Move menu: up / down within the column, or to another status (end of that column) */
  protected moveCard(i: Issue, col: Column, to: string) {
    const idx = col.cards.findIndex((c) => c.id === i.id);
    if (to === 'up' || to === 'down') {
      const others = col.cards.filter((c) => c.id !== i.id);
      const pos = to === 'up' ? idx - 1 : idx + 1;
      this.store.moveIssue(i.id, col.status.id, others[pos - 1], others[pos]);
      return;
    }
    const target = this.columns().find((c) => c.status.id === to);
    const last = target?.cards.filter((c) => c.id !== i.id).at(-1);
    if (this.store.moveIssue(i.id, to, last, undefined)) this.showToast(`${i.key} moved to ${target?.status.name ?? 'the new status'}`);
    else this.showToast(`The workflow doesn't allow that move for ${i.key}`);
  }

  protected dragStarted() {
    this.dragging.set(true);
  }

  protected dragEnded() {
    this.dragging.set(false);
    // A drag ends with a click on the card; ignore that click
    this.justDragged = true;
    setTimeout(() => (this.justDragged = false), 50);
  }

  protected open(i: Issue) {
    if (this.justDragged) return;
    void this.router.navigate(['/tickets', i.key]);
  }

  protected quickCreate(statusId: string) {
    this.newStatus.set(statusId);
    this.formOpen.set(true);
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
