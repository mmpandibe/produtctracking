import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DataStore } from '../../core/data-store';
import type { CustomFieldDef, CustomFieldType } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { FIELD_TYPES } from './workflow-meta';

/** Create / edit a custom field (Step 10) */
@Component({
  selector: 'app-field-form',
  imports: [Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="field() ? 'Edit field' : 'Add custom field'" (closed)="closed.emit()">
      <form id="field-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div>
          <label class="label" for="ff-name">Name *</label>
          <input id="ff-name" class="input" [value]="name()" (input)="name.set(val($event))" placeholder="e.g. Environment, Customer reference" autofocus />
        </div>
        <div>
          <span class="label">Type</span>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Field type">
            @for (t of types; track t.id) {
              <button type="button" role="radio" class="chip" [class]="type() === t.id ? 'chip-on' : 'chip-off'" [attr.aria-checked]="type() === t.id" (click)="type.set(t.id)">
                <app-icon [name]="t.icon" [size]="12" />{{ t.label }}
              </button>
            }
          </div>
          @if (field() && field()!.type !== type() && usage()) {
            <p class="mt-1 text-[11px] text-amber-800">Changing the type clears the {{ usage() }} value(s) already entered.</p>
          }
        </div>
        @if (type() === 'select') {
          <div>
            <label class="label" for="ff-options">Options * <span class="font-normal text-ink/70">(one per line)</span></label>
            <textarea id="ff-options" class="input resize-none overflow-hidden" [rows]="optionRows()" [value]="options()" (input)="options.set(val($event))" placeholder="Production&#10;Staging&#10;Development"></textarea>
          </div>
        }
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="label" for="ff-scope">Applies to</label>
            <select id="ff-scope" class="input" (change)="productId.set(val($event))">
              <option value="" [selected]="!productId()">All products</option>
              @for (p of store.products(); track p.id) {
                <option [value]="p.id" [selected]="p.id === productId()">{{ p.name }} ({{ p.key }})</option>
              }
            </select>
          </div>
          <label class="flex cursor-pointer items-center gap-2 self-end pb-2 text-[12px]">
            <input type="checkbox" class="accent-brand" [checked]="required()" (change)="required.set($any($event.target).checked)" />
            Required on tickets
          </label>
        </div>
        @if (error()) {
          <p class="text-[11px] text-red-700" role="alert">{{ error() }}</p>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="field-form" class="btn-primary">{{ field() ? 'Save field' : 'Add field' }}</button>
      </div>
    </app-modal>
  `,
})
export class FieldForm {
  readonly open = input(false);
  readonly field = input<CustomFieldDef | undefined>();
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly types = FIELD_TYPES;
  protected readonly name = signal('');
  protected readonly type = signal<CustomFieldType>('text');
  protected readonly options = signal('');
  protected readonly productId = signal('');
  protected readonly required = signal(false);
  protected readonly error = signal('');
  protected readonly usage = signal(0);
  /** The options box grows with its lines (no inner scrollbar) */
  protected readonly optionRows = computed(() => Math.max(3, this.options().split('\n').length + 1));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const f = this.field();
      untracked(() => {
        this.name.set(f?.name ?? '');
        this.type.set(f?.type ?? 'text');
        this.options.set(f?.options?.join('\n') ?? '');
        this.productId.set(f?.productId ?? '');
        this.required.set(!!f?.required);
        this.usage.set(f ? this.store.customFieldUsage(f.id) : 0);
        this.error.set('');
      });
    });
  }

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected save() {
    const input = {
      name: this.name(), type: this.type(), options: this.options().split('\n'), required: this.required(), productId: this.productId() || undefined,
    };
    try {
      const f = this.field();
      if (f) this.store.updateCustomField(f.id, input);
      else this.store.createCustomField(input);
      this.saved.emit(`${input.name.trim()} ${f ? 'saved' : 'added'}`);
      this.closed.emit();
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }
}
