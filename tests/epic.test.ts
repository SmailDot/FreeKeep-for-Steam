import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EPIC_FREE_GAMES, EpicClient, parseEpic, resolveSlug, thumbnail } from '@/core/epic';

const feed = JSON.parse(readFileSync(new URL('./fixtures/epic-free-games.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-10-10T00:00:00Z');

const promo = (start: string, end: string, pct = 0) => [
  { promotionalOffers: [{ startDate: start, endDate: end, discountSetting: { discountPercentage: pct } }] },
];
const feedOf = (...elements: object[]) => ({ data: { Catalog: { searchStore: { elements } } } });

describe('parseEpic with the real feed', () => {
  const { current, upcoming } = parseEpic(feed, NOW);

  it('finds the giveaways running now', () => {
    expect(current.map((o) => o.title).sort()).toEqual(['Out of Sight', 'TerraScape']);
    const out = current.find((o) => o.title === 'Out of Sight')!;
    expect(out).toMatchObject({
      kind: 'game',
      upcoming: false,
      url: 'https://store.epicgames.com/p/out-of-sight-b96ca8',
      start: Date.parse('2026-10-08T15:00:00.000Z'),
      end: Date.parse('2026-10-15T15:00:00.000Z'),
    });
    expect(out.image).toMatch(/^https:\/\/cdn1\.epicgames\.com\/.+\?resize=1&w=360&quality=medium$/);
    expect(out.id).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it('lists next week as upcoming', () => {
    expect(upcoming.map((o) => o.title).sort()).toEqual(['Agent A: A puzzle in disguise', 'Bad Cheese']);
    expect(upcoming.every((o) => o.upcoming && o.start > NOW)).toBe(true);
  });

  it('ignores items that are only discounted or always priced', () => {
    const titles = [...current, ...upcoming].map((o) => o.title);
    expect(titles).not.toContain('Ghostrunner 2');
    expect(titles).not.toContain("Them's Fightin' Herds");
  });

  it('moves offers from upcoming to current when their week starts', () => {
    const later = parseEpic(feed, Date.parse('2026-10-16T00:00:00Z'));
    expect(later.current.map((o) => o.title).sort()).toEqual(['Agent A: A puzzle in disguise', 'Bad Cheese']);
    expect(later.upcoming).toEqual([]);
  });
});

describe('parseEpic edge cases', () => {
  it('skips 50% promotions', () => {
    const el = { id: 'a', namespace: 'n', title: 'Half', offerType: 'BASE_GAME', promotions: { promotionalOffers: promo('2026-10-01T00:00:00Z', '2026-10-20T00:00:00Z', 50) } };
    expect(parseEpic(feedOf(el), NOW).current).toEqual([]);
  });

  it('builds bundle URLs and falls back to the free games hub without a slug', () => {
    const live = promo('2026-10-01T00:00:00Z', '2026-10-20T00:00:00Z');
    const bundle = { id: 'b', namespace: 'n', title: 'Pack', offerType: 'BUNDLE', productSlug: 'cool-pack', promotions: { promotionalOffers: live } };
    const mystery = { id: 'm', namespace: 'n', title: 'Mystery Game', offerType: 'BASE_GAME', productSlug: '[]', promotions: { promotionalOffers: live } };
    const [a, b] = parseEpic(feedOf(bundle, mystery), NOW).current;
    expect(a).toMatchObject({ kind: 'bundle', url: 'https://store.epicgames.com/bundle/cool-pack' });
    expect(b).toMatchObject({ kind: 'game', url: EPIC_FREE_GAMES });
  });

  it('lists a game only once when Epic reports it twice during the changeover', () => {
    const live = promo('2026-10-01T00:00:00Z', '2026-10-20T00:00:00Z');
    const next = { upcomingPromotionalOffers: promo('2026-10-20T00:00:00Z', '2026-10-27T00:00:00Z') };
    const one = { id: '1', namespace: 'n', title: 'Twice', promotions: { promotionalOffers: live } };
    const two = { id: '2', namespace: 'n', title: 'Twice', promotions: next };
    const { current, upcoming } = parseEpic(feedOf(one, two), NOW);
    expect(current).toHaveLength(1);
    expect(upcoming).toHaveLength(0);
  });

  it('tolerates an empty or broken feed', () => {
    expect(parseEpic({}, NOW)).toEqual({ current: [], upcoming: [] });
    expect(parseEpic(null, NOW)).toEqual({ current: [], upcoming: [] });
  });
});

describe('resolveSlug', () => {
  it('prefers page mappings and strips a /home suffix', () => {
    expect(resolveSlug({ productSlug: 'cardpocalypse/home' })).toBe('cardpocalypse');
    expect(resolveSlug({ productSlug: 'old', catalogNs: { mappings: [{ pageSlug: 'new', pageType: 'productHome' }] } })).toBe('new');
    expect(resolveSlug({})).toBeNull();
  });
});

describe('thumbnail', () => {
  it('asks Epic\'s CDN for a small JPEG and leaves other hosts alone', () => {
    expect(thumbnail('https://cdn1.epicgames.com/a/b.png')).toBe('https://cdn1.epicgames.com/a/b.png?resize=1&w=360&quality=medium');
    expect(thumbnail('https://cdn1.epicgames.com/a/b.png?h=1')).toBe('https://cdn1.epicgames.com/a/b.png?h=1');
    expect(thumbnail('https://cdn2.unrealengine.com/x.jpg')).toBe('https://cdn2.unrealengine.com/x.jpg');
  });

  it('drops missing, broken and non-https URLs', () => {
    expect(thumbnail(undefined)).toBeNull();
    expect(thumbnail('not a url')).toBeNull();
    expect(thumbnail('http://cdn1.epicgames.com/a.png')).toBeNull();
    expect(thumbnail('javascript:alert(1)')).toBeNull();
  });
});

describe('EpicClient', () => {
  it('sends an anonymous request and parses it', async () => {
    let init: RequestInit | undefined;
    const client = new EpicClient(async (_url, i) => {
      init = i;
      return new Response(JSON.stringify(feed), { status: 200 });
    });
    const { current } = await client.freeGames(NOW);
    expect(current).toHaveLength(2);
    expect(init?.credentials).toBe('omit');
  });

  it('throws on HTTP errors', async () => {
    const client = new EpicClient(async () => new Response('', { status: 503 }));
    await expect(client.freeGames(NOW)).rejects.toThrow('Epic HTTP 503');
  });
});
