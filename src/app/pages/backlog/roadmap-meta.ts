import type { RoadmapStatus } from '../../core/models';

export const ROADMAP_STATUSES: { id: RoadmapStatus; label: string; color: string }[] = [
  { id: 'planned', label: 'Planned', color: '#64748b' },
  { id: 'in_progress', label: 'In progress', color: '#2a78d6' },
  { id: 'on_hold', label: 'On hold', color: '#d97706' },
  { id: 'completed', label: 'Completed', color: '#1fa15a' },
  { id: 'cancelled', label: 'Cancelled', color: '#9ca3af' },
];

export const roadmapStatusOf = (id: RoadmapStatus) => ROADMAP_STATUSES.find((s) => s.id === id) ?? ROADMAP_STATUSES[0]!;
