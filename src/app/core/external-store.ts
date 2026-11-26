import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DataStore } from './data-store';
import {
  type AttendanceDay,
  type AttendanceSource,
  type ConnectorConfig,
  DEFAULT_INTEGRATION_CONFIG,
  type DateKey,
  type DateRange,
  type IntegrationConfig,
  type LeaveBalance,
  type LeaveInput,
  type LeaveRequest,
  type ProductivityDay,
  type ProductivitySource,
  type RegularisationInput,
  type RegularisationRequest,
  type RequestKind,
  addDateKey,
  toDateKey,
} from './external';
import { BackendProxySource, SampleAttendanceSource, SampleProductivitySource } from './external-sample';
import type { ID, User } from './models';

const CONFIG_KEY = 'npro-integrations';

/** External records, re-keyed from employee id to nPro user id */
export type Keyed<T> = T & { userId: ID };

function loadConfig(): IntegrationConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_INTEGRATION_CONFIG, ...(JSON.parse(raw) as Partial<IntegrationConfig>) };
  } catch {
    // ignore
  }
  return structuredClone(DEFAULT_INTEGRATION_CONFIG);
}

/**
 * Step 15: connector settings + the latest data pulled from the productivity tracker and the attendance system.
 * Fetches for every tracked person (in Phase B the backend scopes this); pages show only `visibleUserIds`.
 */
@Injectable({ providedIn: 'root' })
export class ExternalStore {
  private readonly store = inject(DataStore);

  readonly config = signal<IntegrationConfig>(loadConfig());

  /** Test hook: the clock the sample sources use */
  clock: () => number = () => Date.now();

  private readonly sampleAttendance = new SampleAttendanceSource(
    () => this.clock(),
    () => this.config().lateAfter,
  );
  private readonly sampleProductivity = new SampleProductivitySource(this.sampleAttendance);
  private readonly proxy = new BackendProxySource() as unknown as AttendanceSource & ProductivitySource;

  readonly range = signal<DateRange | undefined>(undefined);
  /** Changes only when something that affects fetched data changes (not on sync stamps) */
  readonly sourceKey = computed(() => {
    const c = this.config();
    return JSON.stringify([c.attendance.mode, c.productivity.mode, c.employeeCodes, c.lateAfter, this.trackedUsers().map((u) => u.id)]);
  });
  readonly loading = signal(false);
  readonly productivity = signal<Keyed<ProductivityDay>[]>([]);
  readonly attendance = signal<Keyed<AttendanceDay>[]>([]);
  readonly leaves = signal<Keyed<LeaveRequest>[]>([]);
  readonly regularisations = signal<Keyed<RegularisationRequest>[]>([]);
  readonly balances = signal<Keyed<LeaveBalance>[]>([]);
  /** Errors from the last sync, per connector */
  readonly errors = signal<{ productivity?: string; attendance?: string }>({});

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config()));
      } catch {
        // ignore
      }
    });
  }

  get attendanceSource(): AttendanceSource {
    return this.config().attendance.mode === 'api' ? this.proxy : this.sampleAttendance;
  }

  get productivitySource(): ProductivitySource {
    return this.config().productivity.mode === 'api' ? this.proxy : this.sampleProductivity;
  }

  // ---------- People ----------

  /** People whose laptop time and attendance are tracked: active internal and vendor staff */
  readonly trackedUsers = computed(() => this.store.allUsers().filter((u) => !u.inactive && u.kind !== 'client' && u.role !== 'production_user'));

  /** Who the signed-in person may see: just themselves for developers / testers, else everyone in their scope */
  readonly visibleUserIds = computed(() => {
    const me = this.store.currentUser();
    if (this.store.access().ownTimeOnly) return new Set([me.id]);
    const scope = new Set(this.store.users().map((u) => u.id));
    return new Set(this.trackedUsers().filter((u) => scope.has(u.id)).map((u) => u.id));
  });

  readonly visibleUsers = computed(() => {
    const ids = this.visibleUserIds();
    return this.trackedUsers().filter((u) => ids.has(u.id));
  });

  employeeId(u: Pick<User, 'id' | 'email'>) {
    return this.config().employeeCodes[u.id]?.trim() || u.email.toLowerCase();
  }

  private readonly userByEmployee = computed(() => new Map(this.trackedUsers().map((u) => [this.employeeId(u), u.id])));

  userOfEmployee(employeeId: string | undefined) {
    return employeeId ? this.store.userById(this.userByEmployee().get(employeeId)) : undefined;
  }

  /** Managers approve requests of the people reporting to them; admins approve anyone's. Never your own. */
  canApprove(userId: ID) {
    const me = this.store.currentUser();
    if (userId === me.id) return false;
    if (me.role === 'admin') return true;
    return this.store.reportsOf(me.id).some((u) => u.id === userId);
  }

  // ---------- Settings ----------

  updateConnector(kind: 'productivity' | 'attendance', patch: Partial<ConnectorConfig>) {
    this.config.update((c) => ({ ...c, [kind]: { ...c[kind], ...patch } }));
  }

  updateConfig(patch: Partial<Pick<IntegrationConfig, 'lateAfter' | 'dayMinutes'>>) {
    this.config.update((c) => ({ ...c, ...patch }));
  }

  /** Set (or clear, with '') a person's employee id; ids must be unique */
  setEmployeeCode(userId: ID, code: string) {
    const value = code.trim();
    const other = this.trackedUsers().find((u) => u.id !== userId && this.employeeId(u) === value.toLowerCase());
    if (value && other) throw new Error(`${value} is already used by ${other.name}`);
    this.config.update((c) => {
      const codes = { ...c.employeeCodes };
      if (value) codes[userId] = value.toLowerCase();
      else delete codes[userId];
      return { ...c, employeeCodes: codes };
    });
  }

  resetSampleData() {
    SampleAttendanceSource.reset();
    const r = this.range();
    if (r) void this.load(r);
  }

  // ---------- Loading ----------

  private key<T extends { employeeId: string }>(rows: T[]): Keyed<T>[] {
    const map = this.userByEmployee();
    return rows.flatMap((r) => {
      const userId = map.get(r.employeeId);
      return userId ? [{ ...r, userId }] : [];
    });
  }

  /**
   * Pull both systems for a range. Requests are loaded for a wider window (from 60 days before to 60 days after)
   * so pending and upcoming leave shows up whatever week is on screen.
   */
  async load(range: DateRange) {
    this.range.set(range);
    this.loading.set(true);
    const ids = this.trackedUsers().map((u) => this.employeeId(u));
    const wide: DateRange = { from: addDateKey(range.from, -60), to: addDateKey(range.to, 60) };
    const year = Number(toDateKey(new Date(this.clock())).slice(0, 4));
    const errors: { productivity?: string; attendance?: string } = {};
    const stamp = new Date(this.clock()).toISOString();
    try {
      const src = this.attendanceSource;
      const [days, leaves, regs, balances] = await Promise.all([src.days(range, ids), src.leaves(wide, ids), src.regularisations(wide, ids), src.balances(year, ids)]);
      this.attendance.set(this.key(days));
      this.leaves.set(this.key(leaves));
      this.regularisations.set(this.key(regs));
      this.balances.set(this.key(balances));
      this.updateConnector('attendance', { lastSyncAt: stamp, lastError: undefined });
    } catch (err) {
      errors.attendance = (err as Error).message;
      this.attendance.set([]);
      this.leaves.set([]);
      this.regularisations.set([]);
      this.balances.set([]);
      this.updateConnector('attendance', { lastError: errors.attendance });
    }
    try {
      this.productivity.set(this.key(await this.productivitySource.days(range, ids)));
      this.updateConnector('productivity', { lastSyncAt: stamp, lastError: undefined });
    } catch (err) {
      errors.productivity = (err as Error).message;
      this.productivity.set([]);
      this.updateConnector('productivity', { lastError: errors.productivity });
    }
    this.errors.set(errors);
    this.loading.set(false);
  }

  private reload() {
    const r = this.range();
    return r ? this.load(r) : Promise.resolve();
  }

  // ---------- Lookups ----------

  dayOf(userId: ID, date: DateKey) {
    return this.attendance().find((a) => a.userId === userId && a.date === date);
  }

  productivityOf(userId: ID, date: DateKey) {
    return this.productivity().find((p) => p.userId === userId && p.date === date);
  }

  balanceOf(userId: ID) {
    return this.balances().find((b) => b.userId === userId);
  }

  // ---------- Requests (sent to the attendance system) ----------

  async applyLeave(input: Omit<LeaveInput, 'employeeId'>) {
    const me = this.store.currentUser();
    await this.attendanceSource.applyLeave({ ...input, employeeId: this.employeeId(me) });
    await this.reload();
  }

  async requestRegularisation(input: Omit<RegularisationInput, 'employeeId'>) {
    const me = this.store.currentUser();
    await this.attendanceSource.requestRegularisation({ ...input, employeeId: this.employeeId(me) });
    await this.reload();
  }

  async decide(kind: RequestKind, req: Keyed<LeaveRequest | RegularisationRequest>, decision: 'approved' | 'rejected') {
    if (!this.canApprove(req.userId)) throw new Error('Only their manager or an admin can decide this');
    await this.attendanceSource.decide(kind, req.id, decision, this.employeeId(this.store.currentUser()));
    await this.reload();
  }

  async cancel(kind: RequestKind, req: Keyed<LeaveRequest | RegularisationRequest>) {
    if (req.userId !== this.store.currentUser().id) throw new Error('Only the person who asked can withdraw it');
    await this.attendanceSource.cancel(kind, req.id);
    await this.reload();
  }
}

