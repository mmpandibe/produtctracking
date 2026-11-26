import type { IssueType, Priority, WorkActivity } from '../../core/models';
import type { IconName } from '../../shared/icon';

export const ISSUE_TYPES: { id: IssueType; label: string; icon: IconName; color: string }[] = [
  { id: 'story', label: 'Story', icon: 'bookmark', color: '#1fa15a' },
  { id: 'task', label: 'Task', icon: 'square-check', color: '#2f7cf6' },
  { id: 'bug', label: 'Bug', icon: 'bug', color: '#e5484d' },
  { id: 'epic', label: 'Epic', icon: 'layers', color: '#7c3aed' },
  { id: 'request', label: 'Request', icon: 'inbox', color: '#d99a06' },
  { id: 'support', label: 'Support', icon: 'life-buoy', color: '#0891b2' },
];

/** Priority pills are outlined in `color` (Low green, Medium blue, as in the reference) */
export const PRIORITIES: { id: Priority; label: string; icon: IconName; color: string; rank: number }[] = [
  { id: 'highest', label: 'Highest', icon: 'chevrons-up', color: '#dc2626', rank: 5 },
  { id: 'high', label: 'High', icon: 'chevron-up', color: '#ea580c', rank: 4 },
  { id: 'medium', label: 'Medium', icon: 'equal', color: '#1677ff', rank: 3 },
  { id: 'low', label: 'Low', icon: 'chevron-down', color: '#1fa15a', rank: 2 },
  { id: 'lowest', label: 'Lowest', icon: 'chevrons-down', color: '#64748b', rank: 1 },
];

export const typeOf = (id: IssueType) => ISSUE_TYPES.find((t) => t.id === id) ?? ISSUE_TYPES[1]!;
export const priorityOf = (id: Priority) => PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[2]!;

/** Light tinted background for an icon square in a given colour */
export const tint = (color: string, pct = 14) => `color-mix(in srgb, ${color} ${pct}%, white)`;

/** Kinds of work for logged hours */
export const WORK_ACTIVITIES: { id: WorkActivity; label: string; color: string }[] = [
  { id: 'analysis', label: 'Analysis', color: '#7c3aed' },
  { id: 'design', label: 'Design', color: '#e2539a' },
  { id: 'development', label: 'Development', color: '#2f7cf6' },
  { id: 'testing', label: 'Testing', color: '#1fa15a' },
  { id: 'meeting', label: 'Demo/Meeting', color: '#d99a06' },
  { id: 'documentation', label: 'Documentation', color: '#0891b2' },
];

export const activityOf = (id: WorkActivity) => WORK_ACTIVITIES.find((a) => a.id === id) ?? WORK_ACTIVITIES[2]!;
