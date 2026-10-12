import { browser } from 'wxt/browser';
import { EPIC_FREE_GAMES, EPIC_ORIGIN, EpicClient, epicLocale } from '@/core/epic';
import { claimNow, runCheck, setEpicStatus, skip, type Deps, type MessageKey, type TabRenewal } from '@/core/engine';
import { LOGIN_ORIGIN, STORE, SteamClient } from '@/core/steam';
import type { RunReason } from '@/core/types';
import { t } from '@/lib/i18n';
import type { Command, CommandResult } from '@/lib/messages';
import { browserStore, readSnapshot } from '@/lib/storage';

const PERIODIC = 'freekeep-periodic';
const STARTUP = 'freekeep-startup';
/** Long enough for Steam's renewal redirects and the store page; the tab is closed either way. */
const TAB_TIMEOUT_MS = 25_000;

const deps: Deps = {
  steam: new SteamClient(),
  store: browserStore,
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  ui: {
    async notify(id, title, message) {
      await browser.notifications.create(id, {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        title,
        message,
      });
    },
    async setBadge(text, kind) {
      await browser.action.setBadgeText({ text });
      await browser.action.setBadgeBackgroundColor({ color: kind === 'warn' ? '#d97706' : '#16a34a' });
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
  renewAllowed: () => browser.permissions.contains({ origins: [LOGIN_ORIGIN] }),
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

/** Only the popup and options page can message the worker, but their input is still checked. */
function parseCommand(message: unknown): Command | null {
  const m = message as Partial<Command> & { subid?: unknown; id?: unknown; status?: unknown };
  const subid = typeof m?.subid === 'number' && Number.isInteger(m.subid) && m.subid > 0 ? m.subid : null;
  switch (m?.type) {
    case 'checkNow':
      return { type: 'checkNow' };
    case 'renewLogin':
      return { type: 'renewLogin', visible: (m as { visible?: unknown }).visible === true };
    case 'claim':
    case 'skip':
      return subid ? { type: m.type, subid } : null;
    case 'epic':
      return typeof m.id === 'string' && (m.status === 'opened' || m.status === 'hidden')
        ? { type: 'epic', id: m.id, status: m.status }
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

  browser.alarms.onAlarm.addListener((alarm) => {
    const reason = reasonFor[alarm.name];
    if (reason) void runCheck(deps, reason);
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) void ensurePeriodicAlarm();
  });

  browser.notifications.onClicked.addListener((id) => {
    void browser.notifications.clear(id);
    // The engine names each notification after what a click should do.
    if (id.startsWith('freekeep-renew-')) return void renewInTab(false);
    if (id.startsWith('freekeep-store-')) return void renewInTab(true);
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
        case 'epic':
          await setEpicStatus(deps, message.id, message.status);
          return { ok: true };
        default:
          return { ok: false, error: 'unknown command' };
      }
    };
    handle().then(sendResponse, (e: Error) => sendResponse({ ok: false, error: e.message }));
    return true;
  });
});
