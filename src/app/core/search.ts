import type { DataStore } from './data-store';
import type { IconName } from '../shared/icon';

export type SearchKind = 'ticket' | 'product' | 'person' | 'client' | 'page';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  /** Second line, e.g. product · status */
  meta: string;
  icon: IconName;
  color?: string;
  /** Router link and query params */
  link: string[];
  query?: Record<string, string>;
  score: number;
}

export const SEARCH_GROUPS: { kind: SearchKind; label: string; max: number }[] = [
  { kind: 'ticket', label: 'Tickets', max: 6 },
  { kind: 'product', label: 'Products', max: 3 },
  { kind: 'person', label: 'People', max: 4 },
  { kind: 'client', label: 'Clients', max: 3 },
  { kind: 'page', label: 'Go to', max: 3 },
];

/** 3 = exact, 2 = starts with, 1 = a word starts with, 0.5 = contains anywhere, 0 = no match */
export function matchScore(text: string, q: string) {
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t === q) return 3;
  if (t.startsWith(q)) return 2;
  if (t.split(/[\s\-_/·,.]+/).some((w) => w.startsWith(q))) return 1;
  return t.includes(q) ? 0.5 : 0;
}

/**
 * Step 16 global search over what the signed-in person can see (the store's lists are already scoped).
 * Tickets match on key and summary, products on name and key, people on name / email / title, clients on name.
 * Pages are menu screens the role may open.
 */
export function searchAll(store: DataStore, raw: string, pages: { path: string; label: string; icon: IconName }[] = []): SearchHit[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const me = store.currentUser();
  const staff = me.role !== 'production_user';
  const hits: SearchHit[] = [];
  const products = new Map(store.products().map((p) => [p.id, p]));

  for (const i of store.issues()) {
    const keyScore = matchScore(i.key, q) * 2; // a key match beats a word in a summary
    const score = Math.max(keyScore, matchScore(i.summary, q));
    if (!score) continue;
    const p = products.get(i.productId);
    const status = store.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId);
    const done = status?.category === 'done';
    hits.push({
      kind: 'ticket', id: i.id, title: `${i.key} · ${i.summary}`, meta: [p?.name, status?.name].filter(Boolean).join(' · '),
      icon: 'ticket', color: status?.color, link: ['/tickets', i.key],
      // Open tickets first, then recently updated
      score: score + (done ? 0 : 0.3) + Date.parse(i.updatedAt) / 1e14,
    });
  }

  if (staff) {
    for (const p of store.products()) {
      const score = Math.max(matchScore(p.name, q), matchScore(p.key, q) * 1.5);
      if (score) hits.push({ kind: 'product', id: p.id, title: p.name, meta: `${p.key}${p.archived ? ' · archived' : ''}`, icon: 'package', color: p.color, link: ['/tickets'], query: { product: p.id }, score: score - (p.archived ? 0.5 : 0) });
    }
    for (const u of store.users()) {
      if (u.kind === 'client' && !store.canDo('organisation')) continue;
      const score = Math.max(matchScore(u.name, q), matchScore(u.email, q) * 0.8, matchScore(u.employeeId ?? '', q) * 1.2, matchScore(u.title ?? '', q) * 0.6);
      if (!score) continue;
      const team = store.teamById(u.teamId)?.name;
      hits.push({
        kind: 'person', id: u.id, title: u.name, meta: [u.title, team, u.inactive ? 'deactivated' : ''].filter(Boolean).join(' · ') || u.email,
        icon: 'users', color: u.color, link: ['/tickets'], query: { assignee: u.id }, score: score - (u.inactive ? 0.5 : 0),
      });
    }
    for (const c of store.clients()) {
      const score = matchScore(c.name, q);
      if (score) hits.push({ kind: 'client', id: c.id, title: c.name, meta: c.contactName ?? 'Client', icon: 'building', link: ['/tickets'], query: { client: c.id }, score: score - (c.archived ? 0.5 : 0) });
    }
  }

  for (const p of pages) {
    const score = matchScore(p.label, q);
    if (score) hits.push({ kind: 'page', id: p.path, title: p.label, meta: 'Page', icon: p.icon, link: ['/' + p.path], score });
  }

  return SEARCH_GROUPS.flatMap((g) =>
    hits
      .filter((h) => h.kind === g.kind)
      .sort((a, b) => b.score - a.score)
      .slice(0, g.max),
  );
}
