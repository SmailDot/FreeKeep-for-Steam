import { PIXEL_COVERAGE } from './pixel-coverage';

/** Small pixel-art icons for the popup and options page, drawn in `currentColor`. */
const BITMAPS = {
  bolt: ['.....##.', '....##..', '...##...', '..##....', '.######.', '....##..', '...##...', '..##....', '.##.....'],
  ask: ['#########', '#..###..#', '#.#...#.#', '#.....#.#', '#....#..#', '#...#...#', '#.......#', '#...#...#', '#########'],
  cursor: ['#.......', '##......', '###.....', '####....', '#####...', '######..', '###.....', '#.##....', '...##...', '...##...'],
  renew: ['...###...', '.##...#.#', '.#.....##', '#.....###', '#........', '........#', '###.....#', '##.....#.', '#.#...##.', '...###...'],
  bell: ['....#....', '..#####..', '.#######.', '.#######.', '.#######.', '.#######.', '#########', '.........', '...###...'],
  clock: ['..#####..', '.#.....#.', '#...#...#', '#...#...#', '#...###.#', '#.......#', '#.......#', '.#.....#.', '..#####..'],
  lock: ['..#####..', '.#.....#.', '.#.....#.', '.#.....#.', '#########', '#########', '####.####', '####.####', '#########', '#########'],
  key: ['.###......', '#...#.....', '#...######', '#...#..#.#', '.###...#.#'],
  star: ['....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'],
  gear: ['...#.#...', '.#######.', '.##...##.', '###.#.###', '.#.###.#.', '###.#.###', '.##...##.', '.#######.', '...#.#...'],
  check: ['........#', '.......##', '#.....##.', '##...##..', '.##.##...', '..###....', '...#.....'],
  eye: ['...###...', '.##...##.', '#...#...#', '#..###..#', '#...#...#', '.##...##.', '...###...'],
  palette: ['..#####..', '.#.....#.', '#.##..#.#', '#.##....#', '#.....###', '#.##.#...', '.#.......', '..######.'],
} as const;

export type PixelIcon = keyof typeof BITMAPS;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A pixel icon as an SVG element, `scale` screen pixels per art pixel. */
export function pixelIcon(name: PixelIcon, scale = 2): SVGSVGElement {
  const rows = BITMAPS[name];
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const svg = document.createElementNS(SVG_NS, 'svg');
  const attrs = { class: 'pi', width: w * scale, height: h * scale, viewBox: `0 0 ${w} ${h}`, fill: 'currentColor', 'shape-rendering': 'crispEdges', 'aria-hidden': 'true' };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, String(v));
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== '#') return;
      const rect = document.createElementNS(SVG_NS, 'rect');
      for (const [k, v] of Object.entries({ x, y, width: 1, height: 1 })) rect.setAttribute(k, String(v));
      svg.append(rect);
    }),
  );
  return svg;
}

const COVERED = new Set(PIXEL_COVERAGE);

/**
 * Whether the bundled (subset) pixel fonts can draw all of `text`. Game titles that can't, mostly
 * localized Epic titles, are shown entirely in the system font instead of mixing two fonts.
 */
export function pixelSafe(text: string): boolean {
  for (const c of text) if (!COVERED.has(c) && c.trim()) return false;
  return true;
}

/** Replaces every `<i data-pi="name">` placeholder inside `root` with its icon. */
export function fillPixelIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('i[data-pi]').forEach((el) => {
    const name = el.dataset.pi as PixelIcon;
    if (name in BITMAPS) el.replaceWith(pixelIcon(name, Number(el.dataset.scale ?? 2)));
  });
}
