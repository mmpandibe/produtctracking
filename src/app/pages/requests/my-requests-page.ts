import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/data-store';
import type { Issue, StatusCategory } from '../../core/models';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { priorityOf, typeOf } from '../tickets/ticket-meta';
import { RequestForm } from './request-form';
import { ReadablePipe } from '../../shared/readable';

type Filter = 'open' | 'done' | 'all';

/** Plain-language stage names for people outside the delivery team */
const STAGES: Record<StatusCategory, { label: string; color: string }> = {
  todo: { label: 'Received', color: '#64748b' },
  in_progress: { label: 'In progress', color: '#2563eb' },
  hold: { label: 'On hold', color: '#dc2626' },
  done: { label: 'Done', color: '#16a34a' },
};

/** Step 12: tickets the signed-in person raised (client users also see their company's), plus a short "raise a ticket" form. */
@Component({
  selector: 'app-my-requests-page',
  imports: [ReadablePipe, Avatar, DatePipe, Icon, PageHeader, RequestForm, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-[1000px]">
      <app-page-header heading="My Requests">
        <button type="button" class="btn-primary" (click)="formOpen.set(true)"><app-icon name="plus" [size]="15" /> Raise a ticket</button>
      </app-page-header>

      <!-- Stage counts -->
      <div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        @for (s of stageCounts(); track s.id) {
          <div class="glass rounded-xl px-3 py-2">
            <div class="text-[11px] text-ink/70">{{ s.label }}</div>
            <div class="text-[20px] font-semibold tabular-nums" [style.color]="(s.color) | readable">{{ s.count }}</div>
          </div>
        }
      </div>

      <div class="glass mb-2.5 flex flex-wrap items-center gap-1.5 rounded-xl p-2">
        <div class="flex rounded-lg border border-ink/10 bg-white/60 p-0.5 text-[12px]" role="tablist" aria-label="Show">
          @for (f of filters; track f.id) {
            <button type="button" role="tab" class="rounded-md px-3 py-1" [class]="filter() === f.id ? 'bg-white font-medium text-brand shadow-sm' : 'text-ink/70'" [attr.aria-selected]="filter() === f.id" (click)="filter.set(f.id)">
              {{ f.label }}
            </button>
          }
        </div>
        @if (clientName()) {
          <label class="flex cursor-pointer items-center gap-1.5 px-1 text-[12px] text-ink/70">
            <input type="checkbox" class="accent-brand" [checked]="wholeClient()" (change)="wholeClient.set($any($event.target).checked)" />
            Everything raised for {{ clientName() }}
          </label>
        }
        <div class="relative ml-auto min-w-[150px] flex-1 sm:max-w-64">
          <app-icon name="search" [size]="14" class="absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-ink/70" />
          <input class="input py-1 pl-8 text-[12px]" placeholder="Search requests" aria-label="Search requests" [value]="query()" (input)="query.set($any($event.target).value)" />
        </div>
      </div>

      @if (!visible().length) {
        <div class="glass rounded-xl p-8 text-center">
          <div class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-ink/70"><app-icon name="inbox" [size]="18" /></div>
          <p class="text-[13px] font-medium">{{ mine().length ? 'Nothing matches' : 'You haven\\'t raised any tickets yet' }}</p>
          <p class="mb-3 text-[12px] text-ink/70">Raise a ticket and follow its progress here.</p>
          <button type="button" class="btn-primary" (click)="formOpen.set(true)"><app-icon name="plus" [size]="15" /> Raise a ticket</button>
        </div>
      } @else {
        <ul class="glass divide-y divide-ink/[0.06] overflow-hidden rounded-xl">
          @for (i of visible(); track i.id) {
            @let st = stageOf(i);
            @let t = typeOf(i.type);
            @let assignee = store.userById(i.assigneeId);
            <li>
              <a [routerLink]="['/tickets', i.key]" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-white/50">
                <app-icon [name]="t.icon" [size]="15" [style.color]="(t.color) | readable" class="shrink-0" />
                <div class="min-w-0 flex-1 basis-56">
                  <div class="flex items-center gap-1.5">
                    <span class="shrink-0 font-mono text-[11px] text-ink/70">{{ i.key }}</span>
                    <span class="truncate text-[13px] font-medium">{{ i.summary }}</span>
                  </div>
                  <div class="truncate text-[11px] text-ink/70">
                    {{ productName(i.productId) }} · raised {{ i.createdAt | date: 'MMM d' }}{{ i.reporterId !== store.currentUser().id ? ' by ' + (store.userById(i.reporterId)?.name ?? 'someone') : '' }} · updated {{ i.updatedAt | date: 'MMM d, HH:mm' }}
                  </div>
                </div>
                <div class="flex items-center gap-1.5 text-[11px] text-ink/70">
                  <app-avatar [user]="assignee" size="sm" />
                  <span class="hidden w-28 truncate sm:inline">{{ assignee ? assignee.name : 'Not assigned yet' }}</span>
                </div>
                <span class="w-16 text-[11px]" [style.color]="(priorityOf(i.priority).color) | readable">{{ priorityOf(i.priority).label }}</span>
                <div class="flex w-28 flex-col items-end gap-1">
                  <span class="pill" [style.color]="(st.color) | readable" [title]="'Status: ' + statusName(i)">{{ st.label }}</span>
                  @if (i.progress != null && st.label !== 'Done') {
                    <div class="h-1 w-20 overflow-hidden rounded-full bg-ink/10" [attr.aria-label]="i.progress + '% complete'">
                      <div class="h-full rounded-full bg-brand" [style.width.%]="i.progress"></div>
                    </div>
                  }
                </div>
              </a>
            </li>
          }
        </ul>
        <p class="mt-2 text-[11px] text-ink/70">Open a ticket to see its full history, add comments or attach files.</p>
      }

      <app-request-form [open]="formOpen()" (closed)="formOpen.set(false)" (saved)="raised($event)" />
      @if (toast()) {
        <div class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-3.5 py-1.5 text-[12px] text-white shadow-lg" role="status">{{ toast() }}</div>
      }
    </div>
  `,
})
export class MyRequestsPage {
  protected readonly store = inject(DataStore);
  protected readonly typeOf = typeOf;
  protected readonly priorityOf = priorityOf;
  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'open', label: 'Open' },
    { id: 'done', label: 'Done' },
    { id: 'all', label: 'All' },
  ];
  protected readonly filter = signal<Filter>('open');
  protected readonly query = signal('');
  /** Client users start with everything raised for their company */
  protected readonly wholeClient = signal(!!this.store.currentUser().clientId);
  protected readonly formOpen = signal(false);
  protected readonly toast = signal('');

  protected readonly clientName = computed(() => {
    const id = this.store.currentUser().clientId;
    return id ? this.store.allClients().find((c) => c.id === id)?.name : undefined;
  });

  /** Raised by me, or (client users, when ticked) for my company */
  protected readonly mine = computed(() => {
    const me = this.store.currentUser();
    return this.store
      .issues()
      .filter((i) => i.reporterId === me.id || (this.wholeClient() && !!me.clientId && i.clientId === me.clientId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  protected readonly stageCounts = computed(() =>
    (Object.keys(STAGES) as StatusCategory[]).map((id) => ({ id, ...STAGES[id], count: this.mine().filter((i) => this.categoryOf(i) === id).length })),
  );

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.mine().filter((i) => {
      const done = this.categoryOf(i) === 'done';
      if (this.filter() === 'open' && done) return false;
      if (this.filter() === 'done' && !done) return false;
      return !q || `${i.key} ${i.summary}`.toLowerCase().includes(q);
    });
  });

  private categoryOf(i: Issue): StatusCategory {
    return this.store.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId)?.category ?? 'todo';
  }

  protected stageOf(i: Issue) {
    return STAGES[this.categoryOf(i)];
  }

  protected statusName(i: Issue) {
    return this.store.workflowFor(i.productId).statuses.find((s) => s.id === i.statusId)?.name ?? '';
  }

  protected productName(id: string) {
    return this.store.products().find((p) => p.id === id)?.name ?? '';
  }

  protected raised(key: string) {
    this.filter.set('open');
    this.toast.set(`${key} raised — we'll keep you posted here`);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
