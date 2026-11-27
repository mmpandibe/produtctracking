// Core data model for nPro.
// Shaped so a backend API can return exactly these objects later.

export type ID = string;
export type ISODate = string; // ISO 8601 timestamp

export type Role =
  | 'admin'
  | 'division_head'
  | 'assistant_manager'
  | 'business_analyst'
  | 'tech_lead'
  | 'developer'
  | 'tester'
  | 'production_user';

/** internal: our own staff · vendor: staff of a vendor company · client: a client's user */
export type UserKind = 'internal' | 'vendor' | 'client';

export interface User {
  id: ID;
  name: string;
  email: string;
  role: Role;
  color: string; // avatar background
  kind: UserKind;
  /** Job title, e.g. "Senior developer" */
  title?: string;
  /** In-house employees only: HR employee ID (e.g. "EMP-004"); unique; can also be used to sign in */
  employeeId?: string;
  /** Older records only — no longer asked for */
  phone?: string;
  /** Team the person works in (internal and vendor staff) */
  teamId?: ID;
  /** Reporting manager */
  managerId?: ID;
  /** Vendor company (kind = vendor) */
  vendorId?: ID;
  /** Client company (kind = client) */
  clientId?: ID;
  /** Deactivated people stay on old tickets but can't be picked for new work */
  inactive?: boolean;
  // Server-owned (set only by the API; ignored when sent back)
  /** An admin set the password: the person must choose a new one first */
  mustChangePassword?: boolean;
  lastSignInAt?: string;
  deactivatedAt?: string;
  /** Retention: name / email / employee ID replaced */
  anonymisedAt?: string;
}

/** Top level of the internal organisation: Division → Team → members */
export interface Division {
  id: ID;
  name: string;
  description?: string;
  /** Division head */
  headId?: ID;
  color: string;
}

export interface Team {
  id: ID;
  divisionId: ID;
  name: string;
  description?: string;
  /** Assistant manager who runs the team */
  managerId?: ID;
}

/** External company whose staff work on our products */
export interface Vendor {
  id: ID;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

/** Support levels: L1 service desk → L2 product team → L3 engineering / vendor (Step 13) */
export type SupportLevel = 'l1' | 'l2' | 'l3';

/** Who handles each support level */
export interface SupportLevelConfig {
  level: SupportLevel;
  name: string; // e.g. "Service desk"
  description?: string;
  /** Team whose people work this level's queue */
  teamId?: ID;
}

export interface Client {
  id: ID;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  archived?: boolean;
}

/** todo: not started · in_progress: being worked on · hold: paused · done: finished */
export type StatusCategory = 'todo' | 'in_progress' | 'hold' | 'done';

export interface WorkflowStatus {
  id: ID;
  name: string;
  category: StatusCategory;
  /** Pill colour (hex) */
  color: string;
}

export interface Workflow {
  id: ID;
  name: string;
  statuses: WorkflowStatus[];
  /** Allowed moves: fromStatusId -> exact list of toStatusIds. `{}` = rules off (any move); a missing entry = any. */
  transitions: Record<ID, ID[]>;
}

export type ProductLifecycle = 'planning' | 'active' | 'maintenance' | 'sunset';

/** Top-level container: a product being built or supported. Tickets belong to one product. */
export interface Product {
  id: ID;
  key: string; // e.g. 'WEB' -> tickets WEB-1, WEB-2
  name: string;
  description?: string;
  version?: string; // current release, e.g. '2.4'
  lifecycle: ProductLifecycle;
  leadId: ID;
  clientIds: ID[];
  workflowId: ID;
  /** Division that owns the product */
  divisionId?: ID;
  /** People assigned to work on the product (besides the lead) */
  memberIds: ID[];
  color: string;
  githubUrl?: string; // source repository
  websiteUrl?: string; // live site / product page
  issueCounter: number; // next ticket number
  createdAt: ISODate;
  archived?: boolean;
}

export type IssueType = 'story' | 'task' | 'bug' | 'epic' | 'request' | 'support';
export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';

export interface Issue {
  id: ID;
  key: string; // e.g. "WEB-12"
  productId: ID;
  type: IssueType;
  summary: string;
  description?: string;
  statusId: ID;
  priority: Priority;
  assigneeId?: ID;
  reporterId: ID;
  clientId?: ID;
  sprintId?: ID;
  parentId?: ID; // parent ticket (same product)
  storyPoints?: number;
  labels: string[];
  startDate?: ISODate; // planned start (date)
  startAt?: ISODate; // when work actually started (set automatically)
  endAt?: ISODate; // when work actually finished (set automatically)
  dueDate?: ISODate;
  progress?: number; // % complete, 0-100
  estimatedBenefits?: string;
  achievedBenefits?: string;
  /** Delivery / testing round (1, 2, 3 …) */
  round?: number;
  /** Manual order on the board (lower = higher up). Falls back to creation time. */
  rank?: number;
  estimateMinutes?: number;
  /** Set for support tickets: which level handles it now (drives the SLA targets) */
  supportLevel?: SupportLevel;
  /** First reply by staff (comment or moving the ticket out of "to do"): stops the response clock */
  firstResponseAt?: ISODate;
  customFields: Record<ID, unknown>;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type WorkActivity = 'design' | 'development' | 'testing' | 'analysis' | 'meeting' | 'documentation';

export interface WorkLog {
  id: ID;
  issueId: ID;
  userId: ID;
  startedAt: ISODate; // the day (or moment, for timers) the work was done
  minutes: number;
  activity: WorkActivity;
  note?: string;
  /** true when it came from Start/Stop timer, false when entered by hand */
  fromTimer?: boolean;
}

/** A running Start/Stop timer (one per user) */
export interface RunningTimer {
  userId: ID;
  issueId: ID;
  activity: WorkActivity;
  startedAt: ISODate;
}

export interface Comment {
  id: ID;
  issueId: ID;
  authorId: ID;
  body: string;
  createdAt: ISODate;
}

/** File attached to a ticket. The file bytes live in IndexedDB (see core/file-store.ts), keyed by id. */
export interface Attachment {
  id: ID;
  issueId: ID;
  name: string;
  size: number; // bytes
  type: string; // MIME type
  uploadedBy: ID;
  createdAt: ISODate;
}

export interface Activity {
  id: ID;
  issueId?: ID;
  productId?: ID;
  userId: ID;
  action: string; // e.g. "changed status"
  from?: string;
  to?: string;
  createdAt: ISODate;
}

export type RoadmapStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

/** A product roadmap: a goal delivered over several sprints */
export interface Roadmap {
  id: ID;
  productId: ID;
  name: string;
  description?: string;
  startDate?: ISODate;
  dueDate?: ISODate;
  status: RoadmapStatus;
  completedAt?: ISODate;
  achievedBenefits?: string;
  createdAt: ISODate;
}

export type SprintState = 'planned' | 'active' | 'closed';

export interface Sprint {
  id: ID;
  productId: ID;
  /** Roadmap this sprint belongs to (optional) */
  roadmapId?: ID;
  name: string;
  goal?: string;
  state: SprintState;
  startDate?: ISODate;
  endDate?: ISODate;
  /** Story points in the sprint when it was started */
  committedPoints?: number;
  /** Story points finished when it was completed */
  completedPoints?: number;
  completedAt?: ISODate;
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox';

export interface CustomFieldDef {
  id: ID;
  productId?: ID; // undefined = global
  name: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
}

/** Step 17: what starts a rule. Time-based triggers (sla_*, due_passed) fire once per ticket per rule. */
export type AutomationTrigger =
  | 'issue_created'
  | 'status_changed'
  | 'assignee_changed'
  | 'priority_changed'
  | 'comment_added'
  | 'sla_at_risk'
  | 'sla_breached'
  | 'due_passed';

export type ConditionField = 'type' | 'priority' | 'status' | 'status_category' | 'support_level' | 'client' | 'assignee' | 'label' | 'reporter_kind';

/** `value` '' means "empty" (e.g. assignee is empty) */
export interface AutomationCondition {
  field: ConditionField;
  op: 'is' | 'is_not';
  value: string;
}

export type AutomationActionType = 'set_status' | 'assign' | 'assign_round_robin' | 'unassign' | 'set_priority' | 'add_label' | 'add_comment' | 'escalate';

export interface AutomationAction {
  type: AutomationActionType;
  /** status id / user id / team id / priority / label / comment text ('' for unassign / escalate) */
  value: string;
}

/** "When <trigger>, if <all conditions>, then <actions>" — one product or all products */
export interface AutomationRule {
  id: ID;
  productId?: ID;
  name: string;
  enabled: boolean;
  /** status_changed: `value` = target status id ('' = any status) */
  trigger: { type: AutomationTrigger; value?: string };
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdAt: ISODate;
  createdBy: ID;
  runCount: number;
  lastRunAt?: ISODate;
  /** Round-robin position (assign_round_robin) */
  rrIndex?: number;
  /** Tickets a time-based trigger already fired for */
  firedFor?: ID[];
}

/** One rule run on one ticket (newest first, capped) */
export interface AutomationRun {
  id: ID;
  ruleId: ID;
  ruleName: string;
  issueId: ID;
  issueKey: string;
  trigger: AutomationTrigger;
  at: ISODate;
  outcome: 'done' | 'partial' | 'failed';
  /** One line per action, e.g. "Assigned to Ana Costa", "Skipped: Testing → Live isn't allowed by the workflow" */
  details: string[];
}

/** Response / resolution targets for one support level and priority (calendar time, from ticket creation) */
export interface SlaPolicy {
  id: ID;
  level: SupportLevel;
  priority: Priority;
  responseMinutes: number;
  resolutionMinutes: number;
}

export interface DataState {
  currentUserId: ID;
  users: User[];
  divisions: Division[];
  teams: Team[];
  vendors: Vendor[];
  products: Product[];
  clients: Client[];
  workflows: Workflow[];
  issues: Issue[];
  workLogs: WorkLog[];
  timers: RunningTimer[];
  comments: Comment[];
  attachments: Attachment[];
  activities: Activity[];
  roadmaps: Roadmap[];
  sprints: Sprint[];
  customFields: CustomFieldDef[];
  automations: AutomationRule[];
  automationLog: AutomationRun[];
  slaPolicies: SlaPolicy[];
  supportLevels: SupportLevelConfig[];
  /** CXO summary commentary, keyed by period ("week:2026-11-23" / "month:2026-11") */
  summaryNotes: Record<string, string>;
}
