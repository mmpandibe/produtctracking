/** Date maths for the Gantt and roadmap timeline (Step 14). Everything works in whole local days. */

export const DAY = 86_400_000;

export type Zoom = 'weeks' | 'month' | 'quarter' | 'half';

/** Each zoom shows a fixed number of days that is stretched to the available width (no horizontal scrolling) */
export const ZOOMS: { id: Zoom; label: string; days: number; tick: 'day' | 'week' | 'month' }[] = [
  { id: 'weeks', label: '2 weeks', days: 14, tick: 'day' },
  { id: 'month', label: '6 weeks', days: 42, tick: 'week' },
  { id: 'quarter', label: 'Quarter', days: 91, tick: 'week' },
  { id: 'half', label: '6 months', days: 182, tick: 'month' },
];

export const zoomOf = (id: Zoom) => ZOOMS.find((z) => z.id === id) ?? ZOOMS[2]!;

/** Local midnight of a date */
export function startOfDay(d: Date | number | string) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Monday of the week containing `t` */
export function startOfWeekMs(t: number) {
  const d = new Date(startOfDay(t));
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function addDaysMs(t: number, n: number) {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export interface Range {
  start: number; // local midnight
  days: number;
}

/** Visible window: starts on a Monday shortly before `anchor` (a quarter of the window is shown before it) */
export function rangeAround(anchor: number, zoom: Zoom): Range {
  const z = zoomOf(zoom);
  const lead = z.tick === 'day' ? 3 : Math.round(z.days / 6);
  return { start: startOfWeekMs(addDaysMs(startOfDay(anchor), -lead)), days: z.days };
}

/** Moves the window by most of its width */
export function shiftRange(r: Range, dir: 1 | -1): Range {
  const step = r.days <= 14 ? 7 : Math.round((r.days * 0.75) / 7) * 7;
  return { start: addDaysMs(r.start, dir * step), days: r.days };
}

export function rangeEnd(r: Range) {
  return addDaysMs(r.start, r.days);
}

/** Whole days between two local dates (DST-safe) */
export function daysBetween(a: number, b: number) {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
}

export interface Bar {
  /** % from the left edge of the timeline */
  left: number;
  width: number;
  /** The bar continues before / after the visible window */
  clipStart: boolean;
  clipEnd: boolean;
}

/**
 * Position of an item spanning from `start` to `end` (inclusive days) inside the window, or undefined when it is
 * completely outside. A one-day item gets a full day's width.
 */
export function barFor(start: number, end: number, r: Range): Bar | undefined {
  const s = daysBetween(r.start, start);
  const e = daysBetween(r.start, end) + 1;
  if (e <= 0 || s >= r.days) return undefined;
  const from = Math.max(0, s);
  const to = Math.min(r.days, Math.max(e, s + 1));
  return { left: (from / r.days) * 100, width: ((to - from) / r.days) * 100, clipStart: s < 0, clipEnd: e > r.days };
}

/** % position of a moment (e.g. the today line), or undefined outside the window */
export function pointFor(t: number, r: Range) {
  const pct = ((t - r.start) / (rangeEnd(r) - r.start)) * 100;
  return pct < 0 || pct > 100 ? undefined : pct;
}

export interface Tick {
  left: number;
  label: string;
  /** Stronger line (month start) */
  major: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Header ticks for the window: days, Mondays or month starts depending on the zoom */
export function ticksFor(r: Range, zoom: Zoom): Tick[] {
  const z = zoomOf(zoom);
  const out: Tick[] = [];
  for (let i = 0; i < r.days; i++) {
    const t = addDaysMs(r.start, i);
    const d = new Date(t);
    const left = (i / r.days) * 100;
    if (z.tick === 'day') out.push({ left, label: `${DAYS[d.getDay()]} ${d.getDate()}`, major: d.getDate() === 1 || d.getDay() === 1 });
    else if (z.tick === 'week' && d.getDay() === 1) out.push({ left, label: `${d.getDate()} ${MONTHS[d.getMonth()]}`, major: d.getDate() <= 7 });
    else if (z.tick === 'month' && d.getDate() === 1) out.push({ left, label: `${MONTHS[d.getMonth()]}${d.getMonth() === 0 ? ' ' + d.getFullYear() : ''}`, major: true });
  }
  return out;
}

/** Weekend shading for day-level zooms */
export function weekendsFor(r: Range): { left: number; width: number }[] {
  if (r.days > 42) return [];
  const out: { left: number; width: number }[] = [];
  for (let i = 0; i < r.days; i++) {
    const dow = new Date(addDaysMs(r.start, i)).getDay();
    if (dow === 6 || dow === 0) out.push({ left: (i / r.days) * 100, width: (1 / r.days) * 100 });
  }
  return out;
}

export function windowLabel(r: Range) {
  const a = new Date(r.start);
  const b = new Date(addDaysMs(r.start, r.days - 1));
  const fmt = (d: Date, year: boolean) => `${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ' ' + d.getFullYear() : ''}`;
  return `${fmt(a, a.getFullYear() !== b.getFullYear())} – ${fmt(b, true)}`;
}

/** Shifts an ISO timestamp by whole days, keeping its time of day */
export function shiftIso(iso: string, days: number) {
  return new Date(addDaysMs(Date.parse(iso), days)).toISOString();
}

/** Packs overlapping spans into as few lanes as possible (greedy, by start) */
export function packLanes<T extends { start: number; end: number }>(items: T[]): T[][] {
  const lanes: T[][] = [];
  for (const it of [...items].sort((a, b) => a.start - b.start)) {
    const lane = lanes.find((l) => l[l.length - 1]!.end < it.start);
    if (lane) lane.push(it);
    else lanes.push([it]);
  }
  return lanes;
}
