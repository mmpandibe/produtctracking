import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataStore, formatMinutes } from '../../core/data-store';
import type { Issue, StatusCategory } from '../../core/models';
import { SERIES, changePct, downloadCsv, inPeriod, monthKey, monthRange, pct, periodSummary, type Period, type PeriodSummary } from '../../core/reports';
import { addDays, dayKey, startOfWeek } from '../../core/utils';
import { BarChart } from '../../shared/charts/bar-chart';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { roadmapStatusOf } from '../backlog/roadmap-meta';
import { WORK_ACTIVITIES, priorityOf } from '../tickets/ticket-meta';
import { ReadablePipe } from '../../shared/readable';

type Kind = 'week' | 'month';

interface Kpi {
  label: string;
  now: string;
  delta: number | undefined;
  /** Whether an increase is good (resolved ↑ good, overdue ↑ bad) */
  upIsGood: boolean;
  prev: string;
}

/** Step 9: weekly / monthly executive summary to share with leadership (print/PDF, CSV, copy as text). */
@Component({
  selector: 'app-cxo-page',
  imports: [ReadablePipe, DatePipe, RouterLink, BarChart, Icon, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cxo-page.html',
})
export class CxoPage {
  protected readonly store = inject(DataStore);
  protected readonly fmt = formatMinutes;
  protected readonly priorityOf = priorityOf;
  protected readonly pct = pct;
  protected readonly roadmapStatusOf = roadmapStatusOf;

  protected readonly kind = signal<Kind>('week');
  /** Any date inside the selected period */
  protected readonly anchor = signal(new Date());
  protected readonly productFilter = signal('');
  protected readonly copied = signal(false);
  protected readonly generatedAt = new Date();

  protected readonly period = computed<Period>(() => {
    const a = this.anchor();
    if (this.kind() === 'week') {
      const from = startOfWeek(a);
      return { from, to: addDays(from, 7) };
    }
    return monthRange(monthKey(a));
  });
  protected readonly prevPeriod = computed<Period>(() => {
    const p = this.period();
    if (this.kind() === 'week') return { from: addDays(p.from, -7), to: p.from };
    return monthRange(monthKey(addDays(p.from, -1)));
  });
  protected readonly isCurrent = computed(() => this.period().to.getTime() > Date.now());
  protected readonly periodKey = computed(() => (this.kind() === 'week' ? `week:${dayKey(this.period().from)}` : `month:${monthKey(this.period().from)}`));
  protected readonly title = computed(() => {
    const p = this.period();
    const last = addDays(p.to, -1);
    return this.kind() === 'week'
      ? `Weekly summary · ${p.from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : `Monthly summary · ${p.from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
  });
  protected readonly scopeLabel = computed(() => this.store.products().find((p) => p.id === this.productFilter())?.name ?? 'All products');

  private categoryOf(i: Issue): StatusCategory {
    return this.store.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId)?.category ?? 'todo';
  }
  private readonly isDone = (i: Issue) => this.categoryOf(i) === 'done';

  protected readonly scoped = computed(() => {
    const archived = new Set(this.store.products().filter((p) => p.archived).map((p) => p.id));
    return this.store.issues().filter((i) => (this.productFilter() ? i.productId === this.productFilter() : !archived.has(i.productId)));
  });
  private readonly scopedIds = computed(() => new Set(this.scoped().map((i) => i.id)));
  private readonly logs = computed(() => this.store.workLogs().filter((w) => this.scopedIds().has(w.issueId) && inPeriod(w.startedAt, this.period())));

  protected readonly cur = computed(() => periodSummary(this.scoped(), this.store.workLogs(), this.period(), this.isDone));
  protected readonly prev = computed(() => periodSummary(this.scoped(), this.store.workLogs(), this.prevPeriod(), this.isDone));

  protected readonly kpis = computed<Kpi[]>(() => {
    const c = this.cur();
    const p = this.prev();
    const days = (s: PeriodSummary) => (s.avgCycleDays != null ? `${s.avgCycleDays.toFixed(1)}d` : '—');
    return [
      { label: 'Tickets resolved', now: String(c.resolved), prev: String(p.resolved), delta: changePct(c.resolved, p.resolved), upIsGood: true },
      { label: 'Tickets created', now: String(c.created), prev: String(p.created), delta: changePct(c.created, p.created), upIsGood: false },
      { label: 'Open at period end', now: String(c.open), prev: String(p.open), delta: changePct(c.open, p.open), upIsGood: false },
      { label: 'Overdue', now: String(c.overdue), prev: String(p.overdue), delta: changePct(c.overdue, p.overdue), upIsGood: false },
      { label: 'Hours logged', now: this.fmt(c.minutes), prev: this.fmt(p.minutes), delta: changePct(c.minutes, p.minutes), upIsGood: true },
      {
        label: 'Avg cycle time',
        now: days(c),
        prev: days(p),
        delta: c.avgCycleDays != null && p.avgCycleDays != null ? changePct(c.avgCycleDays, p.avgCycleDays) : undefined,
        upIsGood: false,
      },
    ];
  });

  // ---- Section 1: roadmap summary ----
  protected readonly roadmapRows = computed(() => {
    this.store.issues();
    this.store.sprints();
    const productOrder = new Map(this.store.products().map((p, i) => [p.id, i]));
    return this.store
      .roadmaps()
      .filter((r) => (this.productFilter() ? r.productId === this.productFilter() : !this.store.products().find((p) => p.id === r.productId)?.archived))
      .sort((a, b) => (productOrder.get(a.productId) ?? 0) - (productOrder.get(b.productId) ?? 0) || (a.startDate ?? a.createdAt).localeCompare(b.startDate ?? b.createdAt))
      .map((r) => ({
        roadmap: r,
        product: this.store.products().find((p) => p.id === r.productId),
        progress: this.store.roadmapProgress(r.id),
        overdue: !!r.dueDate && r.status !== 'completed' && r.status !== 'cancelled' && Date.parse(r.dueDate) < Date.now(),
      }));
  });

  // ---- Section 2: hours by client × product ----
  protected readonly hoursGrid = computed(() => {
    const products = this.store.products().filter((p) => (this.productFilter() ? p.id === this.productFilter() : !p.archived));
    const issueById = new Map(this.scoped().map((i) => [i.id, i]));
    const cell = new Map<string, number>(); // "client|product" -> minutes
    const rowT = new Map<string, number>();
    const colT = new Map<string, number>();
    let grand = 0;
    for (const w of this.logs()) {
      const i = issueById.get(w.issueId);
      if (!i) continue;
      const c = i.clientId ?? '__none__';
      cell.set(`${c}|${i.productId}`, (cell.get(`${c}|${i.productId}`) ?? 0) + w.minutes);
      rowT.set(c, (rowT.get(c) ?? 0) + w.minutes);
      colT.set(i.productId, (colT.get(i.productId) ?? 0) + w.minutes);
      grand += w.minutes;
    }
    const rows = [
      ...this.store.clients().filter((c) => rowT.has(c.id)).map((c) => ({ id: c.id, name: c.name })),
      ...(rowT.has('__none__') ? [{ id: '__none__', name: 'No client' }] : []),
    ].sort((a, b) => (rowT.get(b.id) ?? 0) - (rowT.get(a.id) ?? 0));
    return {
      products,
      rows,
      grand,
      cell: (clientId: string, productId: string) => cell.get(`${clientId}|${productId}`) ?? 0,
      rowTotal: (clientId: string) => rowT.get(clientId) ?? 0,
      colTotal: (productId: string) => colT.get(productId) ?? 0,
    };
  });

  // ---- Breakdown tables ----
  protected readonly productRows = computed(() => {
    const p = this.period();
    const total = this.cur().minutes;
    return this.store
      .products()
      .filter((pr) => (this.productFilter() ? pr.id === this.productFilter() : !pr.archived))
      .map((pr) => {
        const issues = this.scoped().filter((i) => i.productId === pr.id);
        const s = periodSummary(issues, this.store.workLogs(), p, this.isDone);
        return { product: pr, ...s, share: pct(s.minutes, total) };
      });
  });

  protected readonly clientRows = computed(() => {
    const p = this.period();
    const total = this.cur().minutes;
    return this.store
      .clients()
      .filter((c) => !c.archived)
      .map((c) => {
        const issues = this.scoped().filter((i) => i.clientId === c.id);
        const s = periodSummary(issues, this.store.workLogs(), p, this.isDone);
        const highOpen = issues.filter((i) => !this.isDone(i) && (i.priority === 'highest' || i.priority === 'high')).length;
        return { client: c, ...s, highOpen, share: pct(s.minutes, total) };
      })
      .filter((r) => r.minutes || r.open || r.resolved || r.created)
      .sort((a, b) => b.minutes - a.minutes || b.open - a.open);
  });

  protected readonly sprintRows = computed(() =>
    this.store
      .sprints()
      .filter((sp) => sp.state === 'active' && (!this.productFilter() || sp.productId === this.productFilter()))
      .map((sp) => {
        const st = this.store.sprintStats(sp.productId, sp.id);
        const start = sp.startDate ? Date.parse(sp.startDate) : Date.now();
        const end = sp.endDate ? Date.parse(sp.endDate) : start;
        const elapsed = end > start ? Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100))) : 100;
        const done = pct(st.donePoints, st.points);
        const daysLeft = Math.ceil((end - Date.now()) / 86_400_000);
        return { sprint: sp, product: this.store.products().find((p) => p.id === sp.productId), stats: st, done, elapsed, daysLeft, onTrack: !st.points || done >= elapsed - 10 };
      }),
  );

  protected readonly people = computed(() => {
    const total = this.cur().minutes;
    return this.store
      .users()
      .map((u) => {
        const minutes = this.logs().filter((w) => w.userId === u.id).reduce((s, w) => s + w.minutes, 0);
        const resolved = this.scoped().filter((i) => i.assigneeId === u.id && i.endAt && inPeriod(i.endAt, this.period()) && this.isDone(i)).length;
        return { user: u, minutes, resolved, share: pct(minutes, total) };
      })
      .sort((a, b) => b.minutes - a.minutes);
  });

  protected readonly activityChart = computed(() => {
    const rows = WORK_ACTIVITIES.map((a) => ({ a, minutes: this.logs().filter((w) => w.activity === a.id).reduce((s, w) => s + w.minutes, 0) })).filter((r) => r.minutes);
    return { categories: rows.map((r) => r.a.label), series: [{ name: 'Hours', color: SERIES[0], values: rows.map((r) => +(r.minutes / 60).toFixed(1)) }] };
  });

  // ---- Attention lists ----
  protected readonly overdueList = computed(() =>
    this.scoped()
      .filter((i) => !this.isDone(i) && i.dueDate && Date.parse(i.dueDate) < new Date(new Date().toDateString()).getTime())
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .slice(0, 8),
  );
  protected readonly highPriorityList = computed(() =>
    this.scoped()
      .filter((i) => !this.isDone(i) && (i.priority === 'highest' || i.priority === 'high'))
      .sort((a, b) => priorityOf(b.priority).rank - priorityOf(a.priority).rank)
      .slice(0, 8),
  );
  protected readonly holdList = computed(() => this.scoped().filter((i) => this.categoryOf(i) === 'hold'));

  // ---- Auto highlights ----
  protected readonly highlights = computed(() => {
    const c = this.cur();
    const p = this.prev();
    const word = this.kind() === 'week' ? 'last week' : 'last month';
    const diff = (a: number, b: number) => (a === b ? `same as ${word}` : `${a > b ? '+' : '−'}${Math.abs(a - b)} vs ${word}`);
    const out: { tone: 'good' | 'warn' | 'info'; text: string }[] = [];
    out.push({ tone: c.resolved >= p.resolved ? 'good' : 'warn', text: `${c.resolved} ticket${c.resolved === 1 ? '' : 's'} resolved (${diff(c.resolved, p.resolved)}), ${c.resolvedPoints} story points delivered.` });
    out.push({
      tone: c.created > c.resolved ? 'warn' : 'good',
      text: `${c.created} new ticket${c.created === 1 ? '' : 's'} came in; open work ${c.open > p.open ? 'grew' : c.open < p.open ? 'shrank' : 'held'} from ${p.open} to ${c.open}.`,
    });
    const topClient = this.clientRows()[0];
    if (topClient && topClient.minutes) out.push({ tone: 'info', text: `${topClient.client.name} took the most effort: ${this.fmt(topClient.minutes)} (${topClient.share}% of logged hours).` });
    const topPerson = this.people()[0];
    if (topPerson && topPerson.minutes) out.push({ tone: 'info', text: `${topPerson.user.name} logged the most time: ${this.fmt(topPerson.minutes)} (${topPerson.share}%).` });
    for (const s of this.sprintRows()) {
      out.push({
        tone: s.onTrack ? 'good' : 'warn',
        text: `${s.sprint.name}: ${s.done}% of points done with ${Math.max(0, s.daysLeft)} day${s.daysLeft === 1 ? '' : 's'} left — ${s.onTrack ? 'on track' : 'behind plan'}.`,
      });
    }
    if (c.overdue) out.push({ tone: 'warn', text: `${c.overdue} ticket${c.overdue === 1 ? ' is' : 's are'} overdue: ${this.overdueList().map((i) => i.key).join(', ')}.` });
    // Support tickets past their SLA right now (Step 13)
    const breached = this.store.issues().filter((i) => {
      const sla = !this.store.isResolved(i) && this.store.slaOf(i);
      return sla && (sla.response.state === 'breached' || sla.resolution.state === 'breached');
    });
    if (breached.length) out.push({ tone: 'warn', text: `${breached.length} open support ticket${breached.length === 1 ? ' has' : 's have'} breached SLA: ${breached.map((i) => i.key).join(', ')}.` });
    if (this.holdList().length) out.push({ tone: 'warn', text: `${this.holdList().length} ticket${this.holdList().length === 1 ? ' is' : 's are'} on hold: ${this.holdList().map((i) => i.key).join(', ')}.` });
    return out;
  });

  protected readonly note = computed(() => this.store.summaryNote(this.periodKey()));

  protected clientName(i: Issue) {
    return this.store.clients().find((c) => c.id === i.clientId)?.name ?? '—';
  }

  // ---- Actions ----
  protected setKind(k: Kind) {
    this.kind.set(k);
  }

  protected shift(n: number) {
    const p = this.period();
    this.anchor.set(this.kind() === 'week' ? addDays(p.from, n * 7) : new Date(p.from.getFullYear(), p.from.getMonth() + n, 1));
  }

  protected toCurrent() {
    this.anchor.set(new Date());
  }

  protected setNote(text: string) {
    this.store.setSummaryNote(this.periodKey(), text);
  }

  protected print() {
    window.print();
  }

  private asText() {
    const lines = [
      `nPro — ${this.title()} (${this.scopeLabel()})`,
      '',
      'Roadmaps:',
      ...this.roadmapRows().map(
        (r) =>
          `• ${r.product?.name ?? ''} — ${r.roadmap.name}: ${roadmapStatusOf(r.roadmap.status).label}, ${r.progress.pct}% complete` +
          (r.roadmap.dueDate ? `, due ${new Date(r.roadmap.dueDate).toLocaleDateString()}` : '') +
          (r.roadmap.achievedBenefits ? ` — achieved: ${r.roadmap.achievedBenefits}` : ''),
      ),
      '',
      `Hours by client (total ${this.fmt(this.hoursGrid().grand)}):`,
      ...this.hoursGrid().rows.map((c) => `• ${c.name}: ${this.fmt(this.hoursGrid().rowTotal(c.id))} (${pct(this.hoursGrid().rowTotal(c.id), this.hoursGrid().grand)}%)`),
      '',
      ...this.kpis().map((k) => `• ${k.label}: ${k.now} (prev ${k.prev})`),
      '',
      'Highlights:',
      ...this.highlights().map((h) => `• ${h.text}`),
    ];
    if (this.note().trim()) lines.push('', 'Comments:', this.note().trim());
    return lines.join('\n');
  }

  protected async copyText() {
    try {
      await navigator.clipboard.writeText(this.asText());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Clipboard can be blocked; fall back to printing
      this.print();
    }
  }

  protected exportCsv() {
    const h = (m: number) => +(m / 60).toFixed(2);
    downloadCsv(`npro-${this.kind()}-summary-${dayKey(this.period().from)}.csv`, [
      [`nPro ${this.title()}`, this.scopeLabel()],
      [],
      ['Section 1: Roadmaps'],
      ['Product', 'Roadmap', 'Created', 'Start date', 'Due date', 'Status', '% complete', 'Completed date', 'Achieved benefits'],
      ...this.roadmapRows().map((r) => [
        r.product?.name ?? '', r.roadmap.name, dayKey(r.roadmap.createdAt), r.roadmap.startDate ? dayKey(r.roadmap.startDate) : '', r.roadmap.dueDate ? dayKey(r.roadmap.dueDate) : '',
        roadmapStatusOf(r.roadmap.status).label, r.progress.pct, r.roadmap.completedAt ? dayKey(r.roadmap.completedAt) : '', r.roadmap.achievedBenefits ?? '',
      ]),
      [],
      ['Section 2: Hours by client and product'],
      ['Client', ...this.hoursGrid().products.map((p) => `${p.name} (h)`), 'Total (h)', '% of hours'],
      ...this.hoursGrid().rows.map((c) => [c.name, ...this.hoursGrid().products.map((p) => h(this.hoursGrid().cell(c.id, p.id))), h(this.hoursGrid().rowTotal(c.id)), pct(this.hoursGrid().rowTotal(c.id), this.hoursGrid().grand)]),
      ['Total', ...this.hoursGrid().products.map((p) => h(this.hoursGrid().colTotal(p.id))), h(this.hoursGrid().grand), 100],
      [],
      ['Metric', 'This period', 'Previous period', 'Change %'],
      ...this.kpis().map((k) => [k.label, k.now, k.prev, k.delta ?? '']),
      [],
      ['Product', 'Created', 'Resolved', 'Open at end', 'Overdue', 'Hours', '% of hours'],
      ...this.productRows().map((r) => [r.product.name, r.created, r.resolved, r.open, r.overdue, h(r.minutes), r.share]),
      [],
      ['Client', 'Hours', '% of hours', 'Resolved', 'Open at end', 'High-priority open', 'Overdue'],
      ...this.clientRows().map((r) => [r.client.name, h(r.minutes), r.share, r.resolved, r.open, r.highOpen, r.overdue]),
      [],
      ['Person', 'Hours', '% of hours', 'Tickets resolved'],
      ...this.people().map((r) => [r.user.name, h(r.minutes), r.share, r.resolved]),
      [],
      ['Highlights'],
      ...this.highlights().map((x) => [x.text]),
      ...(this.note().trim() ? [[], ['Comments'], [this.note().trim()]] : []),
    ]);
  }
}
