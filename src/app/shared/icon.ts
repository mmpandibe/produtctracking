import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  Archive, ArchiveRestore, ArrowUpDown, Code, Globe, Milestone, Target, Trophy, Play, Square, Timer, ChevronLeft, ChevronRight, CornerDownRight, Download, File, GitBranch, LifeBuoy, MessageSquare, PanelLeftClose, PanelLeftOpen, Paperclip, Send, Upload, Bell, Bookmark, Bug, Building2, CalendarClock, ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Equal, Inbox, Layers, SquareCheck, CalendarRange, ChartColumn, Check, Clock, Ellipsis, FileText,
  FolderKanban, Headset, LayoutDashboard, LayoutGrid, List, ListTodo, Package, Tag, Ticket, Users, Menu, Pencil, Plus, Search, Settings, SquareKanban,
  Trash2, Workflow, X, Zap, GripVertical, Copy, Laptop, Plug, RefreshCw, LogIn, UserCheck, CalendarOff, Activity, Mail, IdCard, Lock, Eye, EyeOff, ShieldCheck,
} from 'lucide';

/** Icons used in the app (from the framework-agnostic `lucide` package). Add new ones here. */
const ICONS = {
  archive: Archive,
  code: Code,
  globe: Globe,
  milestone: Milestone,
  target: Target,
  trophy: Trophy,
  play: Play,
  stop: Square,
  timer: Timer,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'corner-down-right': CornerDownRight,
  download: Download,
  file: File,
  'git-branch': GitBranch,
  'life-buoy': LifeBuoy,
  message: MessageSquare,
  'panel-close': PanelLeftClose,
  'panel-open': PanelLeftOpen,
  paperclip: Paperclip,
  send: Send,
  upload: Upload,
  'arrow-up-down': ArrowUpDown,
  bookmark: Bookmark,
  bug: Bug,
  'calendar-clock': CalendarClock,
  'chevron-down': ChevronDown,
  'chevrons-down': ChevronsDown,
  'chevrons-up': ChevronsUp,
  'chevron-up': ChevronUp,
  equal: Equal,
  inbox: Inbox,
  layers: Layers,
  'square-check': SquareCheck,
  bell: Bell,
  'archive-restore': ArchiveRestore,
  building: Building2,
  'calendar-range': CalendarRange,
  chart: ChartColumn,
  check: Check,
  clock: Clock,
  ellipsis: Ellipsis,
  'file-text': FileText,
  'folder-kanban': FolderKanban,
  headset: Headset,
  dashboard: LayoutDashboard,
  grid: LayoutGrid,
  list: List,
  package: Package,
  tag: Tag,
  ticket: Ticket,
  users: Users,
  'list-todo': ListTodo,
  menu: Menu,
  pencil: Pencil,
  plus: Plus,
  search: Search,
  settings: Settings,
  kanban: SquareKanban,
  trash: Trash2,
  workflow: Workflow,
  x: X,
  zap: Zap,
  grip: GripVertical,
  copy: Copy,
  laptop: Laptop,
  plug: Plug,
  refresh: RefreshCw,
  'log-in': LogIn,
  'user-check': UserCheck,
  'calendar-off': CalendarOff,
  activity: Activity,
  mail: Mail,
  'id-card': IdCard,
  lock: Lock,
  eye: Eye,
  'eye-off': EyeOff,
  'shield-check': ShieldCheck,
};

export type IconName = keyof typeof ICONS;

const esc = (v: unknown) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

@Component({
  selector: 'app-icon',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true', '[innerHTML]': 'svg()' },
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);

  private readonly sanitizer = inject(DomSanitizer);

  // Safe: markup is built only from the static icon data above, with attribute values escaped.
  protected readonly svg = computed(() => {
    const nodes = ICONS[this.name()] as unknown as [string, Record<string, string | number>][];
    const children = nodes
      .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`)
      .join('');
    const s = this.size();
    return this.sanitizer.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`,
    );
  });
}
