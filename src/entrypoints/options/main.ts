import '@/assets/theme.css';
import './style.css';
import { browser } from 'wxt/browser';
import { EPIC_ORIGIN } from '@/core/epic';
import { INTERVAL_HOURS, type IntervalHours, type Settings } from '@/core/types';
import { t, translatePage } from '@/lib/i18n';
import { readSnapshot, saveSettings } from '@/lib/storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const interval = $<HTMLSelectElement>('interval');
const includeDlc = $<HTMLInputElement>('includeDlc');
const notifications = $<HTMLInputElement>('notifications');
const epic = $<HTMLInputElement>('epic');
const epicPermission = { origins: [EPIC_ORIGIN] };
const modes = document.querySelectorAll<HTMLInputElement>('input[name="mode"]');

let savedTimer: ReturnType<typeof setTimeout> | undefined;
async function save(patch: Partial<Settings>): Promise<void> {
  await saveSettings(patch);
  $('saved').hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => ($('saved').hidden = true), 1500);
}

async function init(): Promise<void> {
  translatePage();
  for (const hours of INTERVAL_HOURS) {
    interval.append(new Option(t('optHours', [String(hours)]), String(hours)));
  }

  const { settings } = await readSnapshot();
  interval.value = String(settings.intervalHours);
  includeDlc.checked = settings.includeDlc;
  notifications.checked = settings.notifications;
  modes.forEach((m) => (m.checked = m.value === settings.mode));
  // Reflect the real state: the user may have revoked the permission in chrome://extensions.
  epic.checked = settings.epic && (await browser.permissions.contains(epicPermission));

  interval.addEventListener('change', () => void save({ intervalHours: Number(interval.value) as IntervalHours }));
  includeDlc.addEventListener('change', () => void save({ includeDlc: includeDlc.checked }));
  notifications.addEventListener('change', () => void save({ notifications: notifications.checked }));
  modes.forEach((m) => m.addEventListener('change', () => void save({ mode: m.value as Settings['mode'] })));

  epic.addEventListener('change', async () => {
    if (!epic.checked) {
      await save({ epic: false });
      await browser.storage.local.remove('epic'); // the engine also clears it on its next run
      await browser.permissions.remove(epicPermission); // give it back: least privilege
      return;
    }
    // Must be the first call in the click handler, while Chrome still counts it as a user gesture.
    const granted = await browser.permissions.request(epicPermission);
    $('epicDenied').hidden = granted;
    if (!granted) {
      epic.checked = false;
      return;
    }
    await save({ epic: true });
    void browser.runtime.sendMessage({ type: 'checkNow' });
  });
}

void init();
