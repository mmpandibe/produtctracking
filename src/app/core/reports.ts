/**
 * Pure report calculations (no Angular), so they are easy to test and reuse in the CXO summary (Step 9).
 */
import type { Issue, Sprint, StatusCategory, WorkLog } from './models';
import { addDays, dayKey, startOfWeek } from './utils';

export const DAY_MS = 86_400_000;

/** Validated categorical palette (fixed order, never cycled) — see the dataviz reference palette */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'] as const;
/** Neutral for comparison / reference series (ideal line, committed points) */
export const NEUTRAL = '#9aa3ae';
/** Workflow category colours used for state (not categorical identity) */
export const CATEGORY_COLORS: Record<StatusCategory, string> = { todo: '#94a3b8', in_progress: '#2a78d6', hold: '#e34948', done: '#1baf7a' };
export const CATEGORY_LABELS: Record<StatusCategory, string> = { todo: 'To do', in_progress: 'In progress', hold: 'On hold', done: 'Done' };

export interface Period {
  from: Date;
  to: Date; // exclusive
}

export function inPeriod(iso: string | undefined, p: Period) {
  if (!iso) return false;
  const t = Date.parse(iso);
  return t >= p.from.getTime() && t < p.to.getTime();
}

/** Days from work start (or creation) to finish; undefined if not finished */
export function cycleDays(i: Issue) {
  if (!i.endAt) return undefined;
  return Math.max(0, (Date.parse(i.endAt) - Date.parse(i.startAt ?? i.createdAt)) / DAY_MS);
}

/** Days from creation to finish; undefined if not finished */
export function leadDays(i: Issue) {
  if (!i.endAt) return undefined;
  return Math.max(0, (Date.parse(i.endAt) - Date.parse(i.createdAt)) / DAY_MS);
}

export function average(xs: number[]) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined;
}

export function median(xs: number[]) {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function isOverdue(i: Issue, category: StatusCategory | undefined, now = new Date()) {
  return !!i.dueDate && category !== 'done' && Date.parse(i.dueDate) < new Date(now.toDateString()).getTime();
}

/** Cycle-time buckets for the histogram */
export const CYCLE_BUCKETS = [
  { label: '< 1 day', max: 1 },
  { label: '1–3 days', max: 3 },
  { label: '3–7 days', max: 7 },
  { label: '1–2 weeks', max: 14 },
  { label: '> 2 weeks', max: Infinity },
];

export function cycleHistogram(days: number[]) {
  const counts = CYCLE_BUCKETS.map(() => 0);
  for (const d of days) counts[CYCLE_BUCKETS.findIndex((b) => d < b.max)]!++;
  return counts;
}

/** Weekly buckets (Mon–Sun) covering the period: created vs resolved counts */
export function weeklyTrend(issues: Issue[], p: Period) {
  const weeks: Date[] = [];
  for (let w = startOfWeek(p.from); w < p.to; w = addDays(w, 7)) weeks.push(w);
  const created = weeks.map(() => 0);
  const resolved = weeks.map(() => 0);
  const idx = (iso: string) => weeks.findIndex((w, k) => Date.parse(iso) >= w.getTime() && Date.parse(iso) < (weeks[k + 1] ?? addDays(w, 7)).getTime());
  for (const i of issues) {
    if (inPeriod(i.createdAt, p)) {
      const k = idx(i.createdAt);
      if (k >= 0) created[k]!++;
    }
    if (i.endAt && inPeriod(i.endAt, p)) {
      const k = idx(i.endAt);
      if (k >= 0) resolved[k]!++;
    }
  }
  return { weeks, created, resolved };
}

/**
 * Sprint burndown in story points.
 * Remaining on a day = sprint points − points of tickets finished (endAt) by the end of that day.
 * Scope changes during the sprint are not tracked, so this uses the sprint's current tickets.
 */
export function burndown(sprint: Sprint, sprintIssues: Issue[], isDone: (i: Issue) => boolean, now = new Date()) {
  const start = sprint.startDate ? new Date(sprint.startDate) : now;
  const end = sprint.endDate ? new Date(sprint.endDate) : addDays(start, 13);
  const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const days: Date[] = [];
  for (let d = first; d <= end && days.length < 60; d = addDays(d, 1)) days.push(d);
  const total = sprintIssues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const today = dayKey(now);
  const ideal = days.map((_, k) => (days.length > 1 ? +(total - (total * k) / (days.length - 1)).toFixed(1) : 0));
  const actual = days.map((d) => {
    if (dayKey(d) > today) return null;
    const endOfDay = addDays(d, 1).getTime();
    const done = sprintIssues.filter((i) => isDone(i) && i.endAt && Date.parse(i.endAt) < endOfDay).reduce((s, i) => s + (i.storyPoints ?? 0), 0);
    return total - done;
  });
  return { days, total, ideal, actual };
}

/** Minutes of work logged per issue id (optionally within a period) */
export function minutesByIssue(logs: WorkLog[], p?: Period) {
  const m = new Map<string, number>();
  for (const w of logs) if (!p || inPeriod(w.startedAt, p)) m.set(w.issueId, (m.get(w.issueId) ?? 0) + w.minutes);
  return m;
}

/** Rows → CSV text (quotes values that need it) */
export function toCsv(rows: (string | number | undefined)[][]) {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v === undefined ? '' : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
}

export function downloadCsv(filename: string, rows: (string | number | undefined)[][]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "2026-11" for a date (local) */
export function monthKey(d: Date | string) {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

/** First day of a "YYYY-MM" month and of the next month (local) */
export function monthRange(key: string): Period {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

export const NO_CLIENT = '__none__';

/**
 * Minutes logged per person × client within a period.
 * Logs on tickets without a client go to the NO_CLIENT column.
 */
export function hoursMatrix(logs: WorkLog[], clientOfIssue: (issueId: string) => string | undefined, p: Period) {
  const cells = new Map<string, Map<string, number>>(); // user -> client -> minutes
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  let grand = 0;
  for (const w of logs) {
    if (!inPeriod(w.startedAt, p)) continue;
    const client = clientOfIssue(w.issueId) ?? NO_CLIENT;
    const row = cells.get(w.userId) ?? cells.set(w.userId, new Map()).get(w.userId)!;
    row.set(client, (row.get(client) ?? 0) + w.minutes);
    rowTotals.set(w.userId, (rowTotals.get(w.userId) ?? 0) + w.minutes);
    colTotals.set(client, (colTotals.get(client) ?? 0) + w.minutes);
    grand += w.minutes;
  }
  return {
    cell: (user: string, client: string) => cells.get(user)?.get(client) ?? 0,
    rowTotal: (user: string) => rowTotals.get(user) ?? 0,
    colTotal: (client: string) => colTotals.get(client) ?? 0,
    grand,
  };
}

/** Share of a total as a whole percentage (0 when total is 0) */
export function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

export interface PeriodSummary {
  created: number;
  resolved: number;
  open: number;
  overdue: number;
  minutes: number;
  avgCycleDays: number | undefined;
  resolvedPoints: number;
}

/**
 * Headline numbers for one period. `open` / `overdue` are as of the period end
 * (a ticket counts as open if it was created before the end and not finished before it).
 */
export function periodSummary(issues: Issue[], logs: WorkLog[], p: Period, isDoneNow: (i: Issue) => boolean): PeriodSummary {
  const end = p.to.getTime();
  const ids = new Set(issues.map((i) => i.id));
  const resolved = issues.filter((i) => i.endAt && inPeriod(i.endAt, p) && isDoneNow(i));
  const openAtEnd = issues.filter((i) => Date.parse(i.createdAt) < end && !(i.endAt && Date.parse(i.endAt) < end && isDoneNow(i)));
  const cycles = resolved.map(cycleDays).filter((d): d is number => d != null);
  return {
    created: issues.filter((i) => inPeriod(i.createdAt, p)).length,
    resolved: resolved.length,
    open: openAtEnd.length,
    overdue: openAtEnd.filter((i) => i.dueDate && Date.parse(i.dueDate) < Math.min(end, Date.now())).length,
    minutes: logs.filter((w) => ids.has(w.issueId) && inPeriod(w.startedAt, p)).reduce((s, w) => s + w.minutes, 0),
    avgCycleDays: average(cycles),
    resolvedPoints: resolved.reduce((s, i) => s + (i.storyPoints ?? 0), 0),
  };
}

/** Change vs the previous value as a whole percentage; undefined when there is no base */
export function changePct(now: number, before: number) {
  if (!before) return now ? undefined : 0;
  return Math.round(((now - before) / before) * 100);
}
