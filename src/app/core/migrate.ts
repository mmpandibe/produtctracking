import type { DataState, Role } from './models';
import { defaultSlaPolicies, defaultSupportLevels } from './seed';

/** Old (storage v9) roles → Step 11 roles */
const ROLE_MAP: Record<string, Role> = { admin: 'admin', manager: 'assistant_manager', member: 'developer', viewer: 'production_user' };

/**
 * Upgrades data saved before Step 11 (storage v9): new roles, user kind, and a starter
 * division + team so existing people and products already sit in the organisation.
 */
export function migrateV9(old: DataState): DataState {
  const users = old.users.map((u) => ({ ...u, role: ROLE_MAP[u.role as string] ?? u.role, kind: u.kind ?? 'internal' }));
  const manager = users.find((u) => u.role === 'assistant_manager');
  const divisionId = 'd-migrated';
  const teamId = 't-migrated';
  const staff = users.filter((u) => u.role !== 'production_user');
  return {
    ...old,
    users: users.map((u) =>
      u.role === 'production_user' || u.role === 'admin' ? u : { ...u, teamId, managerId: u.id === manager?.id ? undefined : manager?.id },
    ),
    divisions: staff.length ? [{ id: divisionId, name: 'Delivery', description: 'Created when your data was upgraded. Rename or split it as needed.', color: '#7cb4f5' }] : [],
    teams: staff.length ? [{ id: teamId, divisionId, name: 'Core team', managerId: manager?.id }] : [],
    vendors: [],
    products: old.products.map((p) => {
      // Members = everyone with tickets on the product, apart from the lead
      const ids = new Set(old.issues.filter((i) => i.productId === p.id && i.assigneeId).map((i) => i.assigneeId!));
      ids.delete(p.leadId);
      return { ...p, divisionId: staff.length ? divisionId : undefined, memberIds: p.memberIds ?? [...ids] };
    }),
    summaryNotes: old.summaryNotes ?? {},
  };
}

/**
 * Upgrades data saved before Step 13 (storage v10): client SLA tiers are replaced by support levels L1 / L2 / L3.
 * Support and request tickets start at L1; their first staff comment (or start of work) counts as the first response.
 */
export function migrateV10(old: DataState): DataState {
  return {
    ...old,
    clients: old.clients.map((c) => {
      const { slaTier: _drop, ...rest } = c as typeof c & { slaTier?: string };
      return rest;
    }),
    slaPolicies: defaultSlaPolicies(),
    supportLevels: old.supportLevels ?? defaultSupportLevels(),
    issues: old.issues.map((i) => {
      if (i.supportLevel || (i.type !== 'support' && i.type !== 'request')) return i;
      const reply = old.comments
        .filter((c) => c.issueId === i.id && c.authorId !== i.reporterId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      return { ...i, supportLevel: 'l1', firstResponseAt: reply?.createdAt ?? i.startAt };
    }),
  };
}
