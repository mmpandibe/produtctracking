import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataStore } from '../../core/data-store';
import type { Client } from '../../core/models';
import { Modal } from '../../shared/modal';

/** Create or edit a client: contact details, linked products, notes. */
@Component({
  selector: 'app-client-form',
  imports: [ReactiveFormsModule, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="client() ? 'Edit ' + client()!.name : 'Add client'" (closed)="closed.emit()">
      <form id="client-form" class="space-y-3" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div>
          <label class="label" for="cf-name">Client name *</label>
          <input id="cf-name" class="input" formControlName="name" placeholder="e.g. Acme Corp" autofocus />
          @if (submitted() && form.controls.name.invalid) {
            <p class="mt-1 text-[11px] text-red-700">Client name is required</p>
          }
          @if (submitted() && duplicate()) {
            <p class="mt-1 text-[11px] text-red-700">A client with this name already exists</p>
          }
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label class="label" for="cf-contact">Contact person</label>
            <input id="cf-contact" class="input" formControlName="contactName" placeholder="Full name" />
          </div>
          <div>
            <label class="label" for="cf-email">Email</label>
            <input id="cf-email" class="input" type="email" formControlName="contactEmail" placeholder="name@company.com" />
            @if (submitted() && form.controls.contactEmail.invalid) {
              <p class="mt-1 text-[11px] text-red-700">Enter a valid email</p>
            }
          </div>
          <div>
            <label class="label" for="cf-phone">Phone</label>
            <input id="cf-phone" class="input" type="tel" formControlName="contactPhone" placeholder="+1 555 0100" />
          </div>
        </div>
        <div>
          <span class="label">Products</span>
          <div class="flex flex-wrap gap-1.5">
            @for (p of store.products(); track p.id) {
              @if (!p.archived || productIds().includes(p.id)) {
                <button type="button" class="chip" [class]="productIds().includes(p.id) ? 'chip-on' : 'chip-off'" [attr.aria-pressed]="productIds().includes(p.id)" (click)="toggleProduct(p.id)">
                  <span class="h-1.5 w-1.5 rounded-full" [style.background]="productIds().includes(p.id) ? 'white' : p.color"></span>{{ p.name }}
                </button>
              }
            }
          </div>
        </div>
        <div>
          <label class="label" for="cf-notes">Notes</label>
          <textarea id="cf-notes" class="input min-h-16" formControlName="notes" placeholder="Escalation path, contract details, preferences…"></textarea>
        </div>
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="client-form" class="btn-primary">{{ client() ? 'Save changes' : 'Add client' }}</button>
      </div>
    </app-modal>
  `,
})
export class ClientForm {
  readonly open = input(false);
  readonly client = input<Client | undefined>();
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly submitted = signal(false);
  protected readonly productIds = signal<string[]>([]);

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    contactName: [''],
    contactEmail: ['', Validators.email],
    contactPhone: [''],
    notes: [''],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const c = this.client();
      untracked(() => {
        this.form.reset({
          name: c?.name ?? '',
          contactName: c?.contactName ?? '',
          contactEmail: c?.contactEmail ?? '',
          contactPhone: c?.contactPhone ?? '',
          notes: c?.notes ?? '',
        });
        this.productIds.set(c ? this.store.clientProducts(c.id).map((p) => p.id) : []);
        this.submitted.set(false);
      });
    });
  }

  protected duplicate() {
    const name = this.form.controls.name.value.trim().toLowerCase();
    return !!name && this.store.clients().some((c) => c.name.toLowerCase() === name && c.id !== this.client()?.id);
  }

  protected toggleProduct(id: string) {
    this.productIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected save() {
    this.submitted.set(true);
    if (this.form.invalid || this.duplicate()) return;
    const input = this.form.getRawValue();
    const c = this.client();
    if (c) {
      this.store.updateClient(c.id, input, this.productIds());
      this.saved.emit(`${input.name.trim()} updated`);
    } else {
      this.store.createClient(input, this.productIds());
      this.saved.emit(`${input.name.trim()} added`);
    }
    this.closed.emit();
  }
}
