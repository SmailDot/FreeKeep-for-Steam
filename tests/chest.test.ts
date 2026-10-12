import { describe, expect, it } from 'vitest';
import { CHEST_PRESETS, DEFAULT_CHEST, TILE, chestCells, chestPalette, chestSvg, contrast, isHex, sparkleFor } from '@/lib/chest';
import { normalizeSettings } from '@/lib/storage';

describe('chest icon', () => {
  it('stays on the 16-cell grid so it is crisp at 16 px', () => {
    for (const c of chestCells(DEFAULT_CHEST)) {
      expect(Number.isInteger(c.x) && c.x >= 0 && c.x < 16).toBe(true);
      expect(Number.isInteger(c.y) && c.y >= 0 && c.y < 16).toBe(true);
    }
  });

  it('gives every preset a sparkle that stands out from the body', () => {
    for (const p of CHEST_PRESETS) {
      expect(contrast(sparkleFor(p.body), p.body), p.id).toBeGreaterThan(1.5);
    }
  });

  it('uses Steam green for grey bodies, which have no opposite hue', () => {
    expect(sparkleFor('#3a3f48')).toBe('#a4d007');
  });

  it('switches to a light outline when the body is as dark as the tile', () => {
    const dark = chestPalette({ body: '#1c2a3a', band: '#ffcd75' });
    expect(contrast(dark.outline, TILE)).toBeGreaterThan(2);
    const normal = chestPalette(DEFAULT_CHEST);
    expect(contrast(normal.outline, normal.body)).toBeGreaterThan(2);
  });

  it('never puts anything but validated colours into the SVG', () => {
    const svg = chestSvg({ body: '"><script>alert(1)</script>', band: 'red' });
    expect(svg).not.toContain('script');
    expect(svg).toContain(DEFAULT_CHEST.body);
    expect(isHex('#A4d007')).toBe(true);
    expect(isHex('#a4d00')).toBe(false);
  });

  it('falls back to the default colours for invalid settings', () => {
    const s = normalizeSettings({ chestBody: 'url(x)', chestBand: '#123456' });
    expect(s.chestBody).toBe(DEFAULT_CHEST.body);
    expect(s.chestBand).toBe('#123456');
  });
});
