import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/data-store';
import { type SourceMode, addDateKey, toDateKey } from '../../core/external';
import { ExternalStore } from '../../core/external-store';
import type { User } from '../../core/models';
import { startOfWeek } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { Icon, type IconName } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';

type Kind = 'productivity' | 'attendance';

interface Connector {
  kind: Kind;
  name: string;
  icon: IconName;
  blurb: string;
  provides: string[];
  endpointHint: string;
}

const CONNECTORS: Connector[] = [
  {
    kind: 'productivity',
    name: 'Laptop productivity tracker',
    icon: 'laptop',
    blurb: 'Active, productive and idle time per person per day from the desktop agent.',
    provides: ['Active minutes', 'Productive minutes', 'Idle minutes'],
    endpointHint: 'https://tracker.example.com/api/v1',
  },
  {
    kind: 'attendance',
    name: 'Attendance & leave system',
    icon: 'log-in',
    blurb: 'Punch in / out, sick and casual leave with balances, and hour regularisation requests.',
    provides: ['Punches', 'Leave + balances', 'Regularisations', 'Approvals (write back)'],
    endpointHint: 'https://hr.example.com/api',
  },
];

/** Step 15 (admin): where productivity and attendance data come from, how people are matched, and attendance rules. */
@Component({
  selector: 'app-integrations-page',
  imports: [Avatar, DatePipe, Icon, PageHeader, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './integrations-page.html',
})
export class IntegrationsPage {
  protected readonly store = inject(DataStore);
  protected readonly ext = inject(ExternalStore);
  protected readonly connectors = CONNECTORS;
  protected readonly toast = signal('');
  protected readonly codeErrors = signal<Record<string, string>>({});
  protected readonly query = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    if (!this.ext.range()) void this.syncNow(false);
  }

  protected conf(kind: Kind) {
    return this.ext.config()[kind];
  }

  protected setMode(kind: Kind, mode: SourceMode) {
    this.ext.updateConnector(kind, { mode });
    void this.syncNow(false);
  }

  protected setEndpoint(kind: Kind, value: string) {
    this.ext.updateConnector(kind, { endpoint: value.trim() });
  }

  protected async syncNow(announce = true) {
    const from = this.ext.range()?.from ?? toDateKey(startOfWeek(new Date(this.ext.clock())));
    await this.ext.load({ from, to: addDateKey(from, 6) });
    if (announce) {
      const e = this.ext.errors();
      this.showToast(e.attendance || e.productivity ? 'Sync failed — see the connector card' : 'Synced both systems');
    }
  }

  protected resetSample() {
    this.ext.resetSampleData();
    this.showToast('Sample leave and corrections reset');
  }

  /** Records from the last sync, per connector */
  protected readonly counts = computed(() => ({
    productivity: this.ext.productivity().length,
    attendance: this.ext.attendance().length,
  }));

  /** People with data in the last sync (by either system) */
  private readonly withData = computed(() => new Set([...this.ext.attendance(), ...this.ext.productivity()].map((r) => r.userId)));

  protected readonly people = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.ext.trackedUsers().filter((u) => !q || `${u.name} ${u.email} ${this.ext.employeeId(u)}`.toLowerCase().includes(q));
  });

  protected readonly matched = computed(() => this.ext.trackedUsers().filter((u) => this.withData().has(u.id)).length);

  protected hasData(u: User) {
    return this.withData().has(u.id);
  }

  protected isCustom(u: User) {
    return !!this.ext.config().employeeCodes[u.id];
  }

  protected setCode(u: User, value: string) {
    try {
      this.ext.setEmployeeCode(u.id, value);
      this.codeErrors.update((e) => ({ ...e, [u.id]: '' }));
    } catch (err) {
      this.codeErrors.update((e) => ({ ...e, [u.id]: (err as Error).message }));
    }
  }

  protected setLate(v: string) {
    if (/^\d{2}:\d{2}$/.test(v)) this.ext.updateConfig({ lateAfter: v });
  }

  protected setDayHours(v: string) {
    const h = Number(v);
    if (h >= 1 && h <= 14) this.ext.updateConfig({ dayMinutes: Math.round(h * 60) });
  }

  protected teamName(u: User) {
    return this.store.teamById(u.teamId)?.name ?? '';
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
