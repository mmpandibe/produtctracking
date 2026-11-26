import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DataStore } from '../../core/data-store';
import type { Division, Team, Vendor } from '../../core/models';
import { roleOf } from '../../core/roles';
import { PALETTE } from '../../core/utils';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';

const val = (e: Event) => (e.target as HTMLInputElement).value;

/** Add or edit a division: name, description, division head, colour */
@Component({
  selector: 'app-division-form',
  imports: [Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="division() ? 'Edit division' : 'Add division'" (closed)="closed.emit()">
      <form id="division-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div>
          <label class="label" for="dv-name">Division name *</label>
          <input id="dv-name" class="input" [value]="name()" (input)="name.set(val($event))" placeholder="e.g. Digital Products" autofocus />
        </div>
        <div>
          <label class="label" for="dv-desc">Description</label>
          <input id="dv-desc" class="input" [value]="description()" (input)="description.set(val($event))" placeholder="What the division is responsible for" />
        </div>
        <div>
          <label class="label" for="dv-head">Division head</label>
          <select id="dv-head" class="input" (change)="headId.set(val($event))">
            <option value="" [selected]="!headId()">Not set</option>
            @for (u of heads(); track u.id) {
              <option [value]="u.id" [selected]="u.id === headId()">{{ u.name }} · {{ roleLabel(u.role) }}</option>
            }
          </select>
          <p class="mt-1 text-[11px] text-ink/70">People with the Division head or Admin role.</p>
        </div>
        <div>
          <span class="label">Colour</span>
          <div class="flex flex-wrap gap-2">
            @for (c of palette; track c) {
              <button type="button" class="flex h-6 w-6 items-center justify-center rounded-full ring-offset-2" [class.ring-2]="color() === c" [class.ring-brand]="color() === c" [style.background]="c" [attr.aria-label]="'Colour ' + c" (click)="color.set(c)">
                @if (color() === c) {
                  <app-icon name="check" [size]="13" class="text-neutral-900" />
                }
              </button>
            }
          </div>
        </div>
        @if (error()) {
          <p class="text-[11px] text-red-700" role="alert">{{ error() }}</p>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="division-form" class="btn-primary">{{ division() ? 'Save division' : 'Add division' }}</button>
      </div>
    </app-modal>
  `,
})
export class DivisionForm {
  readonly open = input(false);
  readonly division = input<Division | undefined>();
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly palette = PALETTE;
  protected readonly val = val;
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly headId = signal('');
  protected readonly color = signal(PALETTE[0]!);
  protected readonly error = signal('');
  protected readonly heads = computed(() =>
    this.store.users().filter((u) => (u.role === 'division_head' || u.role === 'admin') && (!u.inactive || u.id === this.headId())),
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const d = this.division();
      untracked(() => {
        this.name.set(d?.name ?? '');
        this.description.set(d?.description ?? '');
        this.headId.set(d?.headId ?? '');
        this.color.set(d?.color ?? PALETTE[this.store.divisions().length % PALETTE.length]!);
        this.error.set('');
      });
    });
  }

  protected roleLabel(r: Parameters<typeof roleOf>[0]) {
    return roleOf(r).label;
  }

  protected save() {
    const input = { name: this.name(), description: this.description(), headId: this.headId(), color: this.color() };
    try {
      const d = this.division();
      if (d) this.store.updateDivision(d.id, input);
      else this.store.createDivision(input);
      this.saved.emit(`${input.name.trim()} ${d ? 'saved' : 'added'}`);
      this.closed.emit();
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }
}

/** Add or edit a team inside a division */
@Component({
  selector: 'app-team-form',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="team() ? 'Edit team' : 'Add team'" (closed)="closed.emit()">
      <form id="team-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="label" for="tm-name">Team name *</label>
            <input id="tm-name" class="input" [value]="name()" (input)="name.set(val($event))" placeholder="e.g. Web & Mobile" autofocus />
          </div>
          <div>
            <label class="label" for="tm-div">Division *</label>
            <select id="tm-div" class="input" (change)="divisionId.set(val($event))">
              @for (d of store.divisions(); track d.id) {
                <option [value]="d.id" [selected]="d.id === divisionId()">{{ d.name }}</option>
              }
            </select>
          </div>
        </div>
        <div>
          <label class="label" for="tm-desc">Description</label>
          <input id="tm-desc" class="input" [value]="description()" (input)="description.set(val($event))" placeholder="What the team works on" />
        </div>
        <div>
          <label class="label" for="tm-mgr">Assistant manager</label>
          <select id="tm-mgr" class="input" (change)="managerId.set(val($event))">
            <option value="" [selected]="!managerId()">Not set</option>
            @for (u of managers(); track u.id) {
              <option [value]="u.id" [selected]="u.id === managerId()">{{ u.name }} · {{ roleLabel(u.role) }}</option>
            }
          </select>
          <p class="mt-1 text-[11px] text-ink/70">People added to the team report to this person unless they already have a manager.</p>
        </div>
        @if (error()) {
          <p class="text-[11px] text-red-700" role="alert">{{ error() }}</p>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="team-form" class="btn-primary">{{ team() ? 'Save team' : 'Add team' }}</button>
      </div>
    </app-modal>
  `,
})
export class TeamForm {
  readonly open = input(false);
  readonly team = input<Team | undefined>();
  readonly divisionPreset = input<string | undefined>();
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly val = val;
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly divisionId = signal('');
  protected readonly managerId = signal('');
  protected readonly error = signal('');
  protected readonly managers = computed(() =>
    this.store
      .users()
      .filter((u) => ['assistant_manager', 'division_head', 'admin'].includes(u.role) && (!u.inactive || u.id === this.managerId())),
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const t = this.team();
      const preset = this.divisionPreset();
      untracked(() => {
        this.name.set(t?.name ?? '');
        this.description.set(t?.description ?? '');
        this.divisionId.set(t?.divisionId ?? preset ?? this.store.divisions()[0]?.id ?? '');
        this.managerId.set(t?.managerId ?? '');
        this.error.set('');
      });
    });
  }

  protected roleLabel(r: Parameters<typeof roleOf>[0]) {
    return roleOf(r).label;
  }

  protected save() {
    const input = { name: this.name(), description: this.description(), divisionId: this.divisionId(), managerId: this.managerId() };
    try {
      const t = this.team();
      if (t) this.store.updateTeam(t.id, input);
      else this.store.createTeam(input);
      this.saved.emit(`${input.name.trim()} ${t ? 'saved' : 'added'}`);
      this.closed.emit();
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }
}

/** Add or edit a vendor company */
@Component({
  selector: 'app-vendor-form',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [heading]="vendor() ? 'Edit ' + vendor()!.name : 'Add vendor'" (closed)="closed.emit()">
      <form id="vendor-form" class="space-y-3" (submit)="$event.preventDefault(); save()" novalidate>
        <div>
          <label class="label" for="vd-name">Company name *</label>
          <input id="vd-name" class="input" [value]="name()" (input)="name.set(val($event))" placeholder="e.g. Nimbus Dev Labs" autofocus />
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label class="label" for="vd-contact">Contact person</label>
            <input id="vd-contact" class="input" [value]="contactName()" (input)="contactName.set(val($event))" placeholder="Full name" />
          </div>
          <div>
            <label class="label" for="vd-email">Email</label>
            <input id="vd-email" class="input" type="email" [value]="contactEmail()" (input)="contactEmail.set(val($event))" placeholder="name@vendor.com" />
          </div>
          <div>
            <label class="label" for="vd-phone">Phone</label>
            <input id="vd-phone" class="input" type="tel" [value]="contactPhone()" (input)="contactPhone.set(val($event))" placeholder="+91 80 4000 1200" />
          </div>
        </div>
        <div>
          <label class="label" for="vd-notes">Notes</label>
          <textarea id="vd-notes" class="input min-h-14" [value]="notes()" (input)="notes.set(val($event))" placeholder="Contract, capacity, billing…"></textarea>
        </div>
        @if (error()) {
          <p class="text-[11px] text-red-700" role="alert">{{ error() }}</p>
        }
      </form>
      <div footer class="contents">
        <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="vendor-form" class="btn-primary">{{ vendor() ? 'Save vendor' : 'Add vendor' }}</button>
      </div>
    </app-modal>
  `,
})
export class VendorForm {
  readonly open = input(false);
  readonly vendor = input<Vendor | undefined>();
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly val = val;
  protected readonly name = signal('');
  protected readonly contactName = signal('');
  protected readonly contactEmail = signal('');
  protected readonly contactPhone = signal('');
  protected readonly notes = signal('');
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.vendor();
      untracked(() => {
        this.name.set(v?.name ?? '');
        this.contactName.set(v?.contactName ?? '');
        this.contactEmail.set(v?.contactEmail ?? '');
        this.contactPhone.set(v?.contactPhone ?? '');
        this.notes.set(v?.notes ?? '');
        this.error.set('');
      });
    });
  }

  protected save() {
    const input = { name: this.name(), contactName: this.contactName(), contactEmail: this.contactEmail(), contactPhone: this.contactPhone(), notes: this.notes() };
    try {
      const v = this.vendor();
      if (v) this.store.updateVendor(v.id, input);
      else this.store.createVendor(input);
      this.saved.emit(`${input.name.trim()} ${v ? 'saved' : 'added'}`);
      this.closed.emit();
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }
}
