import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DataStore } from '../../core/data-store';
import type { Role, User, UserKind } from '../../core/models';
import { ROLES, USER_KINDS } from '../../core/roles';
import { Modal } from '../../shared/modal';

/** Add or edit a person: kind (internal / vendor / client), role, team, reporting manager, products. */
@Component({
  selector: 'app-person-form',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="person() ? 'Edit ' + person()!.name : 'Add person'" (closed)="closed.emit()">
      <form id="person-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div>
          <span class="label">Type</span>
          <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Person type">
            @for (k of kinds; track k.id) {
              <button
                type="button"
                role="radio"
                class="rounded-lg border px-2.5 py-1.5 text-left transition"
                [class]="kind() === k.id ? 'border-brand bg-brand/5 ring-2 ring-brand/20' : 'border-ink/10 bg-white/60 hover:bg-white'"
                [attr.aria-checked]="kind() === k.id"
                (click)="kind.set(k.id)"
              >
                <span class="text-[12px] font-semibold">{{ k.label }}</span>
                <span class="block text-[11px] leading-snug text-ink/70">{{ k.blurb }}</span>
              </button>
            }
          </div>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="label" for="pp-name">Full name *</label>
            <input id="pp-name" class="input" [value]="name()" (input)="name.set(val($event))" placeholder="e.g. Anita Desai" autofocus />
          </div>
          <div>
            <label class="label" for="pp-email">Email *</label>
            <input id="pp-email" class="input" type="email" [value]="email()" (input)="email.set(val($event))" placeholder="name@company.com" />
          </div>
          <div>
            <label class="label" for="pp-title">Job title</label>
            <input id="pp-title" class="input" [value]="title()" (input)="title.set(val($event))" placeholder="e.g. Senior developer" />
          </div>
          @if (kind() === 'internal') {
            <div>
              <label class="label" for="pp-emp">Employee ID *</label>
              <input id="pp-emp" class="input font-mono uppercase placeholder:font-sans placeholder:normal-case" maxlength="20" autocomplete="off" [value]="employeeId()" (input)="employeeId.set(val($event))" placeholder="e.g. EMP-014" />
              <p class="mt-0.5 text-[10px] text-ink/70">From HR. In-house employees can also sign in with it.</p>
            </div>
          }
          @if (kind() === 'vendor') {
            <div>
              <label class="label" for="pp-vendor">Vendor company *</label>
              <select id="pp-vendor" class="input" (change)="vendorId.set(val($event))">
                <option value="" [selected]="!vendorId()">Choose…</option>
                @for (v of store.vendors(); track v.id) {
                  <option [value]="v.id" [selected]="v.id === vendorId()">{{ v.name }}</option>
                }
              </select>
              @if (!store.vendors().length) {
                <p class="mt-1 text-[11px] text-amber-800">Add a vendor company on the Vendors tab first.</p>
              }
            </div>
          }
          @if (kind() === 'client') {
            <div>
              <label class="label" for="pp-client">Client company *</label>
              <select id="pp-client" class="input" (change)="clientId.set(val($event))">
                <option value="" [selected]="!clientId()">Choose…</option>
                @for (c of store.clients(); track c.id) {
                  @if (!c.archived || c.id === clientId()) {
                    <option [value]="c.id" [selected]="c.id === clientId()">{{ c.name }}</option>
                  }
                }
              </select>
            </div>
          }
          <div>
            <label class="label" for="pp-role">Role</label>
            @if (kind() === 'client') {
              <div class="input flex items-center bg-white/40 text-ink/70">Production user</div>
            } @else {
              <select id="pp-role" class="input" (change)="role.set($any(val($event)))">
                @for (r of roles; track r.id) {
                  <option [value]="r.id" [selected]="r.id === role()">{{ r.label }}</option>
                }
              </select>
            }
          </div>
          @if (kind() !== 'client') {
            <div>
              <label class="label" for="pp-team">Team</label>
              <select id="pp-team" class="input" (change)="setTeam(val($event))">
                <option value="" [selected]="!teamId()">No team</option>
                @for (d of store.divisions(); track d.id) {
                  <optgroup [label]="d.name">
                    @for (t of store.teamsOf(d.id); track t.id) {
                      <option [value]="t.id" [selected]="t.id === teamId()">{{ t.name }}</option>
                    }
                  </optgroup>
                }
              </select>
            </div>
          }
          <div>
            <label class="label" for="pp-manager">Reports to</label>
            <select id="pp-manager" class="input" (change)="managerId.set(val($event))">
              <option value="" [selected]="!managerId()">Nobody</option>
              @for (u of managers(); track u.id) {
                <option [value]="u.id" [selected]="u.id === managerId()">{{ u.name }} · {{ roleLabel(u.role) }}</option>
              }
            </select>
          </div>
        </div>
        @if (role() === 'production_user' || kind() === 'client') {
          <p class="text-[11px] text-ink/70">Production users raise tickets and follow their status. Products below decide where they can raise them.</p>
        }
        <div>
          <span class="label">Works on products</span>
          <div class="flex flex-wrap gap-1.5">
            @for (p of store.products(); track p.id) {
              @if (!p.archived || productIds().includes(p.id)) {
                @let lead = person() && p.leadId === person()!.id;
                <button
                  type="button"
                  class="chip"
                  [class]="lead || productIds().includes(p.id) ? 'chip-on' : 'chip-off'"
                  [attr.aria-pressed]="lead || productIds().includes(p.id)"
                  [disabled]="lead"
                  [title]="lead ? 'Product lead (change it on the product)' : ''"
                  (click)="toggleProduct(p.id)"
                >
                  <span class="h-1.5 w-1.5 rounded-full" [style.background]="lead || productIds().includes(p.id) ? 'white' : p.color"></span>{{ p.name }}{{ lead ? ' · lead' : '' }}
                </button>
              }
            }
          </div>
        </div>
        @if (error()) {
          <p class="text-[11px] text-red-700" role="alert">{{ error() }}</p>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="person-form" class="btn-primary">{{ person() ? 'Save changes' : 'Add person' }}</button>
      </div>
    </app-modal>
  `,
})
export class PersonForm {
  readonly open = input(false);
  readonly person = input<User | undefined>();
  /** Team to preselect when adding someone from a team card */
  readonly teamPreset = input<string | undefined>();
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly kinds = USER_KINDS;
  protected readonly roles = ROLES;

  protected readonly kind = signal<UserKind>('internal');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly title = signal('');
  protected readonly employeeId = signal('');
  protected readonly role = signal<Role>('developer');
  protected readonly teamId = signal('');
  protected readonly managerId = signal('');
  protected readonly vendorId = signal('');
  protected readonly clientId = signal('');
  protected readonly productIds = signal<string[]>([]);
  protected readonly error = signal('');

  /** Anyone active except the person and their own reports */
  protected readonly managers = computed(() => {
    const p = this.person();
    const blocked = new Set(p ? [p.id, ...this.store.reportsOf(p.id).map((u) => u.id)] : []);
    return this.store.users().filter((u) => !blocked.has(u.id) && (!u.inactive || u.id === this.managerId()) && u.kind !== 'client' && u.role !== 'production_user');
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const p = this.person();
      const preset = this.teamPreset();
      untracked(() => {
        this.kind.set(p?.kind ?? 'internal');
        this.name.set(p?.name ?? '');
        this.email.set(p?.email ?? '');
        this.title.set(p?.title ?? '');
        this.employeeId.set(p?.employeeId ?? '');
        this.role.set(p?.role ?? 'developer');
        this.teamId.set(p?.teamId ?? preset ?? '');
        this.managerId.set(p?.managerId ?? (preset ? (this.store.teamById(preset)?.managerId ?? '') : ''));
        this.vendorId.set(p?.vendorId ?? '');
        this.clientId.set(p?.clientId ?? '');
        this.productIds.set(p ? this.store.userProducts(p.id).filter((x) => x.leadId !== p.id).map((x) => x.id) : []);
        this.error.set('');
      });
    });
  }

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected roleLabel(r: Role) {
    return ROLES.find((x) => x.id === r)?.label ?? r;
  }

  /** Picking a team suggests its manager as reporting manager */
  protected setTeam(id: string) {
    this.teamId.set(id);
    const mgr = this.store.teamById(id)?.managerId;
    if (mgr && !this.managerId() && mgr !== this.person()?.id) this.managerId.set(mgr);
  }

  protected toggleProduct(id: string) {
    this.productIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected save() {
    const input = {
      name: this.name(), email: this.email(), kind: this.kind(), role: this.role(), title: this.title(), employeeId: this.employeeId(),
      teamId: this.teamId(), managerId: this.managerId(), vendorId: this.vendorId(), clientId: this.clientId(),
    };
    try {
      const p = this.person();
      const id = p ? (this.store.updateUser(p.id, input), p.id) : this.store.createUser(input).id;
      this.store.setUserProducts(id, this.productIds());
      this.saved.emit(`${input.name.trim()} ${p ? 'saved' : 'added'}`);
      this.closed.emit();
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }
}
