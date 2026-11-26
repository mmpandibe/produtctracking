import { Injectable, computed, effect, signal } from '@angular/core';
import { AUTOMATION_ID, AUTOMATION_USER, LOG_LIMIT, MAX_CHAIN, allConditionsMatch, defaultAutomations, triggerOf } from './automation';
import type {
  Activity, Attachment, AutomationAction, AutomationRule, AutomationRun, AutomationTrigger, Client, Comment, CustomFieldDef, CustomFieldType, DataState, Division, ID, Issue, IssueType, Priority, Product, ProductLifecycle,
  Roadmap, RoadmapStatus, Role, RunningTimer, SlaPolicy, Sprint, SupportLevel, SupportLevelConfig, StatusCategory, Team, User, UserKind, Vendor, WorkActivity, Workflow,
  WorkflowStatus, WorkLog,
} from './models';
import { api } from './api';
import { fileStore } from './file-store';
import { type SyncChange, applyChanges, diffState } from './state-diff';
import { migrateV10, migrateV9 } from './migrate';
import { type SlaClock, nextLevel, slaClock } from './sla';
import { type Capability, can } from './roles';
import { defaultSlaPolicies, defaultWorkflow, seedData } from './seed';
import { PALETTE, now, uid } from './utils';

const STORAGE_KEY = 'npro-data';
/** Bump when the stored shape changes; older data is replaced with fresh demo data. */
const STORAGE_VERSION = 11;
/** Largest file accepted as an attachment */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface NewProductInput {
  name: string;
  key: string;
  description?: string;
  version?: string;
  githubUrl?: string;
  websiteUrl?: string;
  lifecycle: ProductLifecycle;
  leadId: ID;
  clientIds: ID[];
  color: string;
  divisionId?: ID;
  memberIds?: ID[];
}

export interface NewIssueInput {
  productId: ID;
  type: IssueType;
  summary: string;
  description?: string;
  statusId?: ID; // defaults to the workflow's first status
  priority: Priority;
  assigneeId?: ID;
  reporterId?: ID; // defaults to the current user
  clientId?: ID;
  parentId?: ID;
  sprintId?: ID;
  storyPoints?: number;
  labels?: string[];
  startDate?: string;
  startAt?: string;
  endAt?: string;
  dueDate?: string;
  estimateMinutes?: number;
  progress?: number;
  estimatedBenefits?: string;
  achievedBenefits?: string;
  round?: number;
  customFields?: Record<ID, unknown>;
  /** Support level; leave out to pick one automatically (support / request tickets and production users' tickets start at L1), null for none */
  supportLevel?: SupportLevel | null;
}

export interface StatusInput {
  name: string;
  category: StatusCategory;
  color: string;
}

export interface AccessScope {
  /** Admin: no filtering */
  all: boolean;
  productIds: Set<ID>;
  userIds: Set<ID>;
  /** Production users see only tickets they raised (or their client's) */
  ownTicketsOnly: boolean;
  /** Developers, testers and production users see only their own time entries */
  ownTimeOnly: boolean;
}

export interface DivisionInput {
  name: string;
  description?: string;
  headId?: ID;
  color: string;
}

export interface TeamInput {
  name: string;
  divisionId: ID;
  description?: string;
  managerId?: ID;
}

export interface UserInput {
  name: string;
  email: string;
  kind: UserKind;
  role: Role;
  title?: string;
  /** Required for internal (in-house) people */
  employeeId?: string;
  teamId?: ID;
  managerId?: ID;
  vendorId?: ID;
  clientId?: ID;
}

export interface VendorInput {
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

export interface CustomFieldInput {
  name: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  productId?: ID; // undefined = all products
}

export interface RoadmapInput {
  name: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  status: RoadmapStatus;
  completedAt?: string;
  achievedBenefits?: string;
}

export interface ClientInput {
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

export interface SprintInput {
  name: string;
  goal?: string;
  startDate?: string; // ISO
  endDate?: string; // ISO
  roadmapId?: string;
}

export interface SprintStats {
  total: number;
  done: number;
  points: number;
  donePoints: number;
  unestimated: number;
}

export interface NewWorkLogInput {
  date: string; // ISO
  minutes: number;
  activity: WorkActivity;
  note?: string;
}

export type AutomationRuleInput = Pick<AutomationRule, 'name' | 'productId' | 'trigger' | 'conditions' | 'actions'> & { enabled?: boolean };

/** Fields added after a storage version was introduced get their defaults here */
function withDefaults(s: DataState): DataState {
  const valid = (s.automations ?? []).filter((r) => Array.isArray(r.actions) && typeof r.runCount === 'number');
  return {
    ...s,
    summaryNotes: s.summaryNotes ?? {},
    // Step 17: data saved before automation existed gets the demo rules once
    automations: valid.length || s.automationLog ? valid : defaultAutomations(new Date().toISOString(), s.users.find((u) => u.role === 'admin')?.id ?? s.currentUserId),
    automationLog: s.automationLog ?? [],
    // Employee IDs (added after Step 18b): the demo in-house people get theirs once
    users: s.users.map((u) => (u.kind === 'internal' && !u.employeeId && DEMO_EMPLOYEE_IDS[u.id] && !s.users.some((x) => x.employeeId === DEMO_EMPLOYEE_IDS[u.id]) ? { ...u, employeeId: DEMO_EMPLOYEE_IDS[u.id] } : u)),
  };
}

const DEMO_EMPLOYEE_IDS: Record<string, string> = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13].map((n) => ['u' + n, 'EMP-' + String(n).padStart(3, '0')]));

function load(): DataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version: number; state: DataState };
      // Fields added later without a breaking change get their defaults here
      if (parsed.version === STORAGE_VERSION) return withDefaults(parsed.state);
      // Step 11 changed roles and added the organisation; earlier data is upgraded, not replaced
      if (parsed.version === 10) return withDefaults(migrateV10(parsed.state));
      if (parsed.version === 9) return withDefaults(migrateV10(migrateV9(parsed.state)));
    }
  } catch {
    // storage unavailable or corrupt: fall back to demo data
  }
  return seedData();
}

/**
 * Single source of truth for all app data (Phase A: kept in localStorage).
 * Later this service will call a backend API instead; components won't need to change.
 */
@Injectable({ providedIn: 'root' })
export class DataStore {
  private readonly state = signal<DataState>(load());

  readonly currentUser = computed(() => {
    const s = this.state();
    return s.users.find((u) => u.id === s.currentUserId) ?? s.users[0]!;
  });

  /**
   * What the signed-in person may see (Step 12). Pages read the scoped lists below, so filtering happens in one place.
   * UI-only until the Phase B backend checks the same rules on the server.
   */
  readonly access = computed<AccessScope>(() => {
    const s = this.state();
    const me = this.currentUser();
    if (me.role === 'admin') {
      return { all: true, productIds: new Set(s.products.map((p) => p.id)), userIds: new Set(s.users.map((u) => u.id)), ownTicketsOnly: false, ownTimeOnly: false };
    }
    const productIds = new Set(s.products.filter((p) => p.leadId === me.id || p.memberIds.includes(me.id)).map((p) => p.id));
    const userIds = new Set<ID>([me.id]);
    if (me.role === 'division_head') {
      const divIds = new Set(s.divisions.filter((d) => d.headId === me.id).map((d) => d.id));
      s.products.filter((p) => p.divisionId && divIds.has(p.divisionId)).forEach((p) => productIds.add(p.id));
      divIds.forEach((d) => this.divisionMembers(d).forEach((u) => userIds.add(u.id)));
      this.reportsOf(me.id).forEach((u) => userIds.add(u.id));
    } else if (me.role === 'assistant_manager') {
      const teamIds = new Set(s.teams.filter((t) => t.managerId === me.id).map((t) => t.id));
      s.users.filter((u) => u.teamId && teamIds.has(u.teamId)).forEach((u) => userIds.add(u.id));
      this.reportsOf(me.id).forEach((u) => userIds.add(u.id));
    } else if (me.role === 'production_user' && me.clientId) {
      // Client users can raise tickets on every product their company uses
      s.products.filter((p) => p.clientIds.includes(me.clientId!)).forEach((p) => productIds.add(p.id));
    }
    // Everyone working on a visible product can be seen (needed to assign work), except by production users
    if (me.role !== 'production_user') {
      s.products.filter((p) => productIds.has(p.id)).forEach((p) => [p.leadId, ...p.memberIds].forEach((id) => userIds.add(id)));
    }
    return {
      all: false,
      productIds,
      userIds,
      ownTicketsOnly: me.role === 'production_user',
      ownTimeOnly: ['developer', 'tester', 'production_user'].includes(me.role),
    };
  });

  readonly users = computed(() => {
    const a = this.access();
    return a.all ? this.state().users : this.state().users.filter((u) => a.userIds.has(u.id));
  });
  /** Every person, ignoring the access scope (organisation admin) */
  readonly allUsers = computed(() => this.state().users);
  /** People who can be picked for new work (not deactivated) */
  readonly activeUsers = computed(() => this.users().filter((u) => !u.inactive));
  readonly divisions = computed(() => this.state().divisions);
  readonly teams = computed(() => this.state().teams);
  readonly vendors = computed(() => this.state().vendors);
  readonly products = computed(() => {
    const a = this.access();
    return a.all ? this.state().products : this.state().products.filter((p) => a.productIds.has(p.id));
  });
  readonly clients = computed(() => {
    if (this.access().all) return this.state().clients;
    const me = this.currentUser();
    if (me.clientId) return this.state().clients.filter((c) => c.id === me.clientId);
    const ids = new Set(this.products().flatMap((p) => p.clientIds));
    return this.state().clients.filter((c) => ids.has(c.id));
  });
  /** Every client, ignoring the access scope */
  readonly allClients = computed(() => this.state().clients);
  readonly workflows = computed(() => this.state().workflows);
  readonly issues = computed(() => {
    const a = this.access();
    if (a.all) return this.state().issues;
    const me = this.currentUser();
    return this.state().issues.filter(
      (i) => a.productIds.has(i.productId) && (!a.ownTicketsOnly || i.reporterId === me.id || (!!me.clientId && i.clientId === me.clientId)),
    );
  });
  readonly comments = computed(() => this.state().comments);
  readonly sprints = computed(() => {
    const a = this.access();
    return a.all ? this.state().sprints : this.state().sprints.filter((sp) => a.productIds.has(sp.productId));
  });
  readonly roadmaps = computed(() => {
    const a = this.access();
    return a.all ? this.state().roadmaps : this.state().roadmaps.filter((r) => a.productIds.has(r.productId));
  });
  readonly slaPolicies = computed(() => this.state().slaPolicies);
  readonly supportLevels = computed(() => this.state().supportLevels);
  /** Time entries on visible tickets by visible people; developers, testers and production users see only their own */
  readonly workLogs = computed(() => {
    const a = this.access();
    if (a.all) return this.state().workLogs;
    const me = this.currentUser().id;
    const issueIds = new Set(this.issues().map((i) => i.id));
    return this.state().workLogs.filter((w) => issueIds.has(w.issueId) && (a.ownTimeOnly ? w.userId === me : a.userIds.has(w.userId)));
  });
  readonly activities = computed(() => this.state().activities);
  readonly customFields = computed(() => this.state().customFields);
  /** The current user's running Start/Stop timer, if any */
  readonly activeTimer = computed(() => {
    const s = this.state();
    return s.timers.find((t) => t.userId === s.currentUserId);
  });
  readonly attachments = computed(() => this.state().attachments);

  constructor() {
    effect(() => {
      const state = this.state();
      // Server mode (Step 18b): send what changed instead of keeping data in this browser
      if (this.remote()) {
        this.queueSync(state);
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state }));
      } catch {
        // ignore quota / private-mode errors
      }
    });
  }

  // ---- Server mode (Step 18b) ----

  /** True when data comes from the nPro API (signed in) rather than this browser's demo storage */
  readonly remote = signal(false);
  /** Last problem saving to the server (the data is reloaded from the server when this happens) */
  readonly syncError = signal('');
  /** Changes waiting to be saved or being saved */
  readonly syncPending = signal(0);
  /** State as the server last confirmed it; changes are worked out against this */
  private synced?: DataState;
  private syncChain: Promise<void> = Promise.resolve();

  /** Replaces all data with a server snapshot and switches to server mode */
  hydrate(server: DataState) {
    const { version, ...rest } = server as DataState & { version?: number };
    const state = withDefaults({ ...rest, summaryNotes: rest.summaryNotes ?? {} });
    this.synced = state;
    if (version !== undefined) this.serverVersion = version;
    this.remote.set(true);
    this.state.set(state);
    this.startPolling();
  }

  /** Last data version seen from the server (Step 18c) */
  private serverVersion?: number;
  private pollHandle?: ReturnType<typeof setInterval>;

  /** Every 30 s, while the tab is visible and nothing is waiting to be saved, reload when someone else changed data */
  private startPolling() {
    if (this.pollHandle || typeof window === 'undefined') return;
    this.pollHandle = setInterval(async () => {
      if (!this.remote() || document.visibilityState !== 'visible' || this.syncPending() > 0) return;
      try {
        const { version } = await api<{ version: number }>('GET', '/api/state/version');
        if (version !== this.serverVersion && this.syncPending() === 0) await this.reloadFromServer();
      } catch {
        // offline for a moment: try again next time
      }
    }, 30_000);
  }

  /** Merges what the server changed on its own into both the shown state and the sync baseline */
  private applyServerChanges(changes: SyncChange[]) {
    if (!changes.length || !this.synced) return;
    this.synced = applyChanges(this.synced, changes);
    this.state.set(applyChanges(this.state(), changes));
  }

  /** Reloads everything the signed-in person may see from the server */
  async reloadFromServer() {
    this.hydrate(await api<DataState>('GET', '/api/state'));
  }

  private queueSync(next: DataState) {
    const prev = this.synced;
    if (!prev || prev === next) return;
    const changes = diffState(prev, next);
    this.synced = next;
    if (!changes.length) return;
    this.syncPending.update((n) => n + 1);
    this.syncChain = this.syncChain.then(async () => {
      try {
        const res = await api<{ version?: number; changes?: SyncChange[] }>('POST', '/api/sync', { changes });
        if (res?.version !== undefined) this.serverVersion = res.version;
        this.applyServerChanges(res?.changes ?? []);
        this.syncError.set('');
      } catch (err) {
        this.syncError.set((err as Error).message || 'Saving failed');
        // The server refused or failed: show its version again
        try {
          await this.reloadFromServer();
        } catch {
          // keep what we have; the banner explains
        }
      } finally {
        this.syncPending.update((n) => n - 1);
      }
    });
  }

  /** Resolves when every queued change has been sent */
  flushSync() {
    return this.syncChain;
  }

  /** Looks up anyone by id (not limited by access), so names on visible tickets always resolve */
  userById(id: ID | undefined) {
    if (id === AUTOMATION_ID) return AUTOMATION_USER;
    return this.state().users.find((u) => u.id === id);
  }

  // ---- Access (Step 12) ----

  /** Switches the "signed in as" person (stand-in for real login until Phase B) */
  switchUser(id: ID) {
    const u = this.state().users.find((x) => x.id === id);
    if (!u || u.inactive) throw new Error('Pick an active person');
    this.state.update((s) => ({ ...s, currentUserId: id }));
  }

  /** Role capability, optionally limited to a product the person can see */
  canDo(cap: Capability, productId?: ID) {
    if (!can(this.currentUser().role, cap)) return false;
    const a = this.access();
    return !productId || a.all || a.productIds.has(productId);
  }

  /** Staff can work on (edit, move) visible tickets; production users only follow theirs */
  canEditIssue(issue: Issue) {
    return this.currentUser().role !== 'production_user' && this.canDo('tickets', issue.productId);
  }

  /** Deleting tickets needs full rights on the product */
  canDeleteIssue(issue: Issue) {
    return this.canDo('products', issue.productId);
  }

  /** True when a ticket with this key exists at all (even if the signed-in person can't see it) */
  issueKeyExists(key: string) {
    return this.state().issues.some((i) => i.key.toUpperCase() === key.toUpperCase());
  }

  /** Archiving / deleting a product: admin, or the head of its division */
  canRemoveProduct(productId: ID) {
    const me = this.currentUser();
    if (me.role === 'admin') return true;
    const p = this.state().products.find((x) => x.id === productId);
    return me.role === 'division_head' && !!p?.divisionId && this.divisionById(p.divisionId)?.headId === me.id;
  }

  createProduct(input: NewProductInput): Product {
    const product: Product = {
      id: uid(),
      key: input.key.toUpperCase(),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      version: input.version?.trim() || undefined,
      githubUrl: input.githubUrl?.trim() || undefined,
      websiteUrl: input.websiteUrl?.trim() || undefined,
      lifecycle: input.lifecycle,
      leadId: input.leadId,
      clientIds: input.clientIds,
      divisionId: input.divisionId || undefined,
      memberIds: (input.memberIds ?? []).filter((m) => m !== input.leadId),
      color: input.color,
      workflowId: defaultWorkflow.id,
      issueCounter: 1,
      createdAt: now(),
    };
    const activity: Activity = {
      id: uid(), productId: product.id, userId: this.state().currentUserId,
      action: 'created product', to: product.name, createdAt: now(),
    };
    this.state.update((s) => ({ ...s, products: [...s.products, product], activities: [...s.activities, activity] }));
    return product;
  }

  updateProduct(id: ID, patch: Partial<Product>) {
    this.state.update((s) => ({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }

  archiveProduct(id: ID, archived: boolean) {
    this.updateProduct(id, { archived });
  }

  deleteProduct(id: ID) {
    const issueIds = new Set(this.state().issues.filter((i) => i.productId === id).map((i) => i.id));
    this.state().attachments.filter((a) => issueIds.has(a.issueId)).forEach((a) => void fileStore.delete(a.id).catch(() => undefined));
    this.state.update((s) => {
      const issueIds = new Set(s.issues.filter((i) => i.productId === id).map((i) => i.id));
      return {
        ...s,
        products: s.products.filter((p) => p.id !== id),
        issues: s.issues.filter((i) => i.productId !== id),
        sprints: s.sprints.filter((sp) => sp.productId !== id),
        roadmaps: s.roadmaps.filter((r) => r.productId !== id),
        workLogs: s.workLogs.filter((w) => !issueIds.has(w.issueId)),
        timers: s.timers.filter((t) => !issueIds.has(t.issueId)),
        comments: s.comments.filter((c) => !issueIds.has(c.issueId)),
        attachments: s.attachments.filter((a) => !issueIds.has(a.issueId)),
      };
    });
  }

  workflowFor(productId: ID | undefined) {
    const s = this.state();
    const wfId = s.products.find((p) => p.id === productId)?.workflowId;
    return s.workflows.find((w) => w.id === wfId) ?? s.workflows[0]!;
  }

  /** Creates a ticket keyed from its product (WEB-4) and bumps the product's counter. */
  createIssue(input: NewIssueInput): Issue {
    const s = this.state();
    const product = s.products.find((p) => p.id === input.productId);
    if (!product) throw new Error('Unknown product ' + input.productId);
    const ts = now();
    const issue: Issue = {
      id: uid(),
      key: `${product.key}-${product.issueCounter}`,
      productId: product.id,
      type: input.type,
      summary: input.summary.trim(),
      description: input.description?.trim() || undefined,
      statusId: input.statusId ?? this.workflowFor(product.id).statuses[0]!.id,
      priority: input.priority,
      assigneeId: input.assigneeId || undefined,
      reporterId: input.reporterId || s.currentUserId,
      clientId: input.clientId || undefined,
      parentId: input.parentId || undefined,
      sprintId: input.sprintId || undefined,
      storyPoints: input.storyPoints,
      labels: input.labels ?? [],
      startDate: input.startDate || undefined,
      startAt: input.startAt || undefined,
      endAt: input.endAt || undefined,
      dueDate: input.dueDate || undefined,
      estimateMinutes: input.estimateMinutes,
      progress: input.progress,
      estimatedBenefits: input.estimatedBenefits?.trim() || undefined,
      achievedBenefits: input.achievedBenefits?.trim() || undefined,
      round: input.round,
      customFields: cleanCustomValues(input.customFields ?? {}),
      supportLevel: 'supportLevel' in input ? input.supportLevel || undefined : this.defaultSupportLevel(input),
      createdAt: ts,
      updatedAt: ts,
    };
    const activity: Activity = {
      id: uid(), issueId: issue.id, productId: product.id, userId: s.currentUserId,
      action: 'created ticket', to: issue.key, createdAt: ts,
    };
    this.state.update((st) => ({
      ...st,
      issues: [...st.issues, issue],
      products: st.products.map((p) => (p.id === product.id ? { ...p, issueCounter: p.issueCounter + 1 } : p)),
      activities: [...st.activities, activity],
    }));
    this.fireRules('issue_created', issue.id);
    return this.state().issues.find((i) => i.id === issue.id) ?? issue;
  }

  /** Updates a ticket. Moving into a "done" status sets endAt; leaving "To Do" sets startAt (if not set). */
  updateIssue(id: ID, patch: Partial<Issue>) {
    const s = this.state();
    const before = s.issues.find((i) => i.id === id);
    if (!before) return;
    const ts = now();
    const next: Issue = { ...before, ...patch, updatedAt: ts };
    if (patch.customFields) next.customFields = cleanCustomValues(patch.customFields);
    const activities: Activity[] = [];
    if (patch.statusId && patch.statusId !== before.statusId) {
      const wf = this.workflowFor(before.productId);
      const from = wf.statuses.find((x) => x.id === before.statusId);
      const to = wf.statuses.find((x) => x.id === patch.statusId);
      if ((to?.category === 'in_progress' || to?.category === 'done') && !next.startAt) next.startAt = ts;
      if (to?.category === 'done' && !('endAt' in patch)) next.endAt = ts;
      if (to?.category !== 'done' && from?.category === 'done' && !('endAt' in patch)) next.endAt = undefined;
      // Picking up a support ticket counts as the first response
      if (next.supportLevel && !next.firstResponseAt && to?.category !== 'todo') next.firstResponseAt = ts;
      activities.push({ id: uid(), issueId: id, productId: before.productId, userId: this.actorId(), action: 'changed status', from: from?.name, to: to?.name, createdAt: ts });
    }
    // History entry listing the other fields that changed
    const LABELS: Partial<Record<keyof Issue, string>> = {
      summary: 'summary', description: 'description', type: 'type', priority: 'priority', assigneeId: 'assignee', clientId: 'client',
      parentId: 'parent', sprintId: 'sprint', storyPoints: 'story points', startDate: 'start date', dueDate: 'due date',
      estimateMinutes: 'estimate', progress: 'progress', labels: 'labels', estimatedBenefits: 'estimated benefits', achievedBenefits: 'achieved benefits',
      round: 'round', customFields: 'custom fields', supportLevel: 'support level',
    };
    const changed = (Object.keys(LABELS) as (keyof Issue)[]).filter((k) => k in patch && JSON.stringify(next[k]) !== JSON.stringify(before[k]));
    if (changed.length) {
      activities.push({ id: uid(), issueId: id, productId: before.productId, userId: this.actorId(), action: 'updated', to: changed.map((k) => LABELS[k]).join(', '), createdAt: ts });
    }
    this.state.update((st) => ({
      ...st,
      issues: st.issues.map((i) => (i.id === id ? next : i)),
      activities: [...st.activities, ...activities],
    }));
    if (next.statusId !== before.statusId) this.fireRules('status_changed', id, next.statusId);
    if (next.assigneeId !== before.assigneeId) this.fireRules('assignee_changed', id);
    if (next.priority !== before.priority) this.fireRules('priority_changed', id);
  }

  /** Deletes a ticket with its comments, time logs and attachments; child tickets lose their parent link. */
  deleteIssue(id: ID) {
    this.state().attachments.filter((a) => a.issueId === id).forEach((a) => void fileStore.delete(a.id).catch(() => undefined));
    this.state.update((s) => ({
      ...s,
      issues: s.issues.filter((i) => i.id !== id).map((i) => (i.parentId === id ? { ...i, parentId: undefined } : i)),
      workLogs: s.workLogs.filter((w) => w.issueId !== id),
      timers: s.timers.filter((t) => t.issueId !== id),
      comments: s.comments.filter((c) => c.issueId !== id),
      attachments: s.attachments.filter((a) => a.issueId !== id),
    }));
  }

  /** Board order of a ticket: its manual rank, or its creation time */
  rankOf(issue: Issue) {
    return issue.rank ?? Date.parse(issue.createdAt);
  }

  /**
   * Whether the workflow allows moving from one status to another.
   * No rules at all (`transitions: {}`) = any move; otherwise a status's list is exactly where it may go
   * (a status without an entry may go anywhere).
   */
  canTransition(productId: ID, fromId: ID, toId: ID) {
    if (fromId === toId) return true;
    const wf = this.workflowFor(productId);
    if (!wf.statuses.some((s) => s.id === toId)) return false;
    const allowed = wf.transitions[fromId];
    return !allowed || allowed.includes(toId);
  }

  /** Statuses a ticket may be set to right now: its current status plus every allowed move */
  allowedStatuses(issue: Issue): WorkflowStatus[] {
    return this.workflowFor(issue.productId).statuses.filter((s) => s.id === issue.statusId || this.canTransition(issue.productId, issue.statusId, s.id));
  }

  // ---- Workflows (Step 10) ----

  workflowById(id: ID | undefined) {
    return this.state().workflows.find((w) => w.id === id);
  }

  productsUsingWorkflow(id: ID) {
    return this.state().products.filter((p) => p.workflowId === id);
  }

  /** Whether transition rules are switched on for a workflow */
  isRestricted(wf: Workflow) {
    return Object.keys(wf.transitions).length > 0;
  }

  /** Tickets (of products using this workflow) currently in a status */
  statusUsage(workflowId: ID, statusId: ID) {
    const productIds = new Set(this.productsUsingWorkflow(workflowId).map((p) => p.id));
    return this.state().issues.filter((i) => productIds.has(i.productId) && i.statusId === statusId).length;
  }

  private patchWorkflow(id: ID, fn: (w: Workflow) => Workflow) {
    this.state.update((s) => ({ ...s, workflows: s.workflows.map((w) => (w.id === id ? fn(w) : w)) }));
  }

  /** Creates a workflow, copying statuses (same ids, so tickets map 1:1) and rules from `copyFromId` (default: the first workflow) */
  createWorkflow(name: string, copyFromId?: ID): Workflow {
    const src = this.workflowById(copyFromId) ?? this.state().workflows[0]!;
    const wf: Workflow = {
      id: uid(), name: name.trim() || `${src.name} (copy)`,
      statuses: src.statuses.map((st) => ({ ...st })),
      transitions: Object.fromEntries(Object.entries(src.transitions).map(([k, v]) => [k, [...v]])),
    };
    this.state.update((s) => ({ ...s, workflows: [...s.workflows, wf] }));
    return wf;
  }

  renameWorkflow(id: ID, name: string) {
    const n = name.trim();
    if (n) this.patchWorkflow(id, (w) => ({ ...w, name: n }));
  }

  /** Deletes a workflow that no product uses (the last workflow can't be deleted) */
  deleteWorkflow(id: ID): boolean {
    if (this.state().workflows.length <= 1 || this.productsUsingWorkflow(id).length) return false;
    this.state.update((s) => ({ ...s, workflows: s.workflows.filter((w) => w.id !== id) }));
    return true;
  }

  addStatus(workflowId: ID, input: StatusInput): WorkflowStatus {
    const name = input.name.trim();
    if (!name) throw new Error('Status name is required');
    const status: WorkflowStatus = { id: uid(), name, category: input.category, color: input.color };
    this.patchWorkflow(workflowId, (w) => {
      // With rules on, the new status may go anywhere and be reached from anywhere until rules are edited
      const transitions = this.isRestricted(w)
        ? { ...Object.fromEntries(Object.entries(w.transitions).map(([k, v]) => [k, [...v, status.id]])), [status.id]: w.statuses.map((x) => x.id) }
        : w.transitions;
      return { ...w, statuses: [...w.statuses, status], transitions };
    });
    return status;
  }

  updateStatus(workflowId: ID, statusId: ID, patch: Partial<StatusInput>) {
    const clean = { ...patch };
    if (clean.name !== undefined) {
      clean.name = clean.name.trim();
      if (!clean.name) delete clean.name;
    }
    this.patchWorkflow(workflowId, (w) => ({ ...w, statuses: w.statuses.map((st) => (st.id === statusId ? { ...st, ...clean } : st)) }));
  }

  /** Drag-reorder: moves the status at `from` to index `to` */
  moveStatus(workflowId: ID, from: number, to: number) {
    this.patchWorkflow(workflowId, (w) => {
      const list = [...w.statuses];
      if (from < 0 || from >= list.length) return w;
      const [item] = list.splice(from, 1);
      list.splice(Math.max(0, Math.min(to, list.length)), 0, item!);
      return { ...w, statuses: list };
    });
  }

  /**
   * Deletes a status. Tickets in it (products using this workflow) move to `replacementId`, which is required
   * when any ticket uses the status. A workflow keeps at least one status. Returns how many tickets moved.
   */
  deleteStatus(workflowId: ID, statusId: ID, replacementId?: ID): number {
    const wf = this.workflowById(workflowId);
    if (!wf || !wf.statuses.some((s) => s.id === statusId)) return 0;
    if (wf.statuses.length <= 1) throw new Error('A workflow needs at least one status');
    const used = this.statusUsage(workflowId, statusId);
    const replacement = wf.statuses.find((s) => s.id === replacementId && s.id !== statusId);
    if (used && !replacement) throw new Error('Choose a status for the tickets that use it');
    const productIds = new Set(this.productsUsingWorkflow(workflowId).map((p) => p.id));
    const removed = wf.statuses.find((s) => s.id === statusId)!;
    const ts = now();
    const userId = this.state().currentUserId;
    const activities: Activity[] = [];
    const issues = this.state().issues.map((i) => {
      if (!replacement || !productIds.has(i.productId) || i.statusId !== statusId) return i;
      activities.push({ id: uid(), issueId: i.id, productId: i.productId, userId, action: 'changed status', from: removed.name, to: replacement.name, createdAt: ts });
      return { ...i, statusId: replacement.id, updatedAt: ts };
    });
    this.state.update((s) => ({
      ...s,
      workflows: s.workflows.map((w) => {
        if (w.id !== workflowId) return w;
        const transitions = Object.fromEntries(
          Object.entries(w.transitions).filter(([k]) => k !== statusId).map(([k, v]) => [k, v.filter((x) => x !== statusId)]),
        );
        return { ...w, statuses: w.statuses.filter((x) => x.id !== statusId), transitions };
      }),
      issues,
      activities: [...s.activities, ...activities],
    }));
    return activities.length;
  }

  /** Switches transition rules on (every move allowed to start with) or off (`transitions: {}`) */
  setRestricted(workflowId: ID, on: boolean) {
    this.patchWorkflow(workflowId, (w) => ({
      ...w,
      transitions: on ? Object.fromEntries(w.statuses.map((s) => [s.id, w.statuses.filter((x) => x.id !== s.id).map((x) => x.id)])) : {},
    }));
  }

  /** Allows or forbids one from → to move (switches rules on if needed) */
  setTransition(workflowId: ID, fromId: ID, toId: ID, allowed: boolean) {
    if (fromId === toId) return;
    const wf = this.workflowById(workflowId);
    if (!wf) return;
    if (!this.isRestricted(wf)) this.setRestricted(workflowId, true);
    this.patchWorkflow(workflowId, (w) => {
      const all = w.statuses.filter((x) => x.id !== fromId).map((x) => x.id);
      const current = w.transitions[fromId] ?? all;
      const next = allowed ? [...current, toId] : current.filter((x) => x !== toId);
      // Keep workflow order
      return { ...w, transitions: { ...w.transitions, [fromId]: all.filter((x) => next.includes(x)) } };
    });
  }

  /** Allows every move (allowed = true) or none, keeping rules switched on */
  setAllTransitions(workflowId: ID, allowed: boolean) {
    this.patchWorkflow(workflowId, (w) => ({
      ...w,
      transitions: Object.fromEntries(w.statuses.map((s) => [s.id, allowed ? w.statuses.filter((x) => x.id !== s.id).map((x) => x.id) : []])),
    }));
  }

  /**
   * Gives a product another workflow. Ticket statuses are kept when the new workflow has them,
   * otherwise mapped to its first status of the same category (or its first status). Returns how many tickets changed status.
   */
  assignWorkflow(productId: ID, workflowId: ID): number {
    const wf = this.workflowById(workflowId);
    const product = this.state().products.find((p) => p.id === productId);
    if (!wf || !product || product.workflowId === workflowId) return 0;
    const old = this.workflowFor(productId);
    const ts = now();
    const userId = this.state().currentUserId;
    const activities: Activity[] = [];
    const issues = this.state().issues.map((i) => {
      if (i.productId !== productId || wf.statuses.some((st) => st.id === i.statusId)) return i;
      const from = old.statuses.find((st) => st.id === i.statusId);
      const target = wf.statuses.find((st) => st.category === from?.category) ?? wf.statuses[0]!;
      activities.push({ id: uid(), issueId: i.id, productId, userId, action: 'changed status', from: from?.name, to: target.name, createdAt: ts });
      return { ...i, statusId: target.id, updatedAt: ts };
    });
    this.state.update((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === productId ? { ...p, workflowId } : p)),
      issues,
      activities: [...s.activities, ...activities, { id: uid(), productId, userId, action: 'changed workflow', from: old.name, to: wf.name, createdAt: ts }],
    }));
    return activities.length;
  }

  // ---- Custom fields (Step 10) ----

  /** Fields shown on a product's tickets: all-product fields first, then the product's own */
  customFieldsFor(productId: ID | undefined) {
    const list = this.state().customFields.filter((f) => !f.productId || f.productId === productId);
    return [...list.filter((f) => !f.productId), ...list.filter((f) => f.productId)];
  }

  /** How many tickets have a value for a field */
  customFieldUsage(id: ID) {
    return this.state().issues.filter((i) => i.customFields[id] !== undefined).length;
  }

  private cleanField(input: CustomFieldInput) {
    const name = input.name.trim();
    if (!name) throw new Error('Field name is required');
    const options = input.type === 'select' ? [...new Set((input.options ?? []).map((o) => o.trim()).filter(Boolean))] : undefined;
    if (input.type === 'select' && !options!.length) throw new Error('A dropdown needs at least one option');
    return { name, type: input.type, options, required: !!input.required, productId: input.productId || undefined };
  }

  createCustomField(input: CustomFieldInput): CustomFieldDef {
    const field: CustomFieldDef = { id: uid(), ...this.cleanField(input) };
    this.state.update((s) => ({ ...s, customFields: [...s.customFields, field] }));
    return field;
  }

  /** Updates a field; changing its type clears the values already entered (they would no longer fit) */
  updateCustomField(id: ID, input: CustomFieldInput) {
    const before = this.state().customFields.find((f) => f.id === id);
    if (!before) return;
    const clean = this.cleanField(input);
    this.state.update((s) => ({
      ...s,
      customFields: s.customFields.map((f) => (f.id === id ? { ...f, ...clean } : f)),
      issues: before.type !== clean.type ? s.issues.map((i) => stripField(i, id)) : s.issues,
    }));
  }

  /** Deletes a field and removes its values from every ticket */
  deleteCustomField(id: ID) {
    this.state.update((s) => ({
      ...s,
      customFields: s.customFields.filter((f) => f.id !== id),
      issues: s.issues.map((i) => stripField(i, id)),
    }));
  }

  /**
   * Board drag & drop: puts a ticket into `statusId` between two neighbours (by rank).
   * Returns false when the workflow does not allow the move.
   */
  moveIssue(id: ID, statusId: ID, before?: Issue, after?: Issue): boolean {
    const issue = this.state().issues.find((i) => i.id === id);
    if (!issue || !this.canTransition(issue.productId, issue.statusId, statusId)) return false;
    const a = before ? this.rankOf(before) : undefined;
    const b = after ? this.rankOf(after) : undefined;
    const rank = a !== undefined && b !== undefined ? (a + b) / 2 : a !== undefined ? a + 1000 : b !== undefined ? b - 1000 : this.rankOf(issue);
    if (statusId === issue.statusId) {
      // Reorder only: no history entry, no updatedAt bump
      this.state.update((s) => ({ ...s, issues: s.issues.map((i) => (i.id === id ? { ...i, rank } : i)) }));
    } else {
      this.updateIssue(id, { statusId, rank });
    }
    return true;
  }

  /** Tickets that may be chosen as the parent of `issueId`: same product, not itself, not one of its descendants. */
  parentCandidates(productId: ID, issueId?: ID): Issue[] {
    const issues = this.state().issues.filter((i) => i.productId === productId);
    if (!issueId) return issues;
    const blocked = new Set<ID>([issueId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const i of issues) if (i.parentId && blocked.has(i.parentId) && !blocked.has(i.id)) { blocked.add(i.id); grew = true; }
    }
    return issues.filter((i) => !blocked.has(i.id));
  }

  // ---- Automation (Step 17) ----

  /** Set while a rule's actions run, so history, comments and further triggers know a rule did it */
  private automationActive = false;
  /** Rules running right now, outermost first (loop guard) */
  private ruleChain: ID[] = [];

  private actorId() {
    return this.automationActive ? AUTOMATION_ID : this.state().currentUserId;
  }

  /** Rules the signed-in person can see: admins all, others the rules on their products plus all-product rules */
  readonly automations = computed(() => {
    const a = this.access();
    const rules = this.state().automations;
    return a.all ? rules : rules.filter((r) => !r.productId || a.productIds.has(r.productId));
  });

  /** Run log entries on tickets the person can see */
  readonly automationLog = computed(() => {
    if (this.access().all) return this.state().automationLog;
    const ids = new Set(this.issues().map((i) => i.id));
    return this.state().automationLog.filter((r) => ids.has(r.issueId));
  });

  /** Admins manage every rule; division heads / assistant managers only rules on one of their products */
  canManageRule(productId: ID | undefined) {
    if (this.currentUser().role === 'admin') return true;
    return !!productId && this.canDo('products', productId);
  }

  private checkRule(input: AutomationRuleInput) {
    if (!input.name.trim()) throw new Error('Give the rule a name');
    if (!input.actions.length) throw new Error('Add at least one action');
    if (!this.canManageRule(input.productId)) throw new Error(input.productId ? 'You can’t add rules to this product' : 'Only admins can add rules for all products');
  }

  createRule(input: AutomationRuleInput): AutomationRule {
    this.checkRule(input);
    const rule: AutomationRule = {
      id: uid(), name: input.name.trim(), productId: input.productId || undefined, enabled: input.enabled ?? true,
      trigger: input.trigger, conditions: input.conditions, actions: input.actions,
      createdAt: now(), createdBy: this.state().currentUserId, runCount: 0,
    };
    this.state.update((s) => ({ ...s, automations: [...s.automations, rule] }));
    return rule;
  }

  updateRule(id: ID, input: AutomationRuleInput) {
    const old = this.state().automations.find((r) => r.id === id);
    if (!old) return;
    if (!this.canManageRule(old.productId)) throw new Error('You can’t change this rule');
    this.checkRule(input);
    const triggerChanged = JSON.stringify(old.trigger) !== JSON.stringify(input.trigger);
    this.state.update((s) => ({
      ...s,
      automations: s.automations.map((r) =>
        r.id === id
          ? { ...r, name: input.name.trim(), productId: input.productId || undefined, trigger: input.trigger, conditions: input.conditions, actions: input.actions, enabled: input.enabled ?? r.enabled, firedFor: triggerChanged ? [] : r.firedFor }
          : r,
      ),
    }));
  }

  setRuleEnabled(id: ID, enabled: boolean) {
    const r = this.state().automations.find((x) => x.id === id);
    if (!r || !this.canManageRule(r.productId)) throw new Error('You can’t change this rule');
    this.state.update((s) => ({ ...s, automations: s.automations.map((x) => (x.id === id ? { ...x, enabled } : x)) }));
  }

  deleteRule(id: ID) {
    const r = this.state().automations.find((x) => x.id === id);
    if (!r || !this.canManageRule(r.productId)) throw new Error('You can’t delete this rule');
    this.state.update((s) => ({ ...s, automations: s.automations.filter((x) => x.id !== id) }));
  }

  clearAutomationLog() {
    this.state.update((s) => ({ ...s, automationLog: [] }));
  }

  /** Runs every enabled rule for an event on a ticket (called by the store after the change is saved) */
  private fireRules(trigger: AutomationTrigger, issueId: ID, value?: string) {
    if (this.ruleChain.length >= MAX_CHAIN) return;
    // Server mode: the server runs every rule (Step 18c); the browser engine only runs in the offline demo
    if (this.remote()) return;
    const issue = this.state().issues.find((i) => i.id === issueId);
    if (!issue) return;
    const rules = this.state().automations.filter(
      (r) =>
        r.enabled &&
        r.trigger.type === trigger &&
        (!r.productId || r.productId === issue.productId) &&
        !this.ruleChain.includes(r.id) &&
        (trigger !== 'status_changed' || !r.trigger.value || r.trigger.value === value),
    );
    for (const r of rules) this.runRule(r.id, issueId, trigger);
  }

  /**
   * Checks the time-based triggers (SLA at risk / breached, due date passed) for every open ticket.
   * Each rule fires once per ticket. The shell calls this every minute. Returns how many rule runs happened.
   */
  runTimedRules(nowMs = Date.now()) {
    let runs = 0;
    if (this.remote()) return runs; // the server's background service does this (Step 18c)
    const today = new Date(new Date(nowMs).toDateString()).getTime();
    for (const rule of this.state().automations) {
      if (!rule.enabled || !triggerOf(rule.trigger.type).timed) continue;
      for (const issue of this.state().issues) {
        const fired = this.state().automations.find((r) => r.id === rule.id)?.firedFor ?? [];
        if ((rule.productId && issue.productId !== rule.productId) || fired.includes(issue.id) || this.isResolved(issue)) continue;
        let hit = false;
        if (rule.trigger.type === 'due_passed') hit = !!issue.dueDate && Date.parse(issue.dueDate) < today;
        else {
          const sla = this.slaOf(issue, nowMs);
          const states = sla ? [sla.response.state, sla.resolution.state] : [];
          hit = rule.trigger.type === 'sla_breached' ? states.includes('breached') : states.includes('at_risk');
        }
        if (hit && this.runRule(rule.id, issue.id, rule.trigger.type)) {
          runs++;
          this.state.update((s) => ({ ...s, automations: s.automations.map((r) => (r.id === rule.id ? { ...r, firedFor: [...(r.firedFor ?? []), issue.id] } : r)) }));
        }
      }
    }
    return runs;
  }

  /** Runs one rule on one ticket if its conditions match; records the run. Returns the run, or undefined when it didn't match. */
  private runRule(ruleId: ID, issueId: ID, trigger: AutomationTrigger): AutomationRun | undefined {
    const rule = this.state().automations.find((r) => r.id === ruleId);
    const issue = this.state().issues.find((i) => i.id === issueId);
    if (!rule || !issue) return undefined;
    const facts = {
      issue,
      category: this.workflowFor(issue.productId).statuses.find((s) => s.id === issue.statusId)?.category,
      reporter: this.state().users.find((u) => u.id === issue.reporterId),
    };
    if (!allConditionsMatch(facts, rule.conditions)) return undefined;
    // History first says which rule acted, then lists what it changed
    this.state.update((s) => ({ ...s, activities: [...s.activities, { id: uid(), issueId, productId: issue.productId, userId: AUTOMATION_ID, action: 'ran rule', to: rule.name, createdAt: now() }] }));
    const details: string[] = [];
    let failed = 0;
    const wasActive = this.automationActive;
    this.automationActive = true;
    this.ruleChain.push(rule.id);
    try {
      for (const action of rule.actions) {
        try {
          details.push(this.applyAction(rule.id, action, issueId));
        } catch (err) {
          failed++;
          details.push('Skipped: ' + (err as Error).message);
        }
      }
    } finally {
      this.ruleChain.pop();
      this.automationActive = wasActive;
    }
    const ts = now();
    const run: AutomationRun = {
      id: uid(), ruleId: rule.id, ruleName: rule.name, issueId, issueKey: issue.key, trigger, at: ts,
      outcome: failed === 0 ? 'done' : failed === rule.actions.length ? 'failed' : 'partial', details,
    };
    this.state.update((s) => ({
      ...s,
      automationLog: [run, ...s.automationLog].slice(0, LOG_LIMIT),
      automations: s.automations.map((r) => (r.id === rule.id ? { ...r, runCount: r.runCount + 1, lastRunAt: ts } : r)),
    }));
    return run;
  }

  /** Performs one action; returns a line for the run log, throws with the reason when it can't */
  private applyAction(ruleId: ID, action: AutomationAction, issueId: ID): string {
    const issue = this.state().issues.find((i) => i.id === issueId)!;
    const s = this.state();
    switch (action.type) {
      case 'set_status': {
        const wf = this.workflowFor(issue.productId);
        const to = wf.statuses.find((x) => x.id === action.value);
        const from = wf.statuses.find((x) => x.id === issue.statusId);
        if (!to) throw new Error('that status isn’t in this product’s workflow');
        if (to.id === issue.statusId) return `Already in ${to.name}`;
        if (!this.canTransition(issue.productId, issue.statusId, to.id)) throw new Error(`${from?.name ?? '?'} → ${to.name} isn’t allowed by the workflow`);
        this.updateIssue(issueId, { statusId: to.id });
        return `Status set to ${to.name}`;
      }
      case 'assign': {
        const u = s.users.find((x) => x.id === action.value);
        if (!u || u.inactive || u.role === 'production_user') throw new Error('that person can’t be assigned');
        if (issue.assigneeId === u.id) return `Already assigned to ${u.name}`;
        this.updateIssue(issueId, { assigneeId: u.id });
        return `Assigned to ${u.name}`;
      }
      case 'assign_round_robin': {
        const team = s.teams.find((t) => t.id === action.value);
        if (!team) throw new Error('that team no longer exists');
        const product = s.products.find((p) => p.id === issue.productId);
        const members = s.users.filter((u) => u.teamId === team.id && !u.inactive && u.role !== 'production_user');
        const onProduct = members.filter((u) => product && (product.leadId === u.id || product.memberIds.includes(u.id)));
        const pool = (onProduct.length ? onProduct : members).sort((a, b) => a.name.localeCompare(b.name));
        if (!pool.length) throw new Error(`nobody active in ${team.name}`);
        const rule = s.automations.find((r) => r.id === ruleId);
        const idx = (rule?.rrIndex ?? 0) % pool.length;
        const u = pool[idx]!;
        this.state.update((st) => ({ ...st, automations: st.automations.map((r) => (r.id === ruleId ? { ...r, rrIndex: idx + 1 } : r)) }));
        if (issue.assigneeId === u.id) return `Already assigned to ${u.name}`;
        this.updateIssue(issueId, { assigneeId: u.id });
        return `Assigned to ${u.name} (${team.name}, in turn)`;
      }
      case 'unassign':
        if (!issue.assigneeId) return 'Already unassigned';
        this.updateIssue(issueId, { assigneeId: undefined });
        return 'Unassigned';
      case 'set_priority':
        if (issue.priority === action.value) return `Priority already ${action.value}`;
        this.updateIssue(issueId, { priority: action.value as Priority });
        return `Priority set to ${action.value}`;
      case 'add_label': {
        const label = action.value.trim();
        if (issue.labels.includes(label)) return `Already labelled ${label}`;
        this.updateIssue(issueId, { labels: [...issue.labels, label] });
        return `Label ${label} added`;
      }
      case 'add_comment':
        this.addComment(issueId, action.value);
        return 'Comment added';
      case 'escalate': {
        const to = this.escalate(issueId);
        return `Escalated to ${to.toUpperCase()}`;
      }
    }
  }

  // ---- CXO summary notes ----

  summaryNote(key: string) {
    return this.state().summaryNotes[key] ?? '';
  }

  setSummaryNote(key: string, text: string) {
    this.state.update((s) => {
      const notes = { ...s.summaryNotes };
      if (text.trim()) notes[key] = text;
      else delete notes[key];
      return { ...s, summaryNotes: notes };
    });
  }

  // ---- Clients ----

  private cleanClient(input: ClientInput) {
    const t = (v?: string) => v?.trim() || undefined;
    return { name: input.name.trim(), contactName: t(input.contactName), contactEmail: t(input.contactEmail), contactPhone: t(input.contactPhone), notes: t(input.notes) };
  }

  /** Links a client to exactly these products (adds/removes it from each product's client list) */
  private linkProducts(clientId: ID, productIds: ID[]) {
    const want = new Set(productIds);
    this.state.update((s) => ({
      ...s,
      products: s.products.map((p) => {
        const has = p.clientIds.includes(clientId);
        if (want.has(p.id) && !has) return { ...p, clientIds: [...p.clientIds, clientId] };
        if (!want.has(p.id) && has) return { ...p, clientIds: p.clientIds.filter((c) => c !== clientId) };
        return p;
      }),
    }));
  }

  clientProducts(clientId: ID) {
    return this.state().products.filter((p) => p.clientIds.includes(clientId));
  }

  createClient(input: ClientInput, productIds: ID[] = []): Client {
    const client: Client = { id: uid(), ...this.cleanClient(input) };
    this.state.update((s) => ({ ...s, clients: [...s.clients, client] }));
    this.linkProducts(client.id, productIds);
    return client;
  }

  updateClient(id: ID, input: ClientInput, productIds?: ID[]) {
    this.state.update((s) => ({ ...s, clients: s.clients.map((c) => (c.id === id ? { ...c, ...this.cleanClient(input) } : c)) }));
    if (productIds) this.linkProducts(id, productIds);
  }

  archiveClient(id: ID, archived: boolean) {
    this.state.update((s) => ({ ...s, clients: s.clients.map((c) => (c.id === id ? { ...c, archived } : c)) }));
  }

  /** Deletes a client: tickets keep existing without a client, products are unlinked. */
  deleteClient(id: ID) {
    this.state.update((s) => ({
      ...s,
      clients: s.clients.filter((c) => c.id !== id),
      issues: s.issues.map((i) => (i.clientId === id ? { ...i, clientId: undefined } : i)),
      products: s.products.map((p) => (p.clientIds.includes(id) ? { ...p, clientIds: p.clientIds.filter((c) => c !== id) } : p)),
      // The client's own users lose their company and are deactivated
      users: s.users.map((u) => (u.clientId === id ? { ...u, clientId: undefined, inactive: true } : u)),
    }));
  }

  clientUsers(clientId: ID) {
    return this.state().users.filter((u) => u.clientId === clientId);
  }

  // ---- Organisation: divisions → teams → people, vendors (Step 11) ----

  divisionById(id: ID | undefined) {
    return this.state().divisions.find((d) => d.id === id);
  }

  teamById(id: ID | undefined) {
    return this.state().teams.find((t) => t.id === id);
  }

  vendorById(id: ID | undefined) {
    return this.state().vendors.find((v) => v.id === id);
  }

  teamsOf(divisionId: ID) {
    return this.state().teams.filter((t) => t.divisionId === divisionId);
  }

  teamMembers(teamId: ID) {
    return this.state().users.filter((u) => u.teamId === teamId);
  }

  /** Everyone in the division: its head, and the members and managers of its teams */
  divisionMembers(divisionId: ID) {
    const s = this.state();
    const d = s.divisions.find((x) => x.id === divisionId);
    const teamIds = new Set(s.teams.filter((t) => t.divisionId === divisionId).map((t) => t.id));
    const managerIds = new Set(s.teams.filter((t) => teamIds.has(t.id)).map((t) => t.managerId));
    return s.users.filter((u) => u.id === d?.headId || (u.teamId && teamIds.has(u.teamId)) || managerIds.has(u.id));
  }

  /** Division a person belongs to: through their team, or as division head */
  userDivision(userId: ID) {
    const s = this.state();
    const u = s.users.find((x) => x.id === userId);
    const team = s.teams.find((t) => t.id === u?.teamId);
    return s.divisions.find((d) => d.id === team?.divisionId) ?? s.divisions.find((d) => d.headId === userId);
  }

  /** Direct and indirect reports of a person (follows managerId, safe against loops) */
  reportsOf(userId: ID) {
    const users = this.state().users;
    const out: User[] = [];
    const seen = new Set([userId]);
    const queue = [userId];
    while (queue.length) {
      const boss = queue.shift()!;
      for (const u of users) {
        if (u.managerId === boss && !seen.has(u.id)) {
          seen.add(u.id);
          out.push(u);
          queue.push(u.id);
        }
      }
    }
    return out;
  }

  divisionProducts(divisionId: ID) {
    return this.state().products.filter((p) => p.divisionId === divisionId);
  }

  /** Products a person leads or is a member of */
  userProducts(userId: ID) {
    return this.state().products.filter((p) => p.leadId === userId || p.memberIds.includes(userId));
  }

  createDivision(input: DivisionInput): Division {
    const name = input.name.trim();
    if (!name) throw new Error('Division name is required');
    if (this.state().divisions.some((d) => d.name.toLowerCase() === name.toLowerCase())) throw new Error('A division with this name already exists');
    const d: Division = { id: uid(), name, description: input.description?.trim() || undefined, headId: input.headId || undefined, color: input.color };
    this.state.update((s) => ({ ...s, divisions: [...s.divisions, d] }));
    return d;
  }

  updateDivision(id: ID, input: DivisionInput) {
    const name = input.name.trim();
    if (!name) throw new Error('Division name is required');
    if (this.state().divisions.some((d) => d.id !== id && d.name.toLowerCase() === name.toLowerCase())) throw new Error('A division with this name already exists');
    this.state.update((s) => ({
      ...s,
      divisions: s.divisions.map((d) => (d.id === id ? { ...d, name, description: input.description?.trim() || undefined, headId: input.headId || undefined, color: input.color } : d)),
    }));
  }

  /** A division can only be deleted once it has no teams and no products */
  deleteDivision(id: ID) {
    const s = this.state();
    const teams = s.teams.filter((t) => t.divisionId === id).length;
    const products = s.products.filter((p) => p.divisionId === id).length;
    if (teams || products) throw new Error(`Move or delete its ${teams} team(s) and ${products} product(s) first`);
    this.state.update((st) => ({ ...st, divisions: st.divisions.filter((d) => d.id !== id) }));
  }

  createTeam(input: TeamInput): Team {
    const t: Team = { id: uid(), ...this.cleanTeam(input) };
    this.state.update((s) => ({ ...s, teams: [...s.teams, t] }));
    if (t.managerId) this.joinTeamAsManager(t);
    return t;
  }

  updateTeam(id: ID, input: TeamInput) {
    const t = { id, ...this.cleanTeam(input, id) };
    this.state.update((s) => ({ ...s, teams: s.teams.map((x) => (x.id === id ? t : x)) }));
    if (t.managerId) this.joinTeamAsManager(t);
  }

  /** Deletes a team; its members stay, without a team */
  deleteTeam(id: ID) {
    this.state.update((s) => ({
      ...s,
      teams: s.teams.filter((t) => t.id !== id),
      users: s.users.map((u) => (u.teamId === id ? { ...u, teamId: undefined } : u)),
    }));
  }

  /** Puts people into a team; each person's reporting manager becomes the team's manager if they had none */
  addTeamMembers(teamId: ID, userIds: ID[]) {
    const team = this.teamById(teamId);
    if (!team) return;
    const ids = new Set(userIds);
    this.state.update((s) => ({
      ...s,
      users: s.users.map((u) =>
        ids.has(u.id) ? { ...u, teamId, managerId: u.managerId ?? (team.managerId !== u.id ? team.managerId : undefined) } : u,
      ),
    }));
  }

  removeFromTeam(userId: ID) {
    this.state.update((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, teamId: undefined } : u)) }));
  }

  createUser(input: UserInput): User {
    const clean = this.cleanUser(input);
    const color = PALETTE[this.state().users.length % PALETTE.length]!;
    const user: User = { id: uid(), color, ...clean };
    this.state.update((s) => ({ ...s, users: [...s.users, user] }));
    return user;
  }

  updateUser(id: ID, input: UserInput) {
    const clean = this.cleanUser(input, id);
    this.state.update((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { id, color: u.color, inactive: u.inactive, ...clean } : u)) }));
  }

  /** Deactivate (or reactivate) a person. You can't deactivate yourself. */
  setUserActive(id: ID, active: boolean) {
    if (!active && id === this.state().currentUserId) throw new Error("You can't deactivate yourself");
    this.state.update((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, inactive: active ? undefined : true } : u)) }));
  }

  /** How much a person is referenced; people with history can only be deactivated */
  userUsage(id: ID) {
    const s = this.state();
    return {
      tickets: s.issues.filter((i) => i.assigneeId === id || i.reporterId === id).length,
      workLogs: s.workLogs.filter((w) => w.userId === id).length,
      comments: s.comments.filter((c) => c.authorId === id).length,
      leads: s.products.filter((p) => p.leadId === id).length,
      reports: s.users.filter((u) => u.managerId === id).length,
    };
  }

  deleteUser(id: ID) {
    if (id === this.state().currentUserId) throw new Error("You can't delete yourself");
    const u = this.userUsage(id);
    if (u.tickets || u.workLogs || u.comments || u.leads) throw new Error('This person has tickets, time or comments: deactivate them instead');
    this.state.update((s) => ({
      ...s,
      users: s.users.filter((x) => x.id !== id).map((x) => (x.managerId === id ? { ...x, managerId: undefined } : x)),
      divisions: s.divisions.map((d) => (d.headId === id ? { ...d, headId: undefined } : d)),
      teams: s.teams.map((t) => (t.managerId === id ? { ...t, managerId: undefined } : t)),
      products: s.products.map((p) => (p.memberIds.includes(id) ? { ...p, memberIds: p.memberIds.filter((m) => m !== id) } : p)),
      timers: s.timers.filter((t) => t.userId !== id),
    }));
  }

  /** Replaces the products a person works on (as a member; leads stay as they are) */
  setUserProducts(userId: ID, productIds: ID[]) {
    const want = new Set(productIds);
    this.state.update((s) => ({
      ...s,
      products: s.products.map((p) => {
        const has = p.memberIds.includes(userId);
        if (want.has(p.id) && !has && p.leadId !== userId) return { ...p, memberIds: [...p.memberIds, userId] };
        if (!want.has(p.id) && has) return { ...p, memberIds: p.memberIds.filter((m) => m !== userId) };
        return p;
      }),
    }));
  }

  createVendor(input: VendorInput): Vendor {
    const v: Vendor = { id: uid(), ...this.cleanVendor(input) };
    this.state.update((s) => ({ ...s, vendors: [...s.vendors, v] }));
    return v;
  }

  updateVendor(id: ID, input: VendorInput) {
    const v = { id, ...this.cleanVendor(input, id) };
    this.state.update((s) => ({ ...s, vendors: s.vendors.map((x) => (x.id === id ? v : x)) }));
  }

  vendorUsers(vendorId: ID) {
    return this.state().users.filter((u) => u.vendorId === vendorId);
  }

  /** A vendor can only be deleted when none of its staff are left */
  deleteVendor(id: ID) {
    const n = this.vendorUsers(id).length;
    if (n) throw new Error(`Remove or move its ${n} staff member(s) first`);
    this.state.update((s) => ({ ...s, vendors: s.vendors.filter((v) => v.id !== id) }));
  }

  private cleanTeam(input: TeamInput, id?: ID): Omit<Team, 'id'> {
    const name = input.name.trim();
    if (!name) throw new Error('Team name is required');
    if (!this.divisionById(input.divisionId)) throw new Error('Choose a division');
    if (this.state().teams.some((t) => t.id !== id && t.divisionId === input.divisionId && t.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('This division already has a team with that name');
    }
    return { name, divisionId: input.divisionId, description: input.description?.trim() || undefined, managerId: input.managerId || undefined };
  }

  /** The team's manager counts as a team member */
  private joinTeamAsManager(t: Team) {
    this.state.update((s) => ({ ...s, users: s.users.map((u) => (u.id === t.managerId && !u.teamId ? { ...u, teamId: t.id } : u)) }));
  }

  private cleanUser(input: UserInput, id?: ID): Omit<User, 'id' | 'color'> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name) throw new Error('Name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email');
    if (this.state().users.some((u) => u.id !== id && u.email.toLowerCase() === email)) throw new Error('Someone already uses this email');
    // In-house employees carry their HR employee ID (unique, stored upper-case)
    const employeeId = input.kind === 'internal' ? (input.employeeId ?? '').trim().toUpperCase() : '';
    if (input.kind === 'internal') {
      if (!employeeId) throw new Error('Employee ID is required for in-house employees');
      if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(employeeId)) throw new Error('Employee ID: 2–20 letters, digits or dashes');
      const other = this.state().users.find((u) => u.id !== id && u.employeeId?.toUpperCase() === employeeId);
      if (other) throw new Error(`Employee ID ${employeeId} is already used by ${other.name}`);
    }
    if (input.kind === 'vendor' && !this.vendorById(input.vendorId)) throw new Error('Choose the vendor company');
    if (input.kind === 'client' && !this.state().clients.some((c) => c.id === input.clientId)) throw new Error('Choose the client company');
    if (id && input.managerId && (input.managerId === id || this.reportsOf(id).some((r) => r.id === input.managerId))) {
      throw new Error("A person can't report to themselves or to someone who reports to them");
    }
    // Client users are always production users and sit outside our teams
    const isClient = input.kind === 'client';
    return {
      name,
      email,
      kind: input.kind,
      role: isClient ? 'production_user' : input.role,
      title: input.title?.trim() || undefined,
      employeeId: employeeId || undefined,
      teamId: isClient ? undefined : input.teamId || undefined,
      managerId: input.managerId || undefined,
      vendorId: input.kind === 'vendor' ? input.vendorId : undefined,
      clientId: isClient ? input.clientId : undefined,
    };
  }

  private cleanVendor(input: VendorInput, id?: ID): Omit<Vendor, 'id'> {
    const name = input.name.trim();
    if (!name) throw new Error('Vendor name is required');
    if (this.state().vendors.some((v) => v.id !== id && v.name.toLowerCase() === name.toLowerCase())) throw new Error('A vendor with this name already exists');
    const email = input.contactEmail?.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email');
    return {
      name,
      contactName: input.contactName?.trim() || undefined,
      contactEmail: email || undefined,
      contactPhone: input.contactPhone?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
    };
  }

  // ---- SLA policies ----

  slaFor(level: SupportLevel, priority: Priority): SlaPolicy | undefined {
    return this.state().slaPolicies.find((p) => p.level === level && p.priority === priority);
  }

  /** Sets the response / resolution targets for one support level + priority. Response must not exceed resolution. */
  setSlaPolicy(level: SupportLevel, priority: Priority, responseMinutes: number, resolutionMinutes: number) {
    const r = Math.round(responseMinutes);
    const f = Math.round(resolutionMinutes);
    if (!(r > 0 && f > 0)) throw new Error('Targets must be greater than zero');
    if (r > f) throw new Error('Response target cannot be longer than the resolution target');
    this.state.update((s) => {
      const exists = s.slaPolicies.some((p) => p.level === level && p.priority === priority);
      return {
        ...s,
        slaPolicies: exists
          ? s.slaPolicies.map((p) => (p.level === level && p.priority === priority ? { ...p, responseMinutes: r, resolutionMinutes: f } : p))
          : [...s.slaPolicies, { id: uid(), level, priority, responseMinutes: r, resolutionMinutes: f }],
      };
    });
  }

  resetSlaPolicies() {
    this.state.update((s) => ({ ...s, slaPolicies: defaultSlaPolicies() }));
  }

  // ---- Support desk (Step 13) ----

  /** Support and request tickets, and anything a production user raises, start at L1 */
  private defaultSupportLevel(input: NewIssueInput): SupportLevel | undefined {
    const reporter = this.userById(input.reporterId || this.state().currentUserId);
    return input.type === 'support' || input.type === 'request' || reporter?.role === 'production_user' ? 'l1' : undefined;
  }

  supportLevel(level: SupportLevel | undefined) {
    return this.state().supportLevels.find((l) => l.level === level);
  }

  updateSupportLevel(level: SupportLevel, patch: Partial<Omit<SupportLevelConfig, 'level'>>) {
    if (patch.name !== undefined && !patch.name.trim()) throw new Error('Level name is required');
    this.state.update((s) => ({
      ...s,
      supportLevels: s.supportLevels.map((l) =>
        l.level === level
          ? { ...l, ...patch, name: patch.name?.trim() ?? l.name, description: 'description' in patch ? patch.description?.trim() || undefined : l.description, teamId: 'teamId' in patch ? patch.teamId || undefined : l.teamId }
          : l,
      ),
    }));
  }

  /** True when the ticket's status is in a "done" category */
  isResolved(issue: Issue) {
    return this.workflowFor(issue.productId).statuses.find((s) => s.id === issue.statusId)?.category === 'done';
  }

  /** SLA clocks for a support ticket (undefined for other tickets). Targets follow its current level, from creation. */
  slaOf(issue: Issue, now = Date.now()): { level: SupportLevel; response: SlaClock; resolution: SlaClock } | undefined {
    if (!issue.supportLevel) return undefined;
    const policy = this.slaFor(issue.supportLevel, issue.priority);
    if (!policy) return undefined;
    const resolvedAt = this.isResolved(issue) ? (issue.endAt ?? issue.updatedAt) : undefined;
    return {
      level: issue.supportLevel,
      response: slaClock(issue.createdAt, policy.responseMinutes, issue.firstResponseAt ?? resolvedAt, now),
      resolution: slaClock(issue.createdAt, policy.resolutionMinutes, resolvedAt, now),
    };
  }

  /** Moves a support ticket up one level (L1 → L2 → L3) into that level's queue; the reason is added as a comment. */
  escalate(issueId: ID, reason?: string) {
    const issue = this.state().issues.find((i) => i.id === issueId);
    if (!issue?.supportLevel) throw new Error('Only support tickets can be escalated');
    const to = nextLevel(issue.supportLevel);
    if (!to) throw new Error('Already at L3');
    if (reason?.trim()) this.addComment(issueId, `Escalated to ${to.toUpperCase()}: ${reason.trim()}`);
    const ts = now();
    this.state.update((s) => ({
      ...s,
      issues: s.issues.map((i) => (i.id === issueId ? { ...i, supportLevel: to, assigneeId: undefined, updatedAt: ts } : i)),
      activities: [
        ...s.activities,
        { id: uid(), issueId, productId: issue.productId, userId: this.actorId(), action: 'escalated', from: issue.supportLevel!.toUpperCase(), to: to.toUpperCase(), createdAt: ts },
      ],
    }));
    return to;
  }

  // ---- Roadmaps ----

  private cleanRoadmap(input: RoadmapInput, existing?: Roadmap) {
    const t = (v?: string) => v?.trim() || undefined;
    // Completing a roadmap stamps today's date unless one is given; reopening clears it
    const completedAt = input.status === 'completed' ? input.completedAt || existing?.completedAt || now() : undefined;
    return {
      name: input.name.trim(), description: t(input.description), startDate: input.startDate || undefined, dueDate: input.dueDate || undefined,
      status: input.status, completedAt, achievedBenefits: t(input.achievedBenefits),
    };
  }

  /** Assigns exactly these sprints (of the roadmap's product) to a roadmap */
  private setRoadmapSprints(roadmapId: ID, productId: ID, sprintIds: ID[]) {
    const want = new Set(sprintIds);
    this.state.update((s) => ({
      ...s,
      sprints: s.sprints.map((sp) => {
        if (sp.productId !== productId) return sp;
        if (want.has(sp.id)) return { ...sp, roadmapId };
        return sp.roadmapId === roadmapId ? { ...sp, roadmapId: undefined } : sp;
      }),
    }));
  }

  createRoadmap(productId: ID, input: RoadmapInput, sprintIds: ID[] = []): Roadmap {
    const roadmap: Roadmap = { id: uid(), productId, createdAt: now(), ...this.cleanRoadmap(input) };
    this.state.update((s) => ({ ...s, roadmaps: [...s.roadmaps, roadmap] }));
    this.setRoadmapSprints(roadmap.id, productId, sprintIds);
    return roadmap;
  }

  updateRoadmap(id: ID, input: RoadmapInput, sprintIds?: ID[]) {
    const existing = this.state().roadmaps.find((r) => r.id === id);
    if (!existing) return;
    this.state.update((s) => ({ ...s, roadmaps: s.roadmaps.map((r) => (r.id === id ? { ...r, ...this.cleanRoadmap(input, existing) } : r)) }));
    if (sprintIds) this.setRoadmapSprints(id, existing.productId, sprintIds);
  }

  /** Deletes a roadmap; its sprints and tickets stay (just unlinked). */
  deleteRoadmap(id: ID) {
    this.state.update((s) => ({
      ...s,
      roadmaps: s.roadmaps.filter((r) => r.id !== id),
      sprints: s.sprints.map((sp) => (sp.roadmapId === id ? { ...sp, roadmapId: undefined } : sp)),
    }));
  }

  /**
   * Roadmap progress from its sprints' tickets: % of story points done
   * (falls back to % of tickets done when nothing is estimated).
   */
  roadmapProgress(id: ID) {
    const sprintIds = new Set(this.state().sprints.filter((sp) => sp.roadmapId === id).map((sp) => sp.id));
    const issues = this.state().issues.filter((i) => i.sprintId && sprintIds.has(i.sprintId));
    const done = issues.filter((i) => this.isDone(i));
    const points = issues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
    const donePoints = done.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
    const pctDone = points ? Math.round((donePoints / points) * 100) : issues.length ? Math.round((done.length / issues.length) * 100) : 0;
    return { sprints: sprintIds.size, tickets: issues.length, doneTickets: done.length, points, donePoints, pct: pctDone };
  }

  // ---- Gantt (Step 14) ----

  /**
   * Sets new planned dates from the Gantt: roadmap start/due, sprint start/end, ticket start/due date.
   * Refuses an end before the start, and anything the signed-in role may not plan.
   */
  reschedule(kind: 'roadmap' | 'sprint' | 'issue', id: ID, start: string | undefined, end: string | undefined) {
    if (start && end && Date.parse(end) < Date.parse(start)) throw new Error('The end can’t be before the start');
    const s = this.state();
    if (kind === 'roadmap') {
      const r = s.roadmaps.find((x) => x.id === id);
      if (!r || !this.canDo('roadmaps', r.productId)) throw new Error('You can’t change this roadmap');
      this.state.update((st) => ({ ...st, roadmaps: st.roadmaps.map((x) => (x.id === id ? { ...x, startDate: start, dueDate: end } : x)) }));
    } else if (kind === 'sprint') {
      const sp = s.sprints.find((x) => x.id === id);
      if (!sp || !this.canDo('sprints', sp.productId)) throw new Error('You can’t change this sprint');
      if (sp.state === 'closed') throw new Error('Completed sprints can’t be moved');
      this.state.update((st) => ({ ...st, sprints: st.sprints.map((x) => (x.id === id ? { ...x, startDate: start, endDate: end } : x)) }));
    } else {
      const i = s.issues.find((x) => x.id === id);
      if (!i || !this.canEditIssue(i)) throw new Error('You can’t change this ticket');
      this.updateIssue(id, { startDate: start, dueDate: end });
    }
  }

  // ---- Sprints ----

  /** Sprints of a product, newest first; closed ones only if `keepId` is one of them */
  sprintsFor(productId: ID | undefined, keepId?: ID) {
    return this.state()
      .sprints.filter((sp) => sp.productId === productId && (sp.state !== 'closed' || sp.id === keepId))
      .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  }

  sprintById(id: ID | undefined) {
    return id ? this.state().sprints.find((sp) => sp.id === id) : undefined;
  }

  private isDone(i: Issue) {
    return this.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId)?.category === 'done';
  }

  /** Ticket and story-point totals for a sprint (or the backlog when `sprintId` is undefined) */
  sprintStats(productId: ID, sprintId: ID | undefined): SprintStats {
    const stats: SprintStats = { total: 0, done: 0, points: 0, donePoints: 0, unestimated: 0 };
    for (const i of this.state().issues) {
      if (i.productId !== productId || (i.sprintId || undefined) !== sprintId) continue;
      const pts = i.storyPoints ?? 0;
      const done = this.isDone(i);
      stats.total++;
      stats.points += pts;
      if (i.storyPoints == null) stats.unestimated++;
      if (done) {
        stats.done++;
        stats.donePoints += pts;
      }
    }
    return stats;
  }

  /** Average completed story points over the product's last `count` completed sprints */
  velocity(productId: ID, count = 3) {
    const closed = this.state()
      .sprints.filter((sp) => sp.productId === productId && sp.state === 'closed' && sp.completedPoints != null)
      .sort((a, b) => (b.completedAt ?? b.endDate ?? '').localeCompare(a.completedAt ?? a.endDate ?? ''))
      .slice(0, count);
    return closed.length ? Math.round(closed.reduce((s, sp) => s + (sp.completedPoints ?? 0), 0) / closed.length) : undefined;
  }

  /** Suggested name for the next sprint, e.g. "WEB Sprint 14" */
  nextSprintName(productId: ID) {
    const product = this.state().products.find((p) => p.id === productId);
    const nums = this.state()
      .sprints.filter((sp) => sp.productId === productId)
      .map((sp) => Number(/(\d+)\s*$/.exec(sp.name)?.[1] ?? 0));
    return `${product?.key ?? 'Sprint'} Sprint ${Math.max(0, ...nums) + 1}`;
  }

  createSprint(productId: ID, input: SprintInput): Sprint {
    const sprint: Sprint = {
      id: uid(), productId, name: input.name.trim(), goal: input.goal?.trim() || undefined, state: 'planned',
      startDate: input.startDate, endDate: input.endDate, roadmapId: input.roadmapId || undefined,
    };
    this.state.update((s) => ({ ...s, sprints: [...s.sprints, sprint] }));
    return sprint;
  }

  updateSprint(id: ID, input: SprintInput) {
    this.state.update((s) => ({
      ...s,
      sprints: s.sprints.map((sp) =>
        sp.id === id ? { ...sp, name: input.name.trim(), goal: input.goal?.trim() || undefined, startDate: input.startDate, endDate: input.endDate, roadmapId: input.roadmapId || undefined } : sp,
      ),
    }));
  }

  /** Deletes a planned sprint; its tickets go back to the backlog. Active/closed sprints can't be deleted. */
  deleteSprint(id: ID): boolean {
    const sp = this.sprintById(id);
    if (!sp || sp.state !== 'planned') return false;
    this.state.update((s) => ({
      ...s,
      sprints: s.sprints.filter((x) => x.id !== id),
      issues: s.issues.map((i) => (i.sprintId === id ? { ...i, sprintId: undefined } : i)),
    }));
    return true;
  }

  /** The product's active sprint, if any */
  activeSprint(productId: ID) {
    return this.state().sprints.find((sp) => sp.productId === productId && sp.state === 'active');
  }

  /** Starts a planned sprint. Only one sprint per product can be active. Records committed points. */
  startSprint(id: ID): boolean {
    const sp = this.sprintById(id);
    if (!sp || sp.state !== 'planned' || this.activeSprint(sp.productId)) return false;
    const committed = this.sprintStats(sp.productId, sp.id).points;
    const start = sp.startDate ?? now();
    const end = sp.endDate ?? new Date(Date.parse(start) + 14 * 86400000).toISOString();
    this.state.update((s) => ({
      ...s,
      sprints: s.sprints.map((x) => (x.id === id ? { ...x, state: 'active', startDate: start, endDate: end, committedPoints: committed } : x)),
    }));
    return true;
  }

  /**
   * Completes the active sprint. Finished tickets stay in it (for reports); unfinished ones move to
   * `moveTo`: a planned sprint id, or undefined for the backlog. Returns how many tickets moved.
   */
  completeSprint(id: ID, moveTo?: ID): number {
    const sp = this.sprintById(id);
    if (!sp || sp.state !== 'active') return 0;
    if (moveTo && this.sprintById(moveTo)?.state === 'closed') moveTo = undefined;
    const stats = this.sprintStats(sp.productId, sp.id);
    const ts = now();
    let moved = 0;
    this.state.update((s) => ({
      ...s,
      sprints: s.sprints.map((x) => (x.id === id ? { ...x, state: 'closed', completedPoints: stats.donePoints, completedAt: ts } : x)),
      issues: s.issues.map((i) => {
        if (i.sprintId !== id || this.isDone(i)) return i;
        moved++;
        return { ...i, sprintId: moveTo, updatedAt: ts };
      }),
    }));
    return moved;
  }

  /** Backlog drag & drop: puts a ticket into a sprint (or the backlog) between two neighbours */
  moveToSprint(id: ID, sprintId: ID | undefined, before?: Issue, after?: Issue) {
    const issue = this.state().issues.find((i) => i.id === id);
    if (!issue) return;
    const a = before ? this.rankOf(before) : undefined;
    const b = after ? this.rankOf(after) : undefined;
    const rank = a !== undefined && b !== undefined ? (a + b) / 2 : a !== undefined ? a + 1000 : b !== undefined ? b - 1000 : this.rankOf(issue);
    if ((issue.sprintId || undefined) === sprintId) {
      this.state.update((s) => ({ ...s, issues: s.issues.map((i) => (i.id === id ? { ...i, rank } : i)) }));
    } else {
      this.updateIssue(id, { sprintId, rank });
    }
  }

  // ---- Time logging ----

  workLogsFor(issueId: ID) {
    return this.state().workLogs.filter((w) => w.issueId === issueId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  loggedMinutes(issueId: ID) {
    return this.state().workLogs.reduce((sum, w) => (w.issueId === issueId ? sum + w.minutes : sum), 0);
  }

  /**
   * Logs time by hand (e.g. the timer was forgotten). Between 1 minute and 24 hours per entry.
   * `userId` lets a lead log time for a team member; defaults to the current user.
   */
  addWorkLog(issueId: ID, input: NewWorkLogInput, fromTimer = false, userId?: ID): WorkLog {
    const minutes = Math.round(input.minutes);
    if (!(minutes >= 1 && minutes <= 24 * 60)) throw new Error('Spent time must be between 1 minute and 24 hours');
    const s = this.state();
    const log: WorkLog = {
      id: uid(), issueId, userId: userId ?? s.currentUserId, startedAt: input.date, minutes, activity: input.activity,
      note: input.note?.trim() || undefined, fromTimer,
    };
    const ts = now();
    this.state.update((st) => ({
      ...st,
      workLogs: [...st.workLogs, log],
      issues: st.issues.map((i) => (i.id === issueId ? { ...i, startAt: i.startAt ?? input.date, updatedAt: ts } : i)),
      activities: [...st.activities, { id: uid(), issueId, userId: st.currentUserId, action: 'logged', to: `${formatMinutes(minutes)} of ${input.activity}`, createdAt: ts }],
    }));
    return log;
  }

  /** Work logs whose date falls in [from, to) — optionally for one person */
  workLogsBetween(from: Date, to: Date, userId?: ID) {
    const a = from.getTime();
    const b = to.getTime();
    return this.workLogs().filter((w) => {
      const t = Date.parse(w.startedAt);
      return t >= a && t < b && (!userId || w.userId === userId);
    });
  }

  deleteWorkLog(id: ID) {
    this.state.update((s) => ({ ...s, workLogs: s.workLogs.filter((w) => w.id !== id) }));
  }

  /** Starts the current user's timer on a ticket (stopping and logging any other running timer first). */
  startTimer(issueId: ID, activity: WorkActivity) {
    if (this.activeTimer()) this.stopTimer();
    const timer: RunningTimer = { userId: this.state().currentUserId, issueId, activity, startedAt: now() };
    this.state.update((s) => ({
      ...s,
      timers: [...s.timers, timer],
      issues: s.issues.map((i) => (i.id === issueId && !i.startAt ? { ...i, startAt: timer.startedAt } : i)),
    }));
  }

  /** Stops the current user's timer and logs the elapsed time (at least 1 minute). */
  stopTimer(): WorkLog | undefined {
    const timer = this.activeTimer();
    if (!timer) return undefined;
    this.state.update((s) => ({ ...s, timers: s.timers.filter((t) => t !== timer) }));
    const minutes = Math.min(24 * 60, Math.max(1, Math.round((Date.now() - new Date(timer.startedAt).getTime()) / 60000)));
    return this.addWorkLog(timer.issueId, { date: timer.startedAt, minutes, activity: timer.activity }, true);
  }

  /** History entries for a ticket, newest first */
  activitiesFor(issueId: ID) {
    return this.state().activities.filter((a) => a.issueId === issueId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ---- Comments (remarks) ----

  commentsFor(issueId: ID) {
    return this.state().comments.filter((c) => c.issueId === issueId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  addComment(issueId: ID, body: string): Comment | undefined {
    const text = body.trim();
    if (!text) return undefined;
    const ts = now();
    const byRule = this.automationActive;
    const comment: Comment = { id: uid(), issueId, authorId: this.actorId(), body: text, createdAt: ts };
    const me = this.currentUser();
    this.state.update((s) => ({
      ...s,
      comments: [...s.comments, comment],
      issues: s.issues.map((i) => {
        if (i.id !== issueId) return i;
        // A staff reply (not the reporter, not a production user) stops the support response clock
        const responds = !byRule && !!i.supportLevel && !i.firstResponseAt && i.reporterId !== me.id && me.role !== 'production_user';
        return { ...i, updatedAt: ts, firstResponseAt: responds ? ts : i.firstResponseAt };
      }),
      activities: [...s.activities, { id: uid(), issueId, userId: this.actorId(), action: 'added a comment', createdAt: ts }],
    }));
    if (!byRule) this.fireRules('comment_added', issueId);
    return comment;
  }

  deleteComment(id: ID) {
    this.state.update((s) => ({ ...s, comments: s.comments.filter((c) => c.id !== id) }));
  }

  // ---- Attachments ----

  attachmentsFor(issueId: ID) {
    return this.state().attachments.filter((a) => a.issueId === issueId);
  }

  /** Saves the file bytes to IndexedDB, then records the attachment. Rejects files over the size limit. */
  async addAttachment(issueId: ID, file: File): Promise<Attachment> {
    if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} is larger than 10 MB`);
    const attachment: Attachment = {
      id: uid(), issueId, name: file.name, size: file.size, type: file.type || 'application/octet-stream',
      uploadedBy: this.state().currentUserId, createdAt: now(),
    };
    await fileStore.put(attachment.id, file);
    this.state.update((s) => ({
      ...s,
      attachments: [...s.attachments, attachment],
      activities: [...s.activities, { id: uid(), issueId, userId: s.currentUserId, action: 'attached', to: file.name, createdAt: attachment.createdAt }],
    }));
    return attachment;
  }

  removeAttachment(id: ID) {
    void fileStore.delete(id).catch(() => undefined);
    this.state.update((s) => ({ ...s, attachments: s.attachments.filter((a) => a.id !== id) }));
  }

  /** Opens the browser's save dialog for an attachment */
  async downloadAttachment(a: Attachment) {
    const blob = await fileStore.get(a.id);
    if (!blob) throw new Error(`${a.name} is no longer stored in this browser`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = a.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  resetDemoData() {
    this.state.set(seedData());
  }
}

/** Drops empty custom field values ('' / null / undefined; false is kept for checkboxes) */
function cleanCustomValues(values: Record<ID, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')));
}

function stripField(i: Issue, id: ID): Issue {
  if (!(id in i.customFields)) return i;
  const { [id]: _removed, ...rest } = i.customFields;
  return { ...i, customFields: rest };
}

/** 125 -> "2h 5m" */
export function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
