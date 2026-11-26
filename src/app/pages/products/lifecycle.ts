import type { ProductLifecycle } from '../../core/models';

/** Lifecycle stages; `color` drives the outlined pill (see .pill in styles.css). */
export const LIFECYCLES: { id: ProductLifecycle; label: string; color: string; dot: string }[] = [
  { id: 'planning', label: 'Planning', color: '#2f7cf6', dot: 'bg-pastel-blue' },
  { id: 'active', label: 'Active', color: '#1fa15a', dot: 'bg-pastel-green' },
  { id: 'maintenance', label: 'Maintenance', color: '#d99a06', dot: 'bg-pastel-yellow' },
  { id: 'sunset', label: 'Sunset', color: '#64748b', dot: 'bg-slate-500' },
];

export const lifecycleOf = (id: ProductLifecycle) => LIFECYCLES.find((l) => l.id === id) ?? LIFECYCLES[1]!;
