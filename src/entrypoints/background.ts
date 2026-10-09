import { browser } from 'wxt/browser';
import { EPIC_FREE_GAMES, EPIC_ORIGIN, EpicClient } from '@/core/epic';
import { claimNow, runCheck, setEpicStatus, skip, type Deps, type MessageKey } from '@/core/engine';
import { SteamClient } from '@/core/steam';
import type { RunReason } from '@/core/types';
import { t } from '@/lib/i18n';
import type { Command, CommandResult } from '@/lib/messages';
import { browserStore, readSnapshot } from '@/lib/storage';

const PERIODIC = 'freekeep-periodic';
const STARTUP = 'freekeep-startup';

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
    api: new EpicClient(),
    allowed: () => browser.permissions.contains({ origins: [EPIC_ORIGIN] }),
  },
};

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
    const url = id.startsWith('freekeep-epic-') ? EPIC_FREE_GAMES : browser.runtime.getURL('/popup.html');
    void browser.tabs.create({ url });
  });

  browser.runtime.onMessage.addListener((message: Command, _sender, sendResponse) => {
    const handle = async (): Promise<CommandResult> => {
      switch (message?.type) {
        case 'checkNow':
          await runCheck(deps, 'manual');
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
