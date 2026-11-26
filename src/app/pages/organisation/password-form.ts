import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { api } from '../../core/api';
import type { User } from '../../core/models';
import { Modal } from '../../shared/modal';

/** Admins set a person's sign-in password (server mode). New people have no password until one is set. */
@Component({
  selector: 'app-password-form',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="'Set password for ' + (person()?.name ?? '')" (closed)="closed.emit()">
      <form id="password-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <p class="text-[12px] text-ink/70">
          {{ person()?.name }} signs in with <strong class="text-ink">{{ person()?.email }}</strong>{{ person()?.employeeId ? ' or ' + person()!.employeeId : '' }}.
          Share the password with them safely; they can't change it themselves yet.
        </p>
        <div>
          <label class="label" for="pw-new">New password *</label>
          <input id="pw-new" type="password" class="input" autocomplete="new-password" [value]="password()" (input)="password.set(val($event))" autofocus />
          <p class="mt-0.5 text-[11px] text-ink/70">At least 10 characters, with an upper-case letter, a lower-case letter and a digit.</p>
        </div>
        <div>
          <label class="label" for="pw-again">Repeat password *</label>
          <input id="pw-again" type="password" class="input" autocomplete="new-password" [value]="again()" (input)="again.set(val($event))" />
        </div>
        @if (error()) {
          <p class="text-[12px] text-red-700" role="alert">{{ error() }}</p>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="password-form" class="btn-primary" [disabled]="busy()">Set password</button>
      </div>
    </app-modal>
  `,
})
export class PasswordForm {
  readonly open = input(false);
  readonly person = input<User | undefined>(undefined);
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly password = signal('');
  protected readonly again = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly strongEnough = computed(() => {
    const p = this.password();
    return p.length >= 10 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.password.set('');
        this.again.set('');
        this.error.set('');
      });
    });
  }

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected async save() {
    this.error.set('');
    const p = this.person();
    if (!p) return;
    if (!this.strongEnough()) return this.error.set('The password needs at least 10 characters, including an upper-case letter, a lower-case letter and a digit.');
    if (this.password() !== this.again()) return this.error.set('The two passwords are different.');
    this.busy.set(true);
    try {
      await api('POST', `/api/people/${encodeURIComponent(p.id)}/password`, { password: this.password() });
      this.saved.emit(`Password set for ${p.name}`);
      this.closed.emit();
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
