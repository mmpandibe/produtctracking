import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { DataStore } from '../../core/data-store';
import type { Priority, SupportLevel } from '../../core/models';
import { SUPPORT_LEVELS, formatDuration } from '../../core/sla';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { PRIORITIES } from '../tickets/ticket-meta';
import { ReadablePipe } from '../../shared/readable';

type Draft = Record<string, { response: string; resolution: string }>;
const cellKey = (level: SupportLevel, priority: Priority) => `${level}|${priority}`;

/** Admin settings for the support desk: who works each level, and response / resolution targets per level × priority. */
@Component({
  selector: 'app-sla-settings',
  imports: [ReadablePipe, Icon, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <!-- Levels -->
      <section class="glass rounded-xl p-3" aria-labelledby="lv-h">
        <h2 id="lv-h" class="text-[14px] font-semibold">Support levels</h2>
        <p class="mb-2.5 text-[12px] text-ink/70">Tickets start at L1 and are escalated up. Each level's queue is worked by one team.</p>
        <div class="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          @for (l of levels(); track l.level) {
            <div class="rounded-xl border border-ink/10 bg-white/55 p-2.5">
              <div class="mb-1.5 flex items-center gap-2">
                <span class="pill" [style.color]="(l.meta.color) | readable">{{ l.meta.label }}</span>
                <span class="ml-auto text-[11px] text-ink/70">{{ l.open }} open</span>
              </div>
              <label class="label" [for]="'lv-name-' + l.level">Name</label>
              <input class="input mb-2 py-1 text-[12px]" [id]="'lv-name-' + l.level" [value]="l.name" (change)="rename(l.level, $event)" />
              <label class="label" [for]="'lv-desc-' + l.level">Handles</label>
              <input class="input mb-2 py-1 text-[12px]" [id]="'lv-desc-' + l.level" [value]="l.description ?? ''" placeholder="What this level takes care of" (change)="describe(l.level, $event)" />
              <label class="label" [for]="'lv-team-' + l.level">Team</label>
              <select class="input py-1 text-[12px]" [id]="'lv-team-' + l.level" (change)="setTeam(l.level, $event)">
                <option value="" [selected]="!l.teamId">No team</option>
                @for (d of store.divisions(); track d.id) {
                  <optgroup [label]="d.name">
                    @for (t of store.teamsOf(d.id); track t.id) {
                      <option [value]="t.id" [selected]="t.id === l.teamId">{{ t.name }}</option>
                    }
                  </optgroup>
                }
              </select>
            </div>
          }
        </div>
      </section>

      <!-- Targets -->
      <section class="glass rounded-xl p-3" aria-labelledby="sla-h">
        <div class="mb-3 flex flex-wrap items-start gap-2">
          <div>
            <h2 id="sla-h" class="text-[14px] font-semibold">Response &amp; resolution targets</h2>
            <p class="text-[12px] text-ink/70">Counted in calendar hours from when the ticket was raised, using the ticket's current level. Hours: 0.25 = 15 minutes, 24 = 1 day.</p>
          </div>
          <div class="ml-auto flex items-center gap-1.5">
            @if (editing()) {
              <button type="button" class="btn-secondary" (click)="editing.set(false)">Cancel</button>
              <button type="button" class="btn-primary" (click)="save()">Save targets</button>
            } @else {
              <button type="button" class="btn-secondary" (click)="confirmReset.set(true)">Reset to defaults</button>
              <button type="button" class="btn-primary" (click)="startEdit()"><app-icon name="pencil" [size]="13" /> Edit targets</button>
            }
          </div>
        </div>
        <table class="w-full table-fixed text-[12px]">
          <thead class="text-left text-[11px] text-ink/70">
            <tr class="border-b border-ink/10">
              <th class="w-20 py-2 pr-2 font-medium sm:w-28">Priority</th>
              @for (l of levelMeta; track l.id) {
                <th class="py-2 pr-2 font-medium"><span class="pill" [style.color]="(l.color) | readable">{{ l.label }}</span></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (p of priorities; track p.id) {
              <tr class="border-b border-ink/[0.06] last:border-0">
                <td class="py-2 pr-2"><span class="pill" [style.color]="(p.color) | readable">{{ p.label }}</span></td>
                @for (l of levelMeta; track l.id) {
                  @let key = cellKey(l.id, p.id);
                  @let pol = store.slaFor(l.id, p.id);
                  <td class="py-2 pr-2 align-top">
                    @if (editing()) {
                      <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        <label class="block">
                          <span class="text-[10px] text-ink/70">Respond (h)</span>
                          <input class="input px-2 py-1 text-[12px]" type="number" min="0.25" step="0.25" [value]="draft()[key]?.response" (input)="setDraft(key, 'response', $event)" [attr.aria-label]="l.label + ' ' + p.label + ' response hours'" />
                        </label>
                        <label class="block">
                          <span class="text-[10px] text-ink/70">Resolve (h)</span>
                          <input class="input px-2 py-1 text-[12px]" type="number" min="0.25" step="0.25" [value]="draft()[key]?.resolution" (input)="setDraft(key, 'resolution', $event)" [attr.aria-label]="l.label + ' ' + p.label + ' resolution hours'" />
                        </label>
                      </div>
                      @if (errors()[key]) {
                        <p class="mt-1 text-[11px] text-red-700">{{ errors()[key] }}</p>
                      }
                    } @else if (pol) {
                      <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span><span class="text-ink/70">Respond</span><strong class="ml-1 tabular-nums">{{ dur(pol.responseMinutes) }}</strong></span>
                        <span><span class="text-ink/70">Resolve</span><strong class="ml-1 tabular-nums">{{ dur(pol.resolutionMinutes) }}</strong></span>
                      </div>
                    } @else {
                      <span class="text-ink/70">Not set</span>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
        <p class="mt-2 text-[11px] text-ink/70">The response clock stops at the first staff reply or when work starts; the resolution clock stops when the ticket reaches a "done" status. Clocks don't pause on hold yet.</p>
      </section>
    </div>

    <app-modal [open]="confirmReset()" heading="Reset SLA targets?" (closed)="confirmReset.set(false)">
      <p class="text-[13px] text-ink/70">All 15 response and resolution targets go back to the default values. Your changes to them will be lost.</p>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="confirmReset.set(false)">Cancel</button>
        <button type="button" class="btn-danger" (click)="reset()">Reset targets</button>
      </div>
    </app-modal>
  `,
})
export class SlaSettings {
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly levelMeta = SUPPORT_LEVELS;
  protected readonly priorities = PRIORITIES;
  protected readonly dur = formatDuration;
  protected readonly cellKey = cellKey;
  protected readonly editing = signal(false);
  protected readonly draft = signal<Draft>({});
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly confirmReset = signal(false);

  protected readonly levels = computed(() => {
    const open = this.store.issues().filter((i) => i.supportLevel && !this.store.isResolved(i));
    return this.store.supportLevels().map((l) => ({
      ...l,
      meta: SUPPORT_LEVELS.find((m) => m.id === l.level)!,
      open: open.filter((i) => i.supportLevel === l.level).length,
    }));
  });

  private val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected rename(level: SupportLevel, e: Event) {
    const v = this.val(e);
    if (!v.trim()) {
      (e.target as HTMLInputElement).value = this.store.supportLevel(level)?.name ?? '';
      return;
    }
    this.store.updateSupportLevel(level, { name: v });
    this.saved.emit('Level renamed');
  }

  protected describe(level: SupportLevel, e: Event) {
    this.store.updateSupportLevel(level, { description: this.val(e) });
  }

  protected setTeam(level: SupportLevel, e: Event) {
    this.store.updateSupportLevel(level, { teamId: this.val(e) });
    this.saved.emit(`${level.toUpperCase()} team updated`);
  }

  protected startEdit() {
    const d: Draft = {};
    for (const l of SUPPORT_LEVELS) {
      for (const p of PRIORITIES) {
        const pol = this.store.slaFor(l.id, p.id);
        d[cellKey(l.id, p.id)] = { response: pol ? String(+(pol.responseMinutes / 60).toFixed(2)) : '', resolution: pol ? String(+(pol.resolutionMinutes / 60).toFixed(2)) : '' };
      }
    }
    this.draft.set(d);
    this.errors.set({});
    this.editing.set(true);
  }

  protected setDraft(key: string, field: 'response' | 'resolution', e: Event) {
    const v = this.val(e);
    this.draft.update((d) => ({ ...d, [key]: { ...d[key]!, [field]: v } }));
  }

  protected save() {
    const errors: Record<string, string> = {};
    const updates: [SupportLevel, Priority, number, number][] = [];
    for (const l of SUPPORT_LEVELS) {
      for (const p of PRIORITIES) {
        const key = cellKey(l.id, p.id);
        const c = this.draft()[key]!;
        const r = Number(c.response) * 60;
        const f = Number(c.resolution) * 60;
        if (!(r > 0) || !(f > 0)) errors[key] = 'Both targets are required';
        else if (r > f) errors[key] = 'Response is longer than resolution';
        else updates.push([l.id, p.id, r, f]);
      }
    }
    this.errors.set(errors);
    if (Object.keys(errors).length) return;
    for (const u of updates) this.store.setSlaPolicy(...u);
    this.editing.set(false);
    this.saved.emit('SLA targets saved');
  }

  protected reset() {
    this.store.resetSlaPolicies();
    this.confirmReset.set(false);
    this.editing.set(false);
    this.saved.emit('SLA targets reset to defaults');
  }
}
