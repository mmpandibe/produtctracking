/**
 * Step 15: data from outside nPro — the laptop productivity tracker and the attendance / leave system.
 *
 * Pages never talk to those systems directly. They go through the two adapter interfaces below, so the sample
 * implementation (Phase A, `external-sample.ts`) can be swapped for a backend proxy in Phase B without touching the UI.
 * People are identified by an **employee id** (by default their work email; admins can set a code per person).
 */

/** Local calendar day, "2026-11-25" */
export type DateKey = string;

/** Inclusive day range */
export interface DateRange {
  from: DateKey;
  to: DateKey;
}

// ---------- Productivity (laptop tracker) ----------

/**
 * One person's tracked laptop time for one day.
 * attended (logged-in) time = active + idle; productive time is the part of active time spent in work apps.
 */
export interface ProductivityDay {
  employeeId: string;
  date: DateKey;
  activeMinutes: number;
  productiveMinutes: number;
  idleMinutes: number;
}

export interface ProductivitySource {
  readonly id: string;
  readonly label: string;
  days(range: DateRange, employeeIds: string[]): Promise<ProductivityDay[]>;
}

// ---------- Attendance ----------

export type LeaveType = 'sick' | 'casual';

/**
 * present · missed_punch (punched in, no punch out) · absent (no punch, no leave) · leave · half_day (half-day leave)
 * · weekend · holiday
 */
export type AttendanceStatus = 'present' | 'missed_punch' | 'absent' | 'leave' | 'half_day' | 'weekend' | 'holiday';

export interface AttendanceDay {
  employeeId: string;
  date: DateKey;
  status: AttendanceStatus;
  /** ISO timestamps */
  punchIn?: string;
  punchOut?: string;
  /** Minutes between punches (so far, for today) */
  workedMinutes: number;
  leaveType?: LeaveType;
  /** Times were corrected by an approved regularisation */
  regularised?: boolean;
  /** Punched in after the late threshold */
  late?: boolean;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  from: DateKey;
  to: DateKey;
  halfDay?: boolean;
  reason: string;
  status: RequestStatus;
  appliedAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

/** A request to correct a day's punch in / out (e.g. a forgotten punch out) */
export interface RegularisationRequest {
  id: string;
  employeeId: string;
  date: DateKey;
  punchIn: string;
  punchOut: string;
  reason: string;
  status: RequestStatus;
  appliedAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface LeaveBalance {
  employeeId: string;
  year: number;
  sick: { allowed: number; used: number };
  casual: { allowed: number; used: number };
}

export type LeaveInput = Pick<LeaveRequest, 'employeeId' | 'type' | 'from' | 'to' | 'halfDay' | 'reason'>;
export type RegularisationInput = Pick<RegularisationRequest, 'employeeId' | 'date' | 'punchIn' | 'punchOut' | 'reason'>;
export type RequestKind = 'leave' | 'regularisation';

export interface AttendanceSource {
  readonly id: string;
  readonly label: string;
  days(range: DateRange, employeeIds: string[]): Promise<AttendanceDay[]>;
  leaves(range: DateRange, employeeIds: string[]): Promise<LeaveRequest[]>;
  regularisations(range: DateRange, employeeIds: string[]): Promise<RegularisationRequest[]>;
  balances(year: number, employeeIds: string[]): Promise<LeaveBalance[]>;
  applyLeave(input: LeaveInput): Promise<LeaveRequest>;
  requestRegularisation(input: RegularisationInput): Promise<RegularisationRequest>;
  /** Approve or reject a pending request; `by` is the approver's employee id */
  decide(kind: RequestKind, id: string, decision: 'approved' | 'rejected', by: string): Promise<void>;
  /** The requester withdraws a pending request */
  cancel(kind: RequestKind, id: string): Promise<void>;
}

// ---------- Connector settings (kept in nPro) ----------

export type SourceMode = 'sample' | 'api';

export interface ConnectorConfig {
  mode: SourceMode;
  /** Endpoint the Phase B backend will call; API keys live on the server, never in the browser */
  endpoint: string;
  lastSyncAt?: string;
  lastError?: string;
}

export interface IntegrationConfig {
  productivity: ConnectorConfig;
  attendance: ConnectorConfig;
  /** nPro user id → employee id in the external systems (default: work email) */
  employeeCodes: Record<string, string>;
  /** "HH:MM" — punching in after this counts as late */
  lateAfter: string;
  /** Expected attended minutes in a full working day */
  dayMinutes: number;
}

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  productivity: { mode: 'sample', endpoint: '' },
  attendance: { mode: 'sample', endpoint: '' },
  employeeCodes: {},
  lateAfter: '10:00',
  dayMinutes: 8 * 60,
};

// ---------- Display helpers ----------

export const ATTENDANCE_META: Record<AttendanceStatus, { label: string; color: string; short: string }> = {
  present: { label: 'Present', short: 'In', color: '#15803d' },
  missed_punch: { label: 'Missed punch', short: 'Missed', color: '#b45309' },
  absent: { label: 'Absent', short: 'Absent', color: '#b91c1c' },
  leave: { label: 'On leave', short: 'Leave', color: '#7c3aed' },
  half_day: { label: 'Half-day leave', short: 'Half day', color: '#7c3aed' },
  weekend: { label: 'Weekend', short: '', color: '#94a3b8' },
  holiday: { label: 'Holiday', short: 'Holiday', color: '#0891b2' },
};

export const LEAVE_TYPES: { id: LeaveType; label: string }[] = [
  { id: 'sick', label: 'Sick leave' },
  { id: 'casual', label: 'Casual leave' },
];

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#b45309' },
  approved: { label: 'Approved', color: '#15803d' },
  rejected: { label: 'Rejected', color: '#b91c1c' },
  cancelled: { label: 'Cancelled', color: '#64748b' },
};

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a day key */
export function fromDateKey(k: DateKey) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDateKey(k: DateKey, days: number) {
  const d = fromDateKey(k);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Every day key in the range, in order */
export function daysIn(range: DateRange): DateKey[] {
  const out: DateKey[] = [];
  for (let k = range.from; k <= range.to; k = addDateKey(k, 1)) out.push(k);
  return out;
}

export function isWeekend(k: DateKey) {
  const day = fromDateKey(k).getDay();
  return day === 0 || day === 6;
}

/** ISO timestamp for a day key at "HH:MM" local time */
export function atTime(k: DateKey, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = fromDateKey(k);
  d.setHours(h!, m!, 0, 0);
  return d.toISOString();
}

/** "HH:MM" (local) of an ISO timestamp */
export function timeOf(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Working days (Mon–Fri) a leave covers; half a day for half-day leave */
export function leaveDays(l: Pick<LeaveRequest, 'from' | 'to' | 'halfDay'>) {
  if (l.halfDay) return 0.5;
  return daysIn({ from: l.from, to: l.to }).filter((k) => !isWeekend(k)).length;
}

/** "7h 30m" style hours for minutes */
export function hours(min: number) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`;
}
