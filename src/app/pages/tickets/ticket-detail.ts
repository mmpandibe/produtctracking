import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { DataStore, formatMinutes } from '../../core/data-store';
import type { Activity, Issue } from '../../core/models';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { AttachmentsPanel } from './panels/attachments-panel';
import { CommentsPanel } from './panels/comments-panel';
import { TimeLogPanel } from './panels/time-log-panel';
import { TicketForm } from './ticket-form';
import { activityOf, priorityOf, tint, typeOf } from './ticket-meta';
import { formatFieldValue } from '../workflows/workflow-meta';
import { CLOCK_COLORS, CLOCK_LABELS, clockLabel, formatDuration, levelOf, nextLevel } from '../../core/sla';
import { ReadablePipe } from '../../shared/readable';

type Tab = 'comments' | 'time' | 'files' | 'history';

/** Step 3: full page for one ticket, at /tickets/:key */
@Component({
  selector: 'app-ticket-detail',
  imports: [ReadablePipe, DatePipe, RouterLink, Avatar, Icon, Modal, TicketForm, AttachmentsPanel, CommentsPanel, TimeLogPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-detail.html',
})
export class TicketDetail {
  /** Route param, e.g. "WEB-2" */
  readonly key = input.required<string>();

  protected readonly store = inject(DataStore);
  private readonly router = inject(Router);
  protected readonly typeOf = typeOf;
  protected readonly priorityOf = priorityOf;
  protected readonly activityOf = activityOf;
  protected readonly tint = tint;
  protected readonly fmt = formatMinutes;

  protected readonly tab = signal<Tab>('comments');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Issue | undefined>(undefined);
  protected readonly childParent = signal<string | undefined>(undefined);
  protected readonly confirmDelete = signal(false);
  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected readonly issue = computed(() => this.store.issues().find((i) => i.key.toUpperCase() === this.key().toUpperCase()));
  protected readonly product = computed(() => this.store.products().find((p) => p.id === this.issue()?.productId));
  /** Role rights on this ticket (Step 12): production users follow and comment, staff work on it */
  protected readonly canEdit = computed(() => !!this.issue() && this.store.canEditIssue(this.issue()!));
  protected readonly canDelete = computed(() => !!this.issue() && this.store.canDeleteIssue(this.issue()!));
  protected readonly canTime = computed(() => this.canEdit() && this.store.canDo('time'));
  /** The ticket exists but is outside what the signed-in person may see */
  protected readonly noAccess = computed(() => !this.issue() && this.store.issueKeyExists(this.key()));
  // ---- SLA (Step 13) ----
  protected readonly clockColors = CLOCK_COLORS;
  protected readonly clockLabels = CLOCK_LABELS;
  protected readonly clockLabel = clockLabel;
  protected readonly dur = formatDuration;
  protected readonly levelOf = levelOf;
  /** Ticks every 30 s so the clocks stay current */
  private readonly now = signal(Date.now());
  private readonly ticker = (() => {
    const handle = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(handle));
    return handle;
  })();
  protected readonly sla = computed(() => {
    const i = this.issue();
    this.store.slaPolicies();
    return i ? this.store.slaOf(i, this.now()) : undefined;
  });
  protected readonly nextLevel = computed(() => {
    const l = this.issue()?.supportLevel;
    return l ? nextLevel(l) : undefined;
  });
  protected readonly escalateOpen = signal(false);
  protected readonly escalateReason = signal('');

  protected escalate() {
    const i = this.issue();
    if (!i) return;
    try {
      const to = this.store.escalate(i.id, this.escalateReason());
      this.showToast(`Escalated to ${to.toUpperCase()}`);
    } catch (err) {
      this.showToast((err as Error).message);
    }
    this.escalateOpen.set(false);
    this.escalateReason.set('');
  }

  protected readonly backLink = computed(() => (this.store.currentUser().role === 'production_user' ? '/my-requests' : '/tickets'));
  protected readonly status = computed(() => {
    const i = this.issue();
    return i ? this.store.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId) : undefined;
  });
  protected readonly statuses = computed(() => this.store.workflowFor(this.issue()?.productId).statuses);
  /** Current status plus the moves the workflow allows */
  protected readonly allowedStatuses = computed(() => {
    const i = this.issue();
    return i ? this.store.allowedStatuses(i) : [];
  });
  /** Custom fields of the ticket's product, with display values */
  protected readonly customFields = computed(() => {
    const i = this.issue();
    if (!i) return [];
    this.store.customFields();
    return this.store.customFieldsFor(i.productId).map((f) => ({ field: f, text: formatFieldValue(f, i.customFields[f.id]) }));
  });
  protected readonly parent = computed(() => this.store.issues().find((x) => x.id === this.issue()?.parentId));
  protected readonly children = computed(() => {
    const id = this.issue()?.id;
    return id ? this.store.issues().filter((x) => x.parentId === id) : [];
  });
  protected readonly sprint = computed(() => this.store.sprintById(this.issue()?.sprintId));
  protected readonly client = computed(() => this.store.clients().find((c) => c.id === this.issue()?.clientId));
  protected readonly logged = computed(() => {
    const id = this.issue()?.id;
    return this.store.workLogs().reduce((s, w) => (w.issueId === id ? s + w.minutes : s), 0);
  });
  /** Hours split by activity (Analysis, Design, Development, Testing, Demo/Meeting, Documentation) */
  protected readonly byActivity = computed(() => {
    const id = this.issue()?.id;
    const totals = new Map<string, number>();
    for (const w of this.store.workLogs()) if (w.issueId === id) totals.set(w.activity, (totals.get(w.activity) ?? 0) + w.minutes);
    return [...totals.entries()].map(([a, minutes]) => ({ ...activityOf(a as never), minutes })).sort((a, b) => b.minutes - a.minutes);
  });
  protected readonly history = computed(() => {
    const id = this.issue()?.id;
    return id ? this.store.activities().filter((a) => a.issueId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  });
  protected readonly counts = computed(() => {
    const id = this.issue()?.id;
    return {
      comments: this.store.comments().filter((c) => c.issueId === id).length,
      time: this.store.workLogs().filter((w) => w.issueId === id).length,
      files: this.store.attachments().filter((a) => a.issueId === id).length,
      history: this.history().length,
    };
  });
  protected readonly timerHere = computed(() => this.store.activeTimer()?.issueId === this.issue()?.id);
  protected readonly overdue = computed(() => {
    const i = this.issue();
    return !!i?.dueDate && this.status()?.category !== 'done' && new Date(i.dueDate) < new Date(new Date().toDateString());
  });

  protected statusOf(i: Issue) {
    return this.store.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId);
  }

  protected userName(id?: string) {
    return this.store.userById(id)?.name ?? 'Someone';
  }

  /** Plain-language line for a history entry */
  protected describe(a: Activity) {
    switch (a.action) {
      case 'changed status':
        return `changed status from ${a.from ?? '—'} to ${a.to ?? '—'}`;
      case 'updated':
        return `updated ${a.to}`;
      case 'logged':
        return `logged ${a.to}`;
      case 'attached':
        return `attached ${a.to}`;
      case 'created ticket':
        return `created ${a.to}`;
      default:
        return a.action + (a.to ? ` ${a.to}` : '');
    }
  }

  protected setStatus(e: Event) {
    const i = this.issue();
    if (!i) return;
    const statusId = (e.target as HTMLSelectElement).value;
    this.store.updateIssue(i.id, { statusId });
    this.showToast(`Moved to ${this.statuses().find((s) => s.id === statusId)?.name}`);
  }

  protected toggleTimer() {
    const i = this.issue();
    if (!i) return;
    if (this.timerHere()) {
      const log = this.store.stopTimer();
      if (log) this.showToast(`Logged ${formatMinutes(log.minutes)}`);
    } else {
      this.store.startTimer(i.id, 'development');
      this.tab.set('time');
      this.showToast('Timer started (Development) — change the activity in Log hours');
    }
  }

  protected edit() {
    this.editing.set(this.issue());
    this.childParent.set(undefined);
    this.formOpen.set(true);
  }

  protected addChild() {
    this.editing.set(undefined);
    this.childParent.set(this.issue()?.id);
    this.formOpen.set(true);
  }

  protected deleteTicket() {
    const i = this.issue();
    if (!i) return;
    this.store.deleteIssue(i.id);
    this.confirmDelete.set(false);
    void this.router.navigate(['/tickets']);
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
