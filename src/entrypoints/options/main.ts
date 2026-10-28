import '@/assets/theme.css';
import './style.css';
import { browser } from 'wxt/browser';
import { EPIC_ORIGIN } from '@/core/epic';
import { GOG_ORIGINS } from '@/core/gog';
import { LOGIN_ORIGIN, STORE, STORE_ORIGIN } from '@/core/steam';
import { DEFAULT_SETTINGS, INTERVAL_HOURS, type IntervalHours, type RenewMode, type Settings } from '@/core/types';
import { CHEST_PRESETS, chestElement, isHex, type ChestColors } from '@/lib/chest';
import { t, translatePage } from '@/lib/i18n';
import { fillPixelIcons, pixelSafe } from '@/lib/pixel';
import { readSnapshot, saveSettings, type Snapshot } from '@/lib/storage';
import { formatDate, relativeTime } from '@/lib/time';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const includeDlc = $<HTMLInputElement>('includeDlc');
const notifications = $<HTMLInputElement>('notifications');
const epic = $<HTMLInputElement>('epic');
const gog = $<HTMLInputElement>('gog');
const chestBody = $<HTMLInputElement>('chestBody');
const chestBand = $<HTMLInputElement>('chestBand');
const epicPermission = { origins: [EPIC_ORIGIN] };
const gogPermission = { origins: GOG_ORIGINS };
const loginPermission = { origins: [LOGIN_ORIGIN] };
const modes = document.querySelectorAll<HTMLInputElement>('input[name="mode"]');
const renewModes = document.querySelectorAll<HTMLInputElement>('input[name="renew"]');

let savedTimer: ReturnType<typeof setTimeout> | undefined;
async function save(patch: Partial<Settings>): Promise<void> {
  await saveSettings(patch);
  $('saved').hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => ($('saved').hidden = true), 1500);
}

function tag(text: string, tone = ''): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `tag ${tone}${pixelSafe(text) ? '' : ' nopx'}`;
  span.textContent = text;
  return span;
}

/** Status chips in the banner: login, region, last check, games claimed so far. */
function renderStatus(s: Snapshot): void {
  const chips: HTMLElement[] = [];
  if (s.meta.loggedIn === true) chips.push(tag(t('chipLoggedIn'), 'free'));
  else if (s.meta.loggedIn === false) {
    chips.push(s.meta.login === 'expired' ? tag(t('notifyExpiredTitle'), 'warn') : tag(t('chipLoggedOut'), 'bad'));
  }
  if (s.meta.country) chips.push(tag(t('chipRegion', [s.meta.country])));
  const last = s.runs[0];
  chips.push(tag(last ? t('popupLastCheck', [relativeTime(last.at)]) : t('popupNever')));
  if (s.meta.claimedTotal > 0) chips.push(tag(t('chipClaimed', [String(s.meta.claimedTotal)]), 'got'));
  $('chips').replaceChildren(...chips);

  const running = s.runningSince > 0 && Date.now() - s.runningSince < 2 * 60_000;
  const checkNow = $<HTMLButtonElement>('checkNow');
  checkNow.disabled = running;
  checkNow.classList.toggle('is-busy', running);

  const r = s.meta.renewal;
  $('renewLast').hidden = !r;
  if (r) $('renewLast').textContent = t('optRenewLast', [formatDate(r.at), t(`renewResult_${r.result}`)]);
}

/** Which sites FreeKeep can reach right now, read live from the browser's permissions. */
async function renderHosts(): Promise<void> {
  const [store, login, epicOn, gogOn] = await Promise.all([
    browser.permissions.contains({ origins: [STORE_ORIGIN] }),
    browser.permissions.contains(loginPermission),
    browser.permissions.contains(epicPermission),
    browser.permissions.contains(gogPermission),
  ]);
  const rows: [string, string, boolean, boolean][] = [
    [new URL(STORE).host, t('hostStore'), store, true],
    ['login.steampowered.com', t('hostLogin'), login, false],
    ['store-site-backend-static-ipv4.ak.epicgames.com', t('hostEpic'), epicOn, false],
    ['sections.gog.com', t('hostGog'), gogOn, false],
    ['catalog.gog.com', t('hostGog'), gogOn, false],
  ];
  $('hosts').replaceChildren(
    ...rows.map(([host, use, on, required]) => {
      const row = document.createElement('div');
      row.className = 'host';
      const led = document.createElement('span');
      led.className = `led ${on ? 'on' : ''}`;
      const code = document.createElement('code');
      code.textContent = host;
      const small = document.createElement('small');
      small.textContent = use;
      // The required store access can still be turned off in the browser; flag it then.
      const state = required ? tag(t('hostRequired'), on ? 'free' : 'bad') : tag(t(on ? 'hostOn' : 'hostOff'), on ? 'free' : '');
      row.append(led, code, state, small);
      return row;
    }),
  );
}

function renderChest(colors: ChestColors): void {
  $('navLogo').replaceChildren(chestElement(colors, 32));
  $('bannerLogo').replaceChildren(chestElement(colors, 64));
  $('previewBig').replaceChildren(chestElement(colors, 96));
  $('previewLight').replaceChildren(chestElement(colors, 16));
  $('previewDark').replaceChildren(chestElement(colors, 16));
  chestBody.value = colors.body;
  chestBand.value = colors.band;
  document.querySelectorAll<HTMLButtonElement>('.swatch').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.body === colors.body && b.dataset.band === colors.band));
  });
}

function buildInterval(current: IntervalHours): void {
  const seg = $('intervalSeg');
  const paint = (value: number) =>
    seg.querySelectorAll('label').forEach((l, i) => l.classList.toggle('fill', INTERVAL_HOURS[i]! <= value));
  seg.replaceChildren(
    ...INTERVAL_HOURS.map((hours) => {
      const label = document.createElement('label');
      const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'interval', value: String(hours) });
      input.checked = hours === current;
      input.addEventListener('change', () => {
        paint(hours);
        void save({ intervalHours: hours });
      });
      const bar = document.createElement('span');
      bar.className = 'bar';
      const text = document.createElement('span');
      text.className = 'px';
      text.textContent = t('optHours', [String(hours)]);
      label.append(input, bar, text);
      return label;
    }),
  );
  paint(current);
}

function buildSwatches(): void {
  $('swatches').replaceChildren(
    ...CHEST_PRESETS.map((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.body = p.body;
      b.dataset.band = p.band;
      b.title = t(`chest_${p.id}`);
      b.setAttribute('aria-label', b.title);
      b.replaceChildren(chestElement(p, 32));
      b.addEventListener('click', () => void setChest({ body: p.body, band: p.band }));
      return b;
    }),
  );
}

async function setChest(colors: ChestColors): Promise<void> {
  if (!isHex(colors.body) || !isHex(colors.band)) return;
  renderChest(colors);
  await save({ chestBody: colors.body, chestBand: colors.band });
}

/** Highlights the section in view in the table of contents. */
function watchSections(): void {
  const links = new Map([...document.querySelectorAll<HTMLAnchorElement>('.toc a')].map((a) => [a.hash.slice(1), a]));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a, id) => a.setAttribute('aria-current', String(id === entry.target.id)));
      }
    },
    { rootMargin: '-20% 0px -70% 0px' },
  );
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}

async function init(): Promise<void> {
  translatePage();
  fillPixelIcons();
  $('version').textContent = `FreeKeep ${browser.runtime.getManifest().version}`;

  const snapshot = await readSnapshot();
  const { settings } = snapshot;
  buildInterval(settings.intervalHours);
  buildSwatches();
  renderChest({ body: settings.chestBody, band: settings.chestBand });
  renderStatus(snapshot);
  await renderHosts();
  watchSections();

  includeDlc.checked = settings.includeDlc;
  notifications.checked = settings.notifications;
  modes.forEach((m) => (m.checked = m.value === settings.mode));
  // Reflect the real state: the user may have revoked the permission in chrome://extensions.
  epic.checked = settings.epic && (await browser.permissions.contains(epicPermission));
  gog.checked = settings.gog && (await browser.permissions.contains(gogPermission));

  includeDlc.addEventListener('change', () => void save({ includeDlc: includeDlc.checked }));
  notifications.addEventListener('change', () => void save({ notifications: notifications.checked }));
  modes.forEach((m) => m.addEventListener('change', () => void save({ mode: m.value as Settings['mode'] })));

  let renew: RenewMode = settings.renew;
  const showRenew = async () => {
    renewModes.forEach((r) => (r.checked = r.value === renew));
    // The user can revoke the permission in chrome://extensions; the popup then offers one click instead.
    $('renewMissing').hidden = renew !== 'auto' || (await browser.permissions.contains(loginPermission));
  };
  await showRenew();
  const chooseRenew = async (next: RenewMode) => {
    // Requesting must be the first call in the click handler, while Chrome still counts it as a user gesture.
    const granted = next === 'auto' ? await browser.permissions.request(loginPermission) : true;
    $('renewDenied').hidden = granted;
    if (granted) {
      renew = next;
      await save({ renew });
      // Least privilege: only automatic renewal needs login.steampowered.com.
      if (next !== 'auto') await browser.permissions.remove(loginPermission);
    }
    await showRenew();
  };
  renewModes.forEach((r) => r.addEventListener('change', () => void chooseRenew(r.value as RenewMode)));
  $('renewGrant').addEventListener('click', () => void chooseRenew('auto'));

  /**
   * Epic and GOG reminders each need their store's public data. The permission is requested when a
   * reminder is turned on and given back when it's turned off: least privilege.
   */
  const reminderToggle = (input: HTMLInputElement, store: 'epic' | 'gog', permission: { origins: string[] }, denied: string) =>
    input.addEventListener('change', async () => {
      if (!input.checked) {
        await save({ [store]: false });
        await browser.storage.local.remove(store); // the engine also clears it on its next run
        await browser.permissions.remove(permission);
        return;
      }
      // Must be the first call in the click handler, while the browser still counts it as user input.
      const granted = await browser.permissions.request(permission);
      $(denied).hidden = granted;
      if (!granted) {
        input.checked = false;
        return;
      }
      await save({ [store]: true });
      void browser.runtime.sendMessage({ type: 'checkNow' });
    });
  reminderToggle(epic, 'epic', epicPermission, 'epicDenied');
  reminderToggle(gog, 'gog', gogPermission, 'gogDenied');

  // Colour pickers preview while dragging and save once a colour is picked.
  const picked = (): ChestColors => ({ body: chestBody.value, band: chestBand.value });
  for (const input of [chestBody, chestBand]) {
    input.addEventListener('input', () => renderChest(picked()));
    input.addEventListener('change', () => void setChest(picked()));
  }
  $('chestReset').addEventListener('click', () =>
    void setChest({ body: DEFAULT_SETTINGS.chestBody, band: DEFAULT_SETTINGS.chestBand }),
  );

  $('checkNow').addEventListener('click', () => void browser.runtime.sendMessage({ type: 'checkNow' }));
  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && (changes.meta || changes.runs || changes.runningSince)) renderStatus(await readSnapshot());
  });
  browser.permissions.onAdded.addListener(() => void renderHosts());
  browser.permissions.onRemoved.addListener(() => void renderHosts());
}

void init();
