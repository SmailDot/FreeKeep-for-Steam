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

/** SVG markup for a pixel icon, `scale` screen pixels per art pixel. */
export function pixelIcon(name: PixelIcon, scale = 2): string {
  const rows = BITMAPS[name];
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  let rects = '';
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '#') rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }),
  );
  return `<svg class="pi" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

/** Replaces every `<i data-pi="name">` placeholder inside `root` with its icon. */
export function fillPixelIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('i[data-pi]').forEach((el) => {
    const name = el.dataset.pi as PixelIcon;
    if (name in BITMAPS) el.outerHTML = pixelIcon(name, Number(el.dataset.scale ?? 2));
  });
}
