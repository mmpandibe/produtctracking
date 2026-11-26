import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title row with optional actions on the right: <app-page-header heading="Tickets"><button>…</button></app-page-header> */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mb-2.5 flex flex-wrap items-center gap-2' },
  template: `
    <h1 class="text-[17px] font-semibold tracking-tight">{{ heading() }}</h1>
    @if (sub()) {
      <span class="text-[12px] text-ink/70">{{ sub() }}</span>
    }
    <div class="ml-auto flex items-center gap-2"><ng-content /></div>
  `,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly sub = input('');
}
