import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DataStore, formatMinutes } from '../../../core/data-store';
import type { WorkActivity } from '../../../core/models';
import { fromLocalInput, toLocalDateInput } from '../../../core/utils';
import { Avatar } from '../../../shared/avatar';
import { Icon } from '../../../shared/icon';
import { WORK_ACTIVITIES, activityOf } from '../ticket-meta';
import { ReadablePipe } from '../../../shared/readable';

/**
 * Log hours for a ticket: Start/Stop timer, or enter a date + spent hours by hand
 * (for when the timer wasn't used). Each entry has an activity (Analysis, Design, Development, Testing, Demo/Meeting, Documentation).
 */
@Component({
  selector: 'app-time-log-panel',
  imports: [ReadablePipe, DatePipe, Avatar, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Totals -->
    <div class="mb-2.5 flex items-end justify-between">
      <div>
        <div class="text-[18px] font-semibold tabular-nums">{{ fmt(logged()) }}</div>
        <div class="text-[11px] text-ink/70">logged{{ estimate() ? ' of ' + fmt(estimate()!) + ' estimate' : '' }}</div>
      </div>
      @if (estimate()) {
        <span class="text-[11px] font-medium tabular-nums" [class.text-red-700]="logged() > estimate()!" [class.text-ink/70]="logged() <= estimate()!">
          {{ usedPct() }}% used
        </span>
      }
    </div>
    @if (estimate()) {
      <div class="mb-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div class="h-full rounded-full" [class]="logged() > estimate()! ? 'bg-red-500' : 'bg-brand'" [style.width.%]="Math.min(100, usedPct())"></div>
      </div>
    }

    <!-- Timer -->
    <div class="mb-3 rounded-xl border border-ink/10 bg-white/60 p-2.5">
      @if (timerHere(); as t) {
        <div class="flex items-center gap-2">
          <span class="relative flex h-2.5 w-2.5"><span class="absolute h-full w-full animate-ping rounded-full bg-red-400 opacity-60"></span><span class="relative h-2.5 w-2.5 rounded-full bg-red-500"></span></span>
          <span class="font-mono text-[15px] font-semibold tabular-nums">{{ elapsed() }}</span>
          <span class="pill" [style.color]="(activityOf(t.activity).color) | readable">{{ activityOf(t.activity).label }}</span>
          <button type="button" class="btn-danger ml-auto px-2.5 py-1 text-[12px]" (click)="stop()"><app-icon name="stop" [size]="12" /> Stop &amp; log</button>
        </div>
        <p class="mt-1 text-[11px] text-ink/70">Started {{ t.startedAt | date: 'MMM d, HH:mm' }}</p>
      } @else {
        <div class="flex flex-wrap items-center gap-2">
          <app-icon name="timer" [size]="15" class="text-ink/70" />
          <select class="input w-auto py-1 text-[12px]" aria-label="Timer activity" [value]="timerActivity()" (change)="timerActivity.set($any($event.target).value)">
            @for (a of activities; track a.id) {
              <option [value]="a.id" [selected]="a.id === timerActivity()">{{ a.label }}</option>
            }
          </select>
          <button type="button" class="btn-primary ml-auto px-2.5 py-1 text-[12px]" (click)="start()"><app-icon name="play" [size]="12" /> Start timer</button>
        </div>
        @if (timerElsewhere(); as other) {
          <p class="mt-1.5 text-[11px] text-ink/70">Your timer is running on {{ other }}. Starting here stops and logs that one.</p>
        }
      }
    </div>

    <!-- Manual entry -->
    <form class="mb-3 rounded-xl border border-ink/10 bg-white/40 p-2.5" (submit)="$event.preventDefault(); addManual()">
      <div class="section-title mb-1.5">Log hours manually</div>
      <div class="grid grid-cols-[1fr_76px] gap-2">
        <div>
          <label class="label" for="wl-date">Date</label>
          <input id="wl-date" class="input py-1 text-[12px]" type="date" [max]="today" [value]="date()" (input)="date.set($any($event.target).value)" />
        </div>
        <div>
          <label class="label" for="wl-hours">Hours</label>
          <input id="wl-hours" class="input py-1 text-[12px]" type="number" min="0.25" max="24" step="0.25" placeholder="1.5" [value]="hours()" (input)="hours.set($any($event.target).value)" />
        </div>
        <div>
          <label class="label" for="wl-activity">Activity</label>
          <select id="wl-activity" class="input py-1 text-[12px]" (change)="activity.set($any($event.target).value)">
            @for (a of activities; track a.id) {
              <option [value]="a.id" [selected]="a.id === activity()">{{ a.label }}</option>
            }
          </select>
        </div>
        <div class="flex items-end">
          <button type="submit" class="btn-secondary w-full px-2 py-1 text-[12px]">Add</button>
        </div>
      </div>
      <input class="input mt-2 py-1 text-[12px]" placeholder="Note (optional)" aria-label="Note" [value]="note()" (input)="note.set($any($event.target).value)" />
      @if (error()) {
        <p class="mt-1.5 text-[11px] text-red-700" role="alert">{{ error() }}</p>
      }
    </form>

    <!-- Entries -->
    <ul class="space-y-1.5">
      @for (w of logs(); track w.id) {
        <li class="flex items-start gap-2 rounded-lg bg-white/60 px-2.5 py-1.5 text-[12px]">
          <app-avatar [user]="store.userById(w.userId)" size="sm" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-semibold tabular-nums">{{ fmt(w.minutes) }}</span>
              <span class="pill py-0" [style.color]="(activityOf(w.activity).color) | readable">{{ activityOf(w.activity).label }}</span>
              <span class="text-[11px] text-ink/70">{{ w.startedAt | date: 'MMM d' }}{{ w.fromTimer ? ' · timer' : '' }}</span>
            </div>
            @if (w.note) {
              <p class="mt-0.5 truncate text-[11px] text-ink/70" [title]="w.note">{{ w.note }}</p>
            }
          </div>
          @if (w.userId === store.currentUser().id) {
            @if (confirmDelete() === w.id) {
              <button type="button" class="text-[11px] font-medium text-red-700 hover:underline" (click)="remove(w.id)">Delete</button>
              <button type="button" class="text-[11px] text-ink/70 hover:underline" (click)="confirmDelete.set(null)">Keep</button>
            } @else {
              <button type="button" class="rounded p-0.5 text-ink/70 hover:text-red-700" aria-label="Delete time entry" (click)="confirmDelete.set(w.id)">
                <app-icon name="trash" [size]="12" />
              </button>
            }
          }
        </li>
      } @empty {
        <li class="text-[12px] text-ink/70">No hours logged yet.</li>
      }
    </ul>
  `,
})
export class TimeLogPanel {
  readonly issueId = input.required<string>();

  protected readonly store = inject(DataStore);
  protected readonly activities = WORK_ACTIVITIES;
  protected readonly activityOf = activityOf;
  protected readonly fmt = formatMinutes;
  protected readonly Math = Math;
  protected readonly today = toLocalDateInput(new Date().toISOString());

  protected readonly timerActivity = signal<WorkActivity>('development');
  protected readonly date = signal(this.today);
  protected readonly hours = signal('');
  protected readonly activity = signal<WorkActivity>('development');
  protected readonly note = signal('');
  protected readonly error = signal('');
  protected readonly confirmDelete = signal<string | null>(null);

  /** Ticks every second so the running timer display updates */
  private readonly tick = signal(Date.now());

  protected readonly logs = computed(() => {
    const id = this.issueId();
    return this.store.workLogs().filter((w) => w.issueId === id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  });
  protected readonly logged = computed(() => this.logs().reduce((s, w) => s + w.minutes, 0));
  protected readonly estimate = computed(() => this.store.issues().find((i) => i.id === this.issueId())?.estimateMinutes);
  protected readonly usedPct = computed(() => Math.round((this.logged() / (this.estimate() || 1)) * 100));
  protected readonly timerHere = computed(() => {
    const t = this.store.activeTimer();
    return t?.issueId === this.issueId() ? t : undefined;
  });
  protected readonly timerElsewhere = computed(() => {
    const t = this.store.activeTimer();
    return t && t.issueId !== this.issueId() ? this.store.issues().find((i) => i.id === t.issueId)?.key : undefined;
  });
  protected readonly elapsed = computed(() => {
    const t = this.timerHere();
    if (!t) return '';
    const secs = Math.max(0, Math.floor((this.tick() - new Date(t.startedAt).getTime()) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
  });

  constructor() {
    const handle = setInterval(() => {
      if (this.timerHere()) this.tick.set(Date.now());
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(handle));
  }

  protected start() {
    this.store.startTimer(this.issueId(), this.timerActivity());
    this.tick.set(Date.now());
  }

  protected stop() {
    this.store.stopTimer();
  }

  protected addManual() {
    const h = Number(this.hours());
    if (!this.date()) return this.error.set('Pick the date the work was done.');
    if (this.date() > this.today) return this.error.set("The date can't be in the future.");
    if (!(h > 0 && h <= 24)) return this.error.set('Enter the hours spent (0.25 to 24).');
    try {
      // Noon local time, so the entry stays on the chosen day in any time zone display
      this.store.addWorkLog(this.issueId(), { date: fromLocalInput(`${this.date()}T12:00`)!, minutes: h * 60, activity: this.activity(), note: this.note() });
      this.hours.set('');
      this.note.set('');
      this.error.set('');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not log the time.');
    }
  }

  protected remove(id: string) {
    this.store.deleteWorkLog(id);
    this.confirmDelete.set(null);
  }
}
