import '@/assets/theme.css';
import './style.css';
import './fx.css';
import { browser } from 'wxt/browser';
import { STORE } from '@/core/steam';
import type { PromoState, PromoStatus } from '@/core/types';
import { buildDiagnostics } from '@/lib/diagnostics';
import { t, translatePage } from '@/lib/i18n';
import type { Command, CommandResult } from '@/lib/messages';
import { readSnapshot, type Snapshot } from '@/lib/storage';
import { busy, celebrate, fail, toast } from './fx';

const STALE_RUN_MS = 2 * 60_000;
const ORDER: PromoStatus[] = ['pending', 'failed', 'claimed', 'needs_base', 'owned', 'skipped'];
/** Popup-only UI state: when the user last saw the list, to replay celebrations for background claims. */
const SEEN_KEY = 'popupSeenAt';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

async function send(command: Command): Promise<CommandResult> {
  return browser.runtime.sendMessage(command);
}

function relativeTime(at: number): string {
  const rtf = new Intl.RelativeTimeFormat(browser.i18n.getUILanguage(), { numeric: 'auto' });
  const minutes = Math.round((at - Date.now()) / 60_000);
  if (minutes === 0) return t('justNow');
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}

function untilText(endsText: string | null): string | null {
  const date = endsText?.match(/before (.+?)\.?$/i)?.[1];
  return date ? t('popupUntil', [date]) : null;
}

function actionButton(label: string, command: Command, primary = false): HTMLButtonElement {
  const button = el('button', { type: 'button', className: primary ? 'primary' : '' }, [el('span', { textContent: label })]);
  button.addEventListener('click', () => {
    busy(button);
    void send(command);
  });
  return button;
}

function card(p: PromoState, loggedIn: boolean | null): HTMLElement {
  const status = p.status === 'pending' && p.lastError === 'logged_out' ? t('waitingLogin') : t(`status_${p.status}`);
  const actions = el('div', { className: 'actions' });
  if (p.status === 'pending' && loggedIn !== false) {
    actions.append(actionButton(t('actionClaim'), { type: 'claim', subid: p.subid }, true));
    actions.append(actionButton(t('actionSkip'), { type: 'skip', subid: p.subid }));
  } else if (p.status === 'failed') {
    actions.append(actionButton(t('actionRetry'), { type: 'claim', subid: p.subid }, true));
  }
  actions.append(
    el('a', {
      className: 'store',
      href: `${STORE}/app/${p.appid}/`,
      target: '_blank',
      rel: 'noreferrer',
      textContent: t('actionStore'),
    }),
  );

  const meta = el('div', { className: 'meta' }, [
    el('span', { className: 'chip', textContent: t(`kind_${p.kind}`) }),
    el('span', { className: `chip st st-${p.status}`, textContent: status }),
  ]);
  const until = untilText(p.endsText);
  const info = el('div', { className: 'info' }, [el('div', { className: 'name', textContent: p.name, title: p.name }), meta]);
  if (p.status === 'needs_base' && p.baseName) info.append(el('div', { className: 'sub', textContent: `↳ ${p.baseName}` }));
  if (until) info.append(el('div', { className: 'sub', textContent: until }));

  const capsule = p.capsule
    ? el('img', { className: 'capsule', src: p.capsule, alt: '', loading: 'lazy' })
    : el('div', { className: 'capsule placeholder' });
  return el('article', { className: `card is-${p.status}` }, [
    el('div', { className: 'capsule-wrap' }, [capsule]),
    info,
    actions,
  ]);
}

/** Cards are reused while their content is unchanged so running animations aren't cut off. */
const cards = new Map<number, { el: HTMLElement; signature: string; status: PromoStatus; attempts: number }>();
let firstRender = true;

function syncCards(current: PromoState[], loggedIn: boolean | null, seenAt: number): void {
  const next: HTMLElement[] = [];
  const effects: (() => void)[] = [];
  const live = new Set<number>();

  for (const p of current) {
    live.add(p.subid);
    const signature = JSON.stringify([p.status, p.lastError, p.endsText, p.name, p.capsule, p.attempts, loggedIn]);
    const prev = cards.get(p.subid);
    if (prev && prev.signature === signature) {
      next.push(prev.el);
      continue;
    }
    const node = card(p, loggedIn);
    if (!prev && !firstRender) node.classList.add('fx-enter');
    cards.set(p.subid, { el: node, signature, status: p.status, attempts: p.attempts });
    next.push(node);

    const changed = prev && prev.status !== p.status;
    if (p.status === 'claimed' && (changed || (firstRender && p.updatedAt > seenAt))) {
      const delay = effects.length * 250; // stagger several celebrations
      effects.push(() => {
        celebrate(node, delay);
        toast(t('toastClaimed', [p.name]), 'ok');
      });
    } else if (changed && p.status === 'failed') {
      effects.push(() => {
        fail(node);
        toast(t('toastFailed', [p.name]), 'bad');
      });
    } else if (changed && p.status === 'needs_base') {
      effects.push(() => {
        fail(node, true);
        toast(t('toastNeedsBase', [p.name]), 'warn');
      });
    } else if (prev && p.status === 'pending' && p.attempts > prev.attempts) {
      effects.push(() => fail(node)); // a claim failed but attempts remain
    }
  }
  for (const id of cards.keys()) if (!live.has(id)) cards.delete(id);

  const list = $('list');
  const same = next.length === list.children.length && next.every((n, i) => list.children[i] === n);
  if (!same) list.replaceChildren(...next);
  // Wait a frame so the cards are laid out before measuring them for confetti.
  requestAnimationFrame(() => effects.forEach((run) => run()));
}

function render(s: Snapshot, seenAt: number): void {
  const lastRun = s.runs[0];
  const running = s.runningSince > 0 && Date.now() - s.runningSince < STALE_RUN_MS;
  const loggedOut = s.meta.loggedIn === false;

  $('dot').className = `dot ${running ? 'busy' : loggedOut || lastRun?.ok === false ? 'warn' : 'ok'}`;
  $('statusText').textContent = running
    ? t('popupChecking')
    : `${t('popupWatching')} · ${t('popupEvery', [String(s.settings.intervalHours)])}`;
  $('lastCheck').textContent = !lastRun
    ? t('popupNever')
    : lastRun.ok
      ? t('popupLastCheck', [relativeTime(lastRun.at)])
      : t('popupLastError', [lastRun.error ?? '?']);
  const checkNow = $<HTMLButtonElement>('checkNow');
  checkNow.disabled = running;
  checkNow.classList.toggle('is-busy', running);
  $('login').hidden = !loggedOut;

  // Promos seen in the latest detection are "current"; older claimed ones go to the history list.
  const promos = Object.values(s.promos);
  const latest = Math.max(0, ...promos.map((p) => p.lastSeen));
  const current = promos
    .filter((p) => p.lastSeen === latest)
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const recent = promos
    .filter((p) => p.status === 'claimed' && p.lastSeen !== latest)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  syncCards(current, s.meta.loggedIn, seenAt);
  firstRender = false;

  $('empty').hidden = current.length > 0 || !lastRun;
  $('emptyBody').textContent = t('popupEmptyBody', [String(s.settings.intervalHours)]);
  $('recentWrap').hidden = recent.length === 0;
  $('recent').replaceChildren(
    ...recent.map((p) =>
      el('li', {}, [el('span', { textContent: p.name }), el('time', { textContent: relativeTime(p.updatedAt) })]),
    ),
  );
}

async function main(): Promise<void> {
  translatePage();
  $('settings').title = t('popupSettings');
  $('settings').addEventListener('click', () => void browser.runtime.openOptionsPage());
  $('checkNow').addEventListener('click', () => void send({ type: 'checkNow' }));
  $('diagnostics').addEventListener('click', async () => {
    const report = buildDiagnostics(await readSnapshot());
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    $('diagnostics').textContent = t('popupCopied');
    setTimeout(() => ($('diagnostics').textContent = t('popupDiagnostics')), 1500);
  });

  const seenAt = Number((await browser.storage.local.get(SEEN_KEY))[SEEN_KEY] ?? 0);
  render(await readSnapshot(), seenAt);
  await browser.storage.local.set({ [SEEN_KEY]: Date.now() });

  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || (Object.keys(changes).length === 1 && SEEN_KEY in changes)) return;
    render(await readSnapshot(), seenAt);
    void browser.storage.local.set({ [SEEN_KEY]: Date.now() });
  });
}

void main();
