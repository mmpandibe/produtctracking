import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { Icon } from './icon';

/**
 * Generic dialog. Usage:
 * <app-modal [open]="x()" heading="…" size="lg" (closed)="…"> body <div footer>buttons</div> </app-modal>
 * (Named `heading`, not `title`, so the host element doesn't get a native tooltip.)
 */
@Component({
  selector: 'app-modal',
  imports: [Icon, A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/25 p-3 backdrop-blur-sm sm:p-6 sm:pt-12"
        (mousedown)="closed.emit()"
      >
        <div
          class="glass-strong w-full rounded-2xl"
          [class.max-w-lg]="size() === 'md'"
          [class.max-w-5xl]="size() === 'lg'"
          #dialog
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="headingId"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (mousedown)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between border-b border-ink/10 px-5 py-3">
            <h2 [id]="headingId" class="text-[15px] font-semibold">{{ heading() }}</h2>
            <button type="button" class="rounded-md p-1 text-ink/70 hover:bg-ink/5 hover:text-ink" aria-label="Close" (click)="closed.emit()">
              <app-icon name="x" [size]="17" />
            </button>
          </div>
          <div class="px-5 py-4"><ng-content /></div>
          <div class="flex justify-end gap-2 border-t border-ink/10 px-5 py-3 empty:hidden"><ng-content select="[footer]" /></div>
        </div>
      </div>
    }
  `,
})
export class Modal {
  readonly open = input(false);
  readonly heading = input('');
  readonly size = input<'md' | 'lg'>('md');
  readonly closed = output<void>();
  protected readonly headingId = 'dlg-' + Math.random().toString(36).slice(2, 9);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog()?.nativeElement;
      if (!el) return;
      // After the focus trap has captured focus, prefer the form's first field when it asks for it
      setTimeout(() => (el.querySelector<HTMLElement>('[autofocus]:not([disabled])') ?? null)?.focus(), 0);
    });
  }
}
