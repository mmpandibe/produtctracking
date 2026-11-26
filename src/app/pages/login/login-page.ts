import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DataStore } from '../../core/data-store';
import { Session } from '../../core/session';
import { homeFor } from '../../layout/nav';
import { Icon, type IconName } from '../../shared/icon';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'kanban', title: 'Tickets, boards & sprints', text: 'Plan and deliver every product in one place' },
  { icon: 'headset', title: 'L1 – L3 support with SLAs', text: 'Clocks, escalation and queues per level' },
  { icon: 'calendar-clock', title: 'Gantt & roadmaps', text: 'Dates you can drag, progress you can trust' },
  { icon: 'user-check', title: 'Attendance & hours', text: 'Logged, productive and attended time side by side' },
];

/** Sign-in page (server mode): work email or, for in-house employees, employee ID + password. */
@Component({
  selector: 'app-login-page',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh items-center justify-center p-3 sm:p-6', '(document:keydown)': 'caps($event)', '(document:keyup)': 'caps($event)' },
  template: `
    <main class="glass-strong grid w-full max-w-[880px] overflow-hidden rounded-3xl shadow-xl shadow-brand/10 md:grid-cols-[1.05fr_1fr]">
      <!-- Brand panel (tablet and up) -->
      <section class="relative hidden overflow-hidden bg-gradient-to-br from-[#0b5fd9] via-[#1d4ed8] to-[#4338ca] p-7 text-white md:flex md:flex-col" aria-label="About nPro">
        <div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl"></div>
        <div class="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-indigo-300/30 blur-2xl"></div>
        <div class="relative mb-8 flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-[13px] font-bold text-brand shadow-sm">nP</div>
          <span class="text-[17px] font-semibold tracking-tight">nPro</span>
        </div>
        <h2 class="relative mb-1.5 text-[20px] font-semibold leading-snug">Products, support and people — in one workspace.</h2>
        <p class="relative mb-6 text-[12px] text-white/90">For our in-house teams, vendor partners and clients.</p>
        <ul class="relative space-y-3">
          @for (f of features; track f.title) {
            <li class="flex items-start gap-2.5">
              <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25"><app-icon [name]="f.icon" [size]="14" /></span>
              <span>
                <span class="block text-[12px] font-semibold">{{ f.title }}</span>
                <span class="block text-[11px] text-white/90">{{ f.text }}</span>
              </span>
            </li>
          }
        </ul>
        <p class="relative mt-auto flex items-center gap-1.5 pt-8 text-[10px] text-white/90"><app-icon name="shield-check" [size]="12" />Signed-in sessions are protected and expire after 8 hours of inactivity.</p>
      </section>

      <!-- Sign-in form -->
      <section class="flex flex-col justify-center p-6 sm:p-8" aria-labelledby="login-heading">
        <div class="mb-6 flex items-center gap-2 md:hidden">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-[12px] font-bold text-white">nP</div>
          <span class="text-[16px] font-semibold tracking-tight">nPro</span>
        </div>
        <h1 id="login-heading" class="text-[19px] font-semibold tracking-tight">Welcome back</h1>
        <p class="mb-5 text-[12px] text-ink/70">Sign in with your work email or employee ID.</p>

        <form class="space-y-3.5" (submit)="$event.preventDefault(); submit()" novalidate>
          <div>
            <label class="label" for="login-id">Email or employee ID</label>
            <div class="relative">
              <app-icon [name]="looksLikeEmail() ? 'mail' : 'id-card'" [size]="15" class="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ink/70" />
              <input
                id="login-id"
                class="input pl-9"
                autocomplete="username"
                autocapitalize="off"
                spellcheck="false"
                placeholder="name@company.com or EMP-014"
                [value]="login()"
                (input)="login.set(val($event))"
                [attr.aria-invalid]="!!error() || null"
                autofocus
              />
            </div>
          </div>
          <div>
            <label class="label" for="login-password">Password</label>
            <div class="relative">
              <app-icon name="lock" [size]="15" class="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ink/70" />
              <input
                id="login-password"
                class="input pl-9 pr-10"
                autocomplete="current-password"
                [type]="showPassword() ? 'text' : 'password'"
                [value]="password()"
                (input)="password.set(val($event))"
                [attr.aria-invalid]="!!error() || null"
              />
              <button
                type="button"
                class="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-md p-1.5 text-ink/70 hover:bg-ink/5 hover:text-ink"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                [attr.aria-pressed]="showPassword()"
                (click)="showPassword.set(!showPassword())"
              >
                <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="15" />
              </button>
            </div>
            @if (capsLock()) {
              <p class="mt-1 text-[11px] text-amber-800">Caps Lock is on</p>
            }
          </div>

          @if (error()) {
            <p class="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] text-red-700" role="alert">
              <app-icon name="x" [size]="14" class="mt-px shrink-0" />{{ error() }}
            </p>
          }

          <button type="submit" class="btn-primary w-full justify-center py-2 text-[13px]" [disabled]="busy()">
            @if (busy()) {
              <app-icon name="refresh" [size]="14" class="animate-spin" />Signing in…
            } @else {
              <app-icon name="log-in" [size]="14" />Sign in
            }
          </button>
        </form>

        <div class="mt-6 space-y-1 border-t border-ink/10 pt-4 text-[11px] text-ink/70">
          <p>Forgot your password? Ask your nPro admin to set a new one.</p>
          <p>Vendor and client users sign in with their email.</p>
        </div>
      </section>
    </main>
  `,
})
export class LoginPage {
  private readonly session = inject(Session);
  private readonly store = inject(DataStore);
  private readonly router = inject(Router);
  protected readonly features = FEATURES;

  protected readonly login = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly capsLock = signal(false);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly looksLikeEmail = computed(() => !this.login() || this.login().includes('@'));

  protected caps(e: KeyboardEvent) {
    this.capsLock.set(!!e.getModifierState?.('CapsLock'));
  }

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected async submit() {
    this.error.set('');
    if (!this.login().trim() || !this.password()) return this.error.set('Enter your email or employee ID, and your password');
    this.busy.set(true);
    try {
      await this.session.login(this.login(), this.password());
      void this.router.navigateByUrl(homeFor(this.store.currentUser().role));
    } catch (err) {
      this.error.set((err as Error).message);
      this.password.set('');
    } finally {
      this.busy.set(false);
    }
  }
}
