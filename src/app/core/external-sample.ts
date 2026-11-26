import {
  type AttendanceDay,
  type AttendanceSource,
  type DateKey,
  type DateRange,
  type LeaveBalance,
  type LeaveInput,
  type LeaveRequest,
  type ProductivityDay,
  type ProductivitySource,
  type RegularisationInput,
  type RegularisationRequest,
  type RequestKind,
  addDateKey,
  atTime,
  daysIn,
  isWeekend,
  leaveDays,
  toDateKey,
} from './external';

/**
 * Phase A stand-ins for the real laptop tracker and attendance system.
 * Days are generated deterministically from (employee, date) so they stay the same on every load; leave and
 * regularisation requests are kept in their own localStorage key, as if the external system had stored them.
 */

const SAMPLE_KEY = 'npro-ext-sample';
const ALLOWANCE = { sick: 12, casual: 12 };

interface SampleState {
  leaves: LeaveRequest[];
  regularisations: RegularisationRequest[];
  seeded: boolean;
}

/** Small fast seeded random generator; same seed → same sequence */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 0));
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/** Last weekday strictly before `k` */
function prevWeekday(k: DateKey, steps = 1) {
  let d = k;
  for (let i = 0; i < steps; ) {
    d = addDateKey(d, -1);
    if (!isWeekend(d)) i++;
  }
  return d;
}

function nextWeekday(k: DateKey, steps = 1) {
  let d = k;
  for (let i = 0; i < steps; ) {
    d = addDateKey(d, 1);
    if (!isWeekend(d)) i++;
  }
  return d;
}

export class SampleAttendanceSource implements AttendanceSource {
  readonly id = 'sample';
  readonly label = 'Sample data';

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly lateAfter: () => string = () => '10:00',
  ) {}

  private read(): SampleState {
    try {
      const raw = localStorage.getItem(SAMPLE_KEY);
      if (raw) return JSON.parse(raw) as SampleState;
    } catch {
      // fall through
    }
    return { leaves: [], regularisations: [], seeded: false };
  }

  private write(s: SampleState) {
    try {
      localStorage.setItem(SAMPLE_KEY, JSON.stringify(s));
    } catch {
      // ignore
    }
  }

  /** First use: a few realistic requests around today for the demo people (matched by employee id = email) */
  private state(employeeIds: string[]): SampleState {
    const s = this.read();
    if (s.seeded) return s;
    const today = toDateKey(new Date(this.now()));
    const has = (id: string) => employeeIds.includes(id);
    const stamp = (k: DateKey) => atTime(k, '09:15');
    const leave = (employeeId: string, type: LeaveRequest['type'], from: DateKey, to: DateKey, status: LeaveRequest['status'], reason: string, halfDay = false): LeaveRequest => ({
      id: newId(), employeeId, type, from, to, halfDay: halfDay || undefined, reason, status, appliedAt: stamp(prevWeekday(from, 2) < today ? prevWeekday(from, 2) : prevWeekday(today)),
      ...(status === 'approved' ? { decidedBy: 'meera@example.com', decidedAt: stamp(prevWeekday(from)) } : {}),
    });
    if (has('jordan@example.com')) s.leaves.push(leave('jordan@example.com', 'sick', prevWeekday(today, 7), prevWeekday(today, 6), 'approved', 'Fever'));
    if (has('chris@example.com')) s.leaves.push(leave('chris@example.com', 'casual', isWeekend(today) ? nextWeekday(today) : today, isWeekend(today) ? nextWeekday(today) : today, 'approved', 'Family function'));
    if (has('vikram@nimbus.test')) s.leaves.push(leave('vikram@nimbus.test', 'casual', nextWeekday(today, 4), nextWeekday(today, 5), 'pending', 'Travelling home'));
    if (has('lena@example.com')) s.leaves.push(leave('lena@example.com', 'sick', prevWeekday(today, 3), prevWeekday(today, 3), 'approved', 'Doctor appointment', true));
    if (has('jordan@example.com')) {
      const d = prevWeekday(today, 2);
      s.regularisations.push({ id: newId(), employeeId: 'jordan@example.com', date: d, punchIn: atTime(d, '09:20'), punchOut: atTime(d, '18:10'), reason: 'Forgot to punch out', status: 'pending', appliedAt: stamp(prevWeekday(today)) });
    }
    if (has('ana@example.com')) {
      const d = prevWeekday(today, 4);
      s.regularisations.push({ id: newId(), employeeId: 'ana@example.com', date: d, punchIn: atTime(d, '08:55'), punchOut: atTime(d, '17:40'), reason: 'Biometric reader was down', status: 'approved', appliedAt: stamp(prevWeekday(today, 3)), decidedBy: 'meera@example.com', decidedAt: stamp(prevWeekday(today, 3)) });
    }
    s.seeded = true;
    this.write(s);
    return s;
  }

  /** The generated day for one person, before requests are applied */
  private generated(employeeId: string, k: DateKey, today: DateKey, nowMs: number): AttendanceDay | undefined {
    if (k > today) return undefined;
    if (isWeekend(k)) return { employeeId, date: k, status: 'weekend', workedMinutes: 0 };
    const r = rng(`${employeeId}|${k}`);
    const roll = r();
    if (k < today && roll < 0.025) return { employeeId, date: k, status: 'absent', workedMinutes: 0 };
    const inMin = 8 * 60 + 40 + Math.round(r() * 85); // 08:40 – 10:05
    const length = 7.75 * 60 + Math.round(r() * 120); // 7h45 – 9h45
    const punchIn = atTime(k, `${Math.floor(inMin / 60)}:${inMin % 60}`);
    const inMs = Date.parse(punchIn);
    if (k === today) {
      if (nowMs < inMs) return { employeeId, date: k, status: 'absent', workedMinutes: 0 };
      const outMs = inMs + length * 60_000;
      if (nowMs < outMs) return { employeeId, date: k, status: 'present', punchIn, workedMinutes: Math.round((nowMs - inMs) / 60_000) };
      return { employeeId, date: k, status: 'present', punchIn, punchOut: new Date(outMs).toISOString(), workedMinutes: length };
    }
    if (roll < 0.07) return { employeeId, date: k, status: 'missed_punch', punchIn, workedMinutes: 0 };
    return { employeeId, date: k, status: 'present', punchIn, punchOut: new Date(inMs + length * 60_000).toISOString(), workedMinutes: length };
  }

  async days(range: DateRange, employeeIds: string[]): Promise<AttendanceDay[]> {
    const s = this.state(employeeIds);
    const nowMs = this.now();
    const today = toDateKey(new Date(nowMs));
    const late = this.lateAfter();
    const out: AttendanceDay[] = [];
    for (const e of employeeIds) {
      for (const k of daysIn(range)) {
        const leave = s.leaves.find((l) => l.employeeId === e && l.status === 'approved' && l.from <= k && l.to >= k);
        const reg = s.regularisations.find((g) => g.employeeId === e && g.date === k && g.status !== 'cancelled' && g.status !== 'rejected');
        let day = this.generated(e, k, today, nowMs);
        if (leave && !isWeekend(k) && !leave.halfDay) {
          day = { employeeId: e, date: k, status: 'leave', leaveType: leave.type, workedMinutes: 0 };
        } else if (reg?.status === 'approved') {
          day = { employeeId: e, date: k, status: 'present', punchIn: reg.punchIn, punchOut: reg.punchOut, workedMinutes: Math.round((Date.parse(reg.punchOut) - Date.parse(reg.punchIn)) / 60_000), regularised: true };
        } else if (reg && day) {
          // A pending correction exists because the punch out was missing
          day = { ...day, status: 'missed_punch', punchIn: day.punchIn ?? reg.punchIn, punchOut: undefined, workedMinutes: 0 };
        }
        if (day && leave?.halfDay && !isWeekend(k) && k <= today) {
          const half = Math.round(day.workedMinutes / 2);
          day = { ...day, status: 'half_day', leaveType: leave.type, workedMinutes: day.punchOut ? half : day.workedMinutes, punchOut: day.punchOut ? new Date(Date.parse(day.punchIn!) + half * 60_000).toISOString() : day.punchOut };
        }
        if (!day) continue;
        if (day.punchIn && day.status !== 'half_day') day.late = day.punchIn > atTime(k, late);
        out.push(day);
      }
    }
    return delay(out);
  }

  async leaves(range: DateRange, employeeIds: string[]) {
    const s = this.state(employeeIds);
    return delay(s.leaves.filter((l) => employeeIds.includes(l.employeeId) && l.to >= range.from && l.from <= range.to));
  }

  async regularisations(range: DateRange, employeeIds: string[]) {
    const s = this.state(employeeIds);
    return delay(s.regularisations.filter((g) => employeeIds.includes(g.employeeId) && g.date >= range.from && g.date <= range.to));
  }

  async balances(year: number, employeeIds: string[]): Promise<LeaveBalance[]> {
    const s = this.state(employeeIds);
    return delay(
      employeeIds.map((e) => {
        const used = (type: LeaveRequest['type']) =>
          s.leaves.filter((l) => l.employeeId === e && l.type === type && l.status === 'approved' && l.from.startsWith(String(year))).reduce((n, l) => n + leaveDays(l), 0);
        return { employeeId: e, year, sick: { allowed: ALLOWANCE.sick, used: used('sick') }, casual: { allowed: ALLOWANCE.casual, used: used('casual') } };
      }),
    );
  }

  async applyLeave(input: LeaveInput) {
    const s = this.read();
    if (input.to < input.from) throw new Error('The leave ends before it starts');
    if (input.halfDay && input.to !== input.from) throw new Error('A half day is a single day');
    if (!leaveDays(input)) throw new Error('Those dates are all weekend days');
    const clash = s.leaves.find((l) => l.employeeId === input.employeeId && (l.status === 'pending' || l.status === 'approved') && l.from <= input.to && l.to >= input.from);
    if (clash) throw new Error(`You already have leave from ${clash.from} to ${clash.to}`);
    const req: LeaveRequest = { ...input, id: newId(), reason: input.reason.trim(), status: 'pending', appliedAt: new Date(this.now()).toISOString() };
    s.leaves.push(req);
    this.write(s);
    return delay(req);
  }

  async requestRegularisation(input: RegularisationInput) {
    const s = this.read();
    const today = toDateKey(new Date(this.now()));
    if (input.date >= today) throw new Error('You can only correct days that are over');
    if (input.punchOut <= input.punchIn) throw new Error('Punch out must be after punch in');
    if (s.regularisations.some((g) => g.employeeId === input.employeeId && g.date === input.date && (g.status === 'pending' || g.status === 'approved'))) {
      throw new Error('That day already has a correction request');
    }
    const req: RegularisationRequest = { ...input, id: newId(), reason: input.reason.trim(), status: 'pending', appliedAt: new Date(this.now()).toISOString() };
    s.regularisations.push(req);
    this.write(s);
    return delay(req);
  }

  async decide(kind: RequestKind, id: string, decision: 'approved' | 'rejected', by: string) {
    const s = this.read();
    const list: (LeaveRequest | RegularisationRequest)[] = kind === 'leave' ? s.leaves : s.regularisations;
    const r = list.find((x) => x.id === id);
    if (!r) throw new Error('Request not found');
    if (r.status !== 'pending') throw new Error('This request was already decided');
    if (r.employeeId === by) throw new Error('You can’t approve your own request');
    Object.assign(r, { status: decision, decidedBy: by, decidedAt: new Date(this.now()).toISOString() });
    this.write(s);
    return delay(undefined);
  }

  async cancel(kind: RequestKind, id: string) {
    const s = this.read();
    const list: (LeaveRequest | RegularisationRequest)[] = kind === 'leave' ? s.leaves : s.regularisations;
    const r = list.find((x) => x.id === id);
    if (!r || r.status !== 'pending') throw new Error('Only pending requests can be withdrawn');
    r.status = 'cancelled';
    this.write(s);
    return delay(undefined);
  }

  /** Forget stored requests (used by "Reset sample data") */
  static reset() {
    try {
      localStorage.removeItem(SAMPLE_KEY);
    } catch {
      // ignore
    }
  }
}

export class SampleProductivitySource implements ProductivitySource {
  readonly id = 'sample';
  readonly label = 'Sample data';

  /** Productivity follows attendance: no laptop time on days the person wasn't in */
  constructor(private readonly attendance: AttendanceSource) {}

  async days(range: DateRange, employeeIds: string[]): Promise<ProductivityDay[]> {
    const att = await this.attendance.days(range, employeeIds);
    return att
      .filter((a) => a.punchIn && a.status !== 'weekend')
      .map((a) => {
        const r = rng(`prod|${a.employeeId}|${a.date}`);
        // Missed-punch days still have laptop time even though attendance can't count it
        const span = a.workedMinutes || 8 * 60 + Math.round(r() * 60);
        const logged = Math.round(span * (0.82 + r() * 0.14)); // laptop on for most of the day
        const active = Math.round(logged * (0.72 + r() * 0.2));
        const productive = Math.round(active * (0.68 + r() * 0.27));
        return { employeeId: a.employeeId, date: a.date, activeMinutes: active, productiveMinutes: productive, idleMinutes: logged - active };
      });
  }
}

/** Phase B: the same calls go to the nPro backend, which holds the API keys and calls the vendor's API */
export class BackendProxySource {
  readonly id = 'api';
  readonly label = 'Company system (via nPro backend)';
  private fail(): never {
    throw new Error('Live connection needs the nPro backend (Step 18). Use sample data for now.');
  }
  async days(): Promise<never> {
    this.fail();
  }
  leaves = this.days;
  regularisations = this.days;
  balances = this.days;
  applyLeave = this.days;
  requestRegularisation = this.days;
  decide = this.days;
  cancel = this.days;
}
