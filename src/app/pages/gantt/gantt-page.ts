import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataStore } from '../../core/data-store';
import type { Issue, Roadmap, Sprint } from '../../core/models';
import {
  type Bar, type Range, type Zoom, ZOOMS, addDaysMs, barFor, daysBetween, packLanes, pointFor, rangeAround, shiftIso, shiftRange,
  startOfDay, ticksFor, weekendsFor, windowLabel,
} from '../../core/timeline';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { roadmapStatusOf } from '../backlog/roadmap-meta';
import { typeOf } from '../tickets/ticket-meta';
import { ReadablePipe } from '../../shared/readable';

type Kind = 'roadmap' | 'sprint' | 'issue' | 'group';
type DragMode = 'move' | 'start' | 'end';

/** One line of the product Gantt */
export interface GanttRow {
  id: string;
  kind: Kind;
  depth: number;
  label: string;
  sub?: string;
  color: string;
  start?: number;
  end?: number;
  startIso?: string;
  endIso?: string;
  /** Dates come from the sprint, not the ticket itself */
  inherited?: boolean;
  progress?: number;
  editable: boolean;
  collapsible: boolean;
  done?: boolean;
  link?: string[];
  icon?: string;
}

interface Drag {
  row: GanttRow;
  mode: DragMode;
  x0: number;
  pxPerDay: number;
  delta: number;
}

/** Step 14: Gantt per product (roadmaps → sprints → tickets, drag to move / resize) and a roadmap timeline across products. */
@Component({
  selector: 'app-gantt-page',
  imports: [ReadablePipe, Icon, NgTemplateOutlet, PageHeader, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gantt-page.html',
  host: { '(window:pointerup)': 'endDrag()', '(window:pointermove)': 'moveDrag($event)' },
})
export class GanttPage {
  protected readonly store = inject(DataStore);
  private readonly router = inject(Router);
  protected readonly zooms = ZOOMS;
  protected readonly roadmapStatusOf = roadmapStatusOf;
  protected readonly Math = Math;

  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly tab = signal<'product' | 'roadmap'>(this.params.get('tab') === 'roadmap' ? 'roadmap' : 'product');
  private readonly pickedProduct = signal(this.params.get('product') ?? '');
  protected readonly productId = computed(() => {
    const ps = this.store.products().filter((p) => !p.archived);
    return ps.find((p) => p.id === this.pickedProduct())?.id ?? ps[0]?.id ?? '';
  });
  protected readonly product = computed(() => this.store.products().find((p) => p.id === this.productId()));

  protected readonly zoom = signal<Zoom>('quarter');
  protected readonly range = signal<Range>(rangeAround(Date.now(), 'quarter'));
  protected readonly showDone = signal(true);
  protected readonly collapsed = signal<Set<string>>(new Set());
  protected readonly today = startOfDay(Date.now());

  protected readonly ticks = computed(() => ticksFor(this.range(), this.zoom()));
  protected readonly weekends = computed(() => weekendsFor(this.range()));
  protected readonly todayPct = computed(() => pointFor(Date.now(), this.range()));
  protected readonly windowLabel = computed(() => windowLabel(this.range()));

  /** Width of the timeline track, to thin out header labels on narrow screens */
  private readonly header = viewChild<ElementRef<HTMLElement>>('track');
  private readonly trackWidth = signal(800);
  protected readonly labelEvery = computed(() => {
    const n = this.ticks().length || 1;
    return Math.max(1, Math.ceil(52 / (this.trackWidth() / n)));
  });

  /** Bar width in CSS px (targets under 24px are not offered as separate keyboard targets) */
  protected barPx(bar: { width: number }) {
    return (bar.width / 100) * this.trackWidth();
  }

  protected readonly drag = signal<Drag | undefined>(undefined);
  private dragged = false;
  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const ro = new ResizeObserver(() => {
        const el = this.header()?.nativeElement;
        if (el) this.trackWidth.set(el.getBoundingClientRect().width);
      });
      ro.observe(document.body);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  // ---- Product Gantt rows ----

  private isDoneIssue(i: Issue) {
    return this.store.isResolved(i);
  }

  private issueRow(i: Issue, sprint: Sprint | undefined, depth: number): GanttRow | undefined {
    const wf = this.store.workflowFor(i.productId);
    const status = wf.statuses.find((s) => s.id === i.statusId);
    const ownStart = i.startDate ?? i.startAt;
    const ownEnd = i.dueDate ?? i.endAt;
    let startIso = ownStart;
    let endIso = ownEnd;
    let inherited = false;
    if (!startIso && !endIso && sprint?.startDate && sprint.endDate) {
      startIso = sprint.startDate;
      endIso = sprint.endDate;
      inherited = true;
    }
    if (!startIso && !endIso) return undefined;
    if (!startIso) startIso = Date.parse(i.createdAt) < Date.parse(endIso!) ? i.createdAt : endIso;
    if (!endIso) endIso = startIso;
    if (Date.parse(endIso!) < Date.parse(startIso!)) endIso = startIso;
    const done = status?.category === 'done';
    return {
      id: i.id,
      kind: 'issue',
      depth,
      label: `${i.key} ${i.summary}`,
      sub: status?.name,
      color: status?.color ?? '#64748b',
      start: startOfDay(startIso!),
      end: startOfDay(endIso!),
      startIso,
      endIso,
      inherited,
      progress: done ? 100 : (i.progress ?? 0),
      editable: this.store.canEditIssue(i),
      collapsible: false,
      done,
      link: ['/tickets', i.key],
      icon: typeOf(i.type).icon,
    };
  }

  private sprintRows(sp: Sprint, depth: number, out: GanttRow[]) {
    const pid = sp.productId;
    const stats = this.store.sprintStats(pid, sp.id);
    out.push({
      id: sp.id,
      kind: 'sprint',
      depth,
      label: sp.name,
      sub: sp.state === 'active' ? 'Active sprint' : sp.state === 'closed' ? 'Completed' : 'Planned sprint',
      color: sp.state === 'active' ? '#1677ff' : sp.state === 'closed' ? '#94a3b8' : '#60a5fa',
      start: sp.startDate ? startOfDay(sp.startDate) : undefined,
      end: sp.endDate ? startOfDay(sp.endDate) : undefined,
      startIso: sp.startDate,
      endIso: sp.endDate,
      progress: stats.points ? Math.round((stats.donePoints / stats.points) * 100) : stats.total ? Math.round((stats.done / stats.total) * 100) : 0,
      editable: sp.state !== 'closed' && this.store.canDo('sprints', pid),
      collapsible: stats.total > 0,
      done: sp.state === 'closed',
    });
    if (this.collapsed().has(sp.id)) return;
    for (const i of this.issuesOf(sp.id)) {
      const row = this.issueRow(i, sp, depth + 1);
      if (row) out.push(row);
    }
  }

  private issuesOf(sprintId: string | undefined) {
    return this.store
      .issues()
      .filter((i) => i.productId === this.productId() && (i.sprintId || undefined) === sprintId && (this.showDone() || !this.isDoneIssue(i)))
      .sort((a, b) => (a.startDate ?? a.dueDate ?? a.createdAt).localeCompare(b.startDate ?? b.dueDate ?? b.createdAt));
  }

  protected readonly rows = computed<GanttRow[]>(() => {
    const pid = this.productId();
    if (!pid) return [];
    this.store.issues();
    const out: GanttRow[] = [];
    const sprints = this.store.sprints().filter((s) => s.productId === pid).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
    const roadmaps = this.store.roadmaps().filter((r) => r.productId === pid).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
    for (const r of roadmaps) {
      const st = roadmapStatusOf(r.status);
      const mine = sprints.filter((s) => s.roadmapId === r.id);
      out.push({
        id: r.id,
        kind: 'roadmap',
        depth: 0,
        label: r.name,
        sub: st.label,
        color: st.color,
        start: r.startDate ? startOfDay(r.startDate) : undefined,
        end: r.dueDate ? startOfDay(r.dueDate) : undefined,
        startIso: r.startDate,
        endIso: r.dueDate,
        progress: this.store.roadmapProgress(r.id).pct,
        editable: this.store.canDo('roadmaps', pid),
        collapsible: mine.length > 0,
        done: r.status === 'completed' || r.status === 'cancelled',
      });
      if (!this.collapsed().has(r.id)) for (const sp of mine) this.sprintRows(sp, 1, out);
    }
    const loose = sprints.filter((s) => !s.roadmapId || !roadmaps.some((r) => r.id === s.roadmapId));
    if (loose.length) {
      out.push({ id: 'g-sprints', kind: 'group', depth: 0, label: 'Sprints without a roadmap', color: '#94a3b8', editable: false, collapsible: true });
      if (!this.collapsed().has('g-sprints')) for (const sp of loose) this.sprintRows(sp, 1, out);
    }
    const backlog = this.issuesOf(undefined)
      .map((i) => this.issueRow(i, undefined, 1))
      .filter((r): r is GanttRow => !!r);
    if (backlog.length) {
      out.push({ id: 'g-backlog', kind: 'group', depth: 0, label: 'Backlog tickets with dates', color: '#94a3b8', editable: false, collapsible: true });
      if (!this.collapsed().has('g-backlog')) out.push(...backlog);
    }
    return out;
  });

  /** Backlog tickets with no dates at all (not drawn) */
  protected readonly undated = computed(() => this.issuesOf(undefined).filter((i) => !i.startDate && !i.dueDate && !i.startAt && !i.endAt).length);

  /** Bar position for a row, including the live drag preview */
  protected barOf(row: GanttRow): Bar | undefined {
    const span = this.spanOf(row);
    return span ? barFor(span.start, span.end, this.range()) : undefined;
  }

  private spanOf(row: GanttRow) {
    if (row.start === undefined || row.end === undefined) return undefined;
    const d = this.drag();
    if (!d || d.row.id !== row.id || !d.delta) return { start: row.start, end: row.end };
    let start = row.start;
    let end = row.end;
    if (d.mode !== 'end') start = addDaysMs(start, d.delta);
    if (d.mode !== 'start') end = addDaysMs(end, d.delta);
    if (end < start) d.mode === 'start' ? (start = end) : (end = start);
    return { start, end };
  }

  protected dateLabel(row: GanttRow) {
    const span = this.spanOf(row);
    if (!span) return 'No dates';
    const f = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const days = daysBetween(span.start, span.end) + 1;
    return `${f(span.start)} – ${f(span.end)} · ${days} day${days === 1 ? '' : 's'}`;
  }

  // ---- Drag to move / resize ----

  protected startDrag(e: PointerEvent, row: GanttRow, mode: DragMode) {
    if (!row.editable || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const track = (e.currentTarget as HTMLElement).closest('[data-track]') as HTMLElement | null;
    const width = track?.getBoundingClientRect().width ?? this.trackWidth();
    this.dragged = false;
    this.drag.set({ row, mode, x0: e.clientX, pxPerDay: width / this.range().days, delta: 0 });
  }

  protected moveDrag(e: PointerEvent) {
    const d = this.drag();
    if (!d) return;
    const delta = Math.round((e.clientX - d.x0) / d.pxPerDay);
    if (Math.abs(e.clientX - d.x0) > 3) this.dragged = true;
    if (delta !== d.delta) this.drag.set({ ...d, delta });
  }

  endDrag() {
    const d = this.drag();
    if (!d) return;
    const label = this.dateLabel(d.row); // includes the drag preview
    this.drag.set(undefined);
    if (!d.delta) return;
    const r = d.row;
    // Shift the stored timestamps by whole days (keeps their time of day)
    const startIso = r.startIso && d.mode !== 'end' ? shiftIso(r.startIso, d.delta) : r.startIso;
    let endIso = r.endIso && d.mode !== 'start' ? shiftIso(r.endIso, d.delta) : r.endIso;
    if (startIso && endIso && Date.parse(endIso) < Date.parse(startIso)) endIso = startIso;
    try {
      this.store.reschedule(r.kind as 'roadmap' | 'sprint' | 'issue', r.id, startIso, endIso);
      this.showToast(`${r.kind === 'issue' ? r.label.split(' ')[0] : r.label} ${d.mode === 'move' ? 'moved' : 'resized'} · ${label}`);
    } catch (err) {
      this.showToast((err as Error).message);
    }
  }

  /** Bars keep working as links when they were clicked, not dragged */
  protected open(row: GanttRow) {
    if (this.dragged) {
      this.dragged = false;
      return;
    }
    if (row.link) void this.router.navigate(row.link);
  }

  /** Arrow keys move an editable bar by a day (Shift: resize the end) for keyboard users */
  protected keyMove(e: KeyboardEvent, row: GanttRow) {
    if (!row.editable || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const mode: DragMode = e.shiftKey ? 'end' : 'move';
    this.drag.set({ row, mode, x0: 0, pxPerDay: 1, delta });
    this.endDrag();
  }

  // ---- Toolbar ----

  protected setZoom(z: Zoom) {
    const r = this.range();
    const middle = addDaysMs(r.start, Math.floor(r.days / 2));
    this.zoom.set(z);
    this.range.set(rangeAround(middle, z));
  }

  protected shift(dir: 1 | -1) {
    this.range.update((r) => shiftRange(r, dir));
  }

  protected goToday() {
    this.range.set(rangeAround(Date.now(), this.zoom()));
  }

  /** Jumps the window to an item that is out of view */
  protected focus(row: GanttRow) {
    if (row.start !== undefined) this.range.set(rangeAround(row.start, this.zoom()));
  }

  protected toggle(row: GanttRow) {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }

  protected pickProduct(id: string) {
    this.pickedProduct.set(id);
    this.collapsed.set(new Set());
  }

  // ---- Roadmap timeline (all products) ----

  protected readonly lanes = computed(() => {
    this.store.issues();
    return this.store
      .products()
      .filter((p) => !p.archived)
      .map((p) => {
        const dated = this.store
          .roadmaps()
          .filter((r) => r.productId === p.id && r.startDate && r.dueDate)
          .map((r) => ({ roadmap: r, start: startOfDay(r.startDate!), end: startOfDay(r.dueDate!), pct: this.store.roadmapProgress(r.id).pct }));
        const undated = this.store.roadmaps().filter((r) => r.productId === p.id && (!r.startDate || !r.dueDate)).length;
        return { product: p, division: this.store.divisionById(p.divisionId)?.name, lanes: packLanes(dated), undated };
      });
  });

  protected roadmapBar(item: { start: number; end: number }) {
    return barFor(item.start, item.end, this.range());
  }

  protected overdue(r: Roadmap) {
    return !!r.dueDate && startOfDay(r.dueDate) < this.today && r.status !== 'completed' && r.status !== 'cancelled';
  }

  protected openProduct(productId: string) {
    this.pickProduct(productId);
    this.tab.set('product');
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }
}
