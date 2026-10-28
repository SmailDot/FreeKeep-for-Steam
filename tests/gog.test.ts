import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GogClient, giveawaySections, gogHome, gogLocale, gogThumbnail, parseCatalog, parseGiveaway } from '@/core/gog';

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
// Real responses from 2026-10-28, when no giveaway was running.
const home = load('gog-home-sections.json');
const catalog = load('gog-catalog.json');
const NOW = Date.parse('2026-10-28T06:00:00Z');
const COVER = 'https://images.gog-statics.com/1b7797edd8854601deb3a09f7e81f3c7ee89c93f00bbca9a9fef809e8ba498e9.png';

/**
 * A giveaway section as GOG's own banner reads it (`properties.product.title/slug/coverHorizontal`
 * and `properties.endDate`). No giveaway was running while this was written, so the shape comes
 * from the banner's code rather than a recorded response.
 */
const giveaway = (endDate = '2026-10-30T13:00:00+00:00') => ({
  properties: {
    sectionId: 'g1',
    product: { title: 'Bounty Train', slug: 'bounty-train', coverHorizontal: COVER },
    endDate,
  },
  colors: [],
});
const withGiveaway = { ...home, sections: [...home.sections, { sectionType: 'GIVEAWAY_SECTION', sectionId: 'g1' }] };

/** The first real product, discounted to 0 (a 100%-off deal). */
const freeDeal = () => {
  const p = structuredClone(catalog.products[0]);
  p.price.finalMoney.amount = '0.00';
  return p;
};

describe('gogLocale', () => {
  it('maps the browser language to one of GOG’s store languages', () => {
    expect(gogLocale('zh-TW')).toBe('zh-Hans');
    expect(gogLocale('de')).toBe('de-DE');
    expect(gogLocale('pt_BR')).toBe('en-US');
    expect(gogHome('zh-Hans')).toBe('https://www.gog.com/zh/');
  });
});

describe('giveawaySections', () => {
  it('finds nothing on the real home page without a giveaway', () => {
    expect(giveawaySections(home)).toEqual([]);
  });

  it('finds a giveaway section', () => {
    expect(giveawaySections(withGiveaway)).toEqual(['g1']);
  });

  it('rejects an unknown format instead of reporting "no giveaway"', () => {
    expect(() => giveawaySections({ pages: [] })).toThrow();
  });
});

describe('parseGiveaway', () => {
  it('reads the product and end date like GOG’s banner does', () => {
    expect(parseGiveaway(giveaway(), 'g1', 'en-US', NOW)).toEqual({
      id: 'giveaway:bounty-train',
      title: 'Bounty Train',
      kind: 'game',
      url: 'https://www.gog.com/en/',
      image: COVER.replace('.png', '_giveaway_381x223.jpg'),
      start: NOW,
      end: Date.parse('2026-10-30T13:00:00Z'),
      upcoming: false,
      deal: 'giveaway',
      slug: 'bounty-train',
    });
  });

  it('drops a giveaway that has already ended', () => {
    expect(parseGiveaway(giveaway('2026-10-05T13:00:00Z'), 'g1', 'en-US', NOW)).toBeNull();
  });

  it('still reports a giveaway whose details can’t be read', () => {
    expect(parseGiveaway(null, 'g1', 'de-DE', NOW)).toMatchObject({
      id: 'giveaway:g1',
      title: 'GOG giveaway',
      url: 'https://www.gog.com/de/',
      image: null,
      end: null,
    });
  });
});

describe('parseCatalog', () => {
  it('ignores real discounts that aren’t free and permanently free games', () => {
    expect(parseCatalog(catalog, 'en-US', NOW)).toEqual([]);
  });

  it('reports a game discounted to 0', () => {
    const p = freeDeal();
    expect(parseCatalog({ products: [p] }, 'en-US', NOW)).toEqual([
      {
        id: `deal:${p.id}`,
        title: 'Dead Age 1 + 2 Bundle',
        kind: 'bundle',
        url: 'https://www.gog.com/en/game/dead_age_1_2_bundle',
        image: p.coverHorizontal.replace('.png', '_giveaway_381x223.jpg'),
        start: NOW,
        end: null,
        upcoming: false,
        deal: 'discount',
        slug: 'dead_age_1_2_bundle',
      },
    ]);
  });

  it('only links into GOG’s store', () => {
    const p = { ...freeDeal(), storeLink: 'https://evil.example/game/x' };
    expect(parseCatalog({ products: [p] }, 'de-DE', NOW)[0]!.url).toBe('https://www.gog.com/de/game/dead_age_1_2_bundle');
  });
});

describe('gogThumbnail', () => {
  it('asks GOG’s CDN for a small JPEG and refuses other hosts', () => {
    expect(gogThumbnail('https://images.gog-statics.com/abc0123456789abcdef0123456789_{formatter}.jpg')).toBe(
      'https://images.gog-statics.com/abc0123456789abcdef0123456789_giveaway_381x223.jpg',
    );
    expect(gogThumbnail('https://evil.example/a.png')).toBeNull();
    expect(gogThumbnail('http://images.gog-statics.com/a.png')).toBeNull();
    expect(gogThumbnail(undefined)).toBeNull();
  });
});

describe('GogClient', () => {
  type Routes = Record<string, unknown | Error>;
  function client(routes: Routes) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const key = Object.keys(routes).find((k) => url.includes(k));
      const body = key === undefined ? new Error('404') : routes[key];
      if (body instanceof Error) return new Response('', { status: 404 });
      return new Response(JSON.stringify(body), { status: 200 });
    };
    return { calls, api: new GogClient('zh-Hans', fetchImpl) };
  }

  it('sends anonymous requests with only the language', async () => {
    const { calls, api } = client({ '/v1/pages/2f?': home, 'catalog.gog.com': catalog });
    expect(await api.freeGames(NOW)).toEqual({ current: [], upcoming: [] });
    expect(calls.map((c) => c.url)).toEqual([
      'https://sections.gog.com/v1/pages/2f?locale=zh-Hans',
      'https://catalog.gog.com/v1/catalog?limit=48&price=between:0,0&discounted=eq:true&productType=in:game,pack,dlc&order=desc:trending&locale=zh-Hans',
    ]);
    expect(calls.every((c) => c.init?.credentials === 'omit')).toBe(true);
  });

  it('lists the giveaway first and doesn’t repeat it as a deal', async () => {
    const twin = { ...freeDeal(), slug: 'bounty-train', title: 'Bounty Train' };
    const other = freeDeal();
    const { api } = client({ '/v1/pages/2f?': withGiveaway, '/sections/g1': giveaway(), 'catalog.gog.com': { products: [twin, other] } });
    const { current } = await api.freeGames(NOW);
    expect(current.map((o) => [o.deal, o.title])).toEqual([
      ['giveaway', 'Bounty Train'],
      ['discount', 'Dead Age 1 + 2 Bundle'],
    ]);
  });

  it('keeps the giveaway when the catalog fails, and fails only when both do', async () => {
    const { api } = client({ '/v1/pages/2f?': withGiveaway, '/sections/g1': giveaway() });
    expect((await api.freeGames(NOW)).current.map((o) => o.title)).toEqual(['Bounty Train']);
    await expect(client({}).api.freeGames(NOW)).rejects.toThrow('GOG HTTP 404');
  });
});
