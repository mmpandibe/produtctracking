import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';

export interface LineSeries {
  name: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

const PAD = { l: 34, r: 72, t: 10, b: 24 };

/** Rounded gridline step (1, 2, 2.5, 5 × 10^n) for about 4 intervals */
function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * Multi-series line chart (SVG): recessive grid, 2px lines, legend for ≥2 series, end labels for ≤4,
 * crosshair + tooltip on hover. One y-axis only.
 */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block', '(document:keydown.escape)': 'hover.set(null)' },
  template: `
    @if (series().length > 1) {
      <ul class="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink/70" aria-hidden="true">
        @for (s of series(); track s.name) {
          <li class="flex items-center gap-1.5">
            <svg width="16" height="8"><line x1="1" y1="4" x2="15" y2="4" [attr.stroke]="s.color" stroke-width="2" stroke-linecap="round" [attr.stroke-dasharray]="s.dashed ? '3 3' : null" /></svg>
            {{ s.name }}
          </li>
        }
      </ul>
    }
    <svg
      class="block w-full overflow-visible"
      [attr.height]="height()"
      [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
      role="img"
      [attr.aria-label]="ariaLabel()"
      (mousemove)="onMove($event)"
      (mouseleave)="hover.set(null)"
    >
      <!-- grid + y labels -->
      @for (g of grid(); track g.v) {
        <line [attr.x1]="padL" [attr.x2]="width() - padR" [attr.y1]="g.y" [attr.y2]="g.y" stroke="currentColor" class="text-ink/10" stroke-width="1" />
        <text [attr.x]="padL - 6" [attr.y]="g.y + 3" text-anchor="end" class="fill-ink/45 text-[10px]">{{ g.v }}</text>
      }
      <!-- x labels -->
      @for (x of xLabels(); track x.i) {
        <text [attr.x]="x.x" [attr.y]="height() - 6" text-anchor="middle" class="fill-ink/50 text-[10px]">{{ x.label }}</text>
      }
      <!-- lines -->
      @for (s of paths(); track s.name) {
        <path [attr.d]="s.d" fill="none" [attr.stroke]="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" [attr.stroke-dasharray]="s.dashed ? '4 4' : null" />
        @if (series().length <= 4 && s.end) {
          <text [attr.x]="s.end.x + 6" [attr.y]="s.end.y + 3" class="fill-ink/70 text-[10px] font-medium">{{ s.name }}</text>
        }
      }
      <!-- hover -->
      @if (hover(); as h) {
        <line [attr.x1]="h.x" [attr.x2]="h.x" [attr.y1]="padT" [attr.y2]="height() - padB" stroke="currentColor" class="text-ink/70" stroke-width="1" />
        @for (p of h.points; track p.name) {
          <circle [attr.cx]="h.x" [attr.cy]="p.y" r="4" [attr.fill]="p.color" stroke="white" stroke-width="2" />
        }
      }
    </svg>
    @if (hover(); as h) {
      <div
        class="pointer-events-none absolute z-10 min-w-28 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg"
        [style.left.px]="h.x"
        [style.top.px]="0"
        [style.transform]="h.x > width() / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)'"
      >
        <div class="mb-0.5 font-semibold">{{ labels()[h.i] }}</div>
        @for (p of h.points; track p.name) {
          <div class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full" [style.background]="p.color"></span>{{ p.name }}</span>
            <span class="font-semibold tabular-nums">{{ p.value }}{{ suffix() }}</span>
          </div>
        }
      </div>
    }
  `,
})
export class LineChart {
  readonly labels = input.required<string[]>();
  readonly series = input.required<LineSeries[]>();
  readonly height = input(200);
  readonly suffix = input('');
  readonly ariaLabel = input('Line chart');

  protected readonly padL = PAD.l;
  protected readonly padR = PAD.r;
  protected readonly padT = PAD.t;
  protected readonly padB = PAD.b;
  protected readonly width = signal(600);
  protected readonly hover = signal<{ i: number; x: number; points: { name: string; color: string; y: number; value: number }[] } | null>(null);

  constructor() {
    const el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const ro = new ResizeObserver(([e]) => this.width.set(Math.max(240, Math.round(e!.contentRect.width))));
    ro.observe(el);
    inject(DestroyRef).onDestroy(() => ro.disconnect());
  }

  private readonly rawMax = computed(() => Math.max(0, ...this.series().flatMap((s) => s.values.filter((v): v is number => v != null))));
  private readonly step = computed(() => niceStep(this.rawMax() / 4));
  /** Axis top: the data maximum rounded up to a whole number of steps */
  private readonly max = computed(() => Math.max(this.step(), Math.ceil(this.rawMax() / this.step()) * this.step()));
  private x(i: number) {
    const n = Math.max(1, this.labels().length - 1);
    return PAD.l + ((this.width() - PAD.l - PAD.r) * i) / n;
  }
  private y(v: number) {
    return PAD.t + (this.height() - PAD.t - PAD.b) * (1 - v / this.max());
  }

  protected readonly grid = computed(() => {
    const step = this.step();
    const ticks: { v: number; y: number }[] = [];
    for (let v = 0; v <= this.max() + step / 1000; v += step) ticks.push({ v: +v.toFixed(step < 1 ? 2 : 1), y: this.y(v) });
    return ticks;
  });

  protected readonly xLabels = computed(() => {
    const labels = this.labels();
    const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor((this.width() - PAD.l - PAD.r) / 64))));
    return labels.map((label, i) => ({ i, label, x: this.x(i) })).filter((l) => l.i % every === 0 || l.i === labels.length - 1);
  });

  protected readonly paths = computed(() =>
    this.series().map((s) => {
      let d = '';
      let pen = false;
      let end: { x: number; y: number } | undefined;
      s.values.forEach((v, i) => {
        if (v == null) {
          pen = false;
          return;
        }
        const x = this.x(i);
        const y = this.y(v);
        d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
        pen = true;
        end = { x, y };
      });
      return { ...s, d, end };
    }),
  );

  protected onMove(e: MouseEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * this.width();
    const n = this.labels().length;
    if (!n) return;
    const step = (this.width() - PAD.l - PAD.r) / Math.max(1, n - 1);
    const i = Math.min(n - 1, Math.max(0, Math.round((px - PAD.l) / step)));
    const points = this.series()
      .map((s) => ({ name: s.name, color: s.color, value: s.values[i], y: 0 }))
      .filter((p): p is { name: string; color: string; value: number; y: number } => p.value != null)
      .map((p) => ({ ...p, y: this.y(p.value) }));
    this.hover.set({ i, x: this.x(i), points });
  }
}
