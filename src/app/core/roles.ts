import type { Role, UserKind } from './models';

export interface RoleMeta {
  id: Role;
  label: string;
  color: string;
  /** What the role can see and do */
  scope: string;
}

/** Roles from most to least access */
export const ROLES: RoleMeta[] = [
  { id: 'admin', label: 'Admin', color: '#b91c1c', scope: 'Everything, including organisation, clients and workflows setup.' },
  { id: 'division_head', label: 'Division head', color: '#7c3aed', scope: "Only their division's products and people, with full rights on those products." },
  { id: 'assistant_manager', label: 'Assistant manager', color: '#2563eb', scope: 'Their products and the people reporting to them, with full rights on those products.' },
  { id: 'business_analyst', label: 'Business analyst', color: '#0891b2', scope: 'On assigned products: roadmaps, sprints, tickets and reports.' },
  { id: 'tech_lead', label: 'Tech lead', color: '#059669', scope: 'On assigned products: sprints, tickets and reports.' },
  { id: 'developer', label: 'Developer', color: '#d97706', scope: 'On assigned products: create and work on tickets.' },
  { id: 'tester', label: 'Tester', color: '#c2410c', scope: 'On assigned products: create and work on tickets.' },
  { id: 'production_user', label: 'Production user', color: '#475569', scope: 'Raise tickets and follow their status.' },
];

export type Capability = 'organisation' | 'products' | 'roadmaps' | 'sprints' | 'tickets' | 'time' | 'reports' | 'summary';

export const CAPABILITIES: { id: Capability; label: string }[] = [
  { id: 'organisation', label: 'Admin setup' },
  { id: 'products', label: 'Manage products' },
  { id: 'roadmaps', label: 'Roadmaps' },
  { id: 'sprints', label: 'Sprints' },
  { id: 'tickets', label: 'Create tickets' },
  { id: 'time', label: 'Time tracking' },
  { id: 'reports', label: 'Reports' },
  { id: 'summary', label: 'CXO summary' },
];

/** What each role may do, within the products it can see (enforced in the UI; the Phase B backend must check it too) */
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  admin: ['organisation', 'products', 'roadmaps', 'sprints', 'tickets', 'time', 'reports', 'summary'],
  division_head: ['products', 'roadmaps', 'sprints', 'tickets', 'time', 'reports', 'summary'],
  assistant_manager: ['products', 'roadmaps', 'sprints', 'tickets', 'time', 'reports', 'summary'],
  business_analyst: ['roadmaps', 'sprints', 'tickets', 'time', 'reports'],
  tech_lead: ['sprints', 'tickets', 'time', 'reports'],
  developer: ['tickets', 'time'],
  tester: ['tickets', 'time'],
  production_user: ['tickets'],
};

export function can(role: Role, cap: Capability) {
  return ROLE_CAPABILITIES[role]?.includes(cap) ?? false;
}

export function roleOf(id: Role | undefined): RoleMeta {
  return ROLES.find((r) => r.id === id) ?? ROLES[ROLES.length - 1]!;
}

export const USER_KINDS: { id: UserKind; label: string; blurb: string }[] = [
  { id: 'internal', label: 'Internal', blurb: 'Our own staff, placed in a division and team' },
  { id: 'vendor', label: 'Vendor', blurb: 'Staff of a vendor company working on our products' },
  { id: 'client', label: 'Client', blurb: "A client's user who raises tickets" },
];

export function kindOf(id: UserKind | undefined) {
  return USER_KINDS.find((k) => k.id === id) ?? USER_KINDS[0]!;
}
