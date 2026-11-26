import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DataStore } from '../../core/data-store';
import type { Sprint } from '../../core/models';
import { fromLocalInput, toLocalDateInput } from '../../core/utils';
import { Modal } from '../../shared/modal';

/** Create or edit a sprint. Name is suggested ("WEB Sprint 14"); dates default to a 2-week window. */
@Component({
  selector: 'app-sprint-form',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="sprint() ? 'Edit ' + sprint()!.name : 'Create sprint'" (closed)="closed.emit()">
      <form id="sprint-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div>
          <label class="label" for="sf-name">Sprint name *</label>
          <input id="sf-name" class="input" [value]="name()" (input)="name.set($any($event.target).value)" autofocus />
          @if (submitted() && !name().trim()) {
            <p class="mt-1 text-[11px] text-red-700">Give the sprint a name</p>
          }
        </div>
        <div>
          <label class="label" for="sf-goal">Sprint goal</label>
          <textarea id="sf-goal" class="input min-h-14" placeholder="What should this sprint achieve?" [value]="goal()" (input)="goal.set($any($event.target).value)"></textarea>
        </div>
        <div>
          <label class="label" for="sf-roadmap">Roadmap</label>
          <select id="sf-roadmap" class="input" (change)="roadmapId.set($any($event.target).value)">
            <option value="" [selected]="!roadmapId()">No roadmap</option>
            @for (r of roadmaps(); track r.id) {
              <option [value]="r.id" [selected]="r.id === roadmapId()">{{ r.name }}</option>
            }
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="sf-start">Start date</label>
            <input id="sf-start" class="input" type="date" [value]="start()" (input)="onStart($any($event.target).value)" />
          </div>
          <div>
            <label class="label" for="sf-end">End date</label>
            <input id="sf-end" class="input" type="date" [value]="end()" (input)="end.set($any($event.target).value)" />
          </div>
        </div>
        @if (submitted() && start() && end() && end() < start()) {
          <p class="text-[11px] text-red-700">The end date can't be before the start date.</p>
        } @else {
          <div class="flex flex-wrap gap-1.5">
            <span class="text-[11px] text-ink/70">Length:</span>
            @for (w of [1, 2, 3, 4]; track w) {
              <button type="button" class="chip chip-off py-0 text-[11px]" (click)="setWeeks(w)">{{ w }} week{{ w > 1 ? 's' : '' }}</button>
            }
          </div>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="sprint-form" class="btn-primary">{{ sprint() ? 'Save changes' : 'Create sprint' }}</button>
      </div>
    </app-modal>
  `,
})
export class SprintForm {
  readonly open = input(false);
  readonly productId = input.required<string>();
  /** When set, edits this sprint */
  readonly sprint = input<Sprint | undefined>();
  readonly closed = output<void>();
  readonly saved = output<string>();

  private readonly store = inject(DataStore);
  protected readonly name = signal('');
  protected readonly goal = signal('');
  protected readonly start = signal('');
  protected readonly end = signal('');
  protected readonly submitted = signal(false);
  protected readonly roadmapId = signal('');
  protected readonly roadmaps = computed(() => this.store.roadmaps().filter((r) => r.productId === this.productId() && r.status !== 'cancelled'));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const sp = this.sprint();
      const productId = this.productId();
      untracked(() => {
        this.submitted.set(false);
        if (sp) {
          this.name.set(sp.name);
          this.goal.set(sp.goal ?? '');
          this.start.set(toLocalDateInput(sp.startDate));
          this.end.set(toLocalDateInput(sp.endDate));
          this.roadmapId.set(sp.roadmapId ?? '');
          return;
        }
        // New sprint: starts the day after the latest sprint ends (or today), lasts 2 weeks
        const latestEnd = this.store
          .sprints()
          .filter((x) => x.productId === productId && x.endDate)
          .map((x) => x.endDate!)
          .sort()
          .pop();
        const startDate = latestEnd && Date.parse(latestEnd) > Date.now() ? new Date(Date.parse(latestEnd) + 86400000) : new Date();
        this.name.set(this.store.nextSprintName(productId));
        this.goal.set('');
        // New sprints join the product's current roadmap by default
        this.roadmapId.set(this.store.roadmaps().find((r) => r.productId === productId && r.status === 'in_progress')?.id ?? '');
        this.start.set(toLocalDateInput(startDate.toISOString()));
        this.setWeeks(2);
      });
    });
  }

  protected onStart(v: string) {
    this.start.set(v);
  }

  protected setWeeks(weeks: number) {
    if (!this.start()) this.start.set(toLocalDateInput(new Date().toISOString()));
    const d = new Date(`${this.start()}T00:00`);
    d.setDate(d.getDate() + weeks * 7 - 1);
    this.end.set(toLocalDateInput(d.toISOString()));
  }

  protected save() {
    this.submitted.set(true);
    if (!this.name().trim() || (this.start() && this.end() && this.end() < this.start())) return;
    const input = { name: this.name(), goal: this.goal(), startDate: fromLocalInput(this.start()), endDate: fromLocalInput(this.end()), roadmapId: this.roadmapId() };
    const sp = this.sprint();
    if (sp) {
      this.store.updateSprint(sp.id, input);
      this.saved.emit(`${input.name.trim()} updated`);
    } else {
      this.store.createSprint(this.productId(), input);
      this.saved.emit(`${input.name.trim()} created`);
    }
    this.closed.emit();
  }
}
