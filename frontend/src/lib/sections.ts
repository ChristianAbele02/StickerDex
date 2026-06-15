/** Display metadata + ordering for the album sections. */
import type { Section } from '../types.ts';

export const SECTION_LABELS: Record<Section, string> = {
  intro: 'Introduction',
  museum: 'FIFA Museum',
  team: 'Teams',
  coca_cola: 'Coca-Cola Specials',
};

export const SECTION_ORDER: Section[] = ['intro', 'museum', 'team', 'coca_cola'];

/**
 * A national-flag gradient from ordered color bands. Uses hard-ish stops so the
 * bands read as a flag rather than a muddy blend, with a slight feather between
 * them. Falls back gracefully for 1–2 colors.
 */
export function flagGradient(colors: string[], angle = 110): string {
  const stops = colors.length ? colors : ['#334155', '#0f172a'];
  if (stops.length === 1) return stops[0];
  const band = 100 / stops.length;
  const segments = stops.map((c, i) => {
    const start = Math.round(i * band);
    const end = Math.round((i + 1) * band);
    return `${c} ${start}%, ${c} ${end}%`;
  });
  return `linear-gradient(${angle}deg, ${segments.join(', ')})`;
}

function rgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** A reasonable contrasting text color for a given background hex. */
export function readableText(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return '#ffffff';
  return luminance(hex) > 0.6 ? '#0f172a' : '#ffffff';
}

/**
 * A holographic foil sheen tinted with the flag's own colors instead of plain
 * white, so a foil sticker shimmers in its country's palette. Near-white bands
 * are skipped as accents (they'd be invisible against the white highlight).
 */
export function flagSheen(flag: string[]): string {
  // Distinct, non-white bands so a multi-color flag shimmers in two of its hues.
  const accents = [...new Set(flag.filter((c) => luminance(c) < 0.82))];
  const a = accents[0] ?? flag[0] ?? '#ffffff';
  const b = accents[1] ?? accents[0] ?? flag[flag.length - 1] ?? '#ffffff';
  const tint = (hex: string, alpha: number) => {
    const [r, g, bl] = rgb(hex);
    return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
  };
  return `linear-gradient(115deg, rgba(255,255,255,0) 26%, ${tint(a, 0.5)} 38%, rgba(255,255,255,0.65) 50%, ${tint(b, 0.5)} 62%, rgba(255,255,255,0) 74%)`;
}
