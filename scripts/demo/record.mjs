// Renders the README demo from the real popup UI.
//
//   npm run build
//   node scripts/demo/record.mjs [en|zh_TW]
//
// Needs Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`)
// and ffmpeg on PATH. Writes docs/assets/demo-<lang>.gif and .mp4.
//
// Story, told by the copy on the left while the real popup acts on the right:
//   problem (others want your password) → how (FreeKeep never sees your login) → claim (three
//   promotions found and claimed, one retried) → epic (the Epic tab) → proof (check it yourself).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, demoEpic, demoPromos, demoSeed, mockExtension, root, startServer } from './shared.mjs';

const lang = process.argv[2] ?? 'en';
const WIDTH = 1200;
const HEIGHT = 700;
const T = Date.now();
const server = await startServer();

const videoDir = mkdtempSync(join(tmpdir(), 'freekeep-demo-'));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  recordVideo: { dir: videoDir, size: { width: WIDTH, height: HEIGHT } },
  locale: lang.replace('_', '-'),
});
const seed = demoSeed(T);
// Epic reminders on, but its list arrives after the Steam tab is picked (see below).
await mockExtension(context, lang, { ...seed, settings: { ...seed.settings, epic: true } });

const page = await context.newPage();
await page.goto(`${server.origin}/stage.html?lang=${lang}&scene=problem`);
const frame = page.frame({ url: /popup\.html/ });
await frame.waitForSelector('#checkNow');
// With Steam empty and Epic giveaways listed, the popup would open on the Epic tab. Pick Steam first,
// then hand it the Epic list, so the story starts on Steam with an "Epic Games 2" badge.
await frame.click('#tabSteam');
await frame.evaluate((p) => window.__demo.set(p), { epic: demoEpic(T), runs: [{ ...seed.runs[0], epic: 2 }] });

const wait = (ms) => page.waitForTimeout(ms);
const set = (patch) => frame.evaluate((p) => window.__demo.set(p), patch);
const now = () => Date.now();
let state = demoPromos(T);
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

const scene = (name) => page.evaluate((n) => window.showScene(n), name);
await wait(2800);
await scene('how');
await wait(3300);
await scene('claim');
await wait(500);
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
  runs: [{ at: now(), reason: 'manual', ok: true, loggedIn: true, country: 'TW', found: 3, claimed: 1, error: null, epic: 2 }],
});
await wait(1200);
await frame.click('.card.is-failed button.primary');
await wait(1100);
await update(2, { status: 'claimed', attempts: 0, lastError: null });
await wait(1800);
await scene('epic');
await wait(600);
await frame.click('#tabEpic');
await wait(2800);
await scene('proof');
await wait(3000);

const video = await page.video().path();
await context.close();
await browser.close();
server.close();

const out = join(root, `docs/assets/demo-${lang}`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.4', '-i', video, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', `${out}.mp4`]);
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-ss', '0.4', '-i', video,
  '-vf', 'fps=10,scale=860:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
  `${out}.gif`,
]);
rmSync(videoDir, { recursive: true, force: true });
console.log(`wrote ${out}.gif and ${out}.mp4`);
