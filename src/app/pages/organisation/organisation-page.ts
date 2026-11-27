import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { api } from '../../core/api';
import { DataStore } from '../../core/data-store';
import { downloadCsv } from '../../core/reports';
import type { Division, Role, Team, User, UserKind, Vendor } from '../../core/models';
import { CAPABILITIES, ROLES, USER_KINDS, can, roleOf } from '../../core/roles';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { DivisionForm, TeamForm, VendorForm } from './org-forms';
import { PersonForm } from './person-form';
import { PasswordForm } from './password-form';
import { ReadablePipe } from '../../shared/readable';

type Tab = 'structure' | 'people' | 'vendors' | 'roles';

/** Step 11: divisions → teams → members, people (internal / vendor / client), vendors and roles. */
@Component({
  selector: 'app-organisation-page',
  imports: [PasswordForm, ReadablePipe, Avatar, Icon, Modal, PageHeader, PersonForm, DivisionForm, TeamForm, VendorForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './organisation-page.html',
})
export class OrganisationPage {
  protected readonly store = inject(DataStore);
  protected readonly roles = ROLES;
  protected readonly kinds = USER_KINDS;
  protected readonly capabilities = CAPABILITIES;
  protected readonly roleOf = roleOf;
  protected readonly can = can;

  /** ISO 27001 A.5.18: quarterly access review — everyone's role, scope and sign-in state as CSV (from the server) */
  protected readonly reviewBusy = signal(false);
  protected readonly reviewError = signal('');

  protected async exportAccessReview() {
    this.reviewBusy.set(true);
    this.reviewError.set('');
    try {
      type Row = Record<string, string | boolean | undefined>;
      const r = await api<{ generatedAt: string; rows: Row[] }>('GET', '/api/access-review');
      const day = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : '');
      downloadCsv(`npro-access-review-${r.generatedAt.slice(0, 10)}.csv`, [
        ['Name', 'Email', 'Employee ID', 'Kind', 'Role', 'Company', 'Team', 'Manager', 'Status', 'Products', 'Can sign in', 'Must change password', 'Locked out', 'Last sign-in', 'Deactivated', 'Reviewed (keep / change / remove)'],
        ...r.rows.map((x) => [
          x['name'] as string, x['email'] as string, x['employeeId'] as string, x['kind'] as string, roleOf(x['role'] as Role)?.label ?? (x['role'] as string),
          x['company'] as string, x['team'] as string, x['manager'] as string, x['status'] as string, x['products'] as string,
          x['canSignIn'] ? 'yes' : 'no', x['mustChangePassword'] ? 'yes' : 'no', x['lockedOut'] ? 'yes' : 'no', day(x['lastSignInAt']) || 'never', day(x['deactivatedAt']), '',
        ]),
      ]);
    } catch (err) {
      this.reviewError.set((err as Error).message);
    } finally {
      this.reviewBusy.set(false);
    }
  }

  protected readonly tab = signal<Tab>((inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as Tab) || 'structure');

  // ---- Structure ----
  /** Staff that should sit in a team but don't */
  protected readonly unassigned = computed(() =>
    this.store
      .users()
      .filter((u) => !u.inactive && !u.teamId && u.kind !== 'client' && !['admin', 'division_head', 'production_user'].includes(u.role)),
  );

  // ---- People filters ----
  protected readonly query = signal('');
  protected readonly kindFilter = signal<UserKind | ''>('');
  protected readonly roleFilter = signal<Role | ''>('');
  protected readonly divisionFilter = signal('');
  protected readonly showInactive = signal(false);
  protected readonly people = computed(() => {
    const q = this.query().trim().toLowerCase();
    const order = new Map(ROLES.map((r, i) => [r.id, i]));
    this.store.teams();
    return this.store
      .users()
      .filter((u) => this.showInactive() || !u.inactive)
      .filter((u) => !this.kindFilter() || u.kind === this.kindFilter())
      .filter((u) => !this.roleFilter() || u.role === this.roleFilter())
      .filter((u) => !this.divisionFilter() || this.store.userDivision(u.id)?.id === this.divisionFilter())
      .filter((u) => !q || `${u.name} ${u.email} ${u.title ?? ''} ${u.employeeId ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => order.get(a.role)! - order.get(b.role)! || a.name.localeCompare(b.name));
  });
  protected readonly counts = computed(() => {
    const users = this.store.users().filter((u) => !u.inactive);
    return {
      people: users.length,
      internal: users.filter((u) => u.kind === 'internal').length,
      vendor: users.filter((u) => u.kind === 'vendor').length,
      client: users.filter((u) => u.kind === 'client').length,
    };
  });
  protected readonly roleCounts = computed(() => {
    const users = this.store.users().filter((u) => !u.inactive);
    return Object.fromEntries(ROLES.map((r) => [r.id, users.filter((u) => u.role === r.id)])) as Record<Role, User[]>;
  });

  // ---- Dialogs ----
  protected readonly personOpen = signal(false);
  protected readonly editingPerson = signal<User | undefined>(undefined);
  protected readonly personTeam = signal<string | undefined>(undefined);
  protected readonly divisionOpen = signal(false);
  protected readonly editingDivision = signal<Division | undefined>(undefined);
  protected readonly teamOpen = signal(false);
  protected readonly editingTeam = signal<Team | undefined>(undefined);
  protected readonly teamDivision = signal<string | undefined>(undefined);
  protected readonly vendorOpen = signal(false);
  protected readonly editingVendor = signal<Vendor | undefined>(undefined);

  protected readonly deletingDivision = signal<Division | undefined>(undefined);
  protected readonly deletingTeam = signal<Team | undefined>(undefined);
  protected readonly deletingVendor = signal<Vendor | undefined>(undefined);
  protected readonly deletingPerson = signal<User | undefined>(undefined);
  protected readonly divisionBlocked = computed(() => {
    const d = this.deletingDivision();
    if (!d) return false;
    this.store.teams();
    this.store.products();
    const b = this.divisionBlockers(d);
    return !!(b.teams || b.products);
  });
  protected readonly vendorBlocked = computed(() => {
    const v = this.deletingVendor();
    this.store.users();
    return !!v && this.store.vendorUsers(v.id).length > 0;
  });

  // Add people to a team
  protected readonly addingTo = signal<Team | undefined>(undefined);
  protected readonly picked = signal<string[]>([]);
  protected readonly candidates = computed(() => {
    const t = this.addingTo();
    if (!t) return [];
    // Admins and division heads sit above teams; production users don't work tickets
    return this.store
      .users()
      .filter((u) => !u.inactive && u.kind !== 'client' && u.teamId !== t.id && !['admin', 'division_head', 'production_user'].includes(u.role));
  });

  // Row menu (people table)
  protected readonly menuFor = signal<string | null>(null);
  protected readonly menuPos = signal({ top: 0, left: 0 });
  protected readonly menuPerson = computed(() => this.store.users().find((u) => u.id === this.menuFor()));

  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected teamOfUser(u: User) {
    return this.store.teamById(u.teamId);
  }

  protected companyOf(u: User) {
    if (u.kind === 'vendor') return this.store.vendorById(u.vendorId)?.name ?? 'Vendor';
    if (u.kind === 'client') return this.store.clients().find((c) => c.id === u.clientId)?.name ?? 'Client';
    return '';
  }

  protected vendorProducts(v: Vendor) {
    const ids = new Set(this.store.vendorUsers(v.id).map((u) => u.id));
    return this.store.products().filter((p) => ids.has(p.leadId) || p.memberIds.some((m) => ids.has(m)));
  }

  protected teamProducts(t: Team) {
    const ids = new Set(this.store.teamMembers(t.id).map((u) => u.id));
    return this.store.products().filter((p) => ids.has(p.leadId) || p.memberIds.some((m) => ids.has(m)));
  }

  // ---- Open dialogs ----

  protected addPerson(teamId?: string) {
    this.editingPerson.set(undefined);
    this.personTeam.set(teamId);
    this.personOpen.set(true);
  }

  protected editPerson(u: User) {
    this.menuFor.set(null);
    this.editingPerson.set(u);
    this.personTeam.set(undefined);
    this.personOpen.set(true);
  }

  protected openDivision(d?: Division) {
    this.editingDivision.set(d);
    this.divisionOpen.set(true);
  }

  protected openTeam(divisionId?: string, t?: Team) {
    this.editingTeam.set(t);
    this.teamDivision.set(divisionId);
    this.teamOpen.set(true);
  }

  protected openVendor(v?: Vendor) {
    this.editingVendor.set(v);
    this.vendorOpen.set(true);
  }

  protected openAddMembers(t: Team) {
    this.picked.set([]);
    this.addingTo.set(t);
  }

  protected togglePick(id: string) {
    this.picked.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected confirmAddMembers() {
    const t = this.addingTo();
    if (t && this.picked().length) {
      this.store.addTeamMembers(t.id, this.picked());
      this.showToast(`${this.picked().length} added to ${t.name}`);
    }
    this.addingTo.set(undefined);
  }

  protected removeFromTeam(u: User, t: Team) {
    this.store.removeFromTeam(u.id);
    this.showToast(`${u.name} removed from ${t.name}`);
  }

  // ---- Deletes ----

  protected divisionBlockers(d: Division) {
    return { teams: this.store.teamsOf(d.id).length, products: this.store.divisionProducts(d.id).length };
  }

  protected confirmDeleteDivision() {
    const d = this.deletingDivision();
    this.deletingDivision.set(undefined);
    if (!d) return;
    try {
      this.store.deleteDivision(d.id);
      this.showToast(`${d.name} deleted`);
    } catch (err) {
      this.showToast((err as Error).message);
    }
  }

  protected confirmDeleteTeam() {
    const t = this.deletingTeam();
    if (t) {
      this.store.deleteTeam(t.id);
      this.showToast(`${t.name} deleted`);
    }
    this.deletingTeam.set(undefined);
  }

  protected confirmDeleteVendor() {
    const v = this.deletingVendor();
    this.deletingVendor.set(undefined);
    if (!v) return;
    try {
      this.store.deleteVendor(v.id);
      this.showToast(`${v.name} deleted`);
    } catch (err) {
      this.showToast((err as Error).message);
    }
  }

  protected usageOf(u: User) {
    return this.store.userUsage(u.id);
  }

  protected hasHistory(u: User) {
    const n = this.usageOf(u);
    return !!(n.tickets || n.workLogs || n.comments || n.leads);
  }

  protected askDeletePerson(u: User) {
    this.menuFor.set(null);
    this.deletingPerson.set(u);
  }

  protected confirmDeletePerson() {
    const u = this.deletingPerson();
    this.deletingPerson.set(undefined);
    if (!u) return;
    try {
      this.store.deleteUser(u.id);
      this.showToast(`${u.name} deleted`);
    } catch (err) {
      this.showToast((err as Error).message);
    }
  }

  protected toggleActive(u: User) {
    this.menuFor.set(null);
    this.deletingPerson.set(undefined);
    try {
      this.store.setUserActive(u.id, !!u.inactive);
      this.showToast(`${u.name} ${u.inactive ? 'reactivated' : 'deactivated'}`);
    } catch (err) {
      this.showToast((err as Error).message);
    }
  }

  /** Server mode: admins set sign-in passwords */
  protected readonly passwordFor = signal<User | undefined>(undefined);

  protected setPassword(u: User) {
    this.menuFor.set(null);
    this.passwordFor.set(u);
  }

  /** A new person in server mode can't sign in until an admin sets a password: say so */
  protected personSaved(msg: string) {
    this.showToast(this.store.remote() && msg.endsWith(' added') ? msg + ' · set a password from the row menu so they can sign in' : msg);
  }

  protected toggleMenu(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (this.menuFor() === id) return this.menuFor.set(null);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const top = r.bottom + 4 + 104 > window.innerHeight ? r.top - 108 : r.bottom + 4;
    this.menuPos.set({ top, left: Math.max(8, r.right - 168) });
    this.menuFor.set(id);
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
