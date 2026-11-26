import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DataStore } from '../../core/data-store';
import type { Product, ProductLifecycle, Role } from '../../core/models';
import { roleOf } from '../../core/roles';
import { PALETTE, suggestKey } from '../../core/utils';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { LIFECYCLES } from './lifecycle';

@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-form.html',
})
export class ProductForm {
  readonly open = input(false);
  /** When set, the form edits this product instead of creating one */
  readonly product = input<Product | undefined>();
  readonly closed = output<void>();

  protected readonly store = inject(DataStore);
  protected readonly palette = PALETTE;
  protected readonly lifecycles = LIFECYCLES;
  protected readonly submitted = signal(false);
  protected readonly clientIds = signal<string[]>([]);
  protected readonly lifecycle = signal<ProductLifecycle>('active');
  protected readonly color = signal(PALETTE[0]!);
  protected readonly memberIds = signal<string[]>([]);
  /** Active people, plus whoever is picked already */
  protected readonly leads = computed(() => this.store.users().filter((u) => (!u.inactive || u.id === this.product()?.leadId) && u.kind !== 'client'));
  protected readonly memberOptions = computed(() => {
    const lead = this.leadId();
    return this.store.users().filter((u) => u.id !== lead && (!u.inactive || this.memberIds().includes(u.id)));
  });
  private readonly leadId = signal('');

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    key: ['', [Validators.required, Validators.pattern(/^[A-Z][A-Z0-9]{1,9}$/), (c: AbstractControl) => this.uniqueKey(c)]],
    version: [''],
    githubUrl: ['', Validators.pattern(/^https?:\/\/\S+\.\S+$/i)],
    websiteUrl: ['', Validators.pattern(/^https?:\/\/\S+\.\S+$/i)],
    description: [''],
    leadId: [''],
    divisionId: [''],
  });

  constructor() {
    // Reset the form each time the dialog opens
    effect(() => {
      if (!this.open()) return;
      const p = this.product();
      untracked(() => {
        this.form.reset({
          name: p?.name ?? '',
          key: p?.key ?? '',
          version: p?.version ?? '',
          githubUrl: p?.githubUrl ?? '',
          websiteUrl: p?.websiteUrl ?? '',
          description: p?.description ?? '',
          leadId: p?.leadId ?? this.store.currentUser().id,
          divisionId: p?.divisionId ?? this.store.userDivision(this.store.currentUser().id)?.id ?? '',
        });
        this.memberIds.set(p?.memberIds ?? []);
        this.leadId.set(this.form.controls.leadId.value);
        if (p) this.form.controls.key.markAsDirty();
        this.clientIds.set(p?.clientIds ?? []);
        this.lifecycle.set(p?.lifecycle ?? 'active');
        this.color.set(p?.color ?? PALETTE[this.store.products().length % PALETTE.length]!);
        this.submitted.set(false);
      });
    });

    this.form.controls.leadId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.leadId.set(id));

    // Suggest a key from the name until the user edits the key themselves
    this.form.controls.name.valueChanges.pipe(takeUntilDestroyed()).subscribe((name) => {
      if (!this.form.controls.key.dirty) this.form.controls.key.setValue(suggestKey(name));
    });
  }

  private uniqueKey(c: AbstractControl): ValidationErrors | null {
    const key = String(c.value ?? '').toUpperCase();
    const taken = this.store.products().some((p) => p.key === key && p.id !== this.product()?.id);
    return taken ? { taken: true } : null;
  }

  protected onKeyInput(e: Event) {
    const el = e.target as HTMLInputElement;
    this.form.controls.key.setValue(el.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    this.form.controls.key.markAsDirty();
  }

  protected keyError(): string {
    const c = this.form.controls.key;
    if (c.hasError('required')) return 'Key is required';
    if (c.hasError('pattern')) return '2–10 letters/digits, starting with a letter';
    if (c.hasError('taken')) return 'Key already used by another product';
    return '';
  }

  protected roleLabel(r: Role) {
    return roleOf(r).label;
  }

  protected toggleMember(id: string) {
    this.memberIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected toggleClient(id: string) {
    this.clientIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected submit() {
    this.submitted.set(true);
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const memberIds = this.memberIds().filter((m) => m !== v.leadId);
    const data = { ...v, divisionId: v.divisionId || undefined, memberIds, clientIds: this.clientIds(), lifecycle: this.lifecycle(), color: this.color() };
    const p = this.product();
    if (p) {
      this.store.updateProduct(p.id, {
        ...data,
        name: v.name.trim(),
        version: v.version.trim() || undefined,
        githubUrl: v.githubUrl.trim() || undefined,
        websiteUrl: v.websiteUrl.trim() || undefined,
        description: v.description.trim() || undefined,
      });
    } else {
      this.store.createProduct(data);
    }
    this.closed.emit();
  }
}
