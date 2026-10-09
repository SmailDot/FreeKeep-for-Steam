import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Messages = Record<string, { message: string; placeholders?: Record<string, { content: string }> }>;

const dir = new URL('../public/_locales/', import.meta.url);
const load = (locale: string): Messages => JSON.parse(readFileSync(new URL(`${locale}/messages.json`, dir), 'utf8'));
const english = load('en');
const locales = readdirSync(dir).filter((l) => l !== 'en');
const tokens = (s: string) => (s.match(/\$[A-Z_]+\$/gi) ?? []).map((t) => t.toLowerCase()).sort();

describe.each(locales)('locale %s', (locale) => {
  const messages = load(locale);

  it('has exactly the same keys as English', () => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(english).sort());
  });

  it('uses the same placeholders as English', () => {
    for (const [key, entry] of Object.entries(english)) {
      expect(tokens(messages[key]!.message), key).toEqual(tokens(entry.message));
      expect(messages[key]!.placeholders, key).toEqual(entry.placeholders);
    }
  });
});

it('keeps the store description within the 132 character limit', () => {
  for (const locale of ['en', ...locales]) {
    expect(load(locale).extDescription!.message.length, locale).toBeLessThanOrEqual(132);
  }
});
