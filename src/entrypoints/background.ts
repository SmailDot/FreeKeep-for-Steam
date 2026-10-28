import { browser } from 'wxt/browser';
import { EPIC_FREE_GAMES, EPIC_ORIGIN, EpicClient, epicLocale } from '@/core/epic';
import { claimNow, runCheck, setOfferStatus, skip, type Deps, type MessageKey, type TabRenewal } from '@/core/engine';
import { GOG_ORIGINS, GogClient, gogHome, gogLocale } from '@/core/gog';
import { LOGIN_ORIGIN, STORE, STORE_ORIGIN, SteamClient } from '@/core/steam';
import { REMINDER_STORES, type ReminderStore, type RunReason, type Settings } from '@/core/types';
import { drawChest, type ChestColors } from '@/lib/chest';
import { t } from '@/lib/i18n';
import type { Command, CommandResult } from '@/lib/messages';
import { browserStore, readSnapshot } from '@/lib/storage';

const PERIODIC = 'freekeep-periodic';
const STARTUP = 'freekeep-startup';
/** Long enough for Steam's renewal redirects and the store page; the tab is closed either way. */
const TAB_TIMEOUT_MS = 25_000;

function chestCanvas(colors: ChestColors, size: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(size, size);
  drawChest(canvas.getContext('2d')!, colors, size);
  return canvas;
}

/** The toolbar icon follows the chest colours picked in the options page. */
async function applyIcon(): Promise<void> {
  const { settings } = await readSnapshot();
  const colors = { body: settings.chestBody, band: settings.chestBand };
  const imageData = Object.fromEntries(
    [16, 32].map((size) => [size, chestCanvas(colors, size).getContext('2d')!.getImageData(0, 0, size, size)]),
  );
  await browser.action.setIcon({ imageData });
}

/** Notifications show the chest in the user's colours too (a PNG data URL, drawn locally). */
async function notificationIcon(): Promise<string> {
  try {
    const { settings } = await readSnapshot();
    const blob = await chestCanvas({ body: settings.chestBody, band: settings.chestBand }, 128).convertToBlob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return browser.runtime.getURL('/icon/128.png');
  }
}

const deps: Deps = {
  steam: new SteamClient(),
  store: browserStore,
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  ui: {
    async notify(id, title, message) {
      const options = { type: 'basic' as const, title, message };
      try {
        await browser.notifications.create(id, { ...options, iconUrl: await notificationIcon() });
      } catch {
        // A notification must never fail a check: fall back to the packaged icon.
        await browser.notifications.create(id, { ...options, iconUrl: browser.runtime.getURL('/icon/128.png') });
      }
    },
    async setBadge(text, kind) {
      await browser.action.setBadgeText({ text });
      await browser.action.setBadgeBackgroundColor({ color: kind === 'warn' ? '#e8b545' : '#5c7e10' });
    },
    t: (key: MessageKey, subs?: string[]) => t(key, subs),
    formatDate: (ms) =>
      new Intl.DateTimeFormat(browser.i18n.getUILanguage(), {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(ms),
  },
  epic: {
    api: new EpicClient(epicLocale(browser.i18n.getUILanguage())),
    allowed: () => browser.permissions.contains({ origins: [EPIC_ORIGIN] }),
  },
  gog: {
    api: new GogClient(gogLocale(browser.i18n.getUILanguage())),
    allowed: () => browser.permissions.contains({ origins: GOG_ORIGINS }),
  },
  renewAllowed: () => browser.permissions.contains({ origins: [LOGIN_ORIGIN] }),
  storeAllowed: () => browser.permissions.contains({ origins: [STORE_ORIGIN] }),
};

/**
 * Resolves once a tab has finished loading a store page (after Steam's renewal redirects), is
 * closed, or the timeout passes. Store URLs are readable through the store host permission alone.
 */
function storeLoaded(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(onRemoved);
      resolve();
    };
    const onUpdated = (id: number, info: { status?: string }, tab: { url?: string }) => {
      if (id === tabId && info.status === 'complete' && tab.url?.startsWith(`${STORE}/`)) done();
    };
    const onRemoved = (id: number) => {
      if (id === tabId) done();
    };
    const timer = setTimeout(done, timeoutMs);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(onRemoved);
  });
}

/**
 * Renews a lapsed Steam login the way any visit to the store does, then checks again. Only runs when
 * the user asks for it (popup button or notification click). With `visible`, the store opens as a
 * normal tab the user keeps; otherwise it loads in a background tab that closes itself.
 */
let renewing: Promise<void> | null = null;
function renewInTab(visible: boolean): Promise<void> {
  renewing ??= (async () => {
    const method: TabRenewal = visible ? 'visit' : 'tab';
    try {
      const tab = await browser.tabs.create({ url: `${STORE}/`, active: visible });
      if (tab.id !== undefined) {
        await storeLoaded(tab.id, visible ? 4 * TAB_TIMEOUT_MS : TAB_TIMEOUT_MS);
        if (!visible) await browser.tabs.remove(tab.id).catch(() => {});
      }
      await runCheck(deps, 'renew', method);
    } finally {
      renewing = null;
    }
  })();
  return renewing;
}

async function ensurePeriodicAlarm(): Promise<void> {
  const { settings } = await readSnapshot();
  const period = settings.intervalHours * 60;
  const existing = await browser.alarms.get(PERIODIC);
  if (existing?.periodInMinutes === period) return;
  await browser.alarms.create(PERIODIC, { delayInMinutes: period, periodInMinutes: period });
}

/** Startup checks wait a minute so the network is up and the browser has settled. */
async function scheduleSoon(delayInMinutes = 1): Promise<void> {
  await browser.alarms.create(STARTUP, { delayInMinutes });
}

const reasonFor: Record<string, RunReason> = { [PERIODIC]: 'alarm', [STARTUP]: 'startup' };

/**
 * A GOG notification opens the one game it announced (a 100%-off game's page, or the home page for a
 * giveaway, where its claim button is), or GOG's home page when it announced several.
 */
async function gogTarget(notifiedAt: number): Promise<string> {
  const announced = Object.values((await readSnapshot()).gog).filter((o) => o.firstSeen === notifiedAt);
  return announced.length === 1 ? announced[0]!.url : gogHome(gogLocale(browser.i18n.getUILanguage()));
}

/** Only the popup and options page can message the worker, but their input is still checked. */
function parseCommand(message: unknown): Command | null {
  const m = message as Partial<Command> & { subid?: unknown; id?: unknown; status?: unknown; store?: unknown };
  const subid = typeof m?.subid === 'number' && Number.isInteger(m.subid) && m.subid > 0 ? m.subid : null;
  switch (m?.type) {
    case 'checkNow':
      return { type: 'checkNow' };
    case 'renewLogin':
      return { type: 'renewLogin', visible: (m as { visible?: unknown }).visible === true };
    case 'claim':
    case 'skip':
      return subid ? { type: m.type, subid } : null;
    case 'offer':
      return REMINDER_STORES.includes(m.store as ReminderStore) &&
        typeof m.id === 'string' &&
        (m.status === 'opened' || m.status === 'hidden')
        ? { type: 'offer', store: m.store as ReminderStore, id: m.id, status: m.status }
        : null;
    default:
      return null;
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await ensurePeriodicAlarm();
    await scheduleSoon(0.5);
  });

  browser.runtime.onStartup.addListener(async () => {
    await ensurePeriodicAlarm();
    await scheduleSoon();
  });

  // Chrome doesn't keep an icon set at runtime across restarts, so draw it whenever the worker starts.
  void applyIcon();

  browser.alarms.onAlarm.addListener((alarm) => {
    const reason = reasonFor[alarm.name];
    if (reason) void runCheck(deps, reason);
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    void ensurePeriodicAlarm();
    const [before, after] = [changes.settings.oldValue as Settings | undefined, changes.settings.newValue as Settings | undefined];
    if (before?.chestBody !== after?.chestBody || before?.chestBand !== after?.chestBand) void applyIcon();
  });

  // Store access turned back on (popup button, about:addons or Chrome's site access): check right away.
  browser.permissions.onAdded.addListener((added) => {
    if (added.origins?.includes(STORE_ORIGIN)) void runCheck(deps, 'manual');
  });

  browser.notifications.onClicked.addListener((id) => {
    void browser.notifications.clear(id);
    // The engine names each notification after what a click should do.
    if (id.startsWith('freekeep-renew-')) return void renewInTab(false);
    if (id.startsWith('freekeep-store-')) return void renewInTab(true);
    if (id.startsWith('freekeep-gog-')) {
      return void gogTarget(Number(id.slice('freekeep-gog-'.length))).then((url) => browser.tabs.create({ url }));
    }
    const url = id.startsWith('freekeep-epic-') ? EPIC_FREE_GAMES : browser.runtime.getURL('/popup.html');
    void browser.tabs.create({ url });
  });

  browser.runtime.onMessage.addListener((raw: unknown, _sender, sendResponse) => {
    const handle = async (): Promise<CommandResult> => {
      const message = parseCommand(raw);
      switch (message?.type) {
        case 'checkNow':
          await runCheck(deps, 'manual');
          return { ok: true };
        case 'renewLogin':
          await renewInTab(message.visible);
          return { ok: true };
        case 'claim':
          await claimNow(deps, [message.subid]);
          return { ok: true };
        case 'skip':
          await skip(deps, message.subid);
          return { ok: true };
        case 'offer':
          await setOfferStatus(deps, message.store, message.id, message.status);
          return { ok: true };
        default:
          return { ok: false, error: 'unknown command' };
      }
    };
    handle().then(sendResponse, (e: Error) => sendResponse({ ok: false, error: e.message }));
    return true;
  });
});
