import { Pipe, type PipeTransform } from '@angular/core';

/**
 * WCAG 2.2 AA (1.4.3 / 1.4.11): data colours (status, priority, support level, product …) are used as text and icon colours
 * on the light glass. Many hand-picked hues are too pale for small text, so this darkens a colour (keeping its hue) until it
 * reaches 4.5:1 against the palest panel background. Colours that already pass are returned unchanged.
 */

/** Lightest background text sits on: frosted panel over the sky gradient */
const PANEL_BG: [number, number, number] = [232, 241, 250];
const MIN_RATIO = 4.5;
const cache = new Map<string, string>();

function parseHex(c: string): [number, number, number] | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return undefined;
  const h = m[1]!.length === 3 ? [...m[1]!].map((x) => x + x).join('') : m[1]!;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]) {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: [number, number, number], b: [number, number, number]) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const toHex = (rgb: number[]) => '#' + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');

/** The colour itself if it is readable on the light panels, else the same hue darkened just enough */
export function readableColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const hit = cache.get(color);
  if (hit) return hit;
  const rgb = parseHex(color);
  if (!rgb) return color; // named / rgb() / currentColor: leave alone
  let out = rgb;
  for (let i = 0; i < 40 && contrastRatio(out, PANEL_BG) < MIN_RATIO; i++) out = out.map((c) => c * 0.93) as [number, number, number];
  const result = out === rgb ? color : toHex(out);
  cache.set(color, result);
  return result;
}

@Pipe({ name: 'readable' })
export class ReadablePipe implements PipeTransform {
  transform(color: string | null | undefined): string | null {
    return readableColor(color);
  }
}
