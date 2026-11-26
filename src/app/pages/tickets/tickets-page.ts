import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/data-store';
import type { Issue, WorkflowStatus } from '../../core/models';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { ISSUE_TYPES, PRIORITIES, priorityOf, tint, typeOf } from './ticket-meta';
import { TicketForm } from './ticket-form';
import { ReadablePipe } from '../../shared/readable';

type SortKey = 'updated' | 'created' | 'priority' | 'due';

@Component({
  selector: 'app-tickets-page',
  imports: [ReadablePipe, DatePipe, RouterLink, Avatar, Icon, Modal, PageHeader, TicketForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tickets-page.html',
})
export class TicketsPage {
  /** Optional ?product=<id> query param (e.g. from a product card) */
  readonly product = input<string | undefined>();
  /** Optional ?client=<id> query param (e.g. from the Clients page) */
  readonly client = input<string | undefined>();
  /** Optional ?assignee=<id|me|none> query param (e.g. from global search or the dashboard) */
  readonly assignee = input<string | undefined>();
  /** Optional ?q=<text> query param (global search "All tickets matching") */
  readonly q = input<string | undefined>();

  protected readonly store = inject(DataStore);
  protected readonly types = ISSUE_TYPES;
  protected readonly priorities = PRIORITIES;
  protected readonly typeOf = typeOf;
  protected readonly priorityOf = priorityOf;
  protected readonly tint = tint;

  // Filters
  protected readonly query = signal('');
  protected readonly productFilter = signal('');
  protected readonly clientFilter = signal('');
  protected readonly statusFilter = signal('');
  protected readonly assigneeFilter = signal(''); // '' all · 'me' · 'none' · user id
  protected readonly priorityFilter = signal('');
  protected readonly typeFilter = signal('');
  protected readonly sort = signal<SortKey>('updated');

  // Dialog / menu state
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Issue | undefined>(undefined);
  protected readonly deleting = signal<Issue | undefined>(undefined);
  protected readonly menuFor = signal<string | null>(null);
  protected readonly menuPos = signal({ top: 0, left: 0 });
  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const p = this.product();
      untracked(() => this.productFilter.set(p ?? ''));
    });
    effect(() => {
      const c = this.client();
      untracked(() => this.clientFilter.set(c ?? ''));
    });
    effect(() => {
      const a = this.assignee();
      untracked(() => this.assigneeFilter.set(a ?? ''));
    });
    effect(() => {
      const q = this.q();
      untracked(() => this.query.set(q ?? ''));
    });
  }

  /** All statuses across workflows, in workflow order */
  protected readonly statuses = computed(() => {
    const seen = new Map<string, WorkflowStatus>();
    for (const w of this.store.workflows()) for (const s of w.statuses) if (!seen.has(s.id)) seen.set(s.id, s);
    return [...seen.values()];
  });

  /** Comment and attachment counts per ticket, for the row badges */
  private readonly counts = computed(() => {
    const c: Record<string, { comments: number; files: number }> = {};
    for (const x of this.store.comments()) (c[x.issueId] ??= { comments: 0, files: 0 }).comments++;
    for (const x of this.store.attachments()) (c[x.issueId] ??= { comments: 0, files: 0 }).files++;
    return c;
  });

  /** Tickets matching every filter except status (so the status counts stay useful) */
  private readonly baseFiltered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const me = this.store.currentUser().id;
    const archived = new Set(this.store.products().filter((p) => p.archived).map((p) => p.id));
    return this.store.issues().filter((i) => {
      if (this.productFilter() ? i.productId !== this.productFilter() : archived.has(i.productId)) return false;
      if (this.clientFilter() && i.clientId !== this.clientFilter()) return false;
      if (this.priorityFilter() && i.priority !== this.priorityFilter()) return false;
      if (this.typeFilter() && i.type !== this.typeFilter()) return false;
      const a = this.assigneeFilter();
      if (a === 'me' && i.assigneeId !== me) return false;
      if (a === 'none' && i.assigneeId) return false;
      if (a && a !== 'me' && a !== 'none' && i.assigneeId !== a) return false;
      if (q && !i.key.toLowerCase().includes(q) && !i.summary.toLowerCase().includes(q) && !i.labels.some((l) => l.toLowerCase().includes(q))) return false;
      return true;
    });
  });

  /** Tickets matching the filters, all statuses (for the "All" chip) */
  protected readonly baseCount = computed(() => this.baseFiltered().length);

  protected readonly statusCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const i of this.baseFiltered()) counts[i.statusId] = (counts[i.statusId] ?? 0) + 1;
    return counts;
  });

  protected readonly visible = computed(() => {
    const list = this.baseFiltered().filter((i) => !this.statusFilter() || i.statusId === this.statusFilter());
    const by: Record<SortKey, (a: Issue, b: Issue) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      priority: (a, b) => priorityOf(b.priority).rank - priorityOf(a.priority).rank || b.updatedAt.localeCompare(a.updatedAt),
      due: (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
    };
    return [...list].sort(by[this.sort()]);
  });

  protected readonly hasFilters = computed(
    () => !!(this.query() || this.productFilter() || this.clientFilter() || this.statusFilter() || this.assigneeFilter() || this.priorityFilter() || this.typeFilter()),
  );

  protected clearFilters() {
    this.query.set('');
    this.productFilter.set('');
    this.clientFilter.set('');
    this.statusFilter.set('');
    this.assigneeFilter.set('');
    this.priorityFilter.set('');
    this.typeFilter.set('');
  }

  protected productOf(i: Issue) {
    return this.store.products().find((p) => p.id === i.productId);
  }

  protected parentOf(i: Issue) {
    return i.parentId ? this.store.issues().find((x) => x.id === i.parentId) : undefined;
  }

  protected countsOf(i: Issue) {
    return this.counts()[i.id] ?? { comments: 0, files: 0 };
  }

  protected sprintOf(i: Issue) {
    return this.store.sprintById(i.sprintId);
  }

  protected clientName(i: Issue) {
    return this.store.clients().find((c) => c.id === i.clientId)?.name;
  }

  protected statusOf(i: Issue) {
    const s = this.store.workflowFor(i.productId).statuses.find((x) => x.id === i.statusId);
    return { name: s?.name ?? i.statusId, color: s?.color ?? '#64748b' };
  }

  protected isOverdue(i: Issue) {
    const cat = this.store.workflowFor(i.productId).statuses.find((x) => x.id === i.statusId)?.category;
    return !!i.dueDate && cat !== 'done' && new Date(i.dueDate) < new Date(new Date().toDateString());
  }

  protected value(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected setStatus(i: Issue, e: Event) {
    const statusId = this.value(e);
    this.store.updateIssue(i.id, { statusId });
    this.showToast(`${i.key} moved to ${this.statusOf({ ...i, statusId }).name}`);
  }

  protected toggleStatusFilter(id: string) {
    this.statusFilter.set(this.statusFilter() === id ? '' : id);
  }

  /** Opens the row menu as a fixed overlay so nothing clips it. */
  protected toggleMenu(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (this.menuFor() === id) return this.menuFor.set(null);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuW = 160;
    const menuH = 104;
    const top = r.bottom + 4 + menuH > window.innerHeight ? r.top - menuH - 4 : r.bottom + 4;
    this.menuPos.set({ top, left: Math.max(8, r.right - menuW) });
    this.menuFor.set(id);
  }

  protected menuIssue() {
    return this.store.issues().find((i) => i.id === this.menuFor());
  }

  protected openCreate() {
    this.editing.set(undefined);
    this.formOpen.set(true);
  }

  protected openEdit(i: Issue) {
    this.editing.set(i);
    this.formOpen.set(true);
    this.menuFor.set(null);
  }

  protected askDelete(i: Issue) {
    this.deleting.set(i);
    this.menuFor.set(null);
  }

  protected confirmDelete() {
    const i = this.deleting();
    if (i) {
      this.store.deleteIssue(i.id);
      this.showToast(`${i.key} deleted`);
    }
    this.deleting.set(undefined);
  }

  protected onSaved(msg: string) {
    this.showToast(msg);
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
