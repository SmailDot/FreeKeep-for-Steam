import type { EpicKind, EpicOffer } from './types';

/** Epic's public giveaway feed. It sends no CORS headers, so reading it needs this host permission. */
export const epicApi = (locale: string) =>
  `https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=${encodeURIComponent(locale)}`;
export const EPIC_ORIGIN = 'https://store-site-backend-static-ipv4.ak.epicgames.com/*';
export const EPIC_STORE = 'https://store.epicgames.com';
export const EPIC_FREE_GAMES = `${EPIC_STORE}/free-games`;

interface Offer {
  startDate?: string;
  endDate?: string;
  discountSetting?: { discountPercentage?: number };
}

interface Element {
  id?: string;
  namespace?: string;
  title?: string;
  offerType?: string;
  productSlug?: string | null;
  catalogNs?: { mappings?: { pageSlug?: string; pageType?: string }[] | null };
  offerMappings?: { pageSlug?: string; pageType?: string }[] | null;
  categories?: { path?: string }[];
  keyImages?: { type?: string; url?: string }[];
  promotions?: {
    promotionalOffers?: { promotionalOffers?: Offer[] }[];
    upcomingPromotionalOffers?: { promotionalOffers?: Offer[] }[];
  } | null;
}

const SAME_CODE = ['ar', 'de', 'fr', 'it', 'ja', 'ko', 'pl', 'ru', 'th', 'tr'];

/**
 * Epic's store locale for the browser's UI language, so titles read as they do on Epic's site.
 * Ids, links and dates are the same in every locale; only names change.
 */
export function epicLocale(uiLanguage: string): string {
  const lang = uiLanguage.toLowerCase().replace(/_/g, '-');
  const [base = '', region = ''] = lang.split('-');
  if (base === 'zh') return /hant|tw|hk|mo/.test(lang) ? 'zh-Hant' : 'zh-CN';
  if (base === 'es') return region === '' || region === 'es' ? 'es-ES' : 'es-MX';
  if (base === 'pt') return 'pt-BR';
  return SAME_CODE.includes(base) ? base : 'en-US';
}

/** Free (100% off) offers inside a promotion group list. */
function freeOffers(groups: { promotionalOffers?: Offer[] }[] | undefined): { start: number; end: number }[] {
  return (groups ?? [])
    .flatMap((g) => g.promotionalOffers ?? [])
    .filter((o) => o.discountSetting?.discountPercentage === 0)
    .map((o) => ({ start: Date.parse(o.startDate ?? ''), end: Date.parse(o.endDate ?? '') }))
    .filter((o) => Number.isFinite(o.start) && Number.isFinite(o.end));
}

/**
 * The page slug. `productSlug` is a legacy path that can carry a "/home" suffix (a 404 if used as is),
 * so the page mappings come first and any slug is cut to its first path segment.
 */
export function resolveSlug(el: Element): string | null {
  const candidates = [
    ...(el.catalogNs?.mappings ?? []).filter((m) => m.pageType === 'productHome').map((m) => m.pageSlug),
    ...(el.offerMappings ?? []).filter((m) => m.pageType === 'productHome').map((m) => m.pageSlug),
    ...(el.catalogNs?.mappings ?? []).map((m) => m.pageSlug),
    el.productSlug,
  ];
  for (const candidate of candidates) {
    const slug = (candidate ?? '').trim().replace(/^\/+|\/+$/g, '').split('/')[0];
    if (slug && slug !== '[]') return slug;
  }
  return null;
}

function kindOf(el: Element): EpicKind {
  const isBundle = el.offerType === 'BUNDLE' || (el.categories ?? []).some((c) => c.path === 'bundles');
  if (isBundle) return 'bundle';
  if (el.offerType === 'BASE_GAME') return 'game';
  if (el.offerType === 'ADD_ON' || el.offerType === 'DLC') return 'addon';
  return 'other';
}

/**
 * Epic's key art can be a multi-megabyte PNG. Its image CDN scales on request, so the popup asks
 * for a small JPEG instead (about 15 KB for a 360 px wide banner).
 */
export function thumbnail(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    if (u.hostname.endsWith('.epicgames.com') && !u.search) {
      u.search = '?resize=1&w=360&quality=medium';
    }
    return u.href;
  } catch {
    return null;
  }
}

function toOffer(el: Element, window: { start: number; end: number }, upcoming: boolean): EpicOffer {
  const kind = kindOf(el);
  const slug = resolveSlug(el);
  const image = thumbnail(
    el.keyImages?.find((k) => k.type === 'OfferImageWide')?.url ??
      el.keyImages?.find((k) => k.type === 'Thumbnail')?.url ??
      el.keyImages?.[0]?.url,
  );
  return {
    id: `${el.namespace ?? ''}:${el.id ?? el.title ?? ''}`,
    title: el.title ?? 'Epic Games Store',
    kind,
    url: slug ? `${EPIC_STORE}/${kind === 'bundle' ? 'bundle' : 'p'}/${slug}` : EPIC_FREE_GAMES,
    image,
    start: window.start,
    end: window.end,
    upcoming,
  };
}

/** Splits the feed into giveaways running now and ones announced next; an offer is never in both. */
export function parseEpic(json: unknown, now: number): { current: EpicOffer[]; upcoming: EpicOffer[] } {
  const elements = ((json as any)?.data?.Catalog?.searchStore?.elements ?? []) as Element[];
  const current: EpicOffer[] = [];
  const upcoming: EpicOffer[] = [];
  // Keyed by id and by title: during the weekly changeover Epic can list the same game twice.
  const seen = new Set<string>();

  // Both groups are checked by date: right after the weekly switch the cached feed can still file
  // this week's games under "upcoming".
  const windows = (el: Element) => [
    ...freeOffers(el.promotions?.promotionalOffers),
    ...freeOffers(el.promotions?.upcomingPromotionalOffers),
  ];
  for (const el of elements) {
    const live = windows(el).find((o) => o.start <= now && now < o.end);
    if (!live) continue;
    const offer = toOffer(el, live, false);
    if (seen.has(offer.id) || seen.has(offer.title)) continue;
    seen.add(offer.id).add(offer.title);
    current.push(offer);
  }
  for (const el of elements) {
    const next = windows(el)
      .filter((o) => o.start > now)
      .sort((a, b) => a.start - b.start)[0];
    if (!next) continue;
    const offer = toOffer(el, next, true);
    if (seen.has(offer.id) || seen.has(offer.title)) continue; // already listed as free now
    seen.add(offer.id).add(offer.title);
    upcoming.push(offer);
  }
  return { current, upcoming };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class EpicClient {
  constructor(
    private readonly locale = 'en-US',
    private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init),
  ) {}

  /** Anonymous request: no cookies and no user data beyond the language, like any visitor sends. */
  async freeGames(now: number): Promise<{ current: EpicOffer[]; upcoming: EpicOffer[] }> {
    const res = await this.fetchImpl(epicApi(this.locale), { credentials: 'omit', cache: 'no-store' });
    if (!res.ok) throw new Error(`Epic HTTP ${res.status}`);
    return parseEpic(await res.json(), now);
  }
}
