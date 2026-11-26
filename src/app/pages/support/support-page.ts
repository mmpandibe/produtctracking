import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataStore } from '../../core/data-store';
import type { Issue, SupportLevel } from '../../core/models';
import { CLOCK_COLORS, CLOCK_LABELS, type SlaClock, SUPPORT_LEVELS, clockLabel, formatDuration, levelOf, nextLevel } from '../../core/sla';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { priorityOf, typeOf } from '../tickets/ticket-meta';
import { SlaSettings } from './sla-settings';
import { ReadablePipe } from '../../shared/readable';

type Tab = 'queues' | 'report' | 'settings';
type Sla = NonNullable<ReturnType<DataStore['slaOf']>>;
interface Row {
  issue: Issue;
  sla: Sla;
  resolved: boolean;
  /** 0 breached · 1 at risk · 2 on time · 3 resolved (sort order) */
  urgency: number;
}

const REPORT_DAYS = 30;

/** Step 13: L1 / L2 / L3 support queues with live SLA clocks, escalation, an SLA report and (admins) level + target settings. */
@Component({
  selector: 'app-support-page',
  imports: [ReadablePipe, Avatar, Icon, Modal, PageHeader, RouterLink, SlaSettings],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-page.html',
})
export class SupportPage {
  protected readonly store = inject(DataStore);
  protected readonly levels = SUPPORT_LEVELS;
  protected readonly levelOf = levelOf;
  protected readonly typeOf = typeOf;
  protected readonly priorityOf = priorityOf;
  protected readonly clockLabel = clockLabel;
  protected readonly clockColors = CLOCK_COLORS;
  protected readonly clockLabels = CLOCK_LABELS;
  protected readonly dur = formatDuration;
  protected readonly reportDays = REPORT_DAYS;

  protected readonly canSetup = computed(() => this.store.canDo('organisation'));
  protected readonly tab = signal<Tab>(this.initialTab());

  /** Clocks tick every 30 seconds */
  protected readonly now = signal(Date.now());

  // Queue filters
  protected readonly level = signal<SupportLevel | ''>('');
  protected readonly mine = signal(false);
  protected readonly attention = signal(false);
  protected readonly showResolved = signal(false);
  protected readonly productFilter = signal('');
  protected readonly query = signal('');

  // Escalation dialog
  protected readonly escalating = signal<Issue | undefined>(undefined);
  protected readonly reason = signal('');

  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const handle = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(handle));
  }

  private initialTab(): Tab {
    const t = inject(ActivatedRoute).snapshot.queryParamMap.get('tab');
    return t === 'report' || (t === 'settings' && this.store.canDo('organisation')) ? t : 'queues';
  }

  /** Every support ticket the signed-in person can see, with its clocks */
  private readonly rows = computed<Row[]>(() => {
    const now = this.now();
    this.store.slaPolicies();
    return this.store
      .issues()
      .map((issue) => {
        const sla = this.store.slaOf(issue, now);
        if (!sla) return undefined;
        const resolved = this.store.isResolved(issue);
        const states = [sla.response.state, sla.resolution.state];
        const urgency = resolved ? 3 : states.includes('breached') ? 0 : states.includes('at_risk') ? 1 : 2;
        return { issue, sla, resolved, urgency };
      })
      .filter((r): r is Row => !!r);
  });

  private readonly open = computed(() => this.rows().filter((r) => !r.resolved));

  protected readonly kpis = computed(() => {
    const open = this.open();
    const since = this.now() - REPORT_DAYS * 86_400_000;
    const recent = this.rows().filter((r) => Date.parse(r.issue.createdAt) >= since);
    const responded = recent.filter((r) => r.sla.response.takenMinutes !== undefined);
    const met = responded.filter((r) => r.sla.response.state === 'met').length;
    return {
      open: open.length,
      breached: open.filter((r) => r.urgency === 0).length,
      atRisk: open.filter((r) => r.urgency === 1).length,
      unassigned: open.filter((r) => !r.issue.assigneeId).length,
      responseMet: responded.length ? Math.round((met / responded.length) * 100) : null,
    };
  });

  protected readonly levelCounts = computed(() => {
    const open = this.open();
    return Object.fromEntries(SUPPORT_LEVELS.map((l) => [l.id, open.filter((r) => r.issue.supportLevel === l.id).length])) as Record<SupportLevel, number>;
  });

  protected readonly supportProducts = computed(() => {
    const ids = new Set(this.rows().map((r) => r.issue.productId));
    return this.store.products().filter((p) => ids.has(p.id));
  });

  protected readonly queue = computed(() => {
    const me = this.store.currentUser().id;
    const q = this.query().trim().toLowerCase();
    return this.rows()
      .filter((r) => this.showResolved() || !r.resolved)
      .filter((r) => !this.level() || r.issue.supportLevel === this.level())
      .filter((r) => !this.mine() || r.issue.assigneeId === me)
      .filter((r) => !this.attention() || r.urgency <= 1)
      .filter((r) => !this.productFilter() || r.issue.productId === this.productFilter())
      .filter((r) => !q || `${r.issue.key} ${r.issue.summary}`.toLowerCase().includes(q))
      .sort((a, b) => a.urgency - b.urgency || a.sla.resolution.dueAt - b.sla.resolution.dueAt);
  });

  // ---- Report ----

  protected readonly report = computed(() => {
    const since = this.now() - REPORT_DAYS * 86_400_000;
    const recent = this.rows().filter((r) => Date.parse(r.issue.createdAt) >= since);
    const summarise = (rows: Row[]) => {
      const responded = rows.filter((r) => r.sla.response.takenMinutes !== undefined);
      const resolved = rows.filter((r) => r.sla.resolution.takenMinutes !== undefined);
      const pct = (list: Row[], pick: (r: Row) => SlaClock) => (list.length ? Math.round((list.filter((r) => pick(r).state === 'met').length / list.length) * 100) : null);
      const avg = (list: Row[], pick: (r: Row) => SlaClock) => (list.length ? list.reduce((s, r) => s + (pick(r).takenMinutes ?? 0), 0) / list.length : null);
      return {
        total: rows.length,
        open: rows.filter((r) => !r.resolved).length,
        breachedNow: rows.filter((r) => r.urgency === 0).length,
        responseMet: pct(responded, (r) => r.sla.response),
        resolutionMet: pct(resolved, (r) => r.sla.resolution),
        avgResponse: avg(responded, (r) => r.sla.response),
        avgResolution: avg(resolved, (r) => r.sla.resolution),
      };
    };
    const group = <K extends string>(keyOf: (r: Row) => K | undefined) => {
      const map = new Map<K, Row[]>();
      for (const r of recent) {
        const k = keyOf(r);
        if (k) map.set(k, [...(map.get(k) ?? []), r]);
      }
      return map;
    };
    const byProduct = group((r) => r.issue.productId);
    const byClient = group((r) => r.issue.clientId);
    return {
      all: summarise(recent),
      levels: SUPPORT_LEVELS.map((l) => ({ meta: l, name: this.store.supportLevel(l.id)?.name ?? l.label, ...summarise(recent.filter((r) => r.issue.supportLevel === l.id)) })),
      products: [...byProduct].map(([id, rows]) => ({ name: this.store.products().find((p) => p.id === id)?.name ?? '—', color: this.store.products().find((p) => p.id === id)?.color, ...summarise(rows) })).sort((a, b) => b.total - a.total),
      clients: [...byClient].map(([id, rows]) => ({ name: this.store.clients().find((c) => c.id === id)?.name ?? '—', ...summarise(rows) })).sort((a, b) => b.total - a.total),
    };
  });

  // ---- Actions ----

  protected productOf(i: Issue) {
    return this.store.products().find((p) => p.id === i.productId);
  }

  protected clientName(i: Issue) {
    return this.store.clients().find((c) => c.id === i.clientId)?.name;
  }

  protected teamName(level: SupportLevel | undefined) {
    return this.store.teamById(this.store.supportLevel(level)?.teamId)?.name;
  }

  protected nextOf(i: Issue) {
    return i.supportLevel ? nextLevel(i.supportLevel) : undefined;
  }

  protected assignToMe(i: Issue) {
    this.store.updateIssue(i.id, { assigneeId: this.store.currentUser().id });
    this.showToast(`${i.key} assigned to you`);
  }

  protected openEscalate(i: Issue) {
    this.reason.set('');
    this.escalating.set(i);
  }

  protected confirmEscalate() {
    const i = this.escalating();
    if (!i) return;
    try {
      const to = this.store.escalate(i.id, this.reason());
      this.showToast(`${i.key} escalated to ${to.toUpperCase()}`);
    } catch (err) {
      this.showToast((err as Error).message);
    }
    this.escalating.set(undefined);
  }

  protected pct(v: number | null) {
    return v === null ? '—' : `${v}%`;
  }

  protected avg(v: number | null) {
    return v === null ? '—' : formatDuration(v);
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
