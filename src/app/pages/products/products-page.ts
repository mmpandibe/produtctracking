import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/data-store';
import type { Product } from '../../core/models';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { LIFECYCLES, lifecycleOf } from './lifecycle';
import { ProductForm } from './product-form';
import { ReadablePipe } from '../../shared/readable';

type View = 'grid' | 'list';
const VIEW_KEY = 'npro-products-view';

@Component({
  selector: 'app-products-page',
  imports: [ReadablePipe, DatePipe, RouterLink, Avatar, Icon, Modal, PageHeader, ProductForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-page.html',
})
export class ProductsPage {
  protected readonly store = inject(DataStore);
  protected readonly lifecycles = LIFECYCLES;
  protected readonly lifecycleOf = lifecycleOf;

  // View + filters
  protected readonly view = signal<View>(readView());
  protected readonly query = signal('');
  protected readonly clientFilter = signal('');
  protected readonly lifecycleFilter = signal('');
  protected readonly showArchived = signal(false);

  // Dialog / menu state
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Product | undefined>(undefined);
  protected readonly deleting = signal<Product | undefined>(undefined);
  protected readonly menuFor = signal<string | null>(null);
  protected readonly menuPos = signal({ top: 0, left: 0 });

  /** Ticket totals per product: { total, done } */
  protected readonly stats = computed(() => {
    const doneIds = new Set(
      this.store.workflows().flatMap((w) => w.statuses.filter((s) => s.category === 'done').map((s) => s.id)),
    );
    const map: Record<string, { total: number; done: number }> = {};
    for (const i of this.store.issues()) {
      const m = (map[i.productId] ??= { total: 0, done: 0 });
      m.total++;
      if (doneIds.has(i.statusId)) m.done++;
    }
    return map;
  });

  /** Stats strip across non-archived products. `pct` drives each stat's thin bar. */
  protected readonly summary = computed(() => {
    const all = this.store.products();
    const active = all.filter((p) => !p.archived);
    let open = 0;
    let done = 0;
    for (const p of active) {
      const s = this.statFor(p.id);
      open += s.total - s.done;
      done += s.done;
    }
    const tickets = open + done;
    const clients = new Set(active.flatMap((p) => p.clientIds));
    const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
    return [
      { label: 'Active products', value: active.length, icon: 'package' as const, color: 'var(--color-pastel-blue)', pct: ratio(active.length, all.length) },
      { label: 'Open tickets', value: open, icon: 'ticket' as const, color: 'var(--color-pastel-pink)', pct: ratio(open, tickets) },
      { label: 'Completed', value: done, icon: 'check' as const, color: 'var(--color-pastel-green)', pct: ratio(done, tickets) },
      { label: 'Clients served', value: clients.size, icon: 'users' as const, color: 'var(--color-pastel-coral)', pct: ratio(clients.size, this.store.clients().length) },
    ];
  });

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.store.products().filter((p) => {
      if (!this.showArchived() && p.archived) return false;
      if (this.clientFilter() && !p.clientIds.includes(this.clientFilter())) return false;
      if (this.lifecycleFilter() && p.lifecycle !== this.lifecycleFilter()) return false;
      return !q || p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q);
    });
  });

  protected statFor(id: string | undefined) {
    return this.stats()[id ?? ''] ?? { total: 0, done: 0 };
  }

  protected pct(id: string) {
    const s = this.statFor(id);
    return s.total ? Math.round((s.done / s.total) * 100) : 0;
  }

  protected clientsOf(p: Product) {
    return this.store.clients().filter((x) => p.clientIds.includes(x.id));
  }

  /** "Acme Corp, Globex" for the compact card */
  protected clientNames(p: Product) {
    return this.clientsOf(p).map((c) => c.name).join(', ');
  }

  protected value(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected setView(v: View) {
    this.view.set(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // per-viewer convenience only
    }
  }

  /** Opens the action menu as a fixed overlay so scroll areas can't clip it. */
  protected toggleMenu(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (this.menuFor() === id) return this.menuFor.set(null);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuW = 168;
    const menuH = 120;
    const top = r.bottom + 6 + menuH > window.innerHeight ? r.top - menuH - 6 : r.bottom + 6;
    this.menuPos.set({ top, left: Math.max(8, r.right - menuW) });
    this.menuFor.set(id);
  }

  protected openCreate() {
    this.editing.set(undefined);
    this.formOpen.set(true);
  }

  protected openEdit(p: Product) {
    this.editing.set(p);
    this.formOpen.set(true);
    this.menuFor.set(null);
  }

  protected toggleArchive(p: Product) {
    this.store.archiveProduct(p.id, !p.archived);
    this.menuFor.set(null);
  }

  protected askDelete(p: Product) {
    this.deleting.set(p);
    this.menuFor.set(null);
  }

  protected confirmDelete() {
    const p = this.deleting();
    if (p) this.store.deleteProduct(p.id);
    this.deleting.set(undefined);
  }

  protected menuProduct() {
    return this.store.products().find((p) => p.id === this.menuFor());
  }
}

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}
