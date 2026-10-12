import { browser } from 'wxt/browser';
import { t } from './i18n';

/** "3 minutes ago", in the browser's language. */
export function relativeTime(at: number): string {
  const rtf = new Intl.RelativeTimeFormat(browser.i18n.getUILanguage(), { numeric: 'auto' });
  const minutes = Math.round((at - Date.now()) / 60_000);
  if (minutes === 0) return t('justNow');
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}

/** A short local date and time, e.g. "Oct 15, 23:00". */
export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(browser.i18n.getUILanguage(), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ms);
}
