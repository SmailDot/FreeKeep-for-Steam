import type { Offer, OfferKind } from './types';

/**
 * GOG reminders. GOG can't be claimed automatically: its giveaway button posts with the user's GOG
 * access token, and a 100%-off game goes through GOG's checkout, so FreeKeep only tells the user.
 *
 * Two public, anonymous sources, both read without cookies:
 * - the home page's section list (sections.gog.com): a running giveaway is a `GIVEAWAY_SECTION`
 *   whose details hold the product and the end date, as read by GOG's own giveaway banner;
 * - the catalog (catalog.gog.com): games discounted to 0, which are claimed by checking out for free.
 */
export const GOG_ORIGINS = ['https://sections.gog.com/*', 'https://catalog.gog.com/*'];
export const GOG_STORE = 'https://www.gog.com';

/** The home page's id in GOG's section service. */
const HOME_PAGE = '2f';
const GIVEAWAY_SECTION = 'GIVEAWAY_SECTION';

/** GOG's store languages; anything else falls back to English, as on GOG's site. */
const LOCALES: Record<string, string> = { de: 'de-DE', fr: 'fr-FR', pl: 'pl-PL', ru: 'ru-RU', zh: 'zh-Hans' };

export function gogLocale(uiLanguage: string): string {
  const base = uiLanguage.toLowerCase().split(/[-_]/)[0] ?? '';
  return LOCALES[base] ?? 'en-US';
}

export const gogHome = (locale: string) => `${GOG_STORE}/${locale.split('-')[0]}/`;
const sectionsUrl = (locale: string) => `https://sections.gog.com/v1/pages/${HOME_PAGE}?locale=${encodeURIComponent(locale)}`;
const sectionUrl = (locale: string, id: string) =>
  `https://sections.gog.com/v1/pages/${HOME_PAGE}/sections/${encodeURIComponent(id)}?locale=${encodeURIComponent(locale)}`;
const catalogUrl = (locale: string) =>
  'https://catalog.gog.com/v1/catalog?limit=48&price=between:0,0&discounted=eq:true' +
  `&productType=in:game,pack,dlc&order=desc:trending&locale=${encodeURIComponent(locale)}`;

/**
 * GOG serves covers in named sizes: `<hash>.png` becomes `<hash>_giveaway_381x223.jpg`, the size
 * GOG's own giveaway banner uses on phones (about 40 KB instead of a multi-megabyte PNG).
 */
export function gogThumbnail(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url.replace('{formatter}', 'giveaway_381x223'));
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.gog-statics.com')) return null;
    u.pathname = u.pathname.replace(/^(\/[0-9a-f]{20,})(?:_[a-z0-9_]+)?\.(?:png|jpe?g|webp)$/i, '$1_giveaway_381x223.jpg');
    return u.href;
  } catch {
    return null;
  }
}

/** Product links as GOG's banner builds them: `/<language>/game/<slug>` with underscores. */
function productUrl(locale: string, slug: unknown): string | null {
  if (typeof slug !== 'string' || !/^[\w-]+$/.test(slug)) return null;
  return `${GOG_STORE}/${locale.split('-')[0]}/game/${slug.replace(/-/g, '_')}`;
}

/** Only links into GOG's own store are kept; anything else falls back to the home page. */
function storeLink(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'www.gog.com' ? u.href : null;
  } catch {
    return null;
  }
}

/** Ids of the giveaway sections on the home page; empty when no giveaway is running. */
export function giveawaySections(json: unknown): string[] {
  const sections = (json as { sections?: { sectionType?: unknown; sectionId?: unknown }[] })?.sections;
  if (!Array.isArray(sections)) throw new Error('GOG: unexpected page format');
  return sections
    .filter((s) => s?.sectionType === GIVEAWAY_SECTION && typeof s.sectionId === 'string')
    .map((s) => s.sectionId as string);
}

/**
 * One giveaway section. If its details can't be read, the giveaway is still reported (title
 * "GOG giveaway", link to the home page, where the banner is), so a format change can't hide it.
 */
export function parseGiveaway(json: unknown, sectionId: string, locale: string, now: number): Offer | null {
  const props = (json as { properties?: { product?: Record<string, unknown>; endDate?: unknown } })?.properties;
  const product = props?.product;
  const end = typeof props?.endDate === 'string' ? Date.parse(props.endDate) : NaN;
  if (Number.isFinite(end) && end <= now) return null; // ended; the section can linger in a cache
  const title = typeof product?.title === 'string' && product.title.trim() ? product.title.trim() : 'GOG giveaway';
  const slug = typeof product?.slug === 'string' ? product.slug : null;
  return {
    id: `giveaway:${slug ?? sectionId}`,
    title,
    kind: 'game',
    // The claim button is the banner on the home page, for logged-in users.
    url: gogHome(locale),
    image: gogThumbnail(product?.coverHorizontal),
    start: now,
    end: Number.isFinite(end) ? end : null,
    upcoming: false,
    deal: 'giveaway',
    ...(slug ? { slug } : {}),
  };
}

const KIND: Record<string, OfferKind> = { game: 'game', dlc: 'addon', pack: 'bundle' };

interface CatalogProduct {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  productType?: unknown;
  coverHorizontal?: unknown;
  storeLink?: unknown;
  price?: { finalMoney?: { amount?: unknown }; baseMoney?: { amount?: unknown } } | null;
}

/**
 * Games discounted to 0 right now. Permanently free games (demos, free-to-play) cost 0 before the
 * discount too and are left out: only a real 100% discount is a limited-time freebie.
 */
export function parseCatalog(json: unknown, locale: string, now: number): Offer[] {
  const products = (json as { products?: CatalogProduct[] })?.products;
  if (!Array.isArray(products)) throw new Error('GOG: unexpected catalog format');
  const offers: Offer[] = [];
  for (const p of products) {
    const final = Number(p?.price?.finalMoney?.amount);
    const base = Number(p?.price?.baseMoney?.amount);
    if (!(final === 0 && base > 0) || typeof p.title !== 'string' || !p.title.trim()) continue;
    offers.push({
      id: `deal:${String(p.id ?? p.slug)}`,
      title: p.title.trim(),
      kind: KIND[String(p.productType)] ?? 'other',
      url: storeLink(p.storeLink) ?? productUrl(locale, p.slug) ?? gogHome(locale),
      image: gogThumbnail(p.coverHorizontal),
      start: now,
      end: null,
      upcoming: false,
      deal: 'discount',
      ...(typeof p.slug === 'string' ? { slug: p.slug } : {}),
    });
  }
  return offers;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class GogClient {
  constructor(
    private readonly locale = 'en-US',
    private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init),
  ) {}

  /** Anonymous requests: no cookies, no GOG account, nothing beyond the language. */
  private async json(url: string): Promise<unknown> {
    const res = await this.fetchImpl(url, { credentials: 'omit', cache: 'no-store' });
    if (!res.ok) throw new Error(`GOG HTTP ${res.status}`);
    return res.json();
  }

  private async giveaways(now: number): Promise<Offer[]> {
    const ids = giveawaySections(await this.json(sectionsUrl(this.locale)));
    const offers = await Promise.all(
      ids.map((id) =>
        this.json(sectionUrl(this.locale, id))
          .catch(() => null)
          .then((json) => parseGiveaway(json, id, this.locale, now)),
      ),
    );
    return offers.filter((o): o is Offer => o !== null);
  }

  /**
   * Giveaways first, then 100%-off games that aren't also the giveaway. One source failing doesn't
   * hide the other; only both failing is an error.
   */
  async freeGames(now: number): Promise<{ current: Offer[]; upcoming: Offer[] }> {
    const [giveaways, deals] = await Promise.allSettled([
      this.giveaways(now),
      this.json(catalogUrl(this.locale)).then((json) => parseCatalog(json, this.locale, now)),
    ]);
    if (giveaways.status === 'rejected' && deals.status === 'rejected') throw giveaways.reason;
    const current = giveaways.status === 'fulfilled' ? giveaways.value : [];
    const taken = new Set(current.flatMap((o) => [o.slug, o.title]));
    for (const o of deals.status === 'fulfilled' ? deals.value : []) {
      if (!taken.has(o.slug) && !taken.has(o.title)) current.push(o);
    }
    return { current, upcoming: [] };
  }
}
