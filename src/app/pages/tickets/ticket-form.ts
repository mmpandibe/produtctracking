import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DataStore } from '../../core/data-store';
import type { Issue, IssueType, Priority, SupportLevel } from '../../core/models';
import { fromLocalInput, toLocalDateInput } from '../../core/utils';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { AttachmentsPanel } from './panels/attachments-panel';
import { CommentsPanel } from './panels/comments-panel';
import { TimeLogPanel } from './panels/time-log-panel';
import { ISSUE_TYPES, PRIORITIES } from './ticket-meta';
import { ReadablePipe } from '../../shared/readable';

/** Due date must not be before the start date */
function dueAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as string;
  const due = group.get('dueDate')?.value as string;
  return start && due && due < start ? { dueBeforeStart: true } : null;
}

type SideTab = 'time' | 'files' | 'comments';

@Component({
  selector: 'app-ticket-form',
  imports: [ReadablePipe, ReactiveFormsModule, DatePipe, Modal, Icon, AttachmentsPanel, CommentsPanel, TimeLogPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-form.html',
})
export class TicketForm {
  readonly open = input(false);
  /** When set, the form edits this ticket instead of creating one */
  readonly issue = input<Issue | undefined>();
  /** Product preselected when creating (e.g. the current filter) */
  readonly defaultProductId = input<string | undefined>();
  /** Parent preselected when creating (e.g. "Add child ticket") */
  readonly defaultParentId = input<string | undefined>();
  /** Status preselected when creating (e.g. "+" on a board column) */
  readonly defaultStatusId = input<string | undefined>();
  /** Sprint preselected when creating: a sprint id, '' for the backlog, or undefined for the active sprint */
  readonly defaultSprintId = input<string | undefined>();
  readonly closed = output<void>();
  /** Emits a confirmation message after saving */
  readonly saved = output<string>();

  protected readonly store = inject(DataStore);
  protected readonly types = ISSUE_TYPES;
  protected readonly priorities = PRIORITIES;
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly pendingFiles = signal<File[]>([]);
  protected readonly tab = signal<SideTab>('time');

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group(
    {
      productId: ['', Validators.required],
      parentId: [''],
      type: ['task' as IssueType],
      summary: ['', [Validators.required, Validators.maxLength(200)]],
      description: [''],
      statusId: [''],
      priority: ['medium' as Priority],
      assigneeId: [''],
      clientId: [''],
      sprintId: [''],
      storyPoints: ['', Validators.min(0)],
      startDate: [''],
      dueDate: [''],
      estimateHours: ['', Validators.min(0)],
      round: ['', Validators.min(1)],
      supportLevel: [''],
      estimatedBenefits: [''],
      achievedBenefits: [''],
      progress: [0, [Validators.min(0), Validators.max(100)]],
      labels: [''],
    },
    { validators: dueAfterStart },
  );

  private readonly productId = toSignal(this.form.controls.productId.valueChanges, { initialValue: '' });
  protected readonly progress = toSignal(this.form.controls.progress.valueChanges, { initialValue: 0 });
  protected readonly activeProducts = computed(() => this.store.products().filter((p) => !p.archived || p.id === this.issue()?.productId));
  /** People who can be assigned: active staff (production and client users raise tickets, they do not work them) */
  protected readonly assignees = computed(() =>
    this.store.users().filter((u) => u.id === this.issue()?.assigneeId || (!u.inactive && u.kind !== 'client' && u.role !== 'production_user')),
  );
  /** Creating: every status of the product's workflow. Editing: the current status plus the moves the workflow allows. */
  protected readonly statuses = computed(() => {
    const i = this.issue();
    this.store.workflows();
    return i ? this.store.allowedStatuses(i) : this.store.workflowFor(this.productId()).statuses;
  });
  /** Custom fields of the chosen product (Step 10) */
  protected readonly fields = computed(() => {
    this.store.customFields();
    return this.store.customFieldsFor(this.productId());
  });
  /** Custom field values being edited: strings for inputs, booleans for checkboxes */
  protected readonly cfValues = signal<Record<string, string | boolean>>({});
  /** Validation message per custom field (shown after submit) */
  protected readonly cfErrors = computed(() => {
    const errors: Record<string, string> = {};
    for (const f of this.fields()) {
      const v = this.cfValues()[f.id];
      const empty = v === undefined || v === '' || v === false;
      if (f.required && empty) errors[f.id] = f.type === 'checkbox' ? 'Must be ticked' : 'Required';
      else if (f.type === 'number' && typeof v === 'string' && v.trim() !== '' && !Number.isFinite(Number(v))) errors[f.id] = 'Enter a number';
    }
    return errors;
  });
  protected readonly sprintOptions = computed(() => {
    this.store.sprints();
    return this.store.sprintsFor(this.productId(), this.issue()?.sprintId);
  });
  /** Clients linked to the chosen product (plus the ticket's current client, if it was unlinked later) */
  protected readonly productClients = computed(() => {
    const product = this.store.products().find((p) => p.id === this.productId());
    return this.store.clients().filter((c) => (product?.clientIds.includes(c.id) && !c.archived) || c.id === this.issue()?.clientId);
  });
  /** Possible parents: same product, never the ticket itself or one of its children */
  protected readonly parentOptions = computed(() => {
    this.store.issues();
    return this.store.parentCandidates(this.productId(), this.issue()?.id);
  });
  protected readonly counts = computed(() => {
    const id = this.issue()?.id;
    return {
      time: id ? this.store.workLogs().filter((w) => w.issueId === id).length : 0,
      files: id ? this.store.attachments().filter((a) => a.issueId === id).length : 0,
      comments: id ? this.store.comments().filter((c) => c.issueId === id).length : 0,
    };
  });

  constructor() {
    // Reset the form each time the dialog opens
    effect(() => {
      if (!this.open()) return;
      const i = this.issue();
      const defaultProduct = this.defaultProductId();
      const defaultParent = this.defaultParentId();
      const defaultStatus = this.defaultStatusId();
      const defaultSprint = this.defaultSprintId();
      untracked(() => {
        const productId = i?.productId ?? defaultProduct ?? this.activeProducts()[0]?.id ?? '';
        const activeSprint = this.store.sprintsFor(productId).find((sp) => sp.state === 'active');
        this.form.reset({
          productId,
          parentId: i?.parentId ?? defaultParent ?? '',
          type: i?.type ?? 'task',
          summary: i?.summary ?? '',
          description: i?.description ?? '',
          statusId: i?.statusId ?? (this.store.workflowFor(productId).statuses.some((s) => s.id === defaultStatus) ? defaultStatus! : (this.store.workflowFor(productId).statuses[0]?.id ?? '')),
          priority: i?.priority ?? 'medium',
          assigneeId: i?.assigneeId ?? '',
          clientId: i?.clientId ?? '',
          sprintId: i ? (i.sprintId ?? '') : defaultSprint !== undefined ? defaultSprint : (activeSprint?.id ?? ''),
          storyPoints: i?.storyPoints != null ? String(i.storyPoints) : '',
          startDate: toLocalDateInput(i?.startDate),
          dueDate: toLocalDateInput(i?.dueDate),
          estimateHours: i?.estimateMinutes != null ? String(+(i.estimateMinutes / 60).toFixed(2)) : '',
          round: i?.round != null ? String(i.round) : '',
          supportLevel: i?.supportLevel ?? '',
          estimatedBenefits: i?.estimatedBenefits ?? '',
          achievedBenefits: i?.achievedBenefits ?? '',
          progress: i?.progress ?? 0,
          labels: i?.labels.join(', ') ?? '',
        });
        // A ticket's key comes from its product, so the product can't change after creation
        if (i) this.form.controls.productId.disable();
        else this.form.controls.productId.enable();
        this.submitted.set(false);
        this.saving.set(false);
        this.pendingFiles.set([]);
        const values: Record<string, string | boolean> = {};
        for (const [k, v] of Object.entries(i?.customFields ?? {})) values[k] = typeof v === 'boolean' ? v : String(v);
        this.cfValues.set(values);
        this.tab.set('time');
      });
    });

    // New support / request tickets start at L1 (Step 13)
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      if (!this.issue() && (type === 'support' || type === 'request') && !this.form.controls.supportLevel.value) this.form.controls.supportLevel.setValue('l1');
    });

    // When the product changes, keep status, client, sprint and parent valid for that product
    this.form.controls.productId.valueChanges.pipe(takeUntilDestroyed()).subscribe((productId) => {
      const c = this.form.controls;
      const statuses = this.store.workflowFor(productId).statuses;
      if (!statuses.some((s) => s.id === c.statusId.value)) c.statusId.setValue(statuses[0]?.id ?? '');
      const product = this.store.products().find((p) => p.id === productId);
      if (c.clientId.value && !product?.clientIds.includes(c.clientId.value)) c.clientId.setValue('');
      const sprint = this.store.sprintById(c.sprintId.value);
      if (sprint && sprint.productId !== productId) {
        c.sprintId.setValue(this.store.sprintsFor(productId).find((sp) => sp.state === 'active')?.id ?? '');
      }
      const parent = this.store.issues().find((i) => i.id === c.parentId.value);
      if (parent && parent.productId !== productId) c.parentId.setValue('');
    });
  }

  protected setCf(id: string, value: string | boolean) {
    this.cfValues.update((v) => ({ ...v, [id]: value }));
  }

  protected cfText(id: string) {
    const v = this.cfValues()[id];
    return typeof v === 'string' ? v : '';
  }

  /** Stored values for the product's fields (numbers as numbers; empty ones are dropped by the store) */
  private customValues(existing?: Record<string, unknown>) {
    const out: Record<string, unknown> = { ...(existing ?? {}) };
    for (const f of this.fields()) {
      const v = this.cfValues()[f.id];
      if (f.type === 'checkbox') out[f.id] = v === true ? true : undefined;
      else if (f.type === 'number') out[f.id] = typeof v === 'string' && v.trim() !== '' ? Number(v) : undefined;
      else out[f.id] = typeof v === 'string' ? v.trim() : undefined;
    }
    return out;
  }

  protected invalid(name: keyof typeof this.form.controls) {
    return this.submitted() && this.form.controls[name].invalid;
  }

  protected sprintLabel(state: string) {
    return state === 'active' ? ' (active)' : state === 'closed' ? ' (closed)' : '';
  }

  protected async submit() {
    this.submitted.set(true);
    if (this.form.invalid || Object.keys(this.cfErrors()).length || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
    const hours = num(v.estimateHours);
    const data = {
      type: v.type,
      summary: v.summary.trim(),
      description: v.description.trim() || undefined,
      statusId: v.statusId,
      priority: v.priority,
      assigneeId: v.assigneeId || undefined,
      clientId: v.clientId || undefined,
      parentId: v.parentId || undefined,
      sprintId: v.sprintId || undefined,
      storyPoints: num(v.storyPoints),
      startDate: fromLocalInput(v.startDate),
      dueDate: fromLocalInput(v.dueDate),
      estimateMinutes: hours != null ? Math.round(hours * 60) : undefined,
      round: num(v.round) != null ? Math.round(num(v.round)!) : undefined,
      estimatedBenefits: v.estimatedBenefits.trim() || undefined,
      achievedBenefits: v.achievedBenefits.trim() || undefined,
      labels: v.labels.split(',').map((l) => l.trim()).filter(Boolean),
      supportLevel: (v.supportLevel || null) as SupportLevel | null,
    };
    const existing = this.issue();
    if (existing) {
      // Keep the stored date when the day is unchanged, so an untouched date is not reported as a change
      const sameDay = (iso: string | undefined, input: string) => toLocalDateInput(iso) === input;
      const patch = {
        ...data,
        supportLevel: data.supportLevel ?? undefined,
        startDate: sameDay(existing.startDate, v.startDate) ? existing.startDate : data.startDate,
        dueDate: sameDay(existing.dueDate, v.dueDate) ? existing.dueDate : data.dueDate,
        progress: Math.round(Number(v.progress) || 0),
        customFields: this.customValues(existing.customFields),
      };
      this.store.updateIssue(existing.id, patch);
      this.saved.emit(`${existing.key} updated`);
    } else {
      const created = this.store.createIssue({ ...data, productId: v.productId, progress: 0, customFields: this.customValues() });
      const files = this.pendingFiles();
      let failed = 0;
      for (const f of files) {
        try {
          await this.store.addAttachment(created.id, f);
        } catch {
          failed++;
        }
      }
      const attached = files.length - failed;
      this.saved.emit(
        `${created.key} created` + (attached ? ` · ${attached} file${attached === 1 ? '' : 's'} attached` : '') + (failed ? ` · ${failed} file(s) failed` : ''),
      );
    }
    this.saving.set(false);
    this.closed.emit();
  }
}
