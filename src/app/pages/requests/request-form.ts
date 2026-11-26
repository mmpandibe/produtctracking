import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DataStore } from '../../core/data-store';
import type { IssueType, Priority } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { ISSUE_TYPES, PRIORITIES } from '../tickets/ticket-meta';
import { ReadablePipe } from '../../shared/readable';

/** Request types a production user can raise */
const REQUEST_TYPES: IssueType[] = ['request', 'bug', 'support'];

/** Short "raise a ticket" form for production users: product, type, summary, details, urgency. */
@Component({
  selector: 'app-request-form',
  imports: [ReadablePipe, Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" heading="Raise a ticket" (closed)="closed.emit()">
      <form id="request-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="label" for="rq-product">Product *</label>
            <select id="rq-product" class="input" (change)="productId.set(val($event))">
              @for (p of products(); track p.id) {
                <option [value]="p.id" [selected]="p.id === productId()">{{ p.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="label" for="rq-priority">How urgent?</label>
            <select id="rq-priority" class="input" (change)="priority.set($any(val($event)))">
              @for (p of priorities; track p.id) {
                <option [value]="p.id" [selected]="p.id === priority()">{{ p.label }}</option>
              }
            </select>
          </div>
        </div>
        <div>
          <span class="label">What is it?</span>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ticket type">
            @for (t of types; track t.id) {
              <button type="button" role="radio" class="chip" [class]="type() === t.id ? 'chip-on' : 'chip-off'" [attr.aria-checked]="type() === t.id" (click)="type.set(t.id)">
                <app-icon [name]="t.icon" [size]="12" [style.color]="(type() === t.id ? null : t.color) | readable" />{{ t.id === 'bug' ? 'Something is broken' : t.id === 'support' ? 'I need help' : 'New request' }}
              </button>
            }
          </div>
        </div>
        <div>
          <label class="label" for="rq-summary">Summary *</label>
          <input id="rq-summary" class="input" [value]="summary()" (input)="summary.set(val($event))" maxlength="200" placeholder="One line, e.g. Monthly export file is empty" autofocus />
          @if (submitted() && !summary().trim()) {
            <p class="mt-1 text-[11px] text-red-700">Please add a short summary</p>
          }
        </div>
        <div>
          <label class="label" for="rq-desc">Details</label>
          <textarea id="rq-desc" class="input min-h-20" [value]="description()" (input)="description.set(val($event))" placeholder="What happened, where, and since when? Steps to reproduce help a lot."></textarea>
        </div>
        @if (!products().length) {
          <p class="text-[11px] text-amber-800" role="alert">You're not linked to any product yet. Ask your admin to add you to one.</p>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="request-form" class="btn-primary" [disabled]="!products().length">Raise ticket</button>
      </div>
    </app-modal>
  `,
})
export class RequestForm {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly types = ISSUE_TYPES.filter((t) => REQUEST_TYPES.includes(t.id));
  protected readonly priorities = PRIORITIES;
  protected readonly products = computed(() => this.store.products().filter((p) => !p.archived));

  protected readonly productId = signal('');
  protected readonly type = signal<IssueType>('request');
  protected readonly priority = signal<Priority>('medium');
  protected readonly summary = signal('');
  protected readonly description = signal('');
  protected readonly submitted = signal(false);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.productId.set(this.products()[0]?.id ?? '');
        this.type.set('request');
        this.priority.set('medium');
        this.summary.set('');
        this.description.set('');
        this.submitted.set(false);
      });
    });
  }

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected save() {
    this.submitted.set(true);
    if (!this.summary().trim() || !this.productId()) return;
    const me = this.store.currentUser();
    const issue = this.store.createIssue({
      productId: this.productId(),
      type: this.type(),
      priority: this.priority(),
      summary: this.summary(),
      description: this.description().trim() || undefined,
      reporterId: me.id,
      clientId: me.clientId,
    });
    this.saved.emit(issue.key);
    this.closed.emit();
  }
}
