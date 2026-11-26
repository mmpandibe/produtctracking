import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DataStore } from '../core/data-store';
import { SEARCH_GROUPS, type SearchHit, searchAll } from '../core/search';
import { Icon } from '../shared/icon';
import { CURRENT_STEP, NAV_ITEMS, hasAccess } from './nav';
import { ReadablePipe } from '../shared/readable';

/**
 * Step 16: search box in the top bar. Type to search tickets, products, people, clients and pages you can see;
 * ↑ ↓ to move, Enter to open, Esc to close. "/" or Ctrl+K focuses it from anywhere.
 */
@Component({
  selector: 'app-global-search',
  imports: [ReadablePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'glass relative z-20 flex h-10 flex-1 items-center rounded-xl focus-within:ring-2 focus-within:ring-brand/60',
    '(document:keydown)': 'globalKey($event)',
    '(document:mousedown)': 'outside($event)',
  },
  template: `
    <app-icon name="search" [size]="16" class="absolute left-3.5 text-ink/70" />
    <input
      #box
      class="h-full w-full bg-transparent pl-10 pr-14 text-[13px] outline-none placeholder:text-ink/65"
      [placeholder]="staff() ? 'Search tickets, products, people…' : 'Search your tickets…'"
      aria-label="Search"
      role="combobox"
      aria-autocomplete="list"
      aria-controls="search-results"
      [attr.aria-expanded]="showPanel()"
      [attr.aria-activedescendant]="showPanel() && hits().length ? 'sr-' + active() : null"
      [value]="query()"
      (input)="type($any($event.target).value)"
      (focus)="open.set(true)"
      (keydown)="key($event)"
    />
    @if (query()) {
      <button type="button" class="absolute right-2 rounded p-1 text-ink/70 hover:text-ink" aria-label="Clear search" (click)="clear()"><app-icon name="x" [size]="14" /></button>
    } @else {
      <kbd class="pointer-events-none absolute right-2.5 hidden rounded border border-ink/15 bg-white/70 px-1.5 text-[10px] text-ink/70 sm:block">/</kbd>
    }

    @if (showPanel()) {
      <div id="search-results" class="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-ink/10 bg-white p-1.5 shadow-xl" role="listbox" aria-label="Search results">
        @if (!hits().length) {
          <p class="px-2.5 py-3 text-[12px] text-ink/70">Nothing matches “{{ query().trim() }}”.</p>
        }
        @for (g of groups(); track g.kind) {
          <div class="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink/70">{{ g.label }}</div>
          @for (h of g.hits; track h.kind + h.id) {
            @let idx = indexOf(h);
            <button
              type="button"
              role="option"
              [id]="'sr-' + idx"
              [attr.aria-selected]="idx === active()"
              class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left"
              [class.bg-brand/10]="idx === active()"
              (mouseenter)="active.set(idx)"
              (click)="go(h)"
            >
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/80" [style.color]="(h.color ?? null) | readable">
                <app-icon [name]="h.icon" [size]="13" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[12px] font-medium">{{ h.title }}</span>
                <span class="block truncate text-[11px] text-ink/70">{{ h.meta }}</span>
              </span>
            </button>
          }
        }
        @if (staff()) {
          <button type="button" class="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-ink/10 px-2.5 py-1.5 text-left text-[12px] text-brand hover:bg-brand/5" (click)="allTickets()">
            <app-icon name="list-todo" [size]="13" />All tickets matching “{{ query().trim() }}”
          </button>
        }
      </div>
    }
  `,
})
export class GlobalSearch {
  private readonly store = inject(DataStore);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly staff = computed(() => this.store.currentUser().role !== 'production_user');

  private readonly pages = computed(() => {
    const role = this.store.currentUser().role;
    return NAV_ITEMS.filter((n) => n.step <= CURRENT_STEP && hasAccess(role, n.access)).map((n) => ({ path: n.path, label: n.label, icon: n.icon }));
  });

  protected readonly hits = computed(() => searchAll(this.store, this.query(), this.pages()));
  protected readonly groups = computed(() =>
    SEARCH_GROUPS.map((g) => ({ ...g, hits: this.hits().filter((h) => h.kind === g.kind) })).filter((g) => g.hits.length),
  );
  protected readonly showPanel = computed(() => this.open() && !!this.query().trim());

  protected indexOf(h: SearchHit) {
    return this.hits().indexOf(h);
  }

  protected type(v: string) {
    this.query.set(v);
    this.active.set(0);
    this.open.set(true);
  }

  protected clear() {
    this.query.set('');
    this.box().nativeElement.focus();
  }

  protected key(e: KeyboardEvent) {
    const n = this.hits().length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      this.active.update((i) => (i + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      this.active.update((i) => (i - 1 + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const h = this.hits()[this.active()];
      if (h) this.go(h);
      else if (this.query().trim() && this.staff()) this.allTickets();
    } else if (e.key === 'Escape') {
      if (this.query()) this.query.set('');
      else this.box().nativeElement.blur();
      this.open.set(false);
    }
  }

  /** "/" or Ctrl/Cmd+K focuses the box unless you're typing somewhere else */
  protected globalKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      this.box().nativeElement.focus();
      this.box().nativeElement.select();
      this.open.set(true);
    }
  }

  protected outside(e: MouseEvent) {
    if (!this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  protected go(h: SearchHit) {
    this.open.set(false);
    this.query.set('');
    this.box().nativeElement.blur();
    void this.router.navigate(h.link, { queryParams: h.query });
  }

  protected allTickets() {
    const q = this.query().trim();
    this.open.set(false);
    this.query.set('');
    void this.router.navigate(['/tickets'], { queryParams: { q } });
  }
}
