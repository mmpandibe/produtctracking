import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DataStore } from '../../core/data-store';
import type { Roadmap, RoadmapStatus } from '../../core/models';
import { fromLocalInput, toLocalDateInput } from '../../core/utils';
import { Modal } from '../../shared/modal';
import { ROADMAP_STATUSES } from './roadmap-meta';

/** Create or edit a roadmap (a product goal delivered over several sprints). */
@Component({
  selector: 'app-roadmap-form',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="roadmap() ? 'Edit roadmap' : 'Create roadmap'" (closed)="closed.emit()">
      <form id="roadmap-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div>
          <label class="label" for="rf-name">Roadmap name *</label>
          <input id="rf-name" class="input" placeholder="e.g. Mobile v1 launch" [value]="name()" (input)="name.set($any($event.target).value)" autofocus />
          @if (submitted() && !name().trim()) {
            <p class="mt-1 text-[11px] text-red-700">Give the roadmap a name</p>
          }
        </div>
        <div>
          <label class="label" for="rf-desc">Description / goal</label>
          <textarea id="rf-desc" class="input min-h-14" placeholder="What will this roadmap deliver?" [value]="description()" (input)="description.set($any($event.target).value)"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="rf-start">Start date</label>
            <input id="rf-start" class="input" type="date" [value]="start()" (input)="start.set($any($event.target).value)" />
          </div>
          <div>
            <label class="label" for="rf-due">Due date</label>
            <input id="rf-due" class="input" type="date" [value]="due()" (input)="due.set($any($event.target).value)" />
          </div>
        </div>
        @if (submitted() && start() && due() && due() < start()) {
          <p class="-mt-1 text-[11px] text-red-700">The due date can't be before the start date.</p>
        }
        <div>
          <span class="label">Status</span>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Roadmap status">
            @for (s of statuses; track s.id) {
              <button type="button" role="radio" class="chip" [class]="status() === s.id ? 'chip-on' : 'chip-off'" [attr.aria-checked]="status() === s.id" (click)="setStatus(s.id)">
                <span class="h-1.5 w-1.5 rounded-full" [style.background]="status() === s.id ? 'white' : s.color"></span>{{ s.label }}
              </button>
            }
          </div>
        </div>
        @if (status() === 'completed') {
          <div class="w-1/2 pr-1.5">
            <label class="label" for="rf-completed">Completed date</label>
            <input id="rf-completed" class="input" type="date" [value]="completed()" (input)="completed.set($any($event.target).value)" />
          </div>
        }
        <div>
          <span class="label">Sprints in this roadmap</span>
          <div class="flex flex-wrap gap-1.5">
            @for (sp of productSprints(); track sp.id) {
              <button type="button" class="chip" [class]="sprintIds().includes(sp.id) ? 'chip-on' : 'chip-off'" [attr.aria-pressed]="sprintIds().includes(sp.id)" (click)="toggleSprint(sp.id)">
                {{ sp.name }}<span class="text-[10px]">{{ sp.state === 'active' ? 'active' : sp.state === 'closed' ? 'done' : '' }}</span>
              </button>
            } @empty {
              <span class="text-[12px] text-ink/70">This product has no sprints yet.</span>
            }
          </div>
          <p class="mt-1 text-[11px] text-ink/70">A sprint belongs to one roadmap; picking it here moves it from any other roadmap.</p>
        </div>
        <div>
          <label class="label" for="rf-benefits">Achieved benefits</label>
          <textarea id="rf-benefits" class="input min-h-14" placeholder="Outcomes delivered so far, e.g. +12% sign-ups, 30% fewer support calls" [value]="benefits()" (input)="benefits.set($any($event.target).value)"></textarea>
        </div>
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="roadmap-form" class="btn-primary">{{ roadmap() ? 'Save changes' : 'Create roadmap' }}</button>
      </div>
    </app-modal>
  `,
})
export class RoadmapForm {
  readonly open = input(false);
  readonly productId = input.required<string>();
  readonly roadmap = input<Roadmap | undefined>();
  readonly closed = output<void>();
  readonly saved = output<string>();

  private readonly store = inject(DataStore);
  protected readonly statuses = ROADMAP_STATUSES;
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly start = signal('');
  protected readonly due = signal('');
  protected readonly status = signal<RoadmapStatus>('planned');
  protected readonly completed = signal('');
  protected readonly benefits = signal('');
  protected readonly sprintIds = signal<string[]>([]);
  protected readonly submitted = signal(false);

  protected readonly productSprints = computed(() =>
    this.store
      .sprints()
      .filter((sp) => sp.productId === this.productId())
      .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')),
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const r = this.roadmap();
      untracked(() => {
        this.name.set(r?.name ?? '');
        this.description.set(r?.description ?? '');
        this.start.set(toLocalDateInput(r?.startDate));
        this.due.set(toLocalDateInput(r?.dueDate));
        this.status.set(r?.status ?? 'planned');
        this.completed.set(toLocalDateInput(r?.completedAt));
        this.benefits.set(r?.achievedBenefits ?? '');
        this.sprintIds.set(r ? this.store.sprints().filter((sp) => sp.roadmapId === r.id).map((sp) => sp.id) : []);
        this.submitted.set(false);
      });
    });
  }

  protected setStatus(s: RoadmapStatus) {
    this.status.set(s);
    if (s === 'completed' && !this.completed()) this.completed.set(toLocalDateInput(new Date().toISOString()));
  }

  protected toggleSprint(id: string) {
    this.sprintIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected save() {
    this.submitted.set(true);
    if (!this.name().trim() || (this.start() && this.due() && this.due() < this.start())) return;
    const input = {
      name: this.name(),
      description: this.description(),
      startDate: fromLocalInput(this.start()),
      dueDate: fromLocalInput(this.due()),
      status: this.status(),
      completedAt: this.status() === 'completed' ? fromLocalInput(this.completed()) : undefined,
      achievedBenefits: this.benefits(),
    };
    const r = this.roadmap();
    if (r) {
      this.store.updateRoadmap(r.id, input, this.sprintIds());
      this.saved.emit(`${input.name.trim()} updated`);
    } else {
      this.store.createRoadmap(this.productId(), input, this.sprintIds());
      this.saved.emit(`${input.name.trim()} created`);
    }
    this.closed.emit();
  }
}
