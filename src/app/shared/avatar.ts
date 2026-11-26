import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { User } from '../core/models';
import { initials } from '../core/utils';

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (user(); as u) {
      <div
        class="flex shrink-0 items-center justify-center rounded-full font-semibold text-neutral-900 ring-2 ring-white"
        [class]="dim()"
        [style.background]="u.color"
        [title]="u.name"
      >
        {{ letters() }}
      </div>
    } @else {
      <div class="rounded-full border border-dashed border-ink/25" [class]="dim()" title="Unassigned"></div>
    }
  `,
})
export class Avatar {
  readonly user = input<User | undefined>();
  readonly size = input<'sm' | 'md'>('md');

  protected readonly dim = computed(() => (this.size() === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-8 w-8 text-[11px]'));
  protected readonly letters = computed(() => initials(this.user()?.name ?? ''));
}
