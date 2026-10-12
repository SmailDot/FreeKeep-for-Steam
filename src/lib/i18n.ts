import { browser } from 'wxt/browser';
import { pixelSafe } from './pixel';

// WXT types getMessage with the literal keys from _locales; keys here are often built dynamically.
const getMessage = browser.i18n.getMessage as (key: string, subs?: string[]) => string;

/** Thin wrapper over chrome.i18n so a missing key shows up as the key instead of an empty string. */
export function t(key: string, subs?: string[]): string {
  return getMessage(key, subs) || key;
}

/**
 * Fills every element carrying data-i18n="key" with its translation. Text the pixel fonts can't
 * draw (a language they don't cover) is shown in the system font rather than half and half.
 */
export function translatePage(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
    if (!pixelSafe(el.textContent)) el.classList.add('nopx');
  });
  document.documentElement.lang = browser.i18n.getUILanguage();
}
