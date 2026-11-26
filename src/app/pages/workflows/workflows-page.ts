import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { DataStore } from '../../core/data-store';
import type { CustomFieldDef, StatusCategory, WorkflowStatus } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { FieldForm } from './field-form';
import { STATUS_CATEGORIES, STATUS_COLORS, categoryOf, fieldTypeOf } from './workflow-meta';
import { ReadablePipe } from '../../shared/readable';

/** Step 10: edit workflows (statuses, order, transition rules, product assignment) and custom ticket fields. */
@Component({
  selector: 'app-workflows-page',
  imports: [ReadablePipe, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, Icon, Modal, PageHeader, FieldForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workflows-page.html',
})
export class WorkflowsPage {
  protected readonly store = inject(DataStore);
  protected readonly categories = STATUS_CATEGORIES;
  protected readonly categoryOf = categoryOf;
  protected readonly fieldTypeOf = fieldTypeOf;

  protected readonly tab = signal<'workflows' | 'fields'>('workflows');
  protected readonly selectedId = signal(this.store.workflows()[0]?.id ?? '');
  protected readonly workflow = computed(() => this.store.workflows().find((w) => w.id === this.selectedId()) ?? this.store.workflows()[0]!);
  protected readonly restricted = computed(() => this.store.isRestricted(this.workflow()));
  protected readonly usedBy = computed(() => {
    this.store.products();
    return this.store.productsUsingWorkflow(this.workflow().id);
  });
  /** Ticket count per status of the selected workflow */
  protected readonly usage = computed(() => {
    this.store.issues();
    const wf = this.workflow();
    return Object.fromEntries(wf.statuses.map((s) => [s.id, this.store.statusUsage(wf.id, s.id)])) as Record<string, number>;
  });

  // New workflow dialog
  protected readonly newOpen = signal(false);
  protected readonly newName = signal('');
  protected readonly newFrom = signal('');

  // Add status
  protected readonly addName = signal('');
  protected readonly addCategory = signal<StatusCategory>('in_progress');

  // Delete status dialog
  protected readonly deletingStatus = signal<WorkflowStatus | undefined>(undefined);
  protected readonly replacementId = signal('');
  protected readonly confirmDeleteWf = signal(false);

  // Custom fields
  protected readonly fieldFormOpen = signal(false);
  protected readonly editingField = signal<CustomFieldDef | undefined>(undefined);
  protected readonly deletingField = signal<CustomFieldDef | undefined>(undefined);
  protected readonly fields = computed(() =>
    [...this.store.customFields()].sort((a, b) => (a.productId ? 1 : 0) - (b.productId ? 1 : 0) || a.name.localeCompare(b.name)),
  );
  protected readonly fieldUsage = computed(() => {
    this.store.issues();
    return Object.fromEntries(this.store.customFields().map((f) => [f.id, this.store.customFieldUsage(f.id)])) as Record<string, number>;
  });

  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected wfUsage(id: string) {
    return this.store.products().filter((p) => p.workflowId === id).length;
  }

  // ---- Workflows ----

  protected openNew() {
    this.newName.set('');
    this.newFrom.set(this.workflow().id);
    this.newOpen.set(true);
  }

  protected createWorkflow() {
    const wf = this.store.createWorkflow(this.newName(), this.newFrom());
    this.selectedId.set(wf.id);
    this.newOpen.set(false);
    this.showToast(`${wf.name} created`);
  }

  protected rename(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.value.trim()) input.value = this.workflow().name;
    else this.store.renameWorkflow(this.workflow().id, input.value);
  }

  protected deleteWorkflow() {
    const wf = this.workflow();
    this.confirmDeleteWf.set(false);
    if (this.store.deleteWorkflow(wf.id)) {
      this.selectedId.set(this.store.workflows()[0]!.id);
      this.showToast(`${wf.name} deleted`);
    }
  }

  protected assign(productId: string, e: Event) {
    const workflowId = this.val(e);
    const product = this.store.products().find((p) => p.id === productId);
    const moved = this.store.assignWorkflow(productId, workflowId);
    this.showToast(`${product?.name} now uses ${this.store.workflowById(workflowId)?.name}` + (moved ? ` · ${moved} ticket(s) remapped` : ''));
  }

  // ---- Statuses ----

  protected drop(e: CdkDragDrop<WorkflowStatus[]>) {
    if (e.previousIndex !== e.currentIndex) this.store.moveStatus(this.workflow().id, e.previousIndex, e.currentIndex);
  }

  protected renameStatus(s: WorkflowStatus, e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.value.trim()) input.value = s.name;
    else if (input.value.trim() !== s.name) this.store.updateStatus(this.workflow().id, s.id, { name: input.value });
  }

  protected setCategory(s: WorkflowStatus, e: Event) {
    this.store.updateStatus(this.workflow().id, s.id, { category: this.val(e) as StatusCategory });
  }

  protected setColor(s: WorkflowStatus, e: Event) {
    this.store.updateStatus(this.workflow().id, s.id, { color: this.val(e) });
  }

  protected addStatus() {
    const name = this.addName().trim();
    if (!name) return;
    const wf = this.workflow();
    const color = STATUS_COLORS[wf.statuses.length % STATUS_COLORS.length]!;
    this.store.addStatus(wf.id, { name, category: this.addCategory(), color });
    this.addName.set('');
    this.showToast(`${name} added`);
  }

  protected askDeleteStatus(s: WorkflowStatus) {
    const others = this.workflow().statuses.filter((x) => x.id !== s.id);
    // Suggest a status of the same category
    this.replacementId.set((others.find((x) => x.category === s.category) ?? others[0])?.id ?? '');
    this.deletingStatus.set(s);
  }

  protected confirmDeleteStatus() {
    const s = this.deletingStatus();
    if (!s) return;
    try {
      const moved = this.store.deleteStatus(this.workflow().id, s.id, this.replacementId());
      this.showToast(`${s.name} deleted` + (moved ? ` · ${moved} ticket(s) moved` : ''));
    } catch (err) {
      this.showToast((err as Error).message);
    }
    this.deletingStatus.set(undefined);
  }

  // ---- Transitions ----

  protected allowed(fromId: string, toId: string) {
    const list = this.workflow().transitions[fromId];
    return !list || list.includes(toId);
  }

  protected outCount(fromId: string) {
    const wf = this.workflow();
    return wf.statuses.filter((s) => s.id !== fromId && this.allowed(fromId, s.id)).length;
  }

  protected toggleRestricted(e: Event) {
    this.store.setRestricted(this.workflow().id, (e.target as HTMLInputElement).checked);
  }

  protected toggle(fromId: string, toId: string) {
    this.store.setTransition(this.workflow().id, fromId, toId, !this.allowed(fromId, toId));
  }

  // ---- Custom fields ----

  protected openField(f?: CustomFieldDef) {
    this.editingField.set(f);
    this.fieldFormOpen.set(true);
  }

  protected confirmDeleteField() {
    const f = this.deletingField();
    if (f) {
      this.store.deleteCustomField(f.id);
      this.showToast(`${f.name} deleted`);
    }
    this.deletingField.set(undefined);
  }

  protected productName(id?: string) {
    return this.store.products().find((p) => p.id === id)?.name ?? 'Unknown product';
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
