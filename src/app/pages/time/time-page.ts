import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataStore, formatMinutes } from '../../core/data-store';
import type { Issue, User, WorkLog } from '../../core/models';
import { addDays, dayKey, startOfWeek } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { WORK_ACTIVITIES, activityOf, tint, typeOf } from '../tickets/ticket-meta';
import { LogTimeDialog } from './log-time-dialog';
import { ReadablePipe } from '../../shared/readable';

/** Hours a person is expected to log per week */
const WEEKLY_TARGET_MIN = 40 * 60;

interface TicketRow {
  issue: Issue;
  perDay: number[];
  total: number;
}
interface PersonRow {
  user: User;
  perDay: number[];
  total: number;
}

/** Step 6: weekly timesheet per person (or the whole team), with summaries and an entry list. */
@Component({
  selector: 'app-time-page',
  imports: [ReadablePipe, DatePipe, RouterLink, Avatar, Icon, PageHeader, LogTimeDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-page.html',
})
export class TimePage {
  protected readonly store = inject(DataStore);
  protected readonly fmt = formatMinutes;
  protected readonly typeOf = typeOf;
  protected readonly tint = tint;
  protected readonly activityOf = activityOf;
  protected readonly todayKey = dayKey(new Date());

  protected readonly weekStart = signal(startOfWeek(new Date()));
  /** A user id, or 'all' for the team view */
  protected readonly person = signal(this.store.currentUser().id);
  /** People whose time the signed-in role may see: only yourself for developers and testers (Step 12) */
  protected readonly people = computed(() =>
    this.store.access().ownTimeOnly ? [this.store.currentUser()] : this.store.users().filter((u) => u.role !== 'production_user'),
  );
  protected readonly tab = signal<'sheet' | 'list'>('sheet');
  /** Tickets added to this week's sheet that have no time yet */
  protected readonly extraRows = signal<string[]>([]);

  // Log-time dialog
  protected readonly dialogOpen = signal(false);
  protected readonly dialogIssue = signal<string | undefined>(undefined);
  protected readonly dialogDay = signal<string | undefined>(undefined);
  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected readonly days = computed(() => Array.from({ length: 7 }, (_, i) => addDays(this.weekStart(), i)));
  protected readonly dayKeys = computed(() => this.days().map(dayKey));
  protected readonly isThisWeek = computed(() => dayKey(this.weekStart()) === dayKey(startOfWeek(new Date())));
  protected readonly isTeam = computed(() => this.person() === 'all');
  protected readonly personUser = computed(() => this.store.userById(this.person()));

  /** Logs in the selected week (for the person, or everyone) */
  protected readonly logs = computed(() => {
    this.store.workLogs(); // re-run when logs change
    const p = this.person();
    return this.store.workLogsBetween(this.weekStart(), addDays(this.weekStart(), 7), p === 'all' ? undefined : p).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  });

  private perDay(logs: WorkLog[]) {
    const keys = this.dayKeys();
    const arr = [0, 0, 0, 0, 0, 0, 0];
    for (const w of logs) {
      const idx = keys.indexOf(dayKey(w.startedAt));
      if (idx >= 0) arr[idx]! += w.minutes;
    }
    return arr;
  }

  protected readonly ticketRows = computed<TicketRow[]>(() => {
    if (this.isTeam()) return [];
    const byIssue = new Map<string, WorkLog[]>();
    for (const w of this.logs()) (byIssue.get(w.issueId) ?? byIssue.set(w.issueId, []).get(w.issueId)!).push(w);
    for (const id of this.extraRows()) if (!byIssue.has(id)) byIssue.set(id, []);
    return [...byIssue.entries()]
      .map(([id, logs]) => ({ issue: this.store.issues().find((i) => i.id === id)!, perDay: this.perDay(logs), total: logs.reduce((s, w) => s + w.minutes, 0) }))
      .filter((r) => r.issue)
      .sort((a, b) => a.issue.key.localeCompare(b.issue.key, undefined, { numeric: true }));
  });

  protected readonly personRows = computed<PersonRow[]>(() => {
    if (!this.isTeam()) return [];
    return this.people().map((user) => {
      const mine = this.logs().filter((w) => w.userId === user.id);
      return { user, perDay: this.perDay(mine), total: mine.reduce((s, w) => s + w.minutes, 0) };
    });
  });

  protected readonly dayTotals = computed(() => this.perDay(this.logs()));
  protected readonly weekTotal = computed(() => this.logs().reduce((s, w) => s + w.minutes, 0));
  protected readonly target = computed(() => (this.isTeam() ? WEEKLY_TARGET_MIN * this.people().length : WEEKLY_TARGET_MIN));
  protected readonly targetPct = computed(() => Math.round((this.weekTotal() / this.target()) * 100));

  protected readonly byActivity = computed(() => {
    const total = this.weekTotal() || 1;
    return WORK_ACTIVITIES.map((a) => {
      const minutes = this.logs().filter((w) => w.activity === a.id).reduce((s, w) => s + w.minutes, 0);
      return { ...a, minutes, pct: (minutes / total) * 100 };
    });
  });

  protected readonly byProduct = computed(() => {
    const total = this.weekTotal() || 1;
    const map = new Map<string, number>();
    for (const w of this.logs()) {
      const pid = this.store.issues().find((i) => i.id === w.issueId)?.productId;
      if (pid) map.set(pid, (map.get(pid) ?? 0) + w.minutes);
    }
    return [...map.entries()]
      .map(([pid, minutes]) => ({ product: this.store.products().find((p) => p.id === pid)!, minutes, pct: (minutes / total) * 100 }))
      .filter((x) => x.product)
      .sort((a, b) => b.minutes - a.minutes);
  });

  /** Tickets that can be added as a new row (assigned to the person first) */
  protected readonly addable = computed(() => {
    const onSheet = new Set(this.ticketRows().map((r) => r.issue.id));
    const me = this.person();
    const archived = new Set(this.store.products().filter((p) => p.archived).map((p) => p.id));
    return this.store
      .issues()
      .filter((i) => !onSheet.has(i.id) && !archived.has(i.productId))
      .sort((a, b) => Number(b.assigneeId === me) - Number(a.assigneeId === me) || a.key.localeCompare(b.key, undefined, { numeric: true }));
  });

  /** Grid cell text: hours ("2.5"), minutes for tiny amounts ("5m"), or "" when nothing is logged */
  protected hrs(min: number) {
    if (!min) return '';
    return min < 15 ? `${min}m` : String(+(min / 60).toFixed(2));
  }

  protected isWeekend(i: number) {
    return i >= 5;
  }

  protected shiftWeek(n: number) {
    this.weekStart.set(addDays(this.weekStart(), n * 7));
    this.extraRows.set([]);
  }

  protected thisWeek() {
    this.weekStart.set(startOfWeek(new Date()));
    this.extraRows.set([]);
  }

  protected setPerson(id: string) {
    this.person.set(id);
    this.extraRows.set([]);
  }

  protected addRow(id: string) {
    if (id) this.extraRows.update((rows) => [...rows, id]);
  }

  protected openCell(issueId: string, dayIdx: number) {
    this.dialogIssue.set(issueId);
    this.dialogDay.set(this.dayKeys()[dayIdx]);
    this.dialogOpen.set(true);
  }

  protected logTime() {
    this.dialogIssue.set(undefined);
    this.dialogDay.set(undefined);
    this.dialogOpen.set(true);
  }

  protected issueOf(w: WorkLog) {
    return this.store.issues().find((i) => i.id === w.issueId);
  }

  protected deleteLog(w: WorkLog) {
    this.store.deleteWorkLog(w.id);
    this.showToast('Entry deleted');
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
