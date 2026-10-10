import type { FreeSub, PromoKind } from './types';

export const STORE = 'https://store.steampowered.com';

/** Steam's own package naming for limited-time free-to-keep promotions. */
const LIMITED_PROMO = /Limited Free Promotional Package/i;

export interface Session {
  loggedIn: boolean;
  sessionid: string | null;
  country: string | null;
}

export interface Owned {
  apps: Set<number>;
  packages: Set<number>;
}

export type ClaimOutcome =
  | { kind: 'claimed' }
  | { kind: 'owned' }
  | { kind: 'needs_base' }
  | { kind: 'logged_out' }
  | { kind: 'error'; code: string };

/** The store's `data-userinfo` attribute, e.g. {"logged_in":false,"country_code":"US"}. */
function parseUserInfo(html: string): { logged_in?: unknown; country_code?: unknown } | null {
  const raw = html.match(/data-userinfo="([^"]*)"/)?.[1];
  if (!raw) return null;
  try {
    return JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  } catch {
    return null;
  }
}

/**
 * Reads login state, CSRF session id and store country from any store page. Login is taken from
 * `g_AccountID` or, should Steam stop filling that in, from the `data-userinfo` attribute.
 */
export function parseSession(html: string): Session {
  const accountId = Number(html.match(/g_AccountID\s*=\s*(\d+)/)?.[1] ?? 0);
  const userInfo = parseUserInfo(html);
  const userCountry = typeof userInfo?.country_code === 'string' ? userInfo.country_code : null;
  return {
    loggedIn: accountId > 0 || userInfo?.logged_in === true,
    sessionid: html.match(/g_sessionID\s*=\s*"([0-9a-f]+)"/i)?.[1] ?? null,
    country:
      html.match(/(?:&quot;|")COUNTRY(?:&quot;|"):(?:&quot;|")([A-Z]{2})/)?.[1] ??
      (userCountry && /^[A-Z]{2}$/.test(userCountry) ? userCountry : null),
  };
}

/** The search JSON has no app ids, only capsule URLs that contain them. */
export function parseSearchAppIds(json: unknown): number[] {
  const items = (json as { items?: { logo?: string }[] })?.items ?? [];
  const ids = items
    .map((it) => it.logo?.match(/\/apps\/(\d+)\//)?.[1])
    .filter((id): id is string => Boolean(id))
    .map(Number);
  return [...new Set(ids)];
}

function kindOf(type: string | undefined): PromoKind {
  if (type === 'game') return 'game';
  if (type === 'dlc' || type === 'music') return 'dlc';
  return 'other';
}

/** Returns the limited free promotional packages listed on an app's store data. */
export function parseAppDetails(appid: number, json: unknown): FreeSub[] {
  const entry = (json as Record<string, { success?: boolean; data?: any }>)?.[String(appid)];
  if (!entry?.success || !entry.data) return [];
  const d = entry.data;
  const subs: FreeSub[] = [];
  for (const group of d.package_groups ?? []) {
    for (const sub of group.subs ?? []) {
      const isFree = sub.is_free_license === true && sub.price_in_cents_with_discount === 0;
      if (!isFree || !LIMITED_PROMO.test(sub.option_text ?? '')) continue;
      subs.push({
        subid: Number(sub.packageid),
        appid,
        name: String(d.name ?? `App ${appid}`),
        kind: kindOf(d.type),
        baseAppid: d.fullgame?.appid ? Number(d.fullgame.appid) : null,
        baseName: d.fullgame?.name ?? null,
        capsule: d.header_image ?? null,
      });
    }
  }
  return subs;
}

/** e.g. "Free to keep when you get it before 12 Oct @ 10:00am." */
export function parseEndsText(html: string): string | null {
  const text = html.match(/Free to keep when you get it before[^<]*?\./i)?.[0];
  return text ? text.replace(/\s+/g, ' ').trim() : null;
}

export function parseOwned(json: unknown): Owned {
  const d = json as { rgOwnedApps?: number[]; rgOwnedPackages?: number[] };
  return { apps: new Set(d?.rgOwnedApps ?? []), packages: new Set(d?.rgOwnedPackages ?? []) };
}

/**
 * Maps the response of /freelicense/addfreelicense/<subid> (ajax) to an outcome.
 * Error codes come from Steam's own AddFreeLicense(): 9 = already owned, 24 = base game required.
 */
export function classifyClaim(status: number, body: string): ClaimOutcome {
  if (status >= 200 && status < 300) return { kind: 'claimed' };
  if (status === 401) return { kind: 'logged_out' };
  let detail: unknown = null;
  try {
    detail = (JSON.parse(body) as { purchaseresultdetail?: unknown } | null)?.purchaseresultdetail ?? null;
  } catch {
    // non-JSON body
  }
  if (detail === 9) return { kind: 'owned' };
  if (detail === 24) return { kind: 'needs_base' };
  return { kind: 'error', code: detail == null ? `http_${status}` : `http_${status}:${detail}` };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class SteamClient {
  constructor(private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init)) {}

  private async get(url: string, withLogin: boolean): Promise<Response> {
    const res = await this.fetchImpl(url, {
      credentials: withLogin ? 'include' : 'omit',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).pathname}`);
    return res;
  }

  async session(): Promise<Session> {
    return parseSession(await (await this.get(`${STORE}/?l=english`, true)).text());
  }

  async searchFreeAppIds(cc: string): Promise<number[]> {
    const url = `${STORE}/search/results/?specials=1&maxprice=free&json=1&count=100&l=english&cc=${cc}`;
    return parseSearchAppIds(await (await this.get(url, false)).json());
  }

  async freeSubs(appid: number, cc: string): Promise<FreeSub[]> {
    const url = `${STORE}/api/appdetails?appids=${appid}&l=english&cc=${cc}`;
    return parseAppDetails(appid, await (await this.get(url, false)).json());
  }

  async endsText(appid: number, cc: string): Promise<string | null> {
    // With login cookies, an age gate the user already passed won't hide the purchase block.
    const url = `${STORE}/app/${appid}/?l=english&cc=${cc}`;
    return parseEndsText(await (await this.get(url, true)).text());
  }

  async owned(): Promise<Owned> {
    return parseOwned(await (await this.get(`${STORE}/dynamicstore/userdata/?t=${Date.now()}`, true)).json());
  }

  async claim(subid: number, sessionid: string): Promise<ClaimOutcome> {
    const res = await this.fetchImpl(`${STORE}/freelicense/addfreelicense/${subid}`, {
      method: 'POST',
      credentials: 'include',
      body: new URLSearchParams({ ajax: 'true', sessionid }),
    });
    return classifyClaim(res.status, await res.text());
  }
}
