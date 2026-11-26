import type {
  AutomationActionType,
  AutomationCondition,
  AutomationRule,
  AutomationTrigger,
  ConditionField,
  Issue,
  StatusCategory,
  User,
} from './models';

/** Who rules act as: shown in ticket history and comments */
export const AUTOMATION_ID = 'automation';
export const AUTOMATION_USER: User = { id: AUTOMATION_ID, name: 'Automation', email: 'automation@npro', role: 'admin', kind: 'internal', color: '#c7d2fe', title: 'nPro rule engine' };

/** Rules can trigger further rules; a chain stops after this many levels (and a rule never re-runs within its own chain) */
export const MAX_CHAIN = 5;
/** Run log entries kept */
export const LOG_LIMIT = 300;

export const TRIGGERS: { id: AutomationTrigger; label: string; hint: string; timed?: boolean }[] = [
  { id: 'issue_created', label: 'Ticket is created', hint: 'Right after a ticket is raised' },
  { id: 'status_changed', label: 'Status changes', hint: 'Optionally only into one status' },
  { id: 'assignee_changed', label: 'Assignee changes', hint: 'Assigned, re-assigned or unassigned' },
  { id: 'priority_changed', label: 'Priority changes', hint: 'Raised or lowered' },
  { id: 'comment_added', label: 'Comment is added', hint: 'By a person, not by a rule' },
  { id: 'sla_at_risk', label: 'SLA is at risk', hint: 'Support ticket with ≤25% of a target left', timed: true },
  { id: 'sla_breached', label: 'SLA is breached', hint: 'Support ticket past a response or resolution target', timed: true },
  { id: 'due_passed', label: 'Due date passes', hint: 'Open ticket past its due date', timed: true },
];

export const CONDITION_FIELDS: { id: ConditionField; label: string; allowEmpty?: boolean }[] = [
  { id: 'type', label: 'Type' },
  { id: 'priority', label: 'Priority' },
  { id: 'status', label: 'Status' },
  { id: 'status_category', label: 'Status group' },
  { id: 'support_level', label: 'Support level', allowEmpty: true },
  { id: 'client', label: 'Client', allowEmpty: true },
  { id: 'assignee', label: 'Assignee', allowEmpty: true },
  { id: 'label', label: 'Label' },
  { id: 'reporter_kind', label: 'Raised by' },
];

export const ACTIONS: { id: AutomationActionType; label: string; needsValue: boolean }[] = [
  { id: 'set_status', label: 'Set status', needsValue: true },
  { id: 'assign', label: 'Assign to', needsValue: true },
  { id: 'assign_round_robin', label: 'Assign in turn within team', needsValue: true },
  { id: 'unassign', label: 'Unassign', needsValue: false },
  { id: 'set_priority', label: 'Set priority', needsValue: true },
  { id: 'add_label', label: 'Add label', needsValue: true },
  { id: 'add_comment', label: 'Add comment', needsValue: true },
  { id: 'escalate', label: 'Escalate support level', needsValue: false },
];

export const REPORTER_KINDS = [
  { id: 'staff', label: 'Staff' },
  { id: 'production', label: 'Production / client user' },
];

export const triggerOf = (id: AutomationTrigger) => TRIGGERS.find((t) => t.id === id) ?? TRIGGERS[0]!;
export const fieldOf = (id: ConditionField) => CONDITION_FIELDS.find((f) => f.id === id) ?? CONDITION_FIELDS[0]!;
export const actionOf = (id: AutomationActionType) => ACTIONS.find((a) => a.id === id) ?? ACTIONS[0]!;

/** The ticket facts a condition can look at */
export interface IssueFacts {
  issue: Issue;
  category: StatusCategory | undefined;
  reporter: User | undefined;
}

/** Value of a field on a ticket, as compared by conditions ('' = empty) */
export function factValue(f: IssueFacts, field: ConditionField): string | string[] {
  const i = f.issue;
  switch (field) {
    case 'type': return i.type;
    case 'priority': return i.priority;
    case 'status': return i.statusId;
    case 'status_category': return f.category ?? '';
    case 'support_level': return i.supportLevel ?? '';
    case 'client': return i.clientId ?? '';
    case 'assignee': return i.assigneeId ?? '';
    case 'label': return i.labels;
    case 'reporter_kind': return f.reporter?.role === 'production_user' || f.reporter?.kind === 'client' ? 'production' : 'staff';
  }
}

export function conditionMatches(f: IssueFacts, c: AutomationCondition) {
  const v = factValue(f, c.field);
  const target = c.value.trim().toLowerCase();
  const hit = Array.isArray(v) ? v.some((x) => x.toLowerCase() === target) : v.toLowerCase() === target;
  return c.op === 'is' ? hit : !hit;
}

export function allConditionsMatch(f: IssueFacts, conditions: AutomationCondition[]) {
  return conditions.every((c) => conditionMatches(f, c));
}

/** Validation message for a rule draft, or '' when it can be saved */
export function ruleProblem(r: Pick<AutomationRule, 'name' | 'conditions' | 'actions'>) {
  if (!r.name.trim()) return 'Give the rule a name';
  if (!r.actions.length) return 'Add at least one action';
  const missing = r.actions.find((a) => actionOf(a.type).needsValue && !a.value.trim());
  if (missing) return `“${actionOf(missing.type).label}” needs a value`;
  const cond = r.conditions.find((c) => !c.value.trim() && !fieldOf(c.field).allowEmpty);
  if (cond) return `Pick a value for the “${fieldOf(cond.field).label}” condition`;
  return '';
}

/** Ready-made rules offered on the Automation page (and seeded, disabled except the first, for demo data) */
export function ruleTemplates(): { key: string; blurb: string; rule: Pick<AutomationRule, 'name' | 'trigger' | 'conditions' | 'actions' | 'productId'> }[] {
  return [
    {
      key: 'escalate-breached',
      blurb: 'Breached L1 tickets move to L2 automatically',
      rule: {
        name: 'Escalate breached L1 support tickets',
        trigger: { type: 'sla_breached' },
        conditions: [{ field: 'support_level', op: 'is', value: 'l1' }],
        actions: [{ type: 'escalate', value: '' }, { type: 'add_comment', value: 'SLA breached at L1 — escalated automatically.' }],
      },
    },
    {
      key: 'round-robin',
      blurb: 'New unassigned support tickets go to the Service Desk in turn',
      rule: {
        name: 'Share new support tickets across the Service Desk',
        trigger: { type: 'issue_created' },
        conditions: [{ field: 'type', op: 'is', value: 'support' }, { field: 'assignee', op: 'is', value: '' }],
        actions: [{ type: 'assign_round_robin', value: 't4' }],
      },
    },
    {
      key: 'urgent-client',
      blurb: 'Highest-priority tickets from clients get a label and a heads-up comment',
      rule: {
        name: 'Flag urgent client tickets',
        trigger: { type: 'issue_created' },
        conditions: [{ field: 'priority', op: 'is', value: 'highest' }, { field: 'reporter_kind', op: 'is', value: 'production' }],
        actions: [{ type: 'add_label', value: 'urgent-client' }, { type: 'add_comment', value: 'Urgent ticket from a client — please pick up today.' }],
      },
    },
    {
      key: 'overdue',
      blurb: 'Overdue tickets are raised to High priority',
      rule: {
        name: 'Raise priority of overdue tickets',
        trigger: { type: 'due_passed' },
        conditions: [{ field: 'priority', op: 'is_not', value: 'highest' }],
        actions: [{ type: 'set_priority', value: 'high' }, { type: 'add_label', value: 'overdue' }],
      },
    },
  ];
}

/** Demo rules for fresh data (and for data saved before Step 17) */
export function defaultAutomations(ts: string, createdBy: string): AutomationRule[] {
  return ruleTemplates().map((t, n) => ({
    ...t.rule,
    id: `ar${n + 1}`,
    enabled: n === 0,
    createdAt: ts,
    createdBy,
    runCount: 0,
  }));
}

