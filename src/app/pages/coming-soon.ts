import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { NavItem } from '../layout/nav';
import { Icon } from '../shared/icon';

/** Placeholder for screens not built yet. Receives `item` from route data. */
@Component({
  selector: 'app-coming-soon',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-[60vh] items-center justify-center p-6' },
  template: `
    <div class="glass max-w-md rounded-2xl px-8 py-8 text-center">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-brand/30">
        <app-icon [name]="item().icon" [size]="22" />
      </div>
      <h2 class="text-base font-semibold">{{ item().label }}</h2>
      <p class="mt-1.5 text-[13px] text-ink/70">{{ item().blurb }}</p>
      <p class="tag mt-3 px-2.5 py-1 font-medium">
        Planned for Step {{ item().step }}
      </p>
    </div>
  `,
})
export class ComingSoon {
  readonly item = input.required<NavItem>();
}
