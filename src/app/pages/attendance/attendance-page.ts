import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DataStore } from '../../core/data-store';
import {
  ATTENDANCE_META,
  type AttendanceDay,
  type DateKey,
  LEAVE_TYPES,
  type LeaveRequest,
  REQUEST_STATUS_META,
  type RegularisationRequest,
  addDateKey,
  daysIn,
  fromDateKey,
  hours,
  isWeekend,
  leaveDays,
  timeOf,
  toDateKey,
} from '../../core/external';
import { ExternalStore, type Keyed } from '../../core/external-store';
import type { ID, User } from '../../core/models';
import { startOfWeek } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { CorrectionForm, LeaveForm } from './request-dialogs';
import { ReadablePipe } from '../../shared/readable';

type Tab = 'attendance' | 'productivity' | 'requests';

interface ProdRow {
  user: User;
  attended: number;
  laptop: number;
  active: number;
  productive: number;
  idle: number;
  logged: number;
  /** productive / laptop time, 0–100 */
  pct: number | null;
  flag?: 'over' | 'under';
}

type Req =
  | { kind: 'leave'; req: Keyed<LeaveRequest>; user?: User; sortKey: string }
  | { kind: 'regularisation'; req: Keyed<RegularisationRequest>; user?: User; sortKey: string };

/**
 * Step 15: attendance (punches, leave, corrections) and laptop productivity, pulled from external systems through the
 * adapters in `core/external*.ts`, side by side with the hours people log in nPro.
 */
@Component({
  selector: 'app-attendance-page',
  imports: [ReadablePipe, Avatar, DatePipe, Icon, PageHeader, RouterLink, LeaveForm, CorrectionForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance-page.html',
})
export class AttendancePage {
  protected readonly store = inject(DataStore);
  protected readonly ext = inject(ExternalStore);
  protected readonly meta = ATTENDANCE_META;
  protected readonly statusMeta = REQUEST_STATUS_META;
  protected readonly hours = hours;
  protected readonly timeOf = timeOf;
  protected readonly leaveDays = leaveDays;

  protected readonly tab = signal<Tab>(this.initialTab());
  protected readonly weekStart = signal(toDateKey(startOfWeek(new Date(this.ext.clock()))));
  protected readonly today = toDateKey(new Date(this.ext.clock()));
  /** Day shown in the tiles and the phone list */
  protected readonly day = signal(this.today);
  protected readonly teamFilter = signal('');
  protected readonly query = signal('');

  // Requests tab
  protected readonly reqScope = signal<'mine' | 'approve' | 'all'>('all');
  protected readonly pendingOnly = signal(true);

  // Dialogs
  protected readonly leaveOpen = signal(false);
  protected readonly correctionOpen = signal(false);
  protected readonly correctionDay = signal<string | undefined>(undefined);
  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected readonly canSetup = computed(() => this.store.canDo('organisation'));
  protected readonly me = computed(() => this.store.currentUser());
  protected readonly tracked = computed(() => this.ext.visibleUserIds().has(this.me().id));

  constructor() {
    // Re-fetch whenever the week changes (or the connector settings do)
    effect(() => {
      const from = this.weekStart();
      this.ext.sourceKey();
      untracked(() => void this.ext.load({ from, to: addDateKey(from, 6) }));
    });
    this.reqScope.set(this.approvees().length ? 'approve' : 'mine');
  }

  private initialTab(): Tab {
    const t = inject(ActivatedRoute).snapshot.queryParamMap.get('tab');
    return t === 'productivity' || t === 'requests' ? t : 'attendance';
  }

  // ---------- Week ----------

  protected readonly days = computed(() => daysIn({ from: this.weekStart(), to: addDateKey(this.weekStart(), 6) }));
  protected readonly isThisWeek = computed(() => this.days().includes(this.today));
  protected readonly weekLabel = computed(() => {
    const a = fromDateKey(this.weekStart());
    const b = fromDateKey(addDateKey(this.weekStart(), 6));
    const f = (d: Date, year = false) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) });
    return `${f(a)} – ${f(b, true)}`;
  });

  protected shiftWeek(n: number) {
    const next = addDateKey(this.weekStart(), n * 7);
    this.weekStart.set(next);
    this.day.set(daysIn({ from: next, to: addDateKey(next, 6) }).includes(this.today) ? this.today : next);
  }

  protected thisWeek() {
    this.weekStart.set(toDateKey(startOfWeek(new Date(this.ext.clock()))));
    this.day.set(this.today);
  }

  protected dayName(k: DateKey) {
    return fromDateKey(k).toLocaleDateString(undefined, { weekday: 'short' });
  }

  protected dayNum(k: DateKey) {
    return fromDateKey(k).getDate();
  }

  protected isWeekend = isWeekend;

  // ---------- People ----------

  protected readonly teams = computed(() => {
    const ids = new Set(this.ext.visibleUsers().map((u) => u.teamId).filter(Boolean));
    return this.store.teams().filter((t) => ids.has(t.id));
  });

  protected readonly people = computed(() => {
    const q = this.query().trim().toLowerCase();
    const team = this.teamFilter();
    const me = this.me().id;
    return this.ext
      .visibleUsers()
      .filter((u) => !team || u.teamId === team)
      .filter((u) => !q || u.name.toLowerCase().includes(q))
      .sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : a.name.localeCompare(b.name)));
  });

  protected teamName(u: User) {
    return this.store.teamById(u.teamId)?.name ?? (u.vendorId ? this.store.vendorById(u.vendorId)?.name : '') ?? '';
  }

  // ---------- Attendance ----------

  protected cell(u: User, k: DateKey) {
    return this.ext.dayOf(u.id, k);
  }

  /** Pending leave that covers a day (shown faintly) */
  protected pendingLeave(u: User, k: DateKey) {
    return this.ext.leaves().find((l) => l.userId === u.id && l.status === 'pending' && l.from <= k && l.to >= k && !isWeekend(k));
  }

  /** Approved leave in the future (attendance has no record yet) */
  protected plannedLeave(u: User, k: DateKey) {
    if (k <= this.today || isWeekend(k)) return undefined;
    return this.ext.leaves().find((l) => l.userId === u.id && l.status === 'approved' && l.from <= k && l.to >= k);
  }

  protected pendingCorrection(u: User, k: DateKey) {
    return this.ext.regularisations().some((g) => g.userId === u.id && g.date === k && g.status === 'pending');
  }

  protected leaveLabel(type?: string) {
    return LEAVE_TYPES.find((t) => t.id === type)?.label.replace(' leave', '') ?? 'Leave';
  }

  /** Attended minutes in the week per person */
  protected weekTotal(u: User) {
    return this.days().reduce((s, k) => s + (this.cell(u, k)?.workedMinutes ?? 0), 0);
  }

  protected cellTitle(a: AttendanceDay | undefined) {
    if (!a) return '';
    const parts = [this.meta[a.status].label];
    if (a.punchIn) parts.push(`in ${timeOf(a.punchIn)}`);
    if (a.punchOut) parts.push(`out ${timeOf(a.punchOut)}`);
    if (a.late) parts.push('late');
    if (a.regularised) parts.push('corrected');
    return parts.join(' · ');
  }

  /** Tiles for the selected day */
  protected readonly dayStats = computed(() => {
    const k = this.day();
    const rows = this.people().map((u) => this.cell(u, k));
    const count = (fn: (a: AttendanceDay | undefined) => boolean) => rows.filter(fn).length;
    const weekend = isWeekend(k);
    return {
      weekend,
      future: k > this.today,
      present: count((a) => !!a?.punchIn && a.status !== 'leave'),
      leave: count((a) => a?.status === 'leave' || a?.status === 'half_day') + (k > this.today ? this.people().filter((u) => this.plannedLeave(u, k)).length : 0),
      notIn: weekend || k > this.today ? 0 : count((a) => !a || a.status === 'absent'),
      late: count((a) => !!a?.late),
      missed: count((a) => a?.status === 'missed_punch'),
    };
  });

  protected openCorrection(k?: DateKey) {
    this.correctionDay.set(k);
    this.correctionOpen.set(true);
  }

  // ---------- Productivity ----------

  protected readonly prodRows = computed<ProdRow[]>(() => {
    const days = new Set(this.days());
    const from = fromDateKey(this.weekStart());
    const to = fromDateKey(addDateKey(this.weekStart(), 7));
    this.store.workLogs();
    return this.people().map((u) => {
      const prod = this.ext.productivity().filter((p) => p.userId === u.id && days.has(p.date));
      const active = prod.reduce((s, p) => s + p.activeMinutes, 0);
      const productive = prod.reduce((s, p) => s + p.productiveMinutes, 0);
      const idle = prod.reduce((s, p) => s + p.idleMinutes, 0);
      const logged = this.store.workLogsBetween(from, to, u.id).reduce((s, w) => s + w.minutes, 0);
      const laptop = active + idle;
      const flag = productive && logged > productive + 60 ? 'over' : productive >= 240 && logged < productive * 0.5 ? 'under' : undefined;
      return { user: u, attended: this.weekTotal(u), laptop, active, productive, idle, logged, pct: laptop ? Math.round((productive / laptop) * 100) : null, flag };
    });
  });

  protected readonly prodTotals = computed(() => {
    const rows = this.prodRows();
    const sum = (k: 'attended' | 'laptop' | 'active' | 'productive' | 'idle' | 'logged') => rows.reduce((s, r) => s + r[k], 0);
    const laptop = sum('laptop');
    return { attended: sum('attended'), laptop, active: sum('active'), productive: sum('productive'), idle: sum('idle'), logged: sum('logged'), pct: laptop ? Math.round((sum('productive') / laptop) * 100) : null };
  });

  /** Bar scale: the longest of attended / laptop / logged among the rows */
  protected readonly prodMax = computed(() => Math.max(60, ...this.prodRows().flatMap((r) => [r.attended, r.laptop, r.logged])));

  protected pctOf(v: number) {
    return `${(v / this.prodMax()) * 100}%`;
  }

  // ---------- Requests ----------

  protected readonly approvees = computed(() => this.ext.visibleUsers().filter((u) => this.ext.canApprove(u.id)));

  private readonly allRequests = computed<Req[]>(() => {
    const visible = this.ext.visibleUserIds();
    const me = this.me().id;
    const list: Req[] = [
      ...this.ext.leaves().map((req) => ({ kind: 'leave' as const, req, user: this.store.userById(req.userId), sortKey: req.appliedAt })),
      ...this.ext.regularisations().map((req) => ({ kind: 'regularisation' as const, req, user: this.store.userById(req.userId), sortKey: req.appliedAt })),
    ];
    return list.filter((r) => visible.has(r.req.userId) || r.req.userId === me).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  });

  protected readonly pendingForMe = computed(() => this.allRequests().filter((r) => r.req.status === 'pending' && this.ext.canApprove(r.req.userId)).length);

  protected readonly requests = computed(() => {
    const me = this.me().id;
    const scope = this.reqScope();
    return this.allRequests()
      .filter((r) => !this.pendingOnly() || r.req.status === 'pending')
      .filter((r) => scope === 'all' || (scope === 'mine' ? r.req.userId === me : this.ext.canApprove(r.req.userId)));
  });

  protected readonly myBalance = computed(() => this.ext.balanceOf(this.me().id));

  protected leaveRange(l: LeaveRequest) {
    const f = (k: DateKey) => fromDateKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return l.from === l.to ? f(l.from) : `${f(l.from)} – ${f(l.to)}`;
  }

  protected dateLabel(k: DateKey) {
    return fromDateKey(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  protected deciderName(by?: string) {
    return this.ext.userOfEmployee(by)?.name ?? by ?? '';
  }

  protected async decide(r: Req, decision: 'approved' | 'rejected') {
    try {
      await this.ext.decide(r.kind, r.req, decision);
      this.showToast(`${r.user?.name ?? 'Request'}: ${r.kind === 'leave' ? 'leave' : 'correction'} ${decision}`);
    } catch (err) {
      this.showToast((err as Error).message);
    }
  }

  protected async withdraw(r: Req) {
    try {
      await this.ext.cancel(r.kind, r.req);
      this.showToast('Request withdrawn');
    } catch (err) {
      this.showToast((err as Error).message);
    }
  }

  protected isMine(id: ID) {
    return id === this.me().id;
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
