import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/data-store';
import type { Client } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { ClientForm } from './client-form';

/** Step 7: manage clients (contacts, products, users). SLA targets moved to the Support Desk in Step 13 (per support level). */
@Component({
  selector: 'app-clients-page',
  imports: [RouterLink, Icon, Modal, PageHeader, ClientForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clients-page.html',
})
export class ClientsPage {
  protected readonly store = inject(DataStore);

  protected readonly query = signal('');
  protected readonly showArchived = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Client | undefined>(undefined);
  protected readonly deleting = signal<Client | undefined>(undefined);
  protected readonly menuFor = signal<string | null>(null);
  protected readonly menuPos = signal({ top: 0, left: 0 });

  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  /** Open / total tickets and open support tickets / SLA breaches per client */
  private readonly ticketCounts = computed(() => {
    const now = Date.now();
    const map: Record<string, { open: number; total: number; support: number; breached: number }> = {};
    for (const i of this.store.issues()) {
      if (!i.clientId) continue;
      const m = (map[i.clientId] ??= { open: 0, total: 0, support: 0, breached: 0 });
      m.total++;
      if (this.store.isResolved(i)) continue;
      m.open++;
      const sla = this.store.slaOf(i, now);
      if (sla) {
        m.support++;
        if (sla.response.state === 'breached' || sla.resolution.state === 'breached') m.breached++;
      }
    }
    return map;
  });

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.store
      .clients()
      .filter((c) => this.showArchived() || !c.archived)
      .filter((c) => !q || [c.name, c.contactName, c.contactEmail].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly activeCount = computed(() => this.store.clients().filter((c) => !c.archived).length);

  protected countsOf(c: Client) {
    return this.ticketCounts()[c.id] ?? { open: 0, total: 0, support: 0, breached: 0 };
  }

  protected productsOf(c: Client) {
    return this.store.products().filter((p) => p.clientIds.includes(c.id));
  }

  protected value(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected openCreate() {
    this.editing.set(undefined);
    this.formOpen.set(true);
  }

  protected openEdit(c: Client) {
    this.editing.set(c);
    this.formOpen.set(true);
    this.menuFor.set(null);
  }

  protected toggleArchive(c: Client) {
    this.store.archiveClient(c.id, !c.archived);
    this.menuFor.set(null);
    this.showToast(c.archived ? `${c.name} restored` : `${c.name} archived`);
  }

  protected askDelete(c: Client) {
    this.deleting.set(c);
    this.menuFor.set(null);
  }

  protected confirmDelete() {
    const c = this.deleting();
    if (c) {
      this.store.deleteClient(c.id);
      this.showToast(`${c.name} deleted`);
    }
    this.deleting.set(undefined);
  }

  protected toggleMenu(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (this.menuFor() === id) return this.menuFor.set(null);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const top = r.bottom + 4 + 104 > window.innerHeight ? r.top - 108 : r.bottom + 4;
    this.menuPos.set({ top, left: Math.max(8, r.right - 160) });
    this.menuFor.set(id);
  }

  protected menuClient() {
    return this.store.clients().find((c) => c.id === this.menuFor());
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
