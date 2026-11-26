import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ACTIONS, CONDITION_FIELDS, TRIGGERS, fieldOf, ruleProblem, triggerOf } from '../../core/automation';
import { DataStore } from '../../core/data-store';
import type { AutomationAction, AutomationActionType, AutomationCondition, AutomationRule, AutomationTrigger, ConditionField } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { actionOptions, actionText, conditionOptions, conditionText, statusesFor, triggerText } from './rule-meta';

export type RuleDraft = Pick<AutomationRule, 'name' | 'productId' | 'trigger' | 'conditions' | 'actions'> & { enabled?: boolean };

/** Create / edit an automation rule: When (trigger) → If (all conditions) → Then (actions, in order). */
@Component({
  selector: 'app-rule-form',
  imports: [Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="rule() ? 'Edit rule' : 'New rule'" size="lg" (closed)="closed.emit()">
      <form id="rule-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
          <div>
            <label class="label" for="rf-name">Rule name *</label>
            <input id="rf-name" class="input" maxlength="120" placeholder="e.g. Escalate breached L1 tickets" [value]="name()" (input)="name.set(val($event))" />
          </div>
          <div>
            <label class="label" for="rf-product">Applies to</label>
            <select id="rf-product" class="input" (change)="setProduct(val($event))">
              @if (isAdmin()) {
                <option value="" [selected]="!productId()">All products</option>
              }
              @for (p of products(); track p.id) {
                <option [value]="p.id" [selected]="p.id === productId()">{{ p.name }}</option>
              }
            </select>
          </div>
        </div>

        <!-- When -->
        <section class="rounded-xl border border-ink/10 bg-white/50 p-2.5">
          <div class="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold"><span class="rounded bg-brand px-1.5 py-0.5 text-[10px] text-white">WHEN</span>this happens</div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select class="input py-1 text-[12px]" aria-label="Trigger" (change)="setTrigger($any(val($event)))">
              @for (t of triggers; track t.id) {
                <option [value]="t.id" [selected]="t.id === trigger()">{{ t.label }}</option>
              }
            </select>
            @if (trigger() === 'status_changed') {
              <select class="input py-1 text-[12px]" aria-label="Into status" (change)="triggerValue.set(val($event))">
                <option value="" [selected]="!triggerValue()">to any status</option>
                @for (s of statuses(); track s.id) {
                  <option [value]="s.id" [selected]="s.id === triggerValue()">to {{ s.name }}</option>
                }
              </select>
            } @else {
              <p class="self-center text-[11px] text-ink/70">{{ triggerMeta().hint }}{{ triggerMeta().timed ? ' · checked every minute, once per ticket' : '' }}</p>
            }
          </div>
        </section>

        <!-- If -->
        <section class="rounded-xl border border-ink/10 bg-white/50 p-2.5">
          <div class="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold"><span class="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] text-white">IF</span>all of these are true <span class="font-normal text-ink/70">(optional)</span></div>
          @for (c of conditions(); track $index; let ci = $index) {
            @let opts = condOpts(c.field);
            <div class="mb-1.5 grid grid-cols-[1fr_auto] gap-1.5 sm:grid-cols-[150px_90px_1fr_auto]">
              <select class="input py-1 text-[12px]" aria-label="Condition field" (change)="setCond(ci, { field: $any(val($event)), value: '' })">
                @for (f of fields; track f.id) {
                  <option [value]="f.id" [selected]="f.id === c.field">{{ f.label }}</option>
                }
              </select>
              <select class="input order-3 py-1 text-[12px] sm:order-none" aria-label="Comparison" (change)="setCond(ci, { op: $any(val($event)) })">
                <option value="is" [selected]="c.op === 'is'">is</option>
                <option value="is_not" [selected]="c.op === 'is_not'">is not</option>
              </select>
              @if (opts === null) {
                <input class="input order-4 py-1 text-[12px] sm:order-none" aria-label="Condition value" placeholder="label" [value]="c.value" (input)="setCond(ci, { value: val($event) })" />
              } @else {
                <select class="input order-4 py-1 text-[12px] sm:order-none" aria-label="Condition value" (change)="setCond(ci, { value: val($event) })">
                  @if (fieldMeta(c.field).allowEmpty) {
                    <option value="" [selected]="!c.value">empty</option>
                  } @else {
                    <option value="" [selected]="!c.value" disabled>Pick…</option>
                  }
                  @for (o of opts; track o.id) {
                    <option [value]="o.id" [selected]="o.id === c.value">{{ o.label }}</option>
                  }
                </select>
              }
              <button type="button" class="icon-btn order-2 sm:order-none" aria-label="Remove condition" (click)="removeCond(ci)"><app-icon name="x" [size]="14" /></button>
            </div>
          }
          <button type="button" class="text-[12px] font-medium text-brand hover:underline" (click)="addCond()">+ Add condition</button>
        </section>

        <!-- Then -->
        <section class="rounded-xl border border-ink/10 bg-white/50 p-2.5">
          <div class="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold"><span class="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] text-white">THEN</span>do these, in order</div>
          @for (a of actions(); track $index; let ai = $index) {
            @let opts = actOpts(a.type);
            <div class="mb-1.5 grid grid-cols-[1fr_auto] gap-1.5 sm:grid-cols-[200px_1fr_auto]">
              <select class="input py-1 text-[12px]" aria-label="Action" (change)="setAction(ai, { type: $any(val($event)), value: '' })">
                @for (x of actionTypes; track x.id) {
                  <option [value]="x.id" [selected]="x.id === a.type">{{ x.label }}</option>
                }
              </select>
              @if (opts === null) {
                <input class="input order-3 col-span-2 py-1 text-[12px] sm:order-none sm:col-span-1" aria-label="Action value" [placeholder]="a.type === 'add_comment' ? 'Comment text' : 'label'" [value]="a.value" (input)="setAction(ai, { value: val($event) })" />
              } @else if (opts.length) {
                <select class="input order-3 col-span-2 py-1 text-[12px] sm:order-none sm:col-span-1" aria-label="Action value" (change)="setAction(ai, { value: val($event) })">
                  <option value="" [selected]="!a.value" disabled>Pick…</option>
                  @for (o of opts; track o.id) {
                    <option [value]="o.id" [selected]="o.id === a.value">{{ o.label }}</option>
                  }
                </select>
              } @else {
                <span class="order-3 col-span-2 self-center text-[11px] text-ink/70 sm:order-none sm:col-span-1">{{ a.type === 'escalate' ? 'L1 → L2 → L3, clears the assignee' : 'Removes the assignee' }}</span>
              }
              <button type="button" class="icon-btn order-2 sm:order-none" aria-label="Remove action" (click)="removeAction(ai)"><app-icon name="x" [size]="14" /></button>
            </div>
          }
          <button type="button" class="text-[12px] font-medium text-brand hover:underline" (click)="addAction()">+ Add action</button>
          @if (hasStatusAction()) {
            <p class="mt-1 text-[11px] text-ink/70">Status changes follow the workflow's transition rules; a move the workflow doesn't allow is skipped and noted in the run log.</p>
          }
        </section>

        <div class="rounded-lg bg-brand/[0.06] px-2.5 py-2 text-[12px] text-ink/75">
          <strong class="text-ink">Reads as:</strong> {{ preview() }}
        </div>
        @if (error()) {
          <p class="text-[11px] text-red-700" role="alert">{{ error() }}</p>
        }
      </form>
      <div footer class="contents">
        <label class="mr-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-ink/70"><input type="checkbox" class="accent-brand" [checked]="enabled()" (change)="enabled.set($any($event.target).checked)" /> Enabled</label>
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="rule-form" class="btn-primary">{{ rule() ? 'Save rule' : 'Create rule' }}</button>
      </div>
    </app-modal>
  `,
})
export class RuleForm {
  readonly open = input(false);
  /** Rule being edited (undefined = new) */
  readonly rule = input<AutomationRule | undefined>(undefined);
  /** Starting point for a new rule (template or duplicate) */
  readonly draft = input<RuleDraft | undefined>(undefined);
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly triggers = TRIGGERS;
  protected readonly fields = CONDITION_FIELDS;
  protected readonly actionTypes = ACTIONS;
  protected readonly fieldMeta = fieldOf;

  protected readonly isAdmin = computed(() => this.store.currentUser().role === 'admin');
  protected readonly products = computed(() => this.store.products().filter((p) => !p.archived && this.store.canManageRule(p.id)));

  protected readonly name = signal('');
  protected readonly productId = signal<string | undefined>(undefined);
  protected readonly trigger = signal<AutomationTrigger>('issue_created');
  protected readonly triggerValue = signal('');
  protected readonly conditions = signal<AutomationCondition[]>([]);
  protected readonly actions = signal<AutomationAction[]>([]);
  protected readonly enabled = signal(true);
  protected readonly error = signal('');

  protected readonly triggerMeta = computed(() => triggerOf(this.trigger()));
  protected readonly statuses = computed(() => statusesFor(this.store, this.productId()));
  protected readonly hasStatusAction = computed(() => this.actions().some((a) => a.type === 'set_status'));

  private readonly current = computed<RuleDraft>(() => ({
    name: this.name(),
    productId: this.productId(),
    trigger: this.trigger() === 'status_changed' && this.triggerValue() ? { type: this.trigger(), value: this.triggerValue() } : { type: this.trigger() },
    conditions: this.conditions(),
    actions: this.actions(),
    enabled: this.enabled(),
  }));

  protected readonly preview = computed(() => {
    const r = this.current();
    const when = `When ${triggerText(this.store, r).charAt(0).toLowerCase() + triggerText(this.store, r).slice(1)}`;
    const scope = r.productId ? ` on ${this.store.products().find((p) => p.id === r.productId)?.name}` : ' on any product';
    const lc = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
    const ifs = r.conditions.length ? `, if ${r.conditions.map((c) => lc(conditionText(this.store, c, r.productId))).join(' and ')}` : '';
    const then = r.actions.length ? `, then ${r.actions.map((a) => lc(actionText(this.store, a, r.productId))).join(', then ')}` : ', then … (add an action)';
    return when + scope + ifs + then + '.';
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const r = this.rule() ?? this.draft();
      untracked(() => {
        const fallbackProduct = this.isAdmin() ? undefined : this.products()[0]?.id;
        this.name.set(r?.name ?? '');
        this.productId.set(r ? r.productId : fallbackProduct);
        if (!this.isAdmin() && !this.productId()) this.productId.set(fallbackProduct);
        this.trigger.set(r?.trigger.type ?? 'issue_created');
        this.triggerValue.set(r?.trigger.value ?? '');
        this.conditions.set(structuredClone(r?.conditions ?? []));
        this.actions.set(structuredClone(r?.actions ?? [{ type: 'add_label', value: '' }]));
        this.enabled.set(r?.enabled ?? true);
        this.error.set('');
      });
    });
  }

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected condOpts(field: ConditionField) {
    return conditionOptions(this.store, field, this.productId());
  }

  protected actOpts(type: AutomationActionType) {
    return actionOptions(this.store, type, this.productId());
  }

  protected setProduct(id: string) {
    this.productId.set(id || undefined);
    // Status ids may not exist in the new product's workflow
    const ids = new Set(this.statuses().map((s) => s.id));
    if (this.triggerValue() && !ids.has(this.triggerValue())) this.triggerValue.set('');
    this.conditions.update((cs) => cs.map((c) => (c.field === 'status' && !ids.has(c.value) ? { ...c, value: '' } : c)));
    this.actions.update((as) => as.map((a) => (a.type === 'set_status' && !ids.has(a.value) ? { ...a, value: '' } : a)));
  }

  protected setTrigger(t: AutomationTrigger) {
    this.trigger.set(t);
    if (t !== 'status_changed') this.triggerValue.set('');
  }

  protected addCond() {
    this.conditions.update((cs) => [...cs, { field: 'type', op: 'is', value: '' }]);
  }

  protected setCond(i: number, patch: Partial<AutomationCondition>) {
    this.conditions.update((cs) => cs.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  }

  protected removeCond(i: number) {
    this.conditions.update((cs) => cs.filter((_, n) => n !== i));
  }

  protected addAction() {
    this.actions.update((as) => [...as, { type: 'add_comment', value: '' }]);
  }

  protected setAction(i: number, patch: Partial<AutomationAction>) {
    this.actions.update((as) => as.map((a, n) => (n === i ? { ...a, ...patch } : a)));
  }

  protected removeAction(i: number) {
    this.actions.update((as) => as.filter((_, n) => n !== i));
  }

  protected save() {
    const r = this.current();
    const problem = ruleProblem(r);
    if (problem) return this.error.set(problem);
    const clean = { ...r, actions: r.actions.map((a) => ({ ...a, value: a.value.trim() })), conditions: r.conditions.map((c) => ({ ...c, value: c.value.trim() })) };
    try {
      const existing = this.rule();
      if (existing) {
        this.store.updateRule(existing.id, clean);
        this.saved.emit(`Rule “${clean.name.trim()}” saved`);
      } else {
        this.store.createRule(clean);
        this.saved.emit(`Rule “${clean.name.trim()}” created`);
      }
      this.closed.emit();
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }
}
