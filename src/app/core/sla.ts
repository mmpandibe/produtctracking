import type { SupportLevel } from './models';

/** Display data for the support levels */
export const SUPPORT_LEVELS: { id: SupportLevel; label: string; color: string }[] = [
  { id: 'l1', label: 'L1', color: '#0891b2' },
  { id: 'l2', label: 'L2', color: '#7c3aed' },
  { id: 'l3', label: 'L3', color: '#c2410c' },
];

export const levelOf = (id: SupportLevel | undefined) => SUPPORT_LEVELS.find((l) => l.id === id) ?? SUPPORT_LEVELS[0]!;

export const nextLevel = (id: SupportLevel): SupportLevel | undefined => (id === 'l1' ? 'l2' : id === 'l2' ? 'l3' : undefined);

/** running: on time · at_risk: under 25% of the target left · breached: past due · met: stopped on time */
export type ClockState = 'running' | 'at_risk' | 'breached' | 'met';

export interface SlaClock {
  state: ClockState;
  targetMinutes: number;
  dueAt: number; // epoch ms
  /** Minutes until due (negative = overdue); when stopped, measured at the stop time */
  leftMinutes: number;
  /** Minutes it took, when the clock has stopped */
  takenMinutes?: number;
}

/**
 * One SLA clock in calendar time: starts at `start`, due after `targetMinutes`, stops at `stoppedAt` (response or resolution).
 * Hold time is not paused yet (business hours / pause rules can come with the backend).
 */
export function slaClock(start: string, targetMinutes: number, stoppedAt: string | undefined, now: number): SlaClock {
  const t0 = Date.parse(start);
  const dueAt = t0 + targetMinutes * 60_000;
  if (stoppedAt) {
    const t1 = Date.parse(stoppedAt);
    return { state: t1 <= dueAt ? 'met' : 'breached', targetMinutes, dueAt, leftMinutes: Math.round((dueAt - t1) / 60_000), takenMinutes: Math.max(0, Math.round((t1 - t0) / 60_000)) };
  }
  const left = Math.round((dueAt - now) / 60_000);
  return { state: left < 0 ? 'breached' : left <= targetMinutes * 0.25 ? 'at_risk' : 'running', targetMinutes, dueAt, leftMinutes: left };
}

/** 30 -> "30m", 240 -> "4h", 1440 -> "1d", 2160 -> "1d 12h" (minutes dropped from day-long spans) */
export function formatDuration(minutes: number) {
  const m = Math.abs(Math.round(minutes));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  return [d && `${d}d`, h && `${h}h`, !d && min && `${min}m`].filter(Boolean).join(' ') || '0m';
}

/** Short label for a clock: "2h 10m left", "overdue 3h", "met in 25m", "late by 1h" */
export function clockLabel(c: SlaClock) {
  if (c.takenMinutes !== undefined) return c.state === 'met' ? `met in ${formatDuration(c.takenMinutes)}` : `late by ${formatDuration(-c.leftMinutes)}`;
  return c.leftMinutes < 0 ? `overdue ${formatDuration(-c.leftMinutes)}` : `${formatDuration(c.leftMinutes)} left`;
}

export const CLOCK_COLORS: Record<ClockState, string> = { running: '#2563eb', at_risk: '#d97706', breached: '#dc2626', met: '#16a34a' };
export const CLOCK_LABELS: Record<ClockState, string> = { running: 'On time', at_risk: 'At risk', breached: 'Breached', met: 'Met' };
