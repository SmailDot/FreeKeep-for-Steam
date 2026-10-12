import type { FreeSub, PromoKind } from './types';

export const STORE = 'https://store.steampowered.com';
/**
 * FreeKeep's one required site. Users can still turn it off: Firefox lists it under the add-on's
 * permissions, Chrome under site access. Runs then stop early with `NO_STORE_ACCESS`.
 */
export const STORE_ORIGIN = 'https://store.steampowered.com/*';
export const NO_STORE_ACCESS = 'no_store_access';
/** Only requested when the user picks automatic login renewal in the options page. */
export const LOGIN_ORIGIN = 'https://login.steampowered.com/*';

/**
 * Steam's own renewal address: the store sends a browser here once its 24-hour login has lapsed.
 * With Steam's long-lived login cookie (on login.steampowered.com) it issues a new store login and
 * redirects back to `redir`; without it, it just redirects back.
 */
export const RENEW_URL = `https://login.steampowered.com/jwt/refresh?redir=${encodeURIComponent(`${STORE}/?l=english`)}`;

/** Steam's own package naming for limited-time free-to-keep promotions. */
const LIMITED_PROMO = /Limited Free Promotional Package/i;

export interface Session {
  loggedIn: boolean;
  sessionid: string | null;
  country: string | null;
  /** How the check came out, for diagnostics. Holds no account data. */
  probe?: SessionProbe;
}

export interface SessionProbe {
  status: number;
  /** Path of the final URL, so a redirect (login wall, error page) shows up. */
  path: string;
  redirected: boolean;
  bytes: number;
  accountIdSet: boolean;
  userInfoLoggedIn: boolean | null;
  sessionIdFound: boolean;
  /**
   * Whether the browser attached Steam's cookies at all. Only measured when logged out: Steam echoes
   * the sessionid cookie into the page, so with cookies two loads show the same value and without
   * them each load gets a new one. The values are compared in memory and never stored.
   */
  cookiesSent: boolean | null;
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

/** Only https image URLs reach the popup; anything else becomes the placeholder. */
export function imageUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
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
      const subid = Number(sub.packageid);
      if (!Number.isInteger(subid) || subid <= 0) continue;
      subs.push({
        subid,
        appid,
        name: String(d.name ?? `App ${appid}`),
        kind: kindOf(d.type),
        baseAppid: d.fullgame?.appid ? Number(d.fullgame.appid) : null,
        baseName: d.fullgame?.name ?? null,
        capsule: imageUrl(d.header_image),
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
    const first = await this.loadSession();
    if (first.loggedIn) return { ...first, probe: { ...first.probe!, cookiesSent: true } };
    const second = first.sessionid ? await this.loadSession() : null;
    const cookiesSent = second?.sessionid ? second.sessionid === first.sessionid : null;
    return { ...first, probe: { ...first.probe!, cookiesSent } };
  }

  private async loadSession(): Promise<Session> {
    const res = await this.get(`${STORE}/?l=english`, true);
    const html = await res.text();
    const session = parseSession(html);
    const userInfo = parseUserInfo(html);
    let path = '/';
    try {
      path = new URL(res.url).pathname;
    } catch {
      // Mocked responses have no URL.
    }
    return {
      ...session,
      probe: {
        status: res.status,
        path,
        redirected: res.redirected,
        bytes: html.length,
        accountIdSet: /g_AccountID\s*=\s*[1-9]/.test(html),
        userInfoLoggedIn: typeof userInfo?.logged_in === 'boolean' ? userInfo.logged_in : null,
        sessionIdFound: session.sessionid !== null,
        cookiesSent: null,
      },
    };
  }

  /**
   * Walks Steam's renewal redirect the way a page visit does. The browser sends and stores the login
   * cookies itself; FreeKeep never sees them, and the caller checks the session again afterwards.
   */
  async renew(): Promise<void> {
    const res = await this.fetchImpl(RENEW_URL, { credentials: 'include', cache: 'no-store' });
    await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} /jwt/refresh`);
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
