import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/data-store';
import { ATTENDANCE_META, LEAVE_TYPES, REQUEST_STATUS_META, addDateKey, daysIn, fromDateKey, hours, isWeekend, timeOf, toDateKey } from '../../core/external';
import { ExternalStore } from '../../core/external-store';
import type { Issue, StatusCategory, User } from '../../core/models';
import { CATEGORY_COLORS, CATEGORY_LABELS, NEUTRAL, SERIES, isOverdue } from '../../core/reports';
import { CLOCK_COLORS, levelOf } from '../../core/sla';
import { startOfWeek } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { type BarSeries, BarChart } from '../../shared/charts/bar-chart';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { CorrectionForm, LeaveForm } from '../attendance/request-dialogs';
import { priorityOf, typeOf } from '../tickets/ticket-meta';
import { ReadablePipe } from '../../shared/readable';

/** Hours a person is expected to log per week (same as the timesheet) */
const WEEKLY_TARGET_MIN = 40 * 60;
const DAY_MS = 86_400_000;

type View = 'me' | 'team';

/**
 * Step 16: developer dashboard ("My day": my tickets, logged vs productive vs attended hours, leave, my SLA tickets)
 * and manager dashboard ("My team": attendance today, hours per person, workload, SLA breaches, sprints, approvals).
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [ReadablePipe, Avatar, BarChart, Icon, PageHeader, RouterLink, LeaveForm, CorrectionForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  protected readonly store = inject(DataStore);
  protected readonly ext = inject(ExternalStore);
  protected readonly hours = hours;
  protected readonly timeOf = timeOf;
  protected readonly typeOf = typeOf;
  protected readonly priorityOf = priorityOf;
  protected readonly levelOf = levelOf;
  protected readonly clockColors = CLOCK_COLORS;
  protected readonly attMeta = ATTENDANCE_META;
  protected readonly reqMeta = REQUEST_STATUS_META;

  protected readonly me = computed(() => this.store.currentUser());
  /** Managers get a team view: anyone who can see other people's time */
  protected readonly canTeam = computed(() => this.ext.visibleUsers().filter((u) => u.id !== this.me().id).length > 0);
  protected readonly view = signal<View>(['admin', 'division_head', 'assistant_manager'].includes(this.store.currentUser().role) ? 'team' : 'me');
  protected readonly activeView = computed<View>(() => (this.canTeam() ? this.view() : 'me'));

  protected readonly now = signal(this.ext.clock());
  protected readonly today = computed(() => toDateKey(new Date(this.now())));
  protected readonly weekFrom = computed(() => toDateKey(startOfWeek(new Date(this.now()))));
  protected readonly weekDays = computed(() => daysIn({ from: this.weekFrom(), to: addDateKey(this.weekFrom(), 6) }));

  protected readonly leaveOpen = signal(false);
  protected readonly correctionOpen = signal(false);
  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const from = this.weekFrom();
      this.ext.sourceKey();
      untracked(() => void this.ext.load({ from, to: addDateKey(from, 6) }));
    });
    // Clocks and "working for" refresh every minute
    const handle = setInterval(() => this.now.set(this.ext.clock()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(handle));
  }

  protected readonly greeting = computed(() => {
    const h = new Date(this.now()).getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  });

  protected readonly dateLabel = computed(() => new Date(this.now()).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));

  // ---------- Shared helpers ----------

  private category(i: Issue): StatusCategory {
    return this.store.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId)?.category ?? 'todo';
  }

  protected status(i: Issue) {
    return this.store.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId);
  }

  protected product(i: Issue) {
    return this.store.products().find((p) => p.id === i.productId);
  }

  private readonly openIssues = computed(() => this.store.issues().filter((i) => this.category(i) !== 'done'));

  protected dueLabel(i: Issue) {
    if (!i.dueDate) return '';
    const days = Math.round((fromDateKey(toDateKey(new Date(i.dueDate))).getTime() - fromDateKey(this.today()).getTime()) / DAY_MS);
    if (days < 0) return `${-days}d overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days}d`;
  }

  protected isLate(i: Issue) {
    return isOverdue(i, this.category(i), new Date(this.now()));
  }

  // ---------- My view ----------

  protected readonly myOpen = computed(() => {
    const me = this.me().id;
    return this.openIssues()
      .filter((i) => i.assigneeId === me)
      .sort((a, b) => {
        const la = this.isLate(a) ? 0 : 1;
        const lb = this.isLate(b) ? 0 : 1;
        return la - lb || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9') || priorityOf(b.priority).rank - priorityOf(a.priority).rank;
      });
  });

  private weekLogs(userId?: string) {
    this.store.workLogs();
    const from = fromDateKey(this.weekFrom());
    return this.store.workLogsBetween(from, fromDateKey(addDateKey(this.weekFrom(), 7)), userId);
  }

  protected readonly myWeek = computed(() => {
    const me = this.me().id;
    const days = this.weekDays();
    const logs = this.weekLogs(me);
    const per = days.map((k) => ({
      k,
      attended: this.ext.dayOf(me, k)?.workedMinutes ?? 0,
      productive: this.ext.productivityOf(me, k)?.productiveMinutes ?? 0,
      logged: logs.filter((w) => toDateKey(new Date(w.startedAt)) === k).reduce((s, w) => s + w.minutes, 0),
    }));
    // Weekends only when something happened on them
    const shown = per.filter((d) => !isWeekend(d.k) || d.attended || d.productive || d.logged);
    const sum = (f: 'attended' | 'productive' | 'logged') => per.reduce((s, d) => s + d[f], 0);
    const series: BarSeries[] = [
      { name: 'Attended', color: NEUTRAL, values: shown.map((d) => +(d.attended / 60).toFixed(1)) },
      { name: 'Productive', color: SERIES[0], values: shown.map((d) => +(d.productive / 60).toFixed(1)) },
      { name: 'Logged in nPro', color: SERIES[2], values: shown.map((d) => +(d.logged / 60).toFixed(1)) },
    ];
    return {
      categories: shown.map((d) => fromDateKey(d.k).toLocaleDateString(undefined, { weekday: 'short' })),
      series,
      attended: sum('attended'),
      productive: sum('productive'),
      logged: sum('logged'),
      target: WEEKLY_TARGET_MIN,
    };
  });

  protected readonly myTiles = computed(() => {
    const open = this.myOpen();
    const in7 = fromDateKey(addDateKey(this.today(), 7)).getTime();
    const w = this.myWeek();
    return {
      open: open.length,
      overdue: open.filter((i) => this.isLate(i)).length,
      dueSoon: open.filter((i) => i.dueDate && !this.isLate(i) && Date.parse(i.dueDate) < in7).length,
      logged: w.logged,
      attended: w.attended,
      productive: w.productive,
    };
  });

  protected readonly tracked = computed(() => this.ext.visibleUserIds().has(this.me().id));
  protected readonly myToday = computed(() => this.ext.dayOf(this.me().id, this.today()));
  protected readonly myBalance = computed(() => this.ext.balanceOf(this.me().id));

  protected readonly myRequests = computed(() => {
    const me = this.me().id;
    const today = this.today();
    const leaves = this.ext.leaves().filter((l) => l.userId === me && (l.status === 'pending' || (l.status === 'approved' && l.to >= today)));
    const regs = this.ext.regularisations().filter((g) => g.userId === me && g.status === 'pending');
    return [
      ...leaves.map((l) => ({ id: l.id, label: `${this.leaveName(l.type)} · ${this.range(l.from, l.to)}${l.halfDay ? ' (half day)' : ''}`, status: l.status, sort: l.from })),
      ...regs.map((g) => ({ id: g.id, label: `Hours correction · ${this.range(g.date, g.date)}`, status: g.status, sort: g.date })),
    ].sort((a, b) => a.sort.localeCompare(b.sort));
  });

  /** My missed punches this week that have no correction yet */
  protected readonly myMissed = computed(() => {
    const me = this.me().id;
    return this.weekDays().filter((k) => this.ext.dayOf(me, k)?.status === 'missed_punch' && !this.ext.regularisations().some((g) => g.userId === me && g.date === k && g.status === 'pending'));
  });

  protected readonly mySupport = computed(() => {
    const me = this.me().id;
    const now = this.now();
    return this.openIssues()
      .filter((i) => i.assigneeId === me && i.supportLevel)
      .map((i) => ({ issue: i, sla: this.store.slaOf(i, now)! }))
      .filter((r) => r.sla)
      .sort((a, b) => a.sla.resolution.dueAt - b.sla.resolution.dueAt);
  });

  protected leaveName(type: string) {
    return LEAVE_TYPES.find((t) => t.id === type)?.label ?? 'Leave';
  }

  protected range(from: string, to: string) {
    const f = (k: string) => fromDateKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return from === to ? f(from) : `${f(from)} – ${f(to)}`;
  }

  // ---------- Team view ----------

  /** Everyone in my scope whose time is tracked, except me */
  protected readonly team = computed(() => this.ext.visibleUsers().filter((u) => u.id !== this.me().id));

  protected readonly teamToday = computed(() => {
    const k = this.today();
    const weekend = isWeekend(k);
    const onLeave: { user: User; label: string }[] = [];
    const notIn: User[] = [];
    const late: { user: User; at: string }[] = [];
    let present = 0;
    for (const u of this.team()) {
      const a = this.ext.dayOf(u.id, k);
      if (a?.status === 'leave' || a?.status === 'half_day') onLeave.push({ user: u, label: a.status === 'half_day' ? 'Half day' : this.leaveName(a.leaveType ?? '').replace(' leave', '') });
      if (a?.punchIn && a.status !== 'leave') present++;
      if (!weekend && (!a || a.status === 'absent')) notIn.push(u);
      if (a?.late && a.punchIn) late.push({ user: u, at: timeOf(a.punchIn) });
    }
    return { weekend, present, onLeave, notIn, late };
  });

  /** Upcoming approved / pending leave in the next 14 days */
  protected readonly teamUpcoming = computed(() => {
    const ids = new Set(this.team().map((u) => u.id));
    const from = addDateKey(this.today(), 1);
    const to = addDateKey(this.today(), 14);
    return this.ext
      .leaves()
      .filter((l) => ids.has(l.userId) && (l.status === 'approved' || l.status === 'pending') && l.to >= from && l.from <= to)
      .sort((a, b) => a.from.localeCompare(b.from))
      .map((l) => ({ id: l.id, user: this.store.userById(l.userId), label: `${this.leaveName(l.type).replace(' leave', '')} · ${this.range(l.from, l.to)}`, pending: l.status === 'pending' }));
  });

  protected readonly approvals = computed(
    () =>
      [...this.ext.leaves(), ...this.ext.regularisations()].filter((r) => r.status === 'pending' && this.ext.canApprove(r.userId) && this.ext.visibleUserIds().has(r.userId)).length,
  );

  protected readonly teamHours = computed(() => {
    const days = new Set(this.weekDays());
    const logs = this.weekLogs();
    return this.team()
      .map((u) => {
        const prod = this.ext.productivity().filter((p) => p.userId === u.id && days.has(p.date));
        const productive = prod.reduce((s, p) => s + p.productiveMinutes, 0);
        const attended = this.ext.attendance().filter((a) => a.userId === u.id && days.has(a.date)).reduce((s, a) => s + a.workedMinutes, 0);
        const logged = logs.filter((w) => w.userId === u.id).reduce((s, w) => s + w.minutes, 0);
        return { user: u, attended, productive, logged, gap: logged - productive };
      })
      .sort((a, b) => b.attended - a.attended);
  });

  protected readonly hoursMax = computed(() => Math.max(60, ...this.teamHours().flatMap((r) => [r.attended, r.productive, r.logged])));

  protected pctOf(v: number) {
    return `${Math.min(100, (v / this.hoursMax()) * 100)}%`;
  }

  /** Open tickets per assignee (people in my scope), stacked by status category */
  protected readonly workload = computed(() => {
    const people = this.store.users().filter((u) => u.role !== 'production_user' && !u.inactive);
    const ids = new Set(people.map((u) => u.id));
    const cats: StatusCategory[] = ['in_progress', 'todo', 'hold'];
    const rows = people
      .map((u) => {
        const mine = this.openIssues().filter((i) => i.assigneeId === u.id);
        return {
          user: u,
          counts: cats.map((c) => mine.filter((i) => this.category(i) === c).length),
          total: mine.length,
          points: mine.reduce((s, i) => s + (i.storyPoints ?? 0), 0),
          overdue: mine.filter((i) => this.isLate(i)).length,
        };
      })
      .filter((r) => r.total)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    const unassigned = this.openIssues().filter((i) => !i.assigneeId || !ids.has(i.assigneeId)).length;
    return {
      rows,
      unassigned,
      categories: rows.map((r) => r.user.name),
      series: cats.map((c, ci) => ({ name: CATEGORY_LABELS[c], color: CATEGORY_COLORS[c], values: rows.map((r) => r.counts[ci]!) })),
    };
  });

  protected readonly slaAttention = computed(() => {
    const now = this.now();
    return this.openIssues()
      .map((i) => ({ issue: i, sla: this.store.slaOf(i, now) }))
      .filter((r): r is { issue: Issue; sla: NonNullable<ReturnType<DataStore['slaOf']>> } => !!r.sla)
      .map((r) => {
        const states = [r.sla.response.state, r.sla.resolution.state];
        return { ...r, breached: states.includes('breached'), atRisk: states.includes('at_risk') };
      })
      .filter((r) => r.breached || r.atRisk)
      .sort((a, b) => Number(b.breached) - Number(a.breached) || a.sla.resolution.dueAt - b.sla.resolution.dueAt);
  });

  protected readonly sprints = computed(() => {
    const now = this.now();
    return this.store
      .sprints()
      .filter((s) => s.state === 'active')
      .map((s) => {
        const st = this.store.sprintStats(s.productId, s.id);
        const product = this.store.products().find((p) => p.id === s.productId);
        const start = s.startDate ? Date.parse(s.startDate) : undefined;
        const end = s.endDate ? Date.parse(s.endDate) : undefined;
        const daysLeft = end !== undefined ? Math.ceil((end - now) / DAY_MS) : undefined;
        const timePct = start !== undefined && end !== undefined && end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : undefined;
        const workPct = st.points ? (st.donePoints / st.points) * 100 : st.total ? (st.done / st.total) * 100 : 0;
        return { sprint: s, product, st, daysLeft, timePct, workPct, behind: timePct !== undefined && workPct + 15 < timePct };
      });
  });

  protected readonly teamTiles = computed(() => ({
    people: this.team().length,
    present: this.teamToday().present,
    leave: this.teamToday().onLeave.length,
    notIn: this.teamToday().notIn.length,
    breached: this.slaAttention().filter((r) => r.breached).length,
    approvals: this.approvals(),
  }));

  protected teamName(u: User | undefined) {
    return this.store.teamById(u?.teamId)?.name ?? '';
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
