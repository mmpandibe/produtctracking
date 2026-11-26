import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DataStore } from '../../../core/data-store';
import { Avatar } from '../../../shared/avatar';
import { Icon } from '../../../shared/icon';

/** Comments / remarks on a ticket (saved immediately). */
@Component({
  selector: 'app-comments-panel',
  imports: [DatePipe, Avatar, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="space-y-2">
      @for (c of comments(); track c.id) {
        <li class="flex gap-2">
          <app-avatar [user]="store.userById(c.authorId)" size="sm" />
          <div class="min-w-0 flex-1 rounded-lg bg-white/60 px-2.5 py-1.5">
            <div class="flex items-center gap-2 text-[11px]">
              <span class="font-semibold text-ink">{{ store.userById(c.authorId)?.name ?? 'Unknown' }}</span>
              <span class="text-ink/70">{{ c.createdAt | date: 'MMM d, HH:mm' }}</span>
              @if (c.authorId === store.currentUser().id) {
                @if (confirmDelete() === c.id) {
                  <button type="button" class="ml-auto font-medium text-red-700 hover:underline" (click)="remove(c.id)">Delete</button>
                  <button type="button" class="text-ink/70 hover:underline" (click)="confirmDelete.set(null)">Keep</button>
                } @else {
                  <button type="button" class="ml-auto text-ink/70 hover:text-red-700" aria-label="Delete comment" (click)="confirmDelete.set(c.id)">
                    <app-icon name="trash" [size]="12" />
                  </button>
                }
              }
            </div>
            <p class="mt-0.5 whitespace-pre-wrap break-words text-[12px] text-ink/80">{{ c.body }}</p>
          </div>
        </li>
      } @empty {
        <li class="text-[12px] text-ink/70">No remarks yet.</li>
      }
    </ul>

    <div class="mt-2.5">
      <label class="sr-only" [for]="boxId">Add a comment or remark</label>
      <textarea
        #box
        class="input min-h-14 text-[12px]"
        [id]="boxId"
        placeholder="Add a comment or remark…"
        (input)="text.set(box.value)"
        (keydown)="onKey($event, box)"
      ></textarea>
      <div class="mt-1.5 flex items-center justify-between">
        <span class="text-[11px] text-ink/70">Ctrl+Enter to post</span>
        <button type="button" class="btn-secondary whitespace-nowrap px-2.5 py-1 text-[12px]" [disabled]="!text().trim()" (click)="post(box)">
          <app-icon name="send" [size]="12" /> Add comment
        </button>
      </div>
    </div>
  `,
})
export class CommentsPanel {
  readonly issueId = input.required<string>();

  protected readonly store = inject(DataStore);
  protected readonly text = signal('');
  protected readonly confirmDelete = signal<string | null>(null);
  protected readonly boxId = 'cm-' + Math.random().toString(36).slice(2, 8);

  protected readonly comments = computed(() => {
    const id = this.issueId();
    return this.store.comments().filter((c) => c.issueId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

  protected post(box: HTMLTextAreaElement) {
    if (!box.value.trim()) return;
    this.store.addComment(this.issueId(), box.value);
    box.value = ''; // cleared directly: fast typing + Ctrl+Enter can outrun change detection
    this.text.set('');
  }

  protected onKey(e: KeyboardEvent, box: HTMLTextAreaElement) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.post(box);
    }
  }

  protected remove(id: string) {
    this.store.deleteComment(id);
    this.confirmDelete.set(null);
  }
}
