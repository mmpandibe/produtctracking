import { inject, type Type } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { Session } from './core/session';
import { accessGuard } from './core/access-guard';
import { DataStore } from './core/data-store';
import { Shell } from './layout/shell';
import { CURRENT_STEP, NAV_ITEMS, homeFor } from './layout/nav';
import { ComingSoon } from './pages/coming-soon';

/** Built screens, keyed by their menu path */
const SCREENS: Record<string, () => Promise<Type<unknown>>> = {
  dashboard: () => import('./pages/dashboard/dashboard-page').then((m) => m.DashboardPage),
  'my-requests': () => import('./pages/requests/my-requests-page').then((m) => m.MyRequestsPage),
  products: () => import('./pages/products/products-page').then((m) => m.ProductsPage),
  tickets: () => import('./pages/tickets/tickets-page').then((m) => m.TicketsPage),
  board: () => import('./pages/board/board-page').then((m) => m.BoardPage),
  backlog: () => import('./pages/backlog/backlog-page').then((m) => m.BacklogPage),
  time: () => import('./pages/time/time-page').then((m) => m.TimePage),
  clients: () => import('./pages/clients/clients-page').then((m) => m.ClientsPage),
  reports: () => import('./pages/reports/reports-page').then((m) => m.ReportsPage),
  'cxo-summary': () => import('./pages/cxo/cxo-page').then((m) => m.CxoPage),
  workflows: () => import('./pages/workflows/workflows-page').then((m) => m.WorkflowsPage),
  organisation: () => import('./pages/organisation/organisation-page').then((m) => m.OrganisationPage),
  support: () => import('./pages/support/support-page').then((m) => m.SupportPage),
  attendance: () => import('./pages/attendance/attendance-page').then((m) => m.AttendancePage),
  integrations: () => import('./pages/integrations/integrations-page').then((m) => m.IntegrationsPage),
  automation: () => import('./pages/automation/automation-page').then((m) => m.AutomationPage),
  gantt: () => import('./pages/gantt/gantt-page').then((m) => m.GanttPage),
};

const homeRedirect = () => homeFor(inject(DataStore).currentUser().role);

/** Server mode without a session → login page; the login page is only for that case. Admin-set password → change it first. */
const signedIn = () => {
  const mode = inject(Session).mode();
  if (mode === 'signed_out') return inject(Router).parseUrl('/login');
  if (mode === 'change_password') return inject(Router).parseUrl('/change-password');
  return true;
};
const canChangePassword = () => ['remote', 'change_password'].includes(inject(Session).mode()) || inject(Router).parseUrl('/');
const signedOut = () => inject(Session).mode() === 'signed_out' || inject(Router).parseUrl('/');

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · nPro',
    canActivate: [signedOut],
    loadComponent: () => import('./pages/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'change-password',
    title: 'Change password · nPro',
    canActivate: [canChangePassword],
    loadComponent: () => import('./pages/login/change-password-page').then((m) => m.ChangePasswordPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [signedIn],
    children: [
      { path: '', pathMatch: 'full', redirectTo: homeRedirect },
      // Ticket page: open to everyone; the page itself only shows tickets the person may see
      {
        path: 'tickets/:key',
        title: 'Ticket · nPro',
        loadComponent: () => import('./pages/tickets/ticket-detail').then((m) => m.TicketDetail),
      },
      // Every menu screen is guarded by its access rule; screens not built yet show a placeholder with their roadmap step
      ...NAV_ITEMS.map((n) =>
        n.step <= CURRENT_STEP && SCREENS[n.path]
          ? { path: n.path, title: `${n.label} · nPro`, canActivate: [accessGuard(n.access)], loadComponent: SCREENS[n.path] }
          : { path: n.path, title: `${n.label} · nPro`, canActivate: [accessGuard(n.access)], component: ComingSoon, data: { item: n } },
      ),
    ],
  },
  { path: '**', redirectTo: '' },
];
