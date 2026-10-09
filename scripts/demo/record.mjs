// Renders the README demo from the real popup UI.
//
//   npm run build
//   node scripts/demo/record.mjs [en|zh_TW|zh_CN]
//
// Needs Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`)
// and ffmpeg on PATH. Writes docs/assets/demo-<lang>.gif and .mp4.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const lang = process.argv[2] ?? 'en';
const root = fileURLToPath(new URL('../../', import.meta.url));
const built = join(root, '.output/chrome-mv3');
const WIDTH = 1200;
const HEIGHT = 700;

// ---------- static server for the built extension + stage ----------
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const file = path === '/stage.html' ? join(root, 'scripts/demo/stage.html') : join(built, path);
  try {
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---------- fictional games ----------
function capsule(title, from, to) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="215">
    <defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
    <rect width="460" height="215" fill="url(#g)"/>
    <circle cx="380" cy="40" r="90" fill="#fff" opacity=".12"/><circle cx="60" cy="200" r="70" fill="#000" opacity=".15"/>
    <text x="28" y="130" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="52" fill="#fff">${title}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const T = Date.now();
const base = { attempts: 0, lastError: null, userSkipped: false, firstSeen: T, lastSeen: T, updatedAt: T, baseAppid: null, baseName: null };
const promos = {
  1: { ...base, subid: 1, appid: 11, name: 'Neon Drift', kind: 'game', status: 'pending', capsule: capsule('NEON DRIFT', '#ec4899', '#6d28d9'), endsText: 'Free to keep when you get it before Oct 16 @ 10:00am.' },
  2: { ...base, subid: 2, appid: 12, name: 'Orbital Chef', kind: 'game', status: 'pending', capsule: capsule('ORBITAL CHEF', '#f59e0b', '#dc2626'), endsText: 'Free to keep when you get it before Oct 14 @ 10:00am.' },
  3: { ...base, subid: 3, appid: 13, name: 'Star Forge: Captain Pack', kind: 'dlc', status: 'pending', baseAppid: 99, baseName: 'Star Forge', capsule: capsule('STAR FORGE', '#0ea5e9', '#1e3a8a'), endsText: 'Free to keep when you get it before Oct 20 @ 10:00am.' },
};
const settings = { intervalHours: 6, mode: 'auto', includeDlc: true, notifications: true };
const meta = { country: 'TW', loggedIn: true, sessionCheckedAt: T, decidedAt: T, loginNotified: false, appCache: {} };
const seed = {
  settings,
  promos: {},
  meta,
  runs: [{ at: T - 6 * 3_600_000, reason: 'alarm', ok: true, loggedIn: true, country: 'TW', found: 0, claimed: 0, error: null }],
  runningSince: 0,
  popupSeenAt: T,
};

// ---------- record ----------
const videoDir = mkdtempSync(join(tmpdir(), 'freekeep-demo-'));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  recordVideo: { dir: videoDir, size: { width: WIDTH, height: HEIGHT } },
  locale: lang.replace('_', '-'),
});
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

const page = await context.newPage();
await page.goto(`${origin}/stage.html?lang=${lang}`);
const frame = page.frame({ url: /popup\.html/ });
await frame.waitForSelector('#checkNow');

const wait = (ms) => page.waitForTimeout(ms);
const set = (patch) => frame.evaluate((p) => window.__demo.set(p), patch);
const now = () => Date.now();
let state = structuredClone(promos);
const update = (id, patch) => {
  state = { ...state, [id]: { ...state[id], ...patch, updatedAt: now() } };
  return set({ promos: state });
};

// The "Check now" and "Retry" buttons are clicked for real; the fake background answers them.
await frame.evaluate(() => {
  window.__demo.onCommand = (c) => {
    if (c.type === 'checkNow') window.__demo.set({ runningSince: Date.now() });
  };
});

await wait(1300);
await frame.click('#checkNow');
await wait(1300);
await set({ promos: state });
await wait(1000);
await update(1, { status: 'claimed' });
await wait(1300);
await update(3, { status: 'needs_base' });
await wait(1100);
await update(2, { status: 'failed', attempts: 3, lastError: 'http_502' });
await wait(900);
await set({
  runningSince: 0,
  runs: [{ at: now(), reason: 'manual', ok: true, loggedIn: true, country: 'TW', found: 3, claimed: 1, error: null }],
});
await wait(1200);
await frame.click('.card.is-failed button.primary');
await wait(1100);
await update(2, { status: 'claimed', attempts: 0, lastError: null });
await wait(2600);

const video = await page.video().path();
await context.close();
await browser.close();
server.close();

// ---------- encode ----------
const out = join(root, `docs/assets/demo-${lang}`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.4', '-i', video, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', `${out}.mp4`]);
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-ss', '0.4', '-i', video,
  '-vf', 'fps=12,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
  `${out}.gif`,
]);
rmSync(videoDir, { recursive: true, force: true });
console.log(`wrote ${out}.gif and ${out}.mp4`);
