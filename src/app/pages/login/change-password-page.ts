import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DataStore } from '../../core/data-store';
import { Session } from '../../core/session';
import { homeFor } from '../../layout/nav';
import { Icon } from '../../shared/icon';

/**
 * ISO 27001 A.5.17: change your own password. Also the only page available after an admin set your password
 * (`mustChangePassword`), until you choose your own.
 */
@Component({
  selector: 'app-change-password-page',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh items-center justify-center p-3 sm:p-6' },
  template: `
    <main class="glass-strong w-full max-w-[400px] rounded-3xl p-6 shadow-xl shadow-brand/10 sm:p-7" aria-labelledby="pw-heading">
      <div class="mb-5 flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-[12px] font-bold text-white">nP</div>
        <span class="text-[16px] font-semibold tracking-tight">nPro</span>
      </div>
      <h1 id="pw-heading" class="text-[19px] font-semibold tracking-tight">{{ forced() ? 'Choose a new password' : 'Change password' }}</h1>
      <p class="mb-5 text-[12px] text-ink/70">
        @if (forced()) {
          An admin set your current password. Choose your own before you continue.
        } @else {
          Signed in as {{ store.currentUser().name }}.
        }
      </p>

      <form class="space-y-3.5" (submit)="$event.preventDefault(); submit()" novalidate>
        <div>
          <label class="label" for="pw-current">Current password</label>
          <input id="pw-current" class="input" [type]="show() ? 'text' : 'password'" autocomplete="current-password" [value]="current()" (input)="current.set(val($event))" />
        </div>
        <div>
          <label class="label" for="pw-new">New password</label>
          <input id="pw-new" class="input" [type]="show() ? 'text' : 'password'" autocomplete="new-password" aria-describedby="pw-rules" [value]="next()" (input)="next.set(val($event))" />
          <ul id="pw-rules" class="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            @for (r of rules(); track r.label) {
              <li class="flex items-center gap-1" [class.text-emerald-700]="r.ok" [class.text-ink/70]="!r.ok">
                <app-icon [name]="r.ok ? 'check' : 'x'" [size]="12" /><span>{{ r.label }}<span class="sr-only">{{ r.ok ? ' (met)' : ' (not met)' }}</span></span>
              </li>
            }
          </ul>
        </div>
        <div>
          <label class="label" for="pw-confirm">Repeat new password</label>
          <input id="pw-confirm" class="input" [type]="show() ? 'text' : 'password'" autocomplete="new-password" [value]="confirm()" (input)="confirm.set(val($event))" />
        </div>
        <label class="flex items-center gap-2 text-[12px]">
          <input type="checkbox" [checked]="show()" (change)="show.set(!show())" /> Show passwords
        </label>

        @if (error()) {
          <p class="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] text-red-800" role="alert"><app-icon name="x" [size]="14" class="mt-0.5 shrink-0" />{{ error() }}</p>
        }
        @if (done()) {
          <p class="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-800" role="status">Password changed.</p>
        }

        <button type="submit" class="btn-primary w-full justify-center py-2 text-[13px]" [disabled]="busy()">
          {{ busy() ? 'Saving…' : forced() ? 'Save and continue' : 'Change password' }}
        </button>
      </form>

      <div class="mt-4 flex items-center justify-between text-[12px]">
        @if (forced()) {
          <button type="button" class="text-brand hover:underline" (click)="signOut()">Sign out</button>
        } @else {
          <a [routerLink]="home()" class="text-brand hover:underline">Back to nPro</a>
        }
      </div>
    </main>
  `,
})
export class ChangePasswordPage {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  protected readonly store = inject(DataStore);

  protected readonly forced = computed(() => this.session.mode() === 'change_password');
  protected readonly home = computed(() => homeFor(this.store.currentUser().role));
  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirm = signal('');
  protected readonly show = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal(false);

  /** Same rules as the server (ASP.NET Core Identity options in Program.cs) */
  protected readonly rules = computed(() => {
    const p = this.next();
    return [
      { label: '10+ characters', ok: p.length >= 10 },
      { label: 'Upper-case letter', ok: /[A-Z]/.test(p) },
      { label: 'Lower-case letter', ok: /[a-z]/.test(p) },
      { label: 'Digit', ok: /\d/.test(p) },
    ];
  });

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected async submit() {
    this.error.set('');
    this.done.set(false);
    if (!this.current() || !this.next()) return this.error.set('Enter your current and your new password');
    if (this.rules().some((r) => !r.ok)) return this.error.set('The new password doesn’t meet every rule');
    if (this.next() !== this.confirm()) return this.error.set('The new passwords don’t match');
    this.busy.set(true);
    try {
      const wasForced = this.forced();
      await this.session.changePassword(this.current(), this.next());
      this.current.set('');
      this.next.set('');
      this.confirm.set('');
      if (wasForced) void this.router.navigateByUrl(homeFor(this.store.currentUser().role));
      else this.done.set(true);
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected signOut() {
    void this.session.logout();
  }
}
