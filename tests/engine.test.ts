import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_META, claimNow, runCheck, skip, type Deps, type Meta, type SteamApi } from '@/core/engine';
import type { ClaimOutcome, Session } from '@/core/steam';
import { DEFAULT_SETTINGS, type FreeSub, type PromoMap, type RunInfo, type Settings } from '@/core/types';

const GAME: FreeSub = { subid: 100, appid: 10, name: 'Game A', kind: 'game', baseAppid: null, baseName: null, capsule: null };
const DLC: FreeSub = { subid: 200, appid: 20, name: 'DLC B', kind: 'dlc', baseAppid: 99, baseName: 'Base', capsule: null };

class FakeSteam implements SteamApi {
  session_: Session = { loggedIn: true, sessionid: 'sid', country: 'TW' };
  promos: FreeSub[] = [GAME, DLC];
  ownedApps = new Set<number>();
  ownedPackages = new Set<number>();
  outcomes: ClaimOutcome[] = [];
  claims: number[] = [];
  sessionCalls = 0;
  ccSeen: string[] = [];

  async session() {
    this.sessionCalls++;
    return this.session_;
  }
  async searchFreeAppIds(cc: string) {
    this.ccSeen.push(cc);
    return [...new Set(this.promos.map((p) => p.appid))];
  }
  async freeSubs(appid: number) {
    return this.promos.filter((p) => p.appid === appid);
  }
  async endsText() {
    return 'Free to keep when you get it before 12 Oct @ 10:00am.';
  }
  async owned() {
    return { apps: new Set(this.ownedApps), packages: new Set(this.ownedPackages) };
  }
  async claim(subid: number) {
    this.claims.push(subid);
    const outcome = this.outcomes.shift() ?? { kind: 'claimed' };
    if (outcome.kind === 'claimed') this.ownedPackages.add(subid);
    return outcome;
  }
}

function setup(settings: Partial<Settings> = {}) {
  const steam = new FakeSteam();
  const db = {
    settings: { ...DEFAULT_SETTINGS, ...settings } as Settings,
    promos: {} as PromoMap,
    meta: { ...DEFAULT_META } as Meta,
    runs: [] as RunInfo[],
  };
  const notes: { title: string; message: string }[] = [];
  let badge = '';
  let clock = 1_000_000;
  const deps: Deps = {
    steam,
    store: {
      getSettings: async () => db.settings,
      getPromos: async () => structuredClone(db.promos),
      setPromos: async (p) => void (db.promos = structuredClone(p)),
      getMeta: async () => structuredClone(db.meta),
      setMeta: async (m) => void (db.meta = structuredClone(m)),
      addRun: async (r) => void db.runs.unshift(r),
      setRunning: async () => {},
    },
    ui: {
      notify: async (_id, title, message) => void notes.push({ title, message }),
      setBadge: async (text) => void (badge = text),
      t: (key, subs) => `${key}${subs ? `(${subs.join('|')})` : ''}`,
    },
    now: () => clock,
    sleep: async () => {},
  };
  return {
    steam,
    db,
    deps,
    notes,
    badge: () => badge,
    advance: (ms: number) => void (clock += ms),
    status: (subid: number) => db.promos[String(subid)]?.status,
  };
}

describe('runCheck in auto mode', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => (t = setup()));

  it('claims a new free game and skips DLC whose base game is missing', async () => {
    const run = await runCheck(t.deps, 'alarm');
    expect(run).toMatchObject({ ok: true, found: 2, claimed: 1, loggedIn: true, country: 'TW' });
    expect(t.steam.claims).toEqual([100]);
    expect(t.status(100)).toBe('claimed');
    expect(t.status(200)).toBe('needs_base');
    expect(t.db.promos["100"]!.endsText).toContain('12 Oct');
    expect(t.notes).toEqual([{ title: 'notifyClaimedTitle', message: 'notifyClaimedBody(1|Game A)' }]);
  });

  it('never re-claims on later runs', async () => {
    await runCheck(t.deps, 'alarm');
    t.advance(6 * 3_600_000);
    await runCheck(t.deps, 'alarm');
    await runCheck(t.deps, 'manual');
    expect(t.steam.claims).toEqual([100]);
    expect(t.notes).toHaveLength(1);
  });

  it('claims DLC when the base game is owned', async () => {
    t.steam.ownedApps.add(99);
    await runCheck(t.deps, 'alarm');
    expect(t.steam.claims).toEqual([100, 200]);
  });

  it('respects the DLC setting', async () => {
    t = setup({ includeDlc: false });
    t.steam.ownedApps.add(99);
    await runCheck(t.deps, 'alarm');
    expect(t.steam.claims).toEqual([100]);
    expect(t.status(200)).toBe('skipped');
  });

  it('marks already-owned promos without claiming', async () => {
    t.steam.ownedApps.add(10);
    await runCheck(t.deps, 'alarm');
    expect(t.steam.claims).toEqual([]);
    expect(t.status(100)).toBe('owned');
  });

  it('retries transient failures and gives up after three attempts', async () => {
    t.steam.outcomes = [
      { kind: 'error', code: 'http_502' },
      { kind: 'error', code: 'http_502' },
      { kind: 'error', code: 'http_502' },
    ];
    for (let i = 0; i < 4; i++) {
      await runCheck(t.deps, 'alarm');
      t.advance(3_600_000);
    }
    expect(t.steam.claims).toEqual([100, 100, 100]);
    expect(t.status(100)).toBe('failed');
    expect(t.db.promos["100"]!.lastError).toBe('http_502');
    expect(t.badge()).toBe('!');
    expect(t.notes.map((n) => n.title)).toEqual(['notifyFailedTitle']);
  });

  it('maps Steam result codes to statuses', async () => {
    t.steam.outcomes = [{ kind: 'owned' }];
    await runCheck(t.deps, 'alarm');
    expect(t.status(100)).toBe('owned');
    expect(t.notes).toEqual([]);
  });

  it('asks for login once and claims after logging in', async () => {
    t.steam.session_ = { loggedIn: false, sessionid: 'sid', country: 'TW' };
    await runCheck(t.deps, 'alarm');
    await runCheck(t.deps, 'alarm');
    expect(t.steam.claims).toEqual([]);
    expect(t.notes.map((n) => n.title)).toEqual(['notifyLoginTitle']);
    expect(t.badge()).toBe('!');

    t.steam.session_ = { loggedIn: true, sessionid: 'sid', country: 'TW' };
    await runCheck(t.deps, 'manual');
    expect(t.steam.claims).toEqual([100]);
    expect(t.badge()).toBe('');
  });

  it('only refreshes the session when needed', async () => {
    t.steam.promos = [];
    await runCheck(t.deps, 'alarm');
    await runCheck(t.deps, 'alarm');
    expect(t.steam.sessionCalls).toBe(1);
    expect(t.steam.ccSeen).toEqual(['TW', 'TW']);
  });

  it('records a failed run without throwing', async () => {
    t.steam.searchFreeAppIds = async () => {
      throw new Error('HTTP 503 /search/results/');
    };
    const run = await runCheck(t.deps, 'alarm');
    expect(run).toMatchObject({ ok: false, error: 'HTTP 503 /search/results/' });
    expect(t.db.runs).toHaveLength(1);
  });

  it('forgets promos that disappeared a while ago but keeps claimed history longer', async () => {
    await runCheck(t.deps, 'alarm');
    t.steam.promos = [];
    t.advance(4 * 24 * 3_600_000);
    await runCheck(t.deps, 'alarm');
    expect(t.status(100)).toBe('claimed');
    expect(t.status(200)).toBeUndefined();
  });
});

describe('ask mode', () => {
  it('notifies once, waits for the user, then claims on request', async () => {
    const t = setup({ mode: 'ask' });
    await runCheck(t.deps, 'alarm');
    await runCheck(t.deps, 'alarm');
    expect(t.steam.claims).toEqual([]);
    expect(t.status(100)).toBe('pending');
    expect(t.badge()).toBe('1');
    expect(t.notes).toEqual([{ title: 'notifyAvailableTitle', message: 'notifyAvailableBody(1|Game A)' }]);

    await claimNow(t.deps, [100]);
    expect(t.steam.claims).toEqual([100]);
    expect(t.status(100)).toBe('claimed');
    expect(t.badge()).toBe('');
  });

  it('keeps a skipped promo skipped', async () => {
    const t = setup({ mode: 'ask' });
    await runCheck(t.deps, 'alarm');
    await skip(t.deps, 100);
    await runCheck(t.deps, 'manual');
    expect(t.status(100)).toBe('skipped');
    expect(t.badge()).toBe('');
  });
});

describe('manual retry', () => {
  it('lets the user retry a failed promo', async () => {
    const t = setup();
    t.steam.outcomes = Array(3).fill({ kind: 'error', code: 'http_500' });
    for (let i = 0; i < 3; i++) await runCheck(t.deps, 'alarm');
    expect(t.status(100)).toBe('failed');

    await claimNow(t.deps, [100]);
    expect(t.status(100)).toBe('claimed');
  });
});
