import { decide } from './policy';
import type { ClaimOutcome, Owned, Session } from './steam';
import type { EpicMap, EpicOffer, EpicState, EpicStatus, FreeSub, PromoMap, PromoState, RunInfo, RunReason, Settings } from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const MAX_ATTEMPTS = 3;
const CLAIM_GAP_MS = 2_500;
const DETAILS_GAP_MS = 300;
const APP_CACHE_TTL = 12 * HOUR;
const SESSION_TTL = DAY;
const DECISION_TTL = DAY;

export interface SteamApi {
  session(): Promise<Session>;
  searchFreeAppIds(cc: string): Promise<number[]>;
  freeSubs(appid: number, cc: string): Promise<FreeSub[]>;
  endsText(appid: number, cc: string): Promise<string | null>;
  owned(): Promise<Owned>;
  claim(subid: number, sessionid: string): Promise<ClaimOutcome>;
}

export interface EpicApi {
  freeGames(now: number): Promise<{ current: EpicOffer[]; upcoming: EpicOffer[] }>;
}

export interface Meta {
  country: string | null;
  loggedIn: boolean | null;
  sessionCheckedAt: number;
  decidedAt: number;
  /** Set while the user is known to be logged out and has been told so. */
  loginNotified: boolean;
  appCache: Record<string, { subs: FreeSub[]; fetchedAt: number }>;
}

export const DEFAULT_META: Meta = {
  country: null,
  loggedIn: null,
  sessionCheckedAt: 0,
  decidedAt: 0,
  loginNotified: false,
  appCache: {},
};

export interface Store {
  getSettings(): Promise<Settings>;
  getPromos(): Promise<PromoMap>;
  setPromos(promos: PromoMap): Promise<void>;
  getMeta(): Promise<Meta>;
  setMeta(meta: Meta): Promise<void>;
  addRun(run: RunInfo): Promise<void>;
  setRunning(running: boolean): Promise<void>;
  getEpic(): Promise<EpicMap>;
  setEpic(epic: EpicMap): Promise<void>;
}

export type MessageKey =
  | 'notifyClaimedTitle'
  | 'notifyClaimedBody'
  | 'notifyAvailableTitle'
  | 'notifyAvailableBody'
  | 'notifyLoginTitle'
  | 'notifyLoginBody'
  | 'notifyFailedTitle'
  | 'notifyFailedBody'
  | 'notifyEpicTitle'
  | 'notifyEpicBody';

export interface Ui {
  notify(id: string, title: string, message: string): Promise<void>;
  setBadge(text: string, kind: 'info' | 'warn'): Promise<void>;
  t(key: MessageKey, subs?: string[]): string;
  /** A short local date and time, e.g. "Oct 15, 23:00". */
  formatDate(ms: number): string;
}

export interface Deps {
  steam: SteamApi;
  store: Store;
  ui: Ui;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** Optional Epic reminders: only used when enabled in settings and the host permission is granted. */
  epic?: { api: EpicApi; allowed(): Promise<boolean> };
}

/** Statuses that are never changed again by automatic runs. */
const FINAL: ReadonlySet<PromoState['status']> = new Set(['claimed', 'owned', 'failed']);

function newPromo(sub: FreeSub, now: number): PromoState {
  return {
    ...sub,
    status: 'pending',
    endsText: null,
    attempts: 0,
    lastError: null,
    userSkipped: false,
    firstSeen: now,
    lastSeen: now,
    updatedAt: now,
  };
}

function names(promos: PromoState[]): string {
  return promos.map((p) => p.name).join(', ');
}

// All engine operations share one queue so alarms, startup and popup actions never overlap.
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

class Engine {
  private session: Session | null = null;

  constructor(
    private readonly d: Deps,
    private readonly settings: Settings,
    private readonly promos: PromoMap,
    private readonly meta: Meta,
  ) {}

  static async load(d: Deps): Promise<Engine> {
    const [settings, promos, meta] = await Promise.all([d.store.getSettings(), d.store.getPromos(), d.store.getMeta()]);
    return new Engine(d, settings, promos, { ...DEFAULT_META, ...meta });
  }

  async save(): Promise<void> {
    await Promise.all([this.d.store.setPromos(this.promos), this.d.store.setMeta(this.meta)]);
    await this.updateBadge();
  }

  private async refreshSession(): Promise<Session> {
    if (this.session) return this.session;
    const session = await this.d.steam.session();
    this.session = session;
    this.meta.loggedIn = session.loggedIn;
    this.meta.sessionCheckedAt = this.d.now();
    if (session.country) this.meta.country = session.country;
    if (session.loggedIn) this.meta.loginNotified = false;
    return session;
  }

  private set(p: PromoState, patch: Partial<PromoState>): void {
    Object.assign(p, patch, { updatedAt: this.d.now() });
  }

  async detect(force: boolean): Promise<{ seen: PromoState[]; added: PromoState[] }> {
    const now = this.d.now();
    if (!this.meta.country || now - this.meta.sessionCheckedAt > SESSION_TTL) await this.refreshSession();
    const cc = this.meta.country ?? 'US';

    const appids = await this.d.steam.searchFreeAppIds(cc);
    const subs: FreeSub[] = [];
    const cache: Meta['appCache'] = {};
    for (const appid of appids) {
      const cached = this.meta.appCache[appid];
      if (cached && !force && now - cached.fetchedAt < APP_CACHE_TTL) {
        cache[appid] = cached;
      } else {
        cache[appid] = { subs: await this.d.steam.freeSubs(appid, cc), fetchedAt: now };
        await this.d.sleep(DETAILS_GAP_MS);
      }
      subs.push(...cache[appid].subs);
    }
    this.meta.appCache = cache;

    const seen: PromoState[] = [];
    const added: PromoState[] = [];
    for (const sub of subs) {
      const key = String(sub.subid);
      const existing = this.promos[key];
      if (existing) {
        Object.assign(existing, sub, { lastSeen: now });
        seen.push(existing);
      } else {
        const promo = newPromo(sub, now);
        this.promos[key] = promo;
        seen.push(promo);
        added.push(promo);
      }
    }
    for (const promo of added) {
      promo.endsText = await this.d.steam.endsText(promo.appid, cc).catch(() => null);
    }
    return { seen, added };
  }

  /** Re-evaluates promos against the library. Needs login, otherwise ownership is unknown. */
  async decideAll(promos: PromoState[]): Promise<boolean> {
    const open = promos.filter((p) => !FINAL.has(p.status) && !p.userSkipped);
    if (open.length === 0) return true;
    const session = await this.refreshSession();
    if (!session.loggedIn) return false;

    const owned = await this.d.steam.owned();
    for (const p of open) {
      const decision = decide(p, owned, this.settings);
      if (decision === 'eligible') {
        if (p.status !== 'pending') this.set(p, { status: 'pending' });
      } else if (p.status !== decision) {
        this.set(p, { status: decision });
      }
    }
    this.meta.decidedAt = this.d.now();
    return true;
  }

  /** Resets the given promos for a user-requested claim and returns the engine's own copies. */
  takeForManualClaim(subids: number[]): PromoState[] {
    const list = subids.map((id) => this.promos[String(id)]).filter((p): p is PromoState => Boolean(p));
    for (const p of list) this.set(p, { status: 'pending', attempts: 0, userSkipped: false });
    return list;
  }

  skip(subid: number): void {
    const p = this.promos[String(subid)];
    if (p) this.set(p, { status: 'skipped', userSkipped: true });
  }

  pendingSeen(): PromoState[] {
    return Object.values(this.promos).filter((p) => p.status === 'pending' && !p.userSkipped);
  }

  async claim(targets: PromoState[]): Promise<number> {
    if (targets.length === 0) return 0;
    const session = await this.refreshSession();
    if (!session.loggedIn || !session.sessionid) {
      for (const p of targets) this.set(p, { lastError: 'logged_out' });
      await this.notifyLogin(targets);
      return 0;
    }

    const claimed: PromoState[] = [];
    const failed: PromoState[] = [];
    for (const [i, p] of targets.entries()) {
      if (i > 0) await this.d.sleep(CLAIM_GAP_MS);
      const outcome = await this.d.steam.claim(p.subid, session.sessionid).catch(
        (e): ClaimOutcome => ({ kind: 'error', code: `network:${(e as Error).message}` }),
      );
      if (outcome.kind === 'claimed') {
        this.set(p, { status: 'claimed', lastError: null });
        claimed.push(p);
      } else if (outcome.kind === 'owned' || outcome.kind === 'needs_base') {
        this.set(p, { status: outcome.kind, lastError: null });
      } else if (outcome.kind === 'logged_out') {
        this.meta.loggedIn = false;
        for (const rest of targets.slice(i)) this.set(rest, { lastError: 'logged_out' });
        await this.notifyLogin(targets.slice(i));
        break;
      } else {
        const attempts = p.attempts + 1;
        const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
        this.set(p, { attempts, status, lastError: outcome.code });
        if (status === 'failed') failed.push(p);
      }
    }

    if (claimed.length) {
      await this.notify('claimed', 'notifyClaimedTitle', 'notifyClaimedBody', [String(claimed.length), names(claimed)]);
    }
    if (failed.length) {
      await this.notify('failed', 'notifyFailedTitle', 'notifyFailedBody', [names(failed)]);
    }
    return claimed.length;
  }

  private async notifyLogin(targets: PromoState[]): Promise<void> {
    if (this.meta.loginNotified) return;
    this.meta.loginNotified = true;
    await this.notify('login', 'notifyLoginTitle', 'notifyLoginBody', [names(targets)]);
  }

  async notify(id: string, title: MessageKey, body: MessageKey, subs: string[]): Promise<void> {
    if (!this.settings.notifications) return;
    await this.d.ui.notify(`freekeep-${id}-${this.d.now()}`, this.d.ui.t(title), this.d.ui.t(body, subs));
  }

  prune(): void {
    const now = this.d.now();
    for (const [key, p] of Object.entries(this.promos)) {
      const keep = p.status === 'claimed' ? 30 * DAY : 3 * DAY;
      if (now - p.lastSeen > keep) delete this.promos[key];
    }
  }

  async updateBadge(): Promise<void> {
    const pending = this.pendingSeen();
    if (pending.length && this.meta.loggedIn === false) return this.d.ui.setBadge('!', 'warn');
    if (pending.length && this.settings.mode === 'ask') return this.d.ui.setBadge(String(pending.length), 'info');
    if (Object.values(this.promos).some((p) => p.status === 'failed')) return this.d.ui.setBadge('!', 'warn');
    return this.d.ui.setBadge('', 'info');
  }

  get mode(): Settings['mode'] {
    return this.settings.mode;
  }

  get decisionStale(): boolean {
    return this.d.now() - this.meta.decidedAt > DECISION_TTL;
  }

  get state(): { loggedIn: boolean | null; country: string | null } {
    return { loggedIn: this.meta.loggedIn, country: this.meta.country };
  }
}

/**
 * Epic giveaways can't be claimed automatically, so FreeKeep only reminds: each giveaway is announced
 * once, when it is live. Announced ("upcoming") ones are kept for the popup without a notification.
 */
async function checkEpic(d: Deps, settings: Settings): Promise<RunInfo['epic']> {
  if (!settings.epic || !d.epic) {
    // Switched off: forget the Epic list too, so nothing about it stays on the device.
    if (Object.keys(await d.store.getEpic()).length) await d.store.setEpic({});
    return undefined;
  }
  if (!(await d.epic.allowed())) return 'no_permission';

  const now = d.now();
  const { current, upcoming } = await d.epic.api.freeGames(now);
  const state = await d.store.getEpic();
  for (const offer of [...current, ...upcoming]) {
    const prev = state[offer.id];
    state[offer.id] = prev ? { ...prev, ...offer, lastSeen: now } : { ...offer, status: 'new', firstSeen: now, lastSeen: now };
  }

  const announce = current.map((o) => state[o.id]!).filter((o) => o.status === 'new');
  if (announce.length) {
    for (const o of announce) o.status = 'notified';
    if (settings.notifications) {
      const until = d.ui.formatDate(Math.min(...announce.map((o) => o.end)));
      await d.ui.notify(`freekeep-epic-${now}`, d.ui.t('notifyEpicTitle'), d.ui.t('notifyEpicBody', [announce.map((o) => o.title).join(', '), until]));
    }
  }

  for (const [id, o] of Object.entries(state)) {
    if (now > o.end + DAY || now - o.lastSeen > 14 * DAY) delete state[id];
  }
  await d.store.setEpic(state);
  return current.length;
}

/** One scheduled or manual check: detect → decide → claim (auto mode) → notify. */
export function runCheck(d: Deps, reason: RunReason): Promise<RunInfo> {
  return exclusive(async () => {
    await d.store.setRunning(true);
    const engine = await Engine.load(d);
    const run: RunInfo = { at: d.now(), reason, ok: true, loggedIn: null, country: null, found: 0, claimed: 0, error: null };
    try {
      const manual = reason === 'manual';
      const { seen, added } = await engine.detect(manual);
      run.found = seen.length;

      if (added.length || manual || engine.decisionStale) await engine.decideAll(seen);

      const pending = engine.pendingSeen();
      if (engine.mode === 'auto') {
        run.claimed = await engine.claim(pending);
      } else {
        const fresh = pending.filter((p) => added.includes(p));
        if (fresh.length) {
          await engine.notify('available', 'notifyAvailableTitle', 'notifyAvailableBody', [String(fresh.length), names(fresh)]);
        }
      }
      engine.prune();
    } catch (e) {
      run.ok = false;
      run.error = (e as Error).message;
    } finally {
      Object.assign(run, engine.state);
      await engine.save();
      // Epic is independent: its failures never affect the Steam result and vice versa.
      const epic = await checkEpic(d, await d.store.getSettings()).catch((): RunInfo['epic'] => 'error');
      if (epic !== undefined) run.epic = epic;
      await d.store.addRun(run);
      await d.store.setRunning(false);
    }
    return run;
  });
}

/** Claims specific promos on user request (ask mode, or retrying a failed one). */
export function claimNow(d: Deps, subids: number[]): Promise<number> {
  return exclusive(async () => {
    const engine = await Engine.load(d);
    try {
      return await engine.claim(engine.takeForManualClaim(subids));
    } finally {
      await engine.save();
    }
  });
}

export function skip(d: Deps, subid: number): Promise<void> {
  return exclusive(async () => {
    const engine = await Engine.load(d);
    engine.skip(subid);
    await engine.save();
  });
}

/** Records what the user did with an Epic giveaway in the popup. */
export function setEpicStatus(d: Deps, id: string, status: Extract<EpicStatus, 'opened' | 'hidden'>): Promise<void> {
  return exclusive(async () => {
    const state = await d.store.getEpic();
    const offer: EpicState | undefined = state[id];
    if (!offer) return;
    offer.status = status;
    await d.store.setEpic(state);
  });
}
