import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { DataStore, formatMinutes } from '../core/data-store';
import { Session } from '../core/session';
import { Avatar } from '../shared/avatar';
import { GlobalSearch } from './global-search';
import { Icon } from '../shared/icon';
import type { User } from '../core/models';
import { ROLES, roleOf } from '../core/roles';
import { CURRENT_STEP, NAV_ITEMS, NAV_SECTIONS, type NavItem, hasAccess, homeFor } from './nav';
import { ReadablePipe } from '../shared/readable';

const COLLAPSE_KEY = 'npro-sidebar-collapsed';

@Component({
  selector: 'app-shell',
  imports: [ReadablePipe, RouterOutlet, RouterLink, RouterLinkActive, Icon, Avatar, GlobalSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  host: { class: 'relative isolate flex min-h-full gap-3 p-2.5 sm:p-3', '(document:keydown.escape)': 'tip.set(null)' },
})
export class Shell {
  protected readonly store = inject(DataStore);
  protected readonly session = inject(Session);
  protected readonly sections = NAV_SECTIONS;
  protected readonly currentStep = CURRENT_STEP;
  protected readonly roleLabel = computed(() => roleOf(this.store.currentUser().role).label);
  protected readonly mobileOpen = signal(false);
  /** Desktop only: icon rail instead of the full labelled sidebar */
  protected readonly collapsed = signal(readCollapsed());

  /** Hover label for the collapsed rail, drawn in a fixed layer so nothing clips it */
  protected readonly tip = signal<{ label: string; top: number; left: number } | null>(null);

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Nav item for the current page (its label is the page title) */
  protected readonly current = computed(() => {
    const first = this.url().split(/[/?#]/).filter(Boolean)[0];
    return NAV_ITEMS.find((n) => n.path === first);
  });

  /** Global running timer (shown in the top bar on every page) */
  private readonly tick = signal(Date.now());
  protected readonly timer = computed(() => {
    const t = this.store.activeTimer();
    if (!t) return undefined;
    const issue = this.store.issues().find((i) => i.id === t.issueId);
    const secs = Math.max(0, Math.floor((this.tick() - Date.parse(t.startedAt)) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    return { key: issue?.key ?? '?', summary: issue?.summary ?? '', elapsed: `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}` };
  });
  protected readonly timerToast = signal('');

  constructor() {
    const handle = setInterval(() => {
      if (this.store.activeTimer()) this.tick.set(Date.now());
    }, 1000);
    // Step 17: time-based automation rules (SLA at risk / breached, due date passed) are checked every minute
    // Offline demo only: with the API, the server runs timed rules every minute (Step 18c)
    const runRules = () => {
      if (!this.store.remote()) this.store.runTimedRules();
    };
    runRules();
    const rules = setInterval(runRules, 60_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(handle);
      clearInterval(rules);
    });
  }

  protected stopTimer() {
    const log = this.store.stopTimer();
    if (log) {
      this.timerToast.set(`Logged ${formatMinutes(log.minutes)}`);
      setTimeout(() => this.timerToast.set(''), 2500);
    }
  }

  /** Menu items the signed-in role may open */
  private readonly allowedItems = computed(() => NAV_ITEMS.filter((n) => hasAccess(this.store.currentUser().role, n.access)));
  protected readonly visibleSections = computed(() => this.sections.filter((s) => this.allowedItems().some((n) => n.section === s)));

  protected itemsIn(section: string) {
    return this.allowedItems().filter((n) => n.section === section);
  }

  // ---- Signed-in-as switcher ----
  protected readonly switcherOpen = signal(false);
  protected readonly switcherQuery = signal('');
  protected readonly switcherPos = signal({ left: 0, bottom: 0 });
  protected readonly switchToast = signal('');
  protected readonly switcherGroups = computed(() => {
    const q = this.switcherQuery().trim().toLowerCase();
    const people = this.store.allUsers().filter((u) => !u.inactive && (!q || u.name.toLowerCase().includes(q)));
    return ROLES.map((role) => ({ role, users: people.filter((u) => u.role === role.id) })).filter((g) => g.users.length);
  });

  protected openSwitcher(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.switcherPos.set({ left: Math.min(r.left, window.innerWidth - 296), bottom: window.innerHeight - r.top + 6 });
    this.switcherQuery.set('');
    this.switcherOpen.set(true);
  }

  protected subtitle(u: User) {
    if (u.kind === 'vendor') return this.store.vendorById(u.vendorId)?.name ?? 'Vendor';
    if (u.kind === 'client') return this.store.allClients().find((c) => c.id === u.clientId)?.name ?? 'Client';
    return this.store.teamById(u.teamId)?.name ?? this.store.userDivision(u.id)?.name ?? '';
  }

  /** Signs in as someone else and lands on their home page (the current page may not be allowed) */
  protected async switchTo(id: string) {
    this.switcherOpen.set(false);
    if (id === this.store.currentUser().id) return;
    try {
      if (this.store.remote()) await this.session.switchTo(id);
      else this.store.switchUser(id);
    } catch (err) {
      this.switchToast.set((err as Error).message);
      setTimeout(() => this.switchToast.set(''), 2500);
      return;
    }
    const u = this.store.currentUser();
    this.mobileOpen.set(false);
    void this.router.navigateByUrl(homeFor(u.role));
    this.switchToast.set(`Signed in as ${u.name} · ${roleOf(u.role).label}`);
    setTimeout(() => this.switchToast.set(''), 2500);
  }

  /** Skip link: move focus to the page content (the router uses path URLs, so no hash navigation) */
  protected skipToMain(e: Event) {
    e.preventDefault();
    document.getElementById('main-content')?.focus();
  }

  protected signOut() {
    this.switcherOpen.set(false);
    void this.session.logout();
  }

  protected isSoon(n: NavItem) {
    return n.step > CURRENT_STEP;
  }

  protected toggleCollapsed() {
    this.collapsed.update((c) => !c);
    this.tip.set(null);
    try {
      localStorage.setItem(COLLAPSE_KEY, this.collapsed() ? '1' : '0');
    } catch {
      // per-viewer convenience only
    }
  }

  protected showTip(e: Event, n: NavItem) {
    if (!this.collapsed() || !window.matchMedia('(min-width: 1024px)').matches) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.tip.set({ label: n.label + (this.isSoon(n) ? ' · soon' : ''), top: r.top + r.height / 2, left: r.right + 12 });
  }

  protected navigated() {
    this.mobileOpen.set(false);
    this.tip.set(null);
  }
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}
