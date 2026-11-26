import { ACTIONS, CONDITION_FIELDS, REPORTER_KINDS, TRIGGERS, actionOf, fieldOf, triggerOf } from '../../core/automation';
import type { DataStore } from '../../core/data-store';
import type { AutomationAction, AutomationActionType, AutomationCondition, AutomationRule, ConditionField, WorkflowStatus } from '../../core/models';
import { CATEGORY_LABELS } from '../../core/reports';
import { SUPPORT_LEVELS } from '../../core/sla';
import { ISSUE_TYPES, PRIORITIES } from '../tickets/ticket-meta';

export interface Option {
  id: string;
  label: string;
}

/** Statuses a rule can use: the product's workflow, or every workflow's statuses (by id) for all-product rules */
export function statusesFor(store: DataStore, productId: string | undefined): WorkflowStatus[] {
  if (productId) return store.workflowFor(productId).statuses;
  const seen = new Map<string, WorkflowStatus>();
  for (const w of store.workflows()) for (const s of w.statuses) if (!seen.has(s.id)) seen.set(s.id, s);
  return [...seen.values()];
}

function staff(store: DataStore): Option[] {
  return store.allUsers().filter((u) => !u.inactive && u.role !== 'production_user').map((u) => ({ id: u.id, label: u.name }));
}

/** Choices for a condition field; `null` means free text (labels) */
export function conditionOptions(store: DataStore, field: ConditionField, productId?: string): Option[] | null {
  switch (field) {
    case 'type': return ISSUE_TYPES.map((t) => ({ id: t.id, label: t.label }));
    case 'priority': return PRIORITIES.map((p) => ({ id: p.id, label: p.label }));
    case 'status': return statusesFor(store, productId).map((s) => ({ id: s.id, label: s.name }));
    case 'status_category': return Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label }));
    case 'support_level': return SUPPORT_LEVELS.map((l) => ({ id: l.id, label: l.label }));
    case 'client': return store.allClients().filter((c) => !c.archived).map((c) => ({ id: c.id, label: c.name }));
    case 'assignee': return staff(store);
    case 'reporter_kind': return REPORTER_KINDS;
    case 'label': return null;
  }
}

/** Choices for an action's value; `null` = free text; `[]` = no value needed */
export function actionOptions(store: DataStore, type: AutomationActionType, productId?: string): Option[] | null {
  switch (type) {
    case 'set_status': return statusesFor(store, productId).map((s) => ({ id: s.id, label: s.name }));
    case 'assign': return staff(store);
    case 'assign_round_robin': return store.teams().map((t) => ({ id: t.id, label: t.name }));
    case 'set_priority': return PRIORITIES.map((p) => ({ id: p.id, label: p.label }));
    case 'add_label':
    case 'add_comment': return null;
    case 'unassign':
    case 'escalate': return [];
  }
}

function labelFor(opts: Option[] | null, value: string) {
  if (opts === null) return value || '…';
  return opts.find((o) => o.id === value)?.label ?? (value || '…');
}

export function conditionText(store: DataStore, c: AutomationCondition, productId?: string) {
  const f = fieldOf(c.field);
  const v = c.value ? labelFor(conditionOptions(store, c.field, productId), c.value) : f.allowEmpty ? 'empty' : '…';
  return `${f.label} ${c.op === 'is' ? 'is' : 'is not'} ${v}`;
}

export function actionText(store: DataStore, a: AutomationAction, productId?: string) {
  const meta = actionOf(a.type);
  const opts = actionOptions(store, a.type, productId);
  if (opts && !opts.length) return meta.label;
  if (a.type === 'add_comment') return `Comment “${a.value.length > 40 ? a.value.slice(0, 40) + '…' : a.value}”`;
  if (a.type === 'assign_round_robin') return `Assign in turn within ${labelFor(opts, a.value)}`;
  return `${meta.label} ${labelFor(opts, a.value)}`;
}

export function triggerText(store: DataStore, r: Pick<AutomationRule, 'trigger' | 'productId'>) {
  const t = triggerOf(r.trigger.type);
  if (r.trigger.type === 'status_changed' && r.trigger.value) {
    return `Status changes to ${labelFor(statusesFor(store, r.productId).map((s) => ({ id: s.id, label: s.name })), r.trigger.value)}`;
  }
  return t.label;
}

export { ACTIONS, CONDITION_FIELDS, TRIGGERS };
