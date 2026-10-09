// Shared pieces for the demo recorder and the store asset generator: a static server for the built
// extension, fictional games, and the fake extension state the mocked popup starts from.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const built = join(root, '.output/chrome-mv3');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const pages = { '/stage.html': 'scripts/demo/stage.html', '/tile.html': 'scripts/demo/tile.html' };

/** Serves the built extension plus the demo pages; returns { origin, close }. */
export async function startServer() {
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    const file = pages[path] ? join(root, pages[path]) : join(built, path);
    try {
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

function capsule(title, from, to) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="215">
    <defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
    <rect width="460" height="215" fill="url(#g)"/>
    <circle cx="380" cy="40" r="90" fill="#fff" opacity=".12"/><circle cx="60" cy="200" r="70" fill="#000" opacity=".15"/>
    <text x="28" y="130" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="52" fill="#fff">${title}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Three fictional promotions: two games and a DLC whose base game isn't owned. */
export function demoPromos(T) {
  const base = { attempts: 0, lastError: null, userSkipped: false, firstSeen: T, lastSeen: T, updatedAt: T, baseAppid: null, baseName: null };
  return {
    1: { ...base, subid: 1, appid: 11, name: 'Neon Drift', kind: 'game', status: 'pending', capsule: capsule('NEON DRIFT', '#ec4899', '#6d28d9'), endsText: 'Free to keep when you get it before Oct 16 @ 10:00am.' },
    2: { ...base, subid: 2, appid: 12, name: 'Orbital Chef', kind: 'game', status: 'pending', capsule: capsule('ORBITAL CHEF', '#f59e0b', '#dc2626'), endsText: 'Free to keep when you get it before Oct 14 @ 10:00am.' },
    3: { ...base, subid: 3, appid: 13, name: 'Star Forge: Captain Pack', kind: 'dlc', status: 'pending', baseAppid: 99, baseName: 'Star Forge', capsule: capsule('STAR FORGE', '#0ea5e9', '#1e3a8a'), endsText: 'Free to keep when you get it before Oct 20 @ 10:00am.' },
  };
}

/** Fictional Epic giveaways: two running now, two announced for next week. */
export function demoEpic(T) {
  const day = 86_400_000;
  // Weekly giveaways switch at the same hour: this week's started two days ago at 17:00.
  const start = new Date(T - 2 * day).setHours(17, 0, 0, 0);
  const next = start + 7 * day;
  const offer = (id, title, from, to, start, upcoming, status) => ({
    id: `demo:${id}`,
    title,
    kind: 'game',
    url: 'https://store.epicgames.com/free-games',
    image: capsule(title.toUpperCase(), from, to),
    start,
    end: start + 7 * day,
    upcoming,
    status,
    firstSeen: T,
    lastSeen: T,
  });
  return {
    'demo:1': offer(1, 'Lumen Tides', '#14b8a6', '#1e3a8a', start, false, 'notified'),
    'demo:2': offer(2, 'Paper Knights', '#a3e635', '#15803d', start, false, 'opened'),
    'demo:3': offer(3, 'Moss Runner', '#84cc16', '#365314', next, true, 'new'),
    'demo:4': offer(4, 'Quiet Harbor', '#38bdf8', '#0c4a6e', next, true, 'new'),
  };
}

/** Extension storage as the popup sees it: logged in, last checked six hours ago, nothing found yet. */
export function demoSeed(T) {
  return {
    settings: { intervalHours: 6, mode: 'auto', includeDlc: true, notifications: true },
    promos: {},
    meta: { country: 'TW', loggedIn: true, sessionCheckedAt: T, decidedAt: T, loginNotified: false, appCache: {} },
    runs: [{ at: T - 6 * 3_600_000, reason: 'alarm', ok: true, loggedIn: true, country: 'TW', found: 0, claimed: 0, error: null }],
    runningSince: 0,
    popupSeenAt: T,
  };
}

/** Installs the mocked extension APIs (with this language and storage) into every popup frame. */
export async function mockExtension(context, lang, seed) {
  const messages = JSON.parse(readFileSync(join(built, `_locales/${lang}/messages.json`), 'utf8'));
  await context.addInitScript(
    ({ messages, lang, seed }) => {
      window.__DEMO_MESSAGES__ = messages;
      window.__DEMO_LANG__ = lang.replace('_', '-');
      window.__DEMO_SEED__ = seed;
    },
    { messages, lang, seed },
  );
  await context.addInitScript({ path: join(root, 'scripts/demo/mock-chrome.js') });
}
