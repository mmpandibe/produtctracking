import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { Icon } from './icon';

export interface MoveTarget {
  id: string;
  label: string;
}

/**
 * WCAG 2.2 · 2.5.7 Dragging movements: a single-click (and keyboard) alternative to drag-and-drop.
 * An icon button opens a small menu: "Move up", "Move down" and "Move to …" one of the targets.
 */
@Component({
  selector: 'app-move-menu',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative inline-flex',
    '(click)': '$event.stopPropagation()',
    '(keydown.enter)': '$event.stopPropagation()',
    '(mousedown)': '$event.stopPropagation()',
    '(pointerdown)': '$event.stopPropagation()',
    '(touchstart)': '$event.stopPropagation()',
    '(document:click)': 'open.set(false)',
  },
  template: `
    <button
      #trigger
      type="button"
      class="rounded-md text-ink/70 hover:bg-white hover:text-ink"
      [attr.aria-label]="label()"
      [title]="label()"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
      (keydown.escape)="open.set(false)"
    >
      <app-icon name="arrow-up-down" [size]="13" />
    </button>
    @if (open()) {
      <div
        #menu
        class="glass-strong absolute right-0 top-full z-50 mt-1 w-52 rounded-lg p-1 text-[12px]"
        role="menu"
        [attr.aria-label]="label()"
        (keydown)="key($event)"
      >
        <button type="button" role="menuitem" class="block w-full rounded-md px-2 py-1.5 text-left hover:bg-ink/5 disabled:opacity-40" [disabled]="!canUp()" (click)="pick('up')">Move up</button>
        <button type="button" role="menuitem" class="block w-full rounded-md px-2 py-1.5 text-left hover:bg-ink/5 disabled:opacity-40" [disabled]="!canDown()" (click)="pick('down')">Move down</button>
        @if (targets().length) {
          <div class="my-1 border-t border-ink/10"></div>
          <div class="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/70">{{ targetsLabel() }}</div>
          @for (t of targets(); track t.id) {
            <button type="button" role="menuitem" class="block w-full truncate rounded-md px-2 py-1.5 text-left hover:bg-ink/5" [attr.aria-current]="t.id === current() || null" [class.font-semibold]="t.id === current()" (click)="pick(t.id)">
              {{ t.label }}{{ t.id === current() ? ' (here)' : '' }}
            </button>
          }
        }
      </div>
    }
  `,
})
export class MoveMenu {
  readonly label = input.required<string>();
  readonly targets = input<MoveTarget[]>([]);
  readonly targetsLabel = input('Move to');
  readonly current = input<string | undefined>(undefined);
  readonly canUp = input(true);
  readonly canDown = input(true);
  /** 'up' | 'down' | a target id */
  readonly moved = output<string>();

  protected readonly open = signal(false);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  protected toggle() {
    this.open.update((o) => !o);
    if (this.open()) setTimeout(() => this.items()[0]?.focus());
  }

  private items() {
    return [...(this.menu()?.nativeElement.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not([disabled])') ?? [])];
  }

  /** Arrow keys move between items, Escape closes and returns focus */
  protected key(e: KeyboardEvent) {
    const items = this.items();
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus();
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus();
    else if (e.key === 'Escape') {
      this.open.set(false);
      this.trigger()?.nativeElement.focus();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  }

  protected pick(v: string) {
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
    if (v !== this.current()) this.moved.emit(v);
  }
}
