import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataStore, formatMinutes } from '../../core/data-store';
import type { Issue, StatusCategory } from '../../core/models';
import {
  CATEGORY_COLORS, CATEGORY_LABELS, CYCLE_BUCKETS, NEUTRAL, NO_CLIENT, SERIES, average, burndown, cycleDays, cycleHistogram, downloadCsv, hoursMatrix, inPeriod,
  isOverdue, leadDays, median, minutesByIssue, monthKey, monthRange, pct, weeklyTrend, type Period,
} from '../../core/reports';
import { addDays, dayKey } from '../../core/utils';
import { BarChart, type BarSeries } from '../../shared/charts/bar-chart';
import { LineChart } from '../../shared/charts/line-chart';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { ISSUE_TYPES } from '../tickets/ticket-meta';

type PeriodKey = '30' | '90' | '180' | 'year' | 'all';
const CATS: StatusCategory[] = ['todo', 'in_progress', 'hold', 'done'];

/** Step 8: product-wise and client-wise reports, trend, burndown, velocity, workload, cycle time. */
@Component({
  selector: 'app-reports-page',
  imports: [DatePipe, DecimalPipe, RouterLink, BarChart, LineChart, Icon, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-page.html',
})
export class ReportsPage {
  protected readonly store = inject(DataStore);
  protected readonly fmt = formatMinutes;
  protected readonly catColors = CATEGORY_COLORS;
  protected readonly catLabels = CATEGORY_LABELS;
  protected readonly cats = CATS;

  // Filters
  protected readonly productFilter = signal('');
  protected readonly clientFilter = signal('');
  protected readonly periodKey = signal<PeriodKey>('90');
  protected readonly sprintChoice = signal('');
  /** Month-wise hours report: "YYYY-MM" and which total the percentages are a share of */
  protected readonly month = signal(monthKey(new Date()));
  protected readonly shareOf = signal<'person' | 'client'>('person');
  protected readonly pct = pct;
  protected readonly NO_CLIENT = NO_CLIENT;

  protected readonly period = computed<Period>(() => {
    const now = new Date();
    const to = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
    const k = this.periodKey();
    if (k === 'year') return { from: new Date(now.getFullYear(), 0, 1), to };
    if (k === 'all') {
      const first = Math.min(...this.store.issues().map((i) => Date.parse(i.createdAt)), now.getTime());
      return { from: new Date(first), to };
    }
    return { from: addDays(to, -Number(k)), to };
  });

  private categoryOf(i: Issue): StatusCategory {
    return this.store.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId)?.category ?? 'todo';
  }

  /** Tickets in scope (product / client filters; archived products excluded unless chosen) */
  protected readonly scoped = computed(() => {
    const archived = new Set(this.store.products().filter((p) => p.archived).map((p) => p.id));
    return this.store.issues().filter(
      (i) => (this.productFilter() ? i.productId === this.productFilter() : !archived.has(i.productId)) && (!this.clientFilter() || i.clientId === this.clientFilter()),
    );
  });
  private readonly scopedIds = computed(() => new Set(this.scoped().map((i) => i.id)));
  private readonly logsInPeriod = computed(() => this.store.workLogs().filter((w) => this.scopedIds().has(w.issueId) && inPeriod(w.startedAt, this.period())));
  private readonly minutesInPeriod = computed(() => minutesByIssue(this.logsInPeriod()));
  private readonly resolvedInPeriod = computed(() => this.scoped().filter((i) => this.categoryOf(i) === 'done' && inPeriod(i.endAt, this.period())));

  // ---- KPI tiles ----
  protected readonly kpis = computed(() => {
    const scoped = this.scoped();
    const cycles = this.resolvedInPeriod().map(cycleDays).filter((d): d is number => d != null);
    const avgCycle = average(cycles);
    return [
      { label: 'Created', value: String(scoped.filter((i) => inPeriod(i.createdAt, this.period())).length), hint: 'in period', icon: 'plus' as const },
      { label: 'Resolved', value: String(this.resolvedInPeriod().length), hint: 'in period', icon: 'check' as const },
      { label: 'Open now', value: String(scoped.filter((i) => this.categoryOf(i) !== 'done').length), hint: 'all time', icon: 'ticket' as const },
      { label: 'Overdue', value: String(scoped.filter((i) => isOverdue(i, this.categoryOf(i))).length), hint: 'open & past due', icon: 'calendar-clock' as const },
      { label: 'Avg cycle time', value: avgCycle != null ? `${avgCycle.toFixed(1)}d` : '—', hint: 'start → done', icon: 'clock' as const },
      { label: 'Hours logged', value: this.fmt(this.logsInPeriod().reduce((s, w) => s + w.minutes, 0)), hint: 'in period', icon: 'timer' as const },
    ];
  });

  // ---- Created vs resolved trend ----
  protected readonly trend = computed(() => {
    const t = weeklyTrend(this.scoped(), this.period());
    return {
      labels: t.weeks.map((w) => w.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
      series: [
        { name: 'Created', color: SERIES[0], values: t.created },
        { name: 'Resolved', color: SERIES[1], values: t.resolved },
      ],
    };
  });

  // ---- Product-wise ----
  protected readonly productRows = computed(() => {
    const products = this.store.products().filter((p) => (this.productFilter() ? p.id === this.productFilter() : !p.archived));
    return products.map((p) => {
      const issues = this.scoped().filter((i) => i.productId === p.id);
      const byCat = Object.fromEntries(CATS.map((c) => [c, issues.filter((i) => this.categoryOf(i) === c).length])) as Record<StatusCategory, number>;
      const done = issues.filter((i) => this.categoryOf(i) === 'done');
      const cycles = this.resolvedInPeriod().filter((i) => i.productId === p.id).map(cycleDays).filter((d): d is number => d != null);
      return {
        product: p,
        total: issues.length,
        byCat,
        overdue: issues.filter((i) => isOverdue(i, this.categoryOf(i))).length,
        points: issues.reduce((s, i) => s + (i.storyPoints ?? 0), 0),
        donePoints: done.reduce((s, i) => s + (i.storyPoints ?? 0), 0),
        minutes: issues.reduce((s, i) => s + (this.minutesInPeriod().get(i.id) ?? 0), 0),
        avgCycle: average(cycles),
      };
    });
  });
  protected readonly productChart = computed(() => ({
    categories: this.productRows().map((r) => r.product.name),
    series: CATS.map((c): BarSeries => ({ name: CATEGORY_LABELS[c], color: CATEGORY_COLORS[c], values: this.productRows().map((r) => r.byCat[c]) })),
  }));

  // ---- Client-wise ----
  protected readonly clientRows = computed(() => {
    const clients = this.store.clients().filter((c) => (this.clientFilter() ? c.id === this.clientFilter() : !c.archived));
    return clients
      .map((c) => {
        const issues = this.scoped().filter((i) => i.clientId === c.id);
        const done = issues.filter((i) => this.categoryOf(i) === 'done');
        const lead = this.resolvedInPeriod().filter((i) => i.clientId === c.id).map(leadDays).filter((d): d is number => d != null);
        return {
          client: c,
          total: issues.length,
          open: issues.length - done.length,
          done: done.length,
          overdue: issues.filter((i) => isOverdue(i, this.categoryOf(i))).length,
          highPriorityOpen: issues.filter((i) => this.categoryOf(i) !== 'done' && (i.priority === 'highest' || i.priority === 'high')).length,
          minutes: issues.reduce((s, i) => s + (this.minutesInPeriod().get(i.id) ?? 0), 0),
          avgLead: average(lead),
        };
      })
      .sort((a, b) => b.total - a.total);
  });
  protected readonly clientChart = computed(() => ({
    categories: this.clientRows().map((r) => r.client.name),
    series: [
      { name: 'Open', color: CATEGORY_COLORS.in_progress, values: this.clientRows().map((r) => r.open) },
      { name: 'Done', color: CATEGORY_COLORS.done, values: this.clientRows().map((r) => r.done) },
    ],
  }));

  // ---- Sprint burndown + velocity ----
  protected readonly sprintOptions = computed(() =>
    this.store
      .sprints()
      .filter((sp) => sp.state !== 'planned' && (!this.productFilter() || sp.productId === this.productFilter()))
      // Active sprints first, then the one with the most story points, then the most recent
      .map((sp) => ({ sp, pts: this.store.issues().filter((i) => i.sprintId === sp.id).reduce((s, i) => s + (i.storyPoints ?? 0), 0) }))
      .sort((a, b) => Number(b.sp.state === 'active') - Number(a.sp.state === 'active') || b.pts - a.pts || (b.sp.startDate ?? '').localeCompare(a.sp.startDate ?? ''))
      .map((x) => x.sp),
  );
  protected readonly sprint = computed(() => this.sprintOptions().find((s) => s.id === this.sprintChoice()) ?? this.sprintOptions()[0]);
  protected readonly burn = computed(() => {
    const sp = this.sprint();
    if (!sp) return undefined;
    const issues = this.store.issues().filter((i) => i.sprintId === sp.id);
    const b = burndown(sp, issues, (i) => this.categoryOf(i) === 'done');
    return {
      sprint: sp,
      total: b.total,
      remaining: [...b.actual].reverse().find((v) => v != null) ?? b.total,
      unestimated: issues.filter((i) => i.storyPoints == null).length,
      labels: b.days.map((d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
      series: [
        { name: 'Ideal', color: NEUTRAL, values: b.ideal, dashed: true },
        { name: 'Remaining', color: SERIES[0], values: b.actual },
      ],
    };
  });
  protected readonly velocity = computed(() => {
    const closed = this.store
      .sprints()
      .filter((sp) => sp.state === 'closed' && (!this.productFilter() || sp.productId === this.productFilter()))
      .sort((a, b) => (a.completedAt ?? a.endDate ?? '').localeCompare(b.completedAt ?? b.endDate ?? ''))
      .slice(-6);
    return {
      count: closed.length,
      avg: average(closed.map((s) => s.completedPoints ?? 0)),
      categories: closed.map((s) => s.name),
      series: [
        { name: 'Committed', color: NEUTRAL, values: closed.map((s) => s.committedPoints ?? 0) },
        { name: 'Completed', color: SERIES[0], values: closed.map((s) => s.completedPoints ?? 0) },
      ],
    };
  });

  // ---- Workload ----
  protected readonly workload = computed(() => {
    const rows = this.store.users().map((u) => {
      const open = this.scoped().filter((i) => i.assigneeId === u.id && this.categoryOf(i) !== 'done');
      const byCat = Object.fromEntries((['todo', 'in_progress', 'hold'] as const).map((c) => [c, open.filter((i) => this.categoryOf(i) === c).length]));
      return {
        user: u,
        open: open.length,
        byCat,
        points: open.reduce((s, i) => s + (i.storyPoints ?? 0), 0),
        minutes: this.logsInPeriod().filter((w) => w.userId === u.id).reduce((s, w) => s + w.minutes, 0),
      };
    });
    const unassigned = this.scoped().filter((i) => !i.assigneeId && this.categoryOf(i) !== 'done').length;
    return {
      rows,
      unassigned,
      openChart: {
        categories: rows.map((r) => r.user.name),
        series: (['todo', 'in_progress', 'hold'] as const).map((c): BarSeries => ({ name: CATEGORY_LABELS[c], color: CATEGORY_COLORS[c], values: rows.map((r) => r.byCat[c] ?? 0) })),
      },
      hoursChart: { categories: rows.map((r) => r.user.name), series: [{ name: 'Hours logged', color: SERIES[0], values: rows.map((r) => +(r.minutes / 60).toFixed(2)) }] },
    };
  });

  // ---- Cycle time ----
  protected readonly cycle = computed(() => {
    const done = this.resolvedInPeriod();
    const days = done.map(cycleDays).filter((d): d is number => d != null);
    const byType = ISSUE_TYPES.map((t) => {
      const d = done.filter((i) => i.type === t.id).map(cycleDays).filter((x): x is number => x != null);
      return { type: t, count: d.length, avg: average(d), median: median(d) };
    }).filter((r) => r.count);
    return {
      count: days.length,
      avg: average(days),
      median: median(days),
      p85: days.length ? [...days].sort((a, b) => a - b)[Math.min(days.length - 1, Math.ceil(days.length * 0.85) - 1)] : undefined,
      chart: { categories: CYCLE_BUCKETS.map((b) => b.label), series: [{ name: 'Tickets', color: SERIES[0], values: cycleHistogram(days) }] },
      byType,
    };
  });

  // ---- Month-wise hours: people × clients ----
  protected readonly monthOptions = computed(() => {
    const keys = new Set<string>();
    const now = new Date();
    for (let k = 0; k < 12; k++) keys.add(monthKey(new Date(now.getFullYear(), now.getMonth() - k, 1)));
    for (const w of this.store.workLogs()) keys.add(monthKey(w.startedAt));
    return [...keys]
      .sort()
      .reverse()
      .map((key) => ({ key, label: monthRange(key).from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }));
  });

  protected readonly monthMatrix = computed(() => {
    const issueClient = new Map(this.scoped().map((i) => [i.id, i.clientId] as const));
    const logs = this.store.workLogs().filter((w) => issueClient.has(w.issueId));
    const m = hoursMatrix(logs, (id) => issueClient.get(id), monthRange(this.month()));
    const clients = this.store.clients().filter((c) => (this.clientFilter() ? c.id === this.clientFilter() : !c.archived || m.colTotal(c.id) > 0));
    const columns = [...clients.map((c) => ({ id: c.id, name: c.name })), ...(m.colTotal(NO_CLIENT) > 0 ? [{ id: NO_CLIENT, name: 'No client' }] : [])];
    const rows = this.store.users().map((u) => ({ user: u, total: m.rowTotal(u.id) }));
    return { m, columns, rows };
  });

  /** Cell share in % according to the "Share of" toggle */
  protected cellShare(userId: string, clientId: string) {
    const { m } = this.monthMatrix();
    const v = m.cell(userId, clientId);
    return this.shareOf() === 'person' ? pct(v, m.rowTotal(userId)) : pct(v, m.colTotal(clientId));
  }

  /** Light single-hue shading by share (sequential: more = darker) */
  protected cellShade(share: number) {
    return share ? `color-mix(in srgb, ${SERIES[0]} ${Math.round(6 + share * 0.3)}%, white)` : 'transparent';
  }

  protected shareLabel(userName: string, clientName: string) {
    return this.shareOf() === 'person' ? userName : clientName;
  }

  protected exportMonth() {
    const { m, columns, rows } = this.monthMatrix();
    const h = (min: number) => +(min / 60).toFixed(2);
    const label = this.monthOptions().find((o) => o.key === this.month())?.label ?? this.month();
    downloadCsv(`npro-hours-${this.month()}.csv`, [
      [`Hours by person and client - ${label}`],
      ['Person', ...columns.flatMap((c) => [`${c.name} (h)`, `${c.name} (% of person)`]), 'Total (h)', '% of all hours'],
      ...rows.map((r) => [r.user.name, ...columns.flatMap((c) => [h(m.cell(r.user.id, c.id)), pct(m.cell(r.user.id, c.id), r.total)]), h(r.total), pct(r.total, m.grand)]),
      ['Total', ...columns.flatMap((c) => [h(m.colTotal(c.id)), pct(m.colTotal(c.id), m.grand)]), h(m.grand), 100],
    ]);
  }

  protected periodLabel() {
    const p = this.period();
    return `${p.from.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${addDays(p.to, -1).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  protected value(e: Event) {
    return (e.target as HTMLSelectElement).value;
  }

  protected hrs(min: number) {
    return min ? this.fmt(min) : '—';
  }

  protected exportProducts() {
    downloadCsv(`npro-products-${dayKey(new Date())}.csv`, [
      ['Product', 'Key', 'Total tickets', 'To do', 'In progress', 'On hold', 'Done', 'Overdue', 'Story points', 'Points done', 'Hours logged (period)', 'Avg cycle days (period)'],
      ...this.productRows().map((r) => [
        r.product.name, r.product.key, r.total, r.byCat.todo, r.byCat.in_progress, r.byCat.hold, r.byCat.done, r.overdue, r.points, r.donePoints,
        +(r.minutes / 60).toFixed(2), r.avgCycle != null ? +r.avgCycle.toFixed(1) : '',
      ]),
    ]);
  }

  protected exportClients() {
    downloadCsv(`npro-clients-${dayKey(new Date())}.csv`, [
      ['Client', 'Total tickets', 'Open', 'Done', 'Overdue', 'High-priority open', 'Hours logged (period)', 'Avg resolution days (period)'],
      ...this.clientRows().map((r) => [
        r.client.name, r.total, r.open, r.done, r.overdue, r.highPriorityOpen, +(r.minutes / 60).toFixed(2), r.avgLead != null ? +r.avgLead.toFixed(1) : '',
      ]),
    ]);
  }
}
