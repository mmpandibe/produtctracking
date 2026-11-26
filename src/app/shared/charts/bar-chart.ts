import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface BarSeries {
  name: string;
  color: string;
  values: number[];
}

/**
 * Bar chart in plain HTML (responsive, accessible):
 * - horizontal: one row per category, stacked or single series, total at the bar end
 * - vertical: grouped columns per category
 * Rounded data ends (square at the baseline), 2px gaps between segments, legend for ≥2 series,
 * hover tooltip per mark.
 */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block', '(document:keydown.escape)': 'tip.set(null)' },
  template: `
    @if (series().length > 1) {
      <ul class="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink/70" aria-hidden="true">
        @for (s of series(); track s.name) {
          <li class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm" [style.background]="s.color"></span>{{ s.name }}</li>
        }
      </ul>
    }

    @if (horizontal()) {
      <ul class="space-y-1.5" role="list" [attr.aria-label]="ariaLabel()">
        @for (c of categories(); track $index; let ci = $index) {
          <li class="grid items-center gap-2 text-[11px]" [style.grid-template-columns]="labelWidth() + 'px minmax(0,1fr) 44px'">
            <span class="truncate text-ink/75" [title]="c">{{ c }}</span>
            <div class="flex h-3.5 gap-[2px]" [style.width.%]="(totals()[ci]! / max()) * 100">
              @for (s of series(); track s.name; let si = $index; let last = $last) {
                @if (s.values[ci]) {
                  <div
                    class="h-full"
                    [class.rounded-r]="isLastSegment(ci, si)"
                    [style.background]="s.color"
                    [style.flex-grow]="s.values[ci]"
                    (mouseenter)="show($event, c, s, ci)"
                    (mouseleave)="tip.set(null)"
                  ></div>
                }
              }
            </div>
            <span class="text-right font-semibold tabular-nums text-ink/75">{{ fmt(totals()[ci]!) }}</span>
          </li>
        }
      </ul>
    } @else {
      <div class="relative" [style.height.px]="height()" role="list" [attr.aria-label]="ariaLabel()">
        <!-- recessive grid -->
        @for (g of [0.25, 0.5, 0.75, 1]; track g) {
          <div class="absolute inset-x-0 border-t border-ink/10" [style.bottom.%]="g * 100">
            <span class="absolute -top-2 left-0 text-[10px] text-ink/70">{{ gridLabel(g) }}</span>
          </div>
        }
        <div class="absolute inset-0 flex items-end gap-3 border-b border-ink/20 pl-7">
          @for (c of categories(); track $index; let ci = $index) {
            <div class="flex h-full min-w-0 flex-1 items-end justify-center gap-[2px]" role="listitem" [attr.aria-label]="c">
              @for (s of series(); track s.name) {
                <div class="flex h-full w-full max-w-7 flex-col items-center justify-end">
                  @if (s.values[ci]) {
                    <span class="mb-0.5 text-[10px] font-semibold tabular-nums text-ink/70">{{ fmt(s.values[ci]!) }}</span>
                  }
                  <div
                    class="w-full rounded-t"
                    [style.background]="s.color"
                    [style.height.%]="(s.values[ci]! / max()) * 100"
                    [style.min-height.px]="s.values[ci] ? 2 : 0"
                    (mouseenter)="show($event, c, s, ci)"
                    (mouseleave)="tip.set(null)"
                  ></div>
                </div>
              }
            </div>
          }
        </div>
      </div>
      <div class="mt-1 flex gap-3 pl-7">
        @for (c of categories(); track $index) {
          <span class="min-w-0 flex-1 truncate text-center text-[10px] text-ink/70" [title]="c">{{ c }}</span>
        }
      </div>
    }

    @if (tip(); as t) {
      <div class="pointer-events-none fixed z-50 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg" [style.left.px]="t.x" [style.top.px]="t.y" style="transform: translate(-50%, calc(-100% - 8px))">
        <div class="font-semibold">{{ t.category }}</div>
        <div class="flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full" [style.background]="t.color"></span>{{ t.series }}: <strong class="tabular-nums">{{ t.value }}</strong></div>
      </div>
    }
  `,
})
export class BarChart {
  readonly categories = input.required<string[]>();
  readonly series = input.required<BarSeries[]>();
  readonly horizontal = input(false);
  readonly height = input(180);
  readonly labelWidth = input(110);
  readonly suffix = input('');
  readonly decimals = input(0);
  readonly ariaLabel = input('Bar chart');

  protected readonly tip = signal<{ x: number; y: number; category: string; series: string; color: string; value: string } | null>(null);

  /** Per category: stacked total (horizontal) */
  protected readonly totals = computed(() => this.categories().map((_, ci) => this.series().reduce((s, x) => s + (x.values[ci] ?? 0), 0)));
  protected readonly max = computed(() => {
    const m = this.horizontal() ? Math.max(0, ...this.totals()) : Math.max(0, ...this.series().flatMap((s) => s.values));
    if (this.horizontal()) return m > 0 ? m : 1;
    // Vertical: round the axis up to 1 / 2 / 5 × 10^n so gridline labels are clean
    // Whole-number data (counts) with a tiny maximum: use 4 so gridlines fall on 1, 2, 3, 4
    if (this.decimals() === 0 && m < 4) return 4;
    if (m <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(m)));
    const n = m / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  });

  /** Gridline label: whole numbers when the axis is big enough, else one decimal */
  protected gridLabel(g: number) {
    const v = this.max() * g;
    return `${+v.toFixed(this.max() < 4 ? 1 : 0)}${this.suffix()}`;
  }

  protected fmt(v: number) {
    return `${+v.toFixed(this.decimals())}${this.suffix()}`;
  }

  protected isLastSegment(ci: number, si: number) {
    const s = this.series();
    for (let k = s.length - 1; k >= 0; k--) if (s[k]!.values[ci]) return k === si;
    return false;
  }

  protected show(e: MouseEvent, category: string, s: BarSeries, ci: number) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.tip.set({ x: r.left + r.width / 2, y: r.top, category, series: s.name, color: s.color, value: this.fmt(s.values[ci] ?? 0) });
  }
}
