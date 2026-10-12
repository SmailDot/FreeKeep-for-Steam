import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pixelSafe } from '@/lib/pixel';

const dir = new URL('../public/_locales/', import.meta.url);
const LANGS = ['en', 'zh-TW', 'zh-CN', 'de', 'es', 'fr', 'ja', 'ko', 'pl', 'pt-BR', 'ru', 'tr'];

describe('subset pixel fonts', () => {
  // If this fails, interface text changed: run `npm run fonts` to rebuild the subsets.
  it.each(readdirSync(dir))('cover every interface string in %s', (locale) => {
    const messages = JSON.parse(readFileSync(new URL(`${locale}/messages.json`, dir), 'utf8')) as Record<string, { message: string }>;
    const missing = Object.entries(messages).filter(([, m]) => !pixelSafe(m.message)).map(([k]) => k);
    expect(missing).toEqual([]);
  });

  it('cover the relative times shown in the status chips', () => {
    for (const lang of LANGS) {
      const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
      for (const unit of ['minute', 'hour', 'day'] as const) {
        for (const n of [-1, -2, -5, -30, 0, 1]) expect(pixelSafe(rtf.format(n, unit)), `${lang} ${n} ${unit}`).toBe(true);
      }
    }
  });

  it('keep English, accented and Cyrillic game titles in pixels but not unknown CJK ones', () => {
    expect(pixelSafe('Star Forge: Captain Pack')).toBe(true);
    expect(pixelSafe('Café Rêverie')).toBe(true);
    expect(pixelSafe('Пиксельный рыцарь')).toBe(true);
    expect(pixelSafe('霧港夜話')).toBe(false);
  });
});
