import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  classifyClaim,
  parseAppDetails,
  parseEndsText,
  parseOwned,
  parseSearchAppIds,
  parseSession,
  SteamClient,
} from '@/core/steam';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const json = (name: string) => JSON.parse(fixture(name));

describe('parseSession', () => {
  it('reads a logged-out store page', () => {
    expect(parseSession(fixture('home-logged-out.html'))).toEqual({
      loggedIn: false,
      sessionid: '0123456789abcdef01234567',
      country: 'US',
    });
  });

  it('treats a non-zero account id as logged in', () => {
    const html = 'g_sessionID = "abcdef0123456789abcdef01"; g_AccountID = 12345; "COUNTRY":"TW"';
    expect(parseSession(html)).toEqual({ loggedIn: true, sessionid: 'abcdef0123456789abcdef01', country: 'TW' });
  });

  it('also trusts the data-userinfo attribute', () => {
    const html =
      'g_AccountID = 0; g_sessionID = "abcdef0123456789abcdef01"; ' +
      '<div data-userinfo="{&quot;logged_in&quot;:true,&quot;country_code&quot;:&quot;TW&quot;}">';
    expect(parseSession(html)).toEqual({ loggedIn: true, sessionid: 'abcdef0123456789abcdef01', country: 'TW' });
  });

  it('ignores a broken data-userinfo attribute', () => {
    const html = 'g_AccountID = 0; <div data-userinfo="{not json">';
    expect(parseSession(html)).toEqual({ loggedIn: false, sessionid: null, country: null });
  });

  it('returns nulls for an unexpected page', () => {
    expect(parseSession('<html></html>')).toEqual({ loggedIn: false, sessionid: null, country: null });
  });
});

describe('parseSearchAppIds', () => {
  it('extracts unique app ids from capsule URLs', () => {
    const ids = parseSearchAppIds(json('search.json'));
    expect(ids).toContain(405640);
    expect(ids).toContain(2283211);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tolerates missing items', () => {
    expect(parseSearchAppIds({})).toEqual([]);
    expect(parseSearchAppIds(null)).toEqual([]);
  });
});

describe('parseAppDetails', () => {
  it('finds the limited free promotional package of a game', () => {
    expect(parseAppDetails(405640, json('appdetails-405640.json'))).toEqual([
      expect.objectContaining({ subid: 1857153, appid: 405640, name: 'Pony Island', kind: 'game', baseAppid: null }),
    ]);
  });

  it('links a DLC promo to its base game', () => {
    expect(parseAppDetails(2283211, json('appdetails-2283211.json'))).toEqual([
      expect.objectContaining({ subid: 1869099, kind: 'dlc', baseAppid: 552990, baseName: 'World of Warships' }),
    ]);
  });

  it('ignores free packages that are not limited promotions', () => {
    const details = json('appdetails-405640.json');
    for (const group of details['405640'].data.package_groups) {
      for (const sub of group.subs) sub.option_text = 'Pony Island - Free';
    }
    expect(parseAppDetails(405640, details)).toEqual([]);
  });

  it('returns nothing for a failed lookup', () => {
    expect(parseAppDetails(1, { '1': { success: false } })).toEqual([]);
  });
});

describe('parseEndsText', () => {
  it('extracts the free-to-keep deadline', () => {
    expect(parseEndsText(fixture('app-page-405640.html'))).toBe('Free to keep when you get it before 12 Oct @ 10:00am.');
  });

  it('returns null when absent', () => {
    expect(parseEndsText('<p>Buy now</p>')).toBeNull();
  });
});

describe('parseOwned', () => {
  it('builds sets of owned apps and packages', () => {
    const owned = parseOwned({ rgOwnedApps: [1, 2], rgOwnedPackages: [3] });
    expect(owned.apps.has(2)).toBe(true);
    expect(owned.packages.has(3)).toBe(true);
  });
});

describe('classifyClaim', () => {
  it.each([
    [200, '[]', { kind: 'claimed' }],
    [500, '{"purchaseresultdetail":9}', { kind: 'owned' }],
    [500, '{"purchaseresultdetail":24}', { kind: 'needs_base' }],
    [401, 'null', { kind: 'logged_out' }],
    [404, 'null', { kind: 'error', code: 'http_404' }],
    [500, '{"purchaseresultdetail":53}', { kind: 'error', code: 'http_500:53' }],
    [502, '<html>', { kind: 'error', code: 'http_502' }],
  ])('HTTP %i %s', (status, body, expected) => {
    expect(classifyClaim(status, body)).toEqual(expected);
  });
});

describe('SteamClient.session', () => {
  const page = (html: string) =>
    (async () => new Response(html, { status: 200 })) as unknown as ConstructorParameters<typeof SteamClient>[0];

  it('reports how the login check came out, without account data', async () => {
    const html = 'g_AccountID = 0; g_sessionID = "abcdef0123456789abcdef01"; <div data-userinfo="{&quot;logged_in&quot;:false}">';
    const session = await new SteamClient(page(html)).session();
    expect(session.loggedIn).toBe(false);
    expect(session.probe).toEqual({
      status: 200,
      path: '/',
      redirected: false,
      bytes: html.length,
      accountIdSet: false,
      userInfoLoggedIn: false,
      sessionIdFound: true,
      cookiesSent: true,
    });
  });

  it('tells when the browser sends no cookies: each load gets a new sessionid', async () => {
    let n = 0;
    const fetchImpl = (async () =>
      new Response(`g_AccountID = 0; g_sessionID = "${(n++ ? 'b' : 'a').repeat(24)}";`, { status: 200 })) as unknown as ConstructorParameters<
      typeof SteamClient
    >[0];
    const { probe, sessionid } = await new SteamClient(fetchImpl).session();
    expect(probe?.cookiesSent).toBe(false);
    expect(sessionid).toBe('a'.repeat(24));
  });

  it('reports cookies as sent when logged in, without a second load', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response('g_AccountID = 12345; g_sessionID = "abcdef0123456789abcdef01";', { status: 200 });
    }) as unknown as ConstructorParameters<typeof SteamClient>[0];
    const { probe } = await new SteamClient(fetchImpl).session();
    expect(probe?.cookiesSent).toBe(true);
    expect(calls).toBe(1);
  });

  it('shows a redirect away from the store front', async () => {
    const fetchImpl = (async () => {
      const res = new Response('<html></html>', { status: 200 });
      Object.defineProperty(res, 'url', { value: 'https://store.steampowered.com/login/?redir=' });
      Object.defineProperty(res, 'redirected', { value: true });
      return res;
    }) as unknown as ConstructorParameters<typeof SteamClient>[0];
    const { probe } = await new SteamClient(fetchImpl).session();
    expect(probe).toMatchObject({ path: '/login/', redirected: true, accountIdSet: false, userInfoLoggedIn: null });
  });
});
