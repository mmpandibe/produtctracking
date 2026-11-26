import type { CustomFieldDef, CustomFieldType, StatusCategory } from '../../core/models';
import type { IconName } from '../../shared/icon';

export const STATUS_CATEGORIES: { id: StatusCategory; label: string; color: string; hint: string }[] = [
  { id: 'todo', label: 'To do', color: '#64748b', hint: 'Not started' },
  { id: 'in_progress', label: 'In progress', color: '#2563eb', hint: 'Being worked on — sets the work-started time' },
  { id: 'hold', label: 'On hold', color: '#dc2626', hint: 'Paused' },
  { id: 'done', label: 'Done', color: '#16a34a', hint: 'Finished — sets the finished time' },
];

export const categoryOf = (id: StatusCategory) => STATUS_CATEGORIES.find((c) => c.id === id) ?? STATUS_CATEGORIES[0]!;

export const FIELD_TYPES: { id: CustomFieldType; label: string; icon: IconName }[] = [
  { id: 'text', label: 'Text', icon: 'file-text' },
  { id: 'number', label: 'Number', icon: 'equal' },
  { id: 'date', label: 'Date', icon: 'calendar-clock' },
  { id: 'select', label: 'Dropdown', icon: 'list' },
  { id: 'checkbox', label: 'Checkbox', icon: 'square-check' },
];

export const fieldTypeOf = (id: CustomFieldType) => FIELD_TYPES.find((t) => t.id === id) ?? FIELD_TYPES[0]!;

/** Colours offered for new statuses */
export const STATUS_COLORS = ['#64748b', '#2563eb', '#7c3aed', '#0891b2', '#d97706', '#059669', '#16a34a', '#dc2626', '#db2777', '#475569'];

/** Display text for a stored custom field value ('' when empty) */
export function formatFieldValue(def: CustomFieldDef, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (def.type === 'checkbox') return value ? 'Yes' : 'No';
  if (def.type === 'date' && typeof value === 'string') {
    const d = new Date(value + (value.length === 10 ? 'T00:00:00' : ''));
    return isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return String(value);
}
