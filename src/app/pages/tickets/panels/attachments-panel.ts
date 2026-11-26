import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { DataStore, MAX_ATTACHMENT_BYTES } from '../../../core/data-store';
import { formatBytes } from '../../../core/file-store';
import type { Attachment } from '../../../core/models';
import { Icon } from '../../../shared/icon';

/**
 * Attachments for a ticket.
 * - With `issueId`: files are saved immediately and can be downloaded/removed.
 * - Without it (new ticket): files queue in `pending` and are saved by the caller after creation.
 */
@Component({
  selector: 'app-attachments-panel',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed px-3 py-3 text-center text-[12px] transition"
      [class]="dragOver() ? 'border-brand bg-brand/5 text-brand' : 'border-ink/20 bg-white/40 text-ink/70 hover:border-brand/60 hover:bg-white/70'"
      (dragover)="$event.preventDefault(); dragOver.set(true)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
    >
      <app-icon name="upload" [size]="16" />
      <span><span class="font-medium text-brand">Browse files</span> or drop them here</span>
      <span class="text-[11px] text-ink/70">Up to 10 MB each{{ issueId() ? '' : ' · saved when you create the ticket' }}</span>
      <input type="file" multiple class="sr-only" (change)="onPicked($event)" />
    </label>
    @if (busy()) {
      <p class="mt-1.5 text-[12px] text-ink/70">Saving…</p>
    }
    @if (error()) {
      <p class="mt-1.5 text-[12px] text-red-700" role="alert">{{ error() }}</p>
    }

    <ul class="mt-2 space-y-1.5">
      @if (issueId()) {
        @for (a of saved(); track a.id) {
          <li class="flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-1.5 text-[12px]">
            <app-icon name="file" [size]="14" class="shrink-0 text-ink/70" />
            <button type="button" class="min-w-0 flex-1 truncate text-left hover:text-brand" [title]="'Download ' + a.name" (click)="download(a)">{{ a.name }}</button>
            <span class="shrink-0 text-[11px] text-ink/70">{{ fmt(a.size) }}</span>
            @if (confirmRemove() === a.id) {
              <button type="button" class="shrink-0 text-[11px] font-medium text-red-700 hover:underline" (click)="remove(a)">Remove</button>
              <button type="button" class="shrink-0 text-[11px] text-ink/70 hover:underline" (click)="confirmRemove.set(null)">Keep</button>
            } @else {
              <button type="button" class="shrink-0 rounded p-0.5 text-ink/70 hover:text-brand" [attr.aria-label]="'Download ' + a.name" (click)="download(a)">
                <app-icon name="download" [size]="13" />
              </button>
              <button type="button" class="shrink-0 rounded p-0.5 text-ink/70 hover:text-red-700" [attr.aria-label]="'Remove ' + a.name" (click)="confirmRemove.set(a.id)">
                <app-icon name="trash" [size]="13" />
              </button>
            }
          </li>
        } @empty {
          <li class="text-[12px] text-ink/70">No files attached yet.</li>
        }
      } @else {
        @for (f of pending(); track $index) {
          <li class="flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-1.5 text-[12px]">
            <app-icon name="file" [size]="14" class="shrink-0 text-ink/70" />
            <span class="min-w-0 flex-1 truncate">{{ f.name }}</span>
            <span class="shrink-0 text-[11px] text-ink/70">{{ fmt(f.size) }}</span>
            <button type="button" class="shrink-0 rounded p-0.5 text-ink/70 hover:text-red-700" [attr.aria-label]="'Remove ' + f.name" (click)="removePending($index)">
              <app-icon name="x" [size]="13" />
            </button>
          </li>
        }
      }
    </ul>
  `,
})
export class AttachmentsPanel {
  readonly issueId = input<string | undefined>();
  /** Queued files for a ticket that doesn't exist yet */
  readonly pending = model<File[]>([]);

  private readonly store = inject(DataStore);
  protected readonly fmt = formatBytes;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly dragOver = signal(false);
  protected readonly confirmRemove = signal<string | null>(null);

  protected readonly saved = computed(() => {
    const id = this.issueId();
    return id ? this.store.attachments().filter((a) => a.issueId === id) : [];
  });

  protected onPicked(e: Event) {
    const input = e.target as HTMLInputElement;
    void this.add([...(input.files ?? [])]);
    input.value = ''; // allow picking the same file again
  }

  protected onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(false);
    void this.add([...(e.dataTransfer?.files ?? [])]);
  }

  private async add(files: File[]) {
    if (!files.length) return;
    const tooBig = files.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    const ok = files.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    this.error.set(tooBig.length ? `${tooBig.map((f) => f.name).join(', ')} ${tooBig.length === 1 ? 'is' : 'are'} over the 10 MB limit.` : '');
    const id = this.issueId();
    if (!id) {
      this.pending.update((list) => [...list, ...ok]);
      return;
    }
    this.busy.set(true);
    try {
      for (const f of ok) await this.store.addAttachment(id, f);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not save the file.');
    } finally {
      this.busy.set(false);
    }
  }

  protected removePending(index: number) {
    this.pending.update((list) => list.filter((_, i) => i !== index));
  }

  protected remove(a: Attachment) {
    this.store.removeAttachment(a.id);
    this.confirmRemove.set(null);
  }

  protected async download(a: Attachment) {
    try {
      await this.store.downloadAttachment(a);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not open the file.');
    }
  }
}
