import type { Role } from '../core/models';
import { type Capability, can } from '../core/roles';
import type { IconName } from '../shared/icon';

/** Who may open a screen: a role capability, 'staff' (everyone except production users) or 'all' */
export type NavAccess = Capability | 'staff' | 'all';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  /** Roadmap step in which this screen gets built */
  step: number;
  section: 'Work' | 'Insights' | 'Admin';
  blurb: string;
  access: NavAccess;
}

export const NAV_ITEMS: NavItem[] = [
  { path: 'dashboard', label: 'Dashboard', icon: 'dashboard', step: 16, section: 'Work', access: 'staff', blurb: 'Developer and manager dashboards: tickets, logged vs productive vs attended hours, leave and SLA breaches.' },
  { path: 'my-requests', label: 'My Requests', icon: 'inbox', step: 12, section: 'Work', access: 'all', blurb: 'Tickets you raised and where they stand.' },
  { path: 'products', label: 'Products', icon: 'package', step: 1, section: 'Work', access: 'staff', blurb: '' },
  { path: 'tickets', label: 'Tickets', icon: 'list-todo', step: 2, section: 'Work', access: 'staff', blurb: 'Filterable list of all tickets by product, client, status and assignee.' },
  { path: 'board', label: 'Board', icon: 'kanban', step: 4, section: 'Work', access: 'staff', blurb: 'Drag-and-drop Kanban board driven by the product workflow.' },
  { path: 'backlog', label: 'Backlog & Sprints', icon: 'calendar-range', step: 5, section: 'Work', access: 'staff', blurb: 'Groom the backlog, plan and run sprints.' },
  { path: 'time', label: 'Time Tracking', icon: 'clock', step: 6, section: 'Work', access: 'time', blurb: 'Log work, run timers and review timesheets.' },
  { path: 'attendance', label: 'Attendance & Hours', icon: 'user-check', step: 15, section: 'Work', access: 'staff', blurb: 'Punches, leave, hour corrections and laptop productivity next to logged hours.' },
  { path: 'gantt', label: 'Gantt & Roadmap', icon: 'calendar-clock', step: 14, section: 'Work', access: 'staff', blurb: 'Gantt chart per product and a roadmap timeline across products.' },
  { path: 'support', label: 'Support Desk', icon: 'headset', step: 13, section: 'Work', access: 'staff', blurb: 'L1 / L2 / L3 support queues with SLA clocks, breach flags and escalation.' },
  { path: 'reports', label: 'Reports', icon: 'chart', step: 8, section: 'Insights', access: 'reports', blurb: 'Product-wise and client-wise reports, burndown, velocity and workload.' },
  { path: 'cxo-summary', label: 'CXO Summary', icon: 'file-text', step: 9, section: 'Insights', access: 'summary', blurb: 'Weekly and monthly executive summary you can export and share.' },
  { path: 'clients', label: 'Clients', icon: 'building', step: 7, section: 'Admin', access: 'organisation', blurb: 'Manage clients, their contacts, products and users.' },
  { path: 'workflows', label: 'Workflows & Fields', icon: 'workflow', step: 10, section: 'Admin', access: 'organisation', blurb: 'Edit statuses, transitions and custom fields.' },
  { path: 'organisation', label: 'Organisation', icon: 'users', step: 11, section: 'Admin', access: 'organisation', blurb: 'Divisions, teams, members, vendors and roles.' },
  { path: 'integrations', label: 'Integrations', icon: 'globe', step: 15, section: 'Admin', access: 'organisation', blurb: 'Connect the laptop productivity tracker and the attendance system.' },
  { path: 'automation', label: 'Automation', icon: 'zap', step: 17, section: 'Admin', access: 'products', blurb: '"When X, if Y, then Z" rules to automate ticket handling.' },
];

/** Screens with step <= CURRENT_STEP are built; the rest show a "coming soon" placeholder. */
export const CURRENT_STEP = 17;

export const NAV_SECTIONS: NavItem['section'][] = ['Work', 'Insights', 'Admin'];

export function hasAccess(role: Role, access: NavAccess) {
  if (access === 'all') return true;
  if (access === 'staff') return role !== 'production_user';
  return can(role, access);
}

/** Landing page after sign-in or when a screen is not allowed */
export function homeFor(role: Role) {
  return role === 'production_user' ? '/my-requests' : '/dashboard';
}
