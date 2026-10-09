import '@/assets/theme.css';
import './style.css';
import { INTERVAL_HOURS, type IntervalHours, type Settings } from '@/core/types';
import { t, translatePage } from '@/lib/i18n';
import { readSnapshot, saveSettings } from '@/lib/storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const interval = $<HTMLSelectElement>('interval');
const includeDlc = $<HTMLInputElement>('includeDlc');
const notifications = $<HTMLInputElement>('notifications');
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

  interval.addEventListener('change', () => void save({ intervalHours: Number(interval.value) as IntervalHours }));
  includeDlc.addEventListener('change', () => void save({ includeDlc: includeDlc.checked }));
  notifications.addEventListener('change', () => void save({ notifications: notifications.checked }));
  modes.forEach((m) => m.addEventListener('change', () => void save({ mode: m.value as Settings['mode'] })));
}

void init();
