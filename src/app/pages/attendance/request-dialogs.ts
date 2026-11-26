import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DataStore } from '../../core/data-store';
import { LEAVE_TYPES, type LeaveType, atTime, leaveDays, timeOf, toDateKey } from '../../core/external';
import { ExternalStore } from '../../core/external-store';
import { Modal } from '../../shared/modal';

/** Apply for sick or casual leave (sent to the attendance system, which a manager approves). */
@Component({
  selector: 'app-leave-form',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" heading="Apply for leave" (closed)="closed.emit()">
      <form id="leave-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div>
          <span class="label">Type</span>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Leave type">
            @for (t of types; track t.id) {
              <button type="button" role="radio" class="chip" [class]="type() === t.id ? 'chip-on' : 'chip-off'" [attr.aria-checked]="type() === t.id" (click)="type.set(t.id)">
                {{ t.label }}
                @if (balance(); as b) {
                  <span class="font-normal">· {{ b[t.id].allowed - b[t.id].used }} left</span>
                }
              </button>
            }
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="lv-from">From *</label>
            <input id="lv-from" type="date" class="input" [value]="from()" (input)="setFrom(val($event))" />
          </div>
          <div>
            <label class="label" for="lv-to">To *</label>
            <input id="lv-to" type="date" class="input" [value]="to()" [disabled]="halfDay()" (input)="to.set(val($event))" />
          </div>
        </div>
        <label class="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink/70">
          <input type="checkbox" class="accent-brand" [checked]="halfDay()" (change)="setHalf($any($event.target).checked)" /> Half day
        </label>
        <div>
          <label class="label" for="lv-reason">Reason *</label>
          <input id="lv-reason" class="input" maxlength="200" placeholder="e.g. Fever, family function" [value]="reason()" (input)="reason.set(val($event))" />
        </div>
        <p class="text-[11px] text-ink/70">{{ days() }} working day{{ days() === 1 ? '' : 's' }} · your manager approves it in the attendance system.</p>
        @if (error()) {
          <p class="text-[11px] text-red-700" role="alert">{{ error() }}</p>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="leave-form" class="btn-primary" [disabled]="busy()">Apply</button>
      </div>
    </app-modal>
  `,
})
export class LeaveForm {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<string>();

  private readonly ext = inject(ExternalStore);
  private readonly store = inject(DataStore);
  protected readonly types = LEAVE_TYPES;
  protected readonly type = signal<LeaveType>('casual');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly halfDay = signal(false);
  protected readonly reason = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected readonly balance = computed(() => this.ext.balanceOf(this.store.currentUser().id));
  protected readonly days = computed(() => (this.from() && this.to() && this.to() >= this.from() ? leaveDays({ from: this.from(), to: this.to(), halfDay: this.halfDay() }) : 0));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        const today = toDateKey(new Date(this.ext.clock()));
        this.type.set('casual');
        this.from.set(today);
        this.to.set(today);
        this.halfDay.set(false);
        this.reason.set('');
        this.error.set('');
      });
    });
  }

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected setFrom(v: string) {
    this.from.set(v);
    if (this.halfDay() || !this.to() || this.to() < v) this.to.set(v);
  }

  protected setHalf(on: boolean) {
    this.halfDay.set(on);
    if (on) this.to.set(this.from());
  }

  protected async save() {
    this.error.set('');
    if (!this.from() || !this.to()) return this.error.set('Pick the dates');
    if (!this.reason().trim()) return this.error.set('Please give a reason');
    this.busy.set(true);
    try {
      await this.ext.applyLeave({ type: this.type(), from: this.from(), to: this.halfDay() ? this.from() : this.to(), halfDay: this.halfDay() || undefined, reason: this.reason() });
      this.saved.emit('Leave applied · waiting for approval');
      this.closed.emit();
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}

/** Ask to correct a past day's punch in / out (regularisation). */
@Component({
  selector: 'app-correction-form',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" heading="Correct my hours" (closed)="closed.emit()">
      <form id="correction-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-3 sm:col-span-1">
            <label class="label" for="rg-date">Day *</label>
            <input id="rg-date" type="date" class="input" [max]="yesterday()" [value]="date()" (input)="pickDate(val($event))" />
          </div>
          <div>
            <label class="label" for="rg-in">Punch in *</label>
            <input id="rg-in" type="time" class="input" [value]="punchIn()" (input)="punchIn.set(val($event))" />
          </div>
          <div>
            <label class="label" for="rg-out">Punch out *</label>
            <input id="rg-out" type="time" class="input" [value]="punchOut()" (input)="punchOut.set(val($event))" />
          </div>
        </div>
        @if (recorded(); as r) {
          <p class="text-[11px] text-ink/70">Recorded that day: {{ r }}</p>
        }
        <div>
          <label class="label" for="rg-reason">Reason *</label>
          <input id="rg-reason" class="input" maxlength="200" placeholder="e.g. Forgot to punch out, client visit" [value]="reason()" (input)="reason.set(val($event))" />
        </div>
        @if (error()) {
          <p class="text-[11px] text-red-700" role="alert">{{ error() }}</p>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="correction-form" class="btn-primary" [disabled]="busy()">Send for approval</button>
      </div>
    </app-modal>
  `,
})
export class CorrectionForm {
  readonly open = input(false);
  /** Day to prefill (e.g. the missed-punch cell that was clicked) */
  readonly day = input<string | undefined>(undefined);
  readonly closed = output<void>();
  readonly saved = output<string>();

  private readonly ext = inject(ExternalStore);
  private readonly store = inject(DataStore);
  protected readonly date = signal('');
  protected readonly punchIn = signal('09:30');
  protected readonly punchOut = signal('18:00');
  protected readonly reason = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected readonly yesterday = computed(() => {
    const d = new Date(this.ext.clock());
    d.setDate(d.getDate() - 1);
    return toDateKey(d);
  });

  protected readonly recorded = computed(() => {
    const me = this.store.currentUser().id;
    const a = this.date() ? this.ext.dayOf(me, this.date()) : undefined;
    if (!a) return '';
    if (!a.punchIn) return 'no punches';
    return `in ${timeOf(a.punchIn)}${a.punchOut ? ', out ' + timeOf(a.punchOut) : ', no punch out'}`;
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const day = this.day();
      untracked(() => {
        this.reason.set('');
        this.error.set('');
        this.pickDate(day ?? this.yesterday());
      });
    });
  }

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected pickDate(k: string) {
    this.date.set(k);
    const me = this.store.currentUser().id;
    const a = k ? this.ext.dayOf(me, k) : undefined;
    this.punchIn.set(a?.punchIn ? timeOf(a.punchIn) : '09:30');
    this.punchOut.set(a?.punchOut ? timeOf(a.punchOut) : '18:00');
  }

  protected async save() {
    this.error.set('');
    if (!this.date() || !this.punchIn() || !this.punchOut()) return this.error.set('Pick the day and both times');
    if (!this.reason().trim()) return this.error.set('Please give a reason');
    this.busy.set(true);
    try {
      await this.ext.requestRegularisation({ date: this.date(), punchIn: atTime(this.date(), this.punchIn()), punchOut: atTime(this.date(), this.punchOut()), reason: this.reason() });
      this.saved.emit('Correction sent · waiting for approval');
      this.closed.emit();
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
