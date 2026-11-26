import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ruleTemplates, triggerOf } from '../../core/automation';
import { DataStore } from '../../core/data-store';
import type { AutomationRule, AutomationRun } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { actionText, conditionText, triggerText } from './rule-meta';
import { RuleDraft, RuleForm } from './rule-form';
import { ReadablePipe } from '../../shared/readable';

type Tab = 'rules' | 'log';

const OUTCOME: Record<AutomationRun['outcome'], { label: string; color: string }> = {
  done: { label: 'Done', color: '#15803d' },
  partial: { label: 'Partly done', color: '#b45309' },
  failed: { label: 'Failed', color: '#b91c1c' },
};

/** Step 17: "When X, if Y, then Z" rules per product (or all products) and a log of every run. */
@Component({
  selector: 'app-automation-page',
  imports: [ReadablePipe, DatePipe, Icon, Modal, PageHeader, RouterLink, RuleForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './automation-page.html',
})
export class AutomationPage {
  protected readonly store = inject(DataStore);
  protected readonly templates = ruleTemplates();
  protected readonly outcome = OUTCOME;
  protected readonly triggerOf = triggerOf;

  protected readonly tab = signal<Tab>('rules');
  protected readonly productFilter = signal('');
  protected readonly logRule = signal('');

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<AutomationRule | undefined>(undefined);
  protected readonly draft = signal<RuleDraft | undefined>(undefined);
  protected readonly deleting = signal<AutomationRule | undefined>(undefined);
  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected readonly canCreate = computed(() => this.store.currentUser().role === 'admin' || this.store.products().some((p) => this.store.canManageRule(p.id)));

  protected readonly rules = computed(() => {
    const f = this.productFilter();
    return this.store
      .automations()
      .filter((r) => !f || (f === 'all' ? !r.productId : r.productId === f))
      .slice()
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
  });

  protected readonly stats = computed(() => {
    const rules = this.store.automations();
    const day = Date.now() - 86_400_000;
    const log = this.store.automationLog();
    return {
      total: rules.length,
      enabled: rules.filter((r) => r.enabled).length,
      runs24h: log.filter((r) => Date.parse(r.at) >= day).length,
      problems: log.filter((r) => r.outcome !== 'done' && Date.parse(r.at) >= day).length,
    };
  });

  protected readonly log = computed(() => {
    const r = this.logRule();
    return this.store.automationLog().filter((x) => !r || x.ruleId === r).slice(0, 100);
  });

  protected productName(id?: string) {
    return id ? (this.store.products().find((p) => p.id === id)?.name ?? 'Unknown product') : 'All products';
  }

  protected productColor(id?: string) {
    return id ? this.store.products().find((p) => p.id === id)?.color : undefined;
  }

  protected when(r: AutomationRule) {
    return triggerText(this.store, r);
  }

  protected ifs(r: AutomationRule) {
    return r.conditions.map((c) => conditionText(this.store, c, r.productId));
  }

  protected thens(r: AutomationRule) {
    return r.actions.map((a) => actionText(this.store, a, r.productId));
  }

  protected canManage(r: AutomationRule) {
    return this.store.canManageRule(r.productId);
  }

  protected openNew(draft?: RuleDraft) {
    this.editing.set(undefined);
    this.draft.set(draft);
    this.formOpen.set(true);
  }

  protected useTemplate(t: (typeof this.templates)[number]) {
    const admin = this.store.currentUser().role === 'admin';
    this.openNew({ ...structuredClone(t.rule), productId: admin ? undefined : this.store.products().find((p) => this.store.canManageRule(p.id))?.id, enabled: true });
  }

  protected edit(r: AutomationRule) {
    this.draft.set(undefined);
    this.editing.set(r);
    this.formOpen.set(true);
  }

  protected duplicate(r: AutomationRule) {
    this.openNew({ name: `${r.name} (copy)`, productId: r.productId, trigger: structuredClone(r.trigger), conditions: structuredClone(r.conditions), actions: structuredClone(r.actions), enabled: false });
  }

  protected toggle(r: AutomationRule) {
    try {
      this.store.setRuleEnabled(r.id, !r.enabled);
      this.showToast(`${r.name} ${r.enabled ? 'turned off' : 'turned on'}`);
      // A time-based rule switched on catches up straight away
      if (!r.enabled && triggerOf(r.trigger.type).timed) {
        const n = this.store.runTimedRules();
        if (n) this.showToast(`${r.name} turned on · ran on ${n} ticket${n === 1 ? '' : 's'}`);
      }
    } catch (err) {
      this.showToast((err as Error).message);
    }
  }

  protected confirmDelete() {
    const r = this.deleting();
    if (!r) return;
    try {
      this.store.deleteRule(r.id);
      this.showToast(`Rule “${r.name}” deleted`);
    } catch (err) {
      this.showToast((err as Error).message);
    }
    this.deleting.set(undefined);
  }

  protected showLog(r: AutomationRule) {
    this.logRule.set(r.id);
    this.tab.set('log');
  }

  protected saved(msg: string) {
    this.showToast(msg);
    this.store.runTimedRules();
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
