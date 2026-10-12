/**
 * The FreeKeep chest, a 16 × 16 pixel drawing on a navy tile. Users pick its body and lock colours;
 * the light and dark shades and the sparkle are derived, so any pick stays readable at 16 px.
 *
 * Everything sits on a 16-cell grid, so the icon stays crisp at 16, 32, 48 and 96 px.
 */

export interface ChestColors {
  body: string;
  band: string;
}

export const TILE = '#1b2838';
export const DEFAULT_CHEST: ChestColors = { body: '#2a6f9e', band: '#ffcd75' };

export const CHEST_PRESETS = [
  { id: 'steam', body: '#2a6f9e', band: '#ffcd75' },
  { id: 'wood', body: '#a8642c', band: '#ffcd75' },
  { id: 'emerald', body: '#2f8f5b', band: '#ffe08a' },
  { id: 'amethyst', body: '#6b46c1', band: '#ffcd75' },
  { id: 'ruby', body: '#b33a3a', band: '#ffd27a' },
  { id: 'obsidian', body: '#3a3f48', band: '#c7d5e0' },
  { id: 'gold', body: '#c99a1e', band: '#5a3410' },
  { id: 'sakura', body: '#d16b9b', band: '#fff0a6' },
] as const;

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (value: unknown): value is string => typeof value === 'string' && HEX.test(value);

type Rgb = [number, number, number];
const toRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: Rgb) =>
  `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Moves a colour towards white (t > 0) or black (t < 0). */
export function shade(hex: string, t: number): string {
  return toHex(toRgb(hex).map((v) => (t >= 0 ? v + (255 - v) * t : v * (1 + t))) as Rgb);
}

/** WCAG relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return toHex([f(0), f(8), f(4)]);
}

/**
 * The sparkle takes the opposite hue of the body so it never blends in, light or dark, whichever
 * stands out more. Greys have no opposite hue and get Steam green.
 */
export function sparkleFor(body: string): string {
  const [h, s] = toHsl(toRgb(body));
  if (s < 0.2) return '#a4d007';
  const [light, dark] = [fromHsl((h + 0.5) % 1, 0.9, 0.78), fromHsl((h + 0.5) % 1, 0.9, 0.42)];
  return contrast(light, body) >= contrast(dark, body) ? light : dark;
}

export interface ChestPalette {
  tile: string;
  outline: string;
  lid: string;
  body: string;
  band: string;
  sparkle: string;
}

export function chestPalette(colors: ChestColors = DEFAULT_CHEST): ChestPalette {
  const body = isHex(colors.body) ? colors.body : DEFAULT_CHEST.body;
  const band = isHex(colors.band) ? colors.band : DEFAULT_CHEST.band;
  // A dark outline disappears on the navy tile when the body is dark too; use a light one then.
  const outline = contrast(body, TILE) < 1.6 ? shade(body, 0.6) : shade(body, -0.75);
  return { tile: TILE, outline, lid: shade(body, 0.45), body, band, sparkle: sparkleFor(body) };
}

// o outline, l lid highlight, b body, g lock band, k keyhole. 12 × 10 cells at (2, 4) on the 16-cell grid.
const ROWS = [
  '..oooooooo..',
  '.ollllllllo.',
  'olbbbbbbbblo',
  'olbbbbbbbblo',
  'oggggggggggo',
  'oggggkkggggo',
  'obbbbkkbbbbo',
  'olbbbbbbbblo',
  'olbbbbbbbblo',
  'oooooooooooo',
];

export interface Cell {
  x: number;
  y: number;
  color: string;
}

/** The drawing as cells on the 16 × 16 grid (the tile itself is not included). */
export function chestCells(colors: ChestColors = DEFAULT_CHEST): Cell[] {
  const p = chestPalette(colors);
  const fill: Record<string, string> = { o: p.outline, l: p.lid, b: p.body, g: p.band, k: p.outline };
  const cells: Cell[] = [];
  ROWS.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== '.') cells.push({ x: x + 2, y: y + 4, color: fill[c]! });
    }),
  );
  // A small plus-shaped sparkle above the lid, with a white centre.
  for (const [x, y] of [[13, 0], [12, 1], [14, 1], [13, 2]] as const) cells.push({ x, y, color: p.sparkle });
  cells.push({ x: 13, y: 1, color: '#ffffff' });
  return cells;
}

/** SVG markup (16-unit viewBox). Colours are validated hex values, so the string is safe to insert. */
export function chestSvg(colors: ChestColors = DEFAULT_CHEST, size = 32, tile = true): string {
  const rects = chestCells(colors)
    .map((c) => `<rect x="${c.x}" y="${c.y}" width="1" height="1" fill="${c.color}"/>`)
    .join('');
  const bg = tile ? `<rect width="16" height="16" rx="2.5" fill="${TILE}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${bg}${rects}</svg>`;
}

type Ctx = Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect' | 'clearRect' | 'beginPath' | 'roundRect' | 'fill'>;

/** Draws the chest onto a canvas of `size` × `size` px (a multiple of 16 keeps it crisp). */
export function drawChest(ctx: Ctx, colors: ChestColors, size: number): void {
  const u = size / 16;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = TILE;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 2.5 * u);
  ctx.fill();
  for (const c of chestCells(colors)) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x * u, c.y * u, u, u);
  }
}
