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

/**
 * Step 18c: merges records the server changed on its own (ticket numbers, automation results) into a state.
 * Unchanged collections keep their array, so the change detection above stays reference-based.
 */
export function applyChanges(state: DataState, changes: SyncChange[]): DataState {
  if (!changes.length) return state;
  const next: DataState = { ...state };
  const keyOf = new Map(COLLECTIONS.map((c) => [c.name as string, c.key]));
  for (const ch of changes) {
    if (ch.collection === 'summaryNotes') {
      const notes = { ...next.summaryNotes };
      if (ch.op === 'delete') delete notes[ch.id];
      else notes[ch.id] = (ch.data as { text: string }).text;
      next.summaryNotes = notes;
      continue;
    }
    const key = keyOf.get(ch.collection);
    if (!key) continue;
    const name = ch.collection as keyof DataState;
    const list = next[name] as unknown as Record<string, unknown>[];
    const idx = list.findIndex((r) => String(r[key]) === ch.id);
    let updated: Record<string, unknown>[];
    if (ch.op === 'delete') updated = idx < 0 ? list : list.filter((_, i) => i !== idx);
    else if (idx < 0) updated = ch.collection === 'automationLog' ? [ch.data as Record<string, unknown>, ...list] : [...list, ch.data as Record<string, unknown>];
    else updated = list.map((r, i) => (i === idx ? (ch.data as Record<string, unknown>) : r));
    (next as unknown as Record<string, unknown>)[name] = updated;
  }
  return next;
}
