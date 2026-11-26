import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DataStore, formatMinutes } from '../../core/data-store';
import type { WorkActivity } from '../../core/models';
import { dayKey, fromLocalInput } from '../../core/utils';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { WORK_ACTIVITIES, activityOf } from '../tickets/ticket-meta';
import { ReadablePipe } from '../../shared/readable';

/** Log time for a person on a ticket and day; also shows (and can delete) that day's entries. */
@Component({
  selector: 'app-log-time-dialog',
  imports: [ReadablePipe, Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="'Log time' + (personName() ? ' · ' + personName() : '')" (closed)="closed.emit()">
      <form id="log-time-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div>
          <label class="label" for="lt-ticket">Ticket *</label>
          <select id="lt-ticket" class="input" (change)="issueIdSel.set($any($event.target).value)">
            <option value="" [selected]="!issueIdSel()">Choose a ticket…</option>
            @for (g of ticketGroups(); track g.product.id) {
              <optgroup [label]="g.product.name">
                @for (i of g.issues; track i.id) {
                  <option [value]="i.id" [selected]="i.id === issueIdSel()">{{ i.key }} · {{ i.summary }}</option>
                }
              </optgroup>
            }
          </select>
        </div>
        <div class="grid grid-cols-[1fr_90px] gap-3">
          <div>
            <label class="label" for="lt-date">Date *</label>
            <input id="lt-date" class="input" type="date" [max]="today" [value]="date()" (input)="date.set($any($event.target).value)" />
          </div>
          <div>
            <label class="label" for="lt-hours">Hours *</label>
            <input id="lt-hours" class="input" type="number" min="0.25" max="24" step="0.25" placeholder="1.5" [value]="hours()" (input)="hours.set($any($event.target).value)" autofocus />
          </div>
        </div>
        <div>
          <span class="label">Activity</span>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Activity">
            @for (a of activities; track a.id) {
              <button type="button" role="radio" class="chip" [class]="activity() === a.id ? 'chip-on' : 'chip-off'" [attr.aria-checked]="activity() === a.id" (click)="activity.set(a.id)">
                <span class="h-1.5 w-1.5 rounded-full" [style.background]="activity() === a.id ? 'white' : a.color"></span>{{ a.label }}
              </button>
            }
          </div>
        </div>
        <div>
          <label class="label" for="lt-note">Note</label>
          <input id="lt-note" class="input" placeholder="What did you work on? (optional)" [value]="note()" (input)="note.set($any($event.target).value)" />
        </div>
        @if (error()) {
          <p class="text-[12px] text-red-700" role="alert">{{ error() }}</p>
        }

        @if (dayEntries().length) {
          <div class="rounded-xl border border-ink/10 bg-white/50 p-2.5">
            <div class="section-title mb-1.5">Already logged on this day · {{ fmt(dayTotal()) }}</div>
            <ul class="space-y-1">
              @for (w of dayEntries(); track w.id) {
                <li class="flex items-center gap-2 text-[12px]">
                  <span class="font-semibold tabular-nums">{{ fmt(w.minutes) }}</span>
                  <span class="pill py-0" [style.color]="(activityOf(w.activity).color) | readable">{{ activityOf(w.activity).label }}</span>
                  <span class="min-w-0 flex-1 truncate text-ink/70">{{ w.note ?? (w.fromTimer ? 'Timer' : '') }}</span>
                  @if (confirmDelete() === w.id) {
                    <button type="button" class="text-[11px] font-medium text-red-700 hover:underline" (click)="remove(w.id)">Delete</button>
                    <button type="button" class="text-[11px] text-ink/70 hover:underline" (click)="confirmDelete.set(null)">Keep</button>
                  } @else {
                    <button type="button" class="rounded p-0.5 text-ink/70 hover:text-red-700" aria-label="Delete entry" (click)="confirmDelete.set(w.id)"><app-icon name="trash" [size]="12" /></button>
                  }
                </li>
              }
            </ul>
          </div>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Close</button>
        <button type="submit" form="log-time-form" class="btn-primary">Log time</button>
      </div>
    </app-modal>
  `,
})
export class LogTimeDialog {
  readonly open = input(false);
  /** Person the time is logged for */
  readonly userId = input.required<string>();
  readonly issueId = input<string | undefined>();
  /** "YYYY-MM-DD" */
  readonly day = input<string | undefined>();
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly activities = WORK_ACTIVITIES;
  protected readonly activityOf = activityOf;
  protected readonly fmt = formatMinutes;
  protected readonly today = dayKey(new Date());

  protected readonly issueIdSel = signal('');
  protected readonly date = signal(this.today);
  protected readonly hours = signal('');
  protected readonly activity = signal<WorkActivity>('development');
  protected readonly note = signal('');
  protected readonly error = signal('');
  protected readonly confirmDelete = signal<string | null>(null);

  protected readonly personName = computed(() => this.store.userById(this.userId())?.name ?? '');
  /** Tickets grouped by (active) product */
  protected readonly ticketGroups = computed(() =>
    this.store
      .products()
      .filter((p) => !p.archived)
      .map((product) => ({ product, issues: this.store.issues().filter((i) => i.productId === product.id) }))
      .filter((g) => g.issues.length),
  );
  protected readonly dayEntries = computed(() => {
    const id = this.issueIdSel();
    const d = this.date();
    const uid = this.userId();
    return id && d ? this.store.workLogs().filter((w) => w.issueId === id && w.userId === uid && dayKey(w.startedAt) === d) : [];
  });
  protected readonly dayTotal = computed(() => this.dayEntries().reduce((s, w) => s + w.minutes, 0));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const issueId = this.issueId();
      const day = this.day();
      untracked(() => {
        this.issueIdSel.set(issueId ?? '');
        this.date.set(day && day <= this.today ? day : this.today);
        this.hours.set('');
        this.note.set('');
        this.error.set('');
        this.confirmDelete.set(null);
      });
    });
  }

  protected save() {
    const h = Number(this.hours());
    if (!this.issueIdSel()) return this.error.set('Choose the ticket you worked on.');
    if (!this.date()) return this.error.set('Pick the date the work was done.');
    if (this.date() > this.today) return this.error.set("The date can't be in the future.");
    if (!(h > 0 && h <= 24)) return this.error.set('Enter the hours spent (0.25 to 24).');
    if (this.dayTotal() + h * 60 > 24 * 60) return this.error.set('That would be more than 24 hours on one day for this ticket.');
    try {
      // Noon local time keeps the entry on the chosen day
      this.store.addWorkLog(
        this.issueIdSel(),
        { date: fromLocalInput(`${this.date()}T12:00`)!, minutes: h * 60, activity: this.activity(), note: this.note() },
        false,
        this.userId(),
      );
      const key = this.store.issues().find((i) => i.id === this.issueIdSel())?.key;
      this.saved.emit(`Logged ${formatMinutes(Math.round(h * 60))} on ${key}`);
      this.closed.emit();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not log the time.');
    }
  }

  protected remove(id: string) {
    this.store.deleteWorkLog(id);
    this.confirmDelete.set(null);
  }
}
