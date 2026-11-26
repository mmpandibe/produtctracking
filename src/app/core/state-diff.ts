import type { DataState } from './models';

/** One changed record, in the shape the API's POST /api/sync expects */
export interface SyncChange {
  collection: string;
  op: 'upsert' | 'delete';
  id: string;
  data?: unknown;
}

/** Collections that are saved to the server and the field that identifies a record */
const COLLECTIONS: { name: keyof DataState; key: string }[] = [
  { name: 'users', key: 'id' },
  { name: 'divisions', key: 'id' },
  { name: 'teams', key: 'id' },
  { name: 'vendors', key: 'id' },
  { name: 'clients', key: 'id' },
  { name: 'workflows', key: 'id' },
  { name: 'customFields', key: 'id' },
  { name: 'slaPolicies', key: 'id' },
  { name: 'supportLevels', key: 'level' },
  // Products before the tickets and roadmaps that point at them
  { name: 'products', key: 'id' },
  { name: 'sprints', key: 'id' },
  { name: 'roadmaps', key: 'id' },
  { name: 'issues', key: 'id' },
  { name: 'comments', key: 'id' },
  { name: 'attachments', key: 'id' },
  { name: 'workLogs', key: 'id' },
  { name: 'timers', key: 'userId' },
  { name: 'activities', key: 'id' },
  { name: 'automations', key: 'id' },
  { name: 'automationLog', key: 'id' },
];

/**
 * Records that differ between two states. The store updates immutably, so an unchanged record keeps the same object:
 * a reference check finds what changed without comparing contents.
 */
export function diffState(prev: DataState, next: DataState): SyncChange[] {
  const upserts: SyncChange[] = [];
  const deletes: SyncChange[] = [];
  for (const { name, key } of COLLECTIONS) {
    const a = prev[name] as unknown as Record<string, unknown>[];
    const b = next[name] as unknown as Record<string, unknown>[];
    if (a === b) continue;
    const before = new Map(a.map((r) => [String(r[key]), r]));
    const after = new Set<string>();
    for (const r of b) {
      const id = String(r[key]);
      after.add(id);
      if (before.get(id) !== r) upserts.push({ collection: name, op: 'upsert', id, data: r });
    }
    for (const id of before.keys()) if (!after.has(id)) deletes.push({ collection: name, op: 'delete', id });
  }
  if (prev.summaryNotes !== next.summaryNotes) {
    for (const [k, text] of Object.entries(next.summaryNotes)) {
      if (prev.summaryNotes[k] !== text) upserts.push({ collection: 'summaryNotes', op: 'upsert', id: k, data: { key: k, text } });
    }
    for (const k of Object.keys(prev.summaryNotes)) if (!(k in next.summaryNotes)) deletes.push({ collection: 'summaryNotes', op: 'delete', id: k });
  }
  // Removals last, children before parents (reverse order), so nothing points at a deleted record mid-batch
  return [...upserts, ...deletes.reverse()];
}
