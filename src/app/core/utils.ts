export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export const PALETTE = ['#7cb4f5', '#f29bc4', '#7ed98f', '#f59a7e', '#f5c84a', '#d4f5a0', '#b9a7f5', '#9ca3af'];

/** Suggest a product key from a name: "Customer Portal" -> "CP", "Website" -> "WEB". */
export function suggestKey(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const key = words.length === 1 ? words[0]!.slice(0, 3) : words.map((w) => w[0]).join('').slice(0, 5);
  return key.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO timestamp -> value for <input type="datetime-local"> (local time) */
export function toLocalDateTimeInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO timestamp -> value for <input type="date"> (local date) */
export function toLocalDateInput(iso?: string) {
  return toLocalDateTimeInput(iso).slice(0, 10);
}

/** Value from a date or datetime-local input -> ISO timestamp (undefined when empty) */
export function fromLocalInput(value: string) {
  if (!value) return undefined;
  return new Date(value.length === 10 ? `${value}T00:00` : value).toISOString();
}

/** Monday 00:00 (local) of the week containing `d` */
export function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  x.setDate(x.getDate() - day);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Local calendar day key, e.g. "2026-11-25" */
export function dayKey(d: Date | string) {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
