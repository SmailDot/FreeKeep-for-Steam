// Renders the Chrome Web Store images from the real popup UI into .output/store/:
//   icon-128.png, small-tile-440x280.png, marquee-1400x560.png,
//   screenshot-<lang>-1-claimed.png, screenshot-<lang>-2-overview.png and
//   screenshot-<lang>-3-epic.png (1280×800)
//
//   npm run build
//   node scripts/demo/store-assets.mjs
//
// All images are opaque 24-bit PNGs, as the store requires. Needs Playwright with Chromium.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, demoClaimedSeed, demoEpicSeed, mockExtension, root, startServer } from './shared.mjs';

const out = join(root, '.output/store');
mkdirSync(out, { recursive: true });

const T = Date.now();
const claimedSeed = demoClaimedSeed(T);
const epicSeed = demoEpicSeed(T);

const STAGE_CSS =
  'html,body{width:1280px!important;height:800px!important}body{padding:0 84px!important;gap:64px!important}' +
  '.brand,h1,.privacy,li{animation:none!important;opacity:1!important}';

const server = await startServer();
const browser = await chromium.launch();

async function open(lang, viewport, path, seed = claimedSeed) {
  const context = await browser.newContext({ viewport, locale: lang.replace('_', '-') });
  await mockExtension(context, lang, seed);
  const page = await context.newPage();
  await page.goto(`${server.origin}${path}`);
  return { page, close: () => context.close() };
}

for (const lang of ['en', 'zh_TW']) {
  const { page, close } = await open(lang, { width: 1280, height: 800 }, `/stage.html?lang=${lang}`);
  await page.addStyleTag({ content: STAGE_CSS });
  await page.waitForTimeout(950); // mid-celebration: confetti and toasts
  await page.screenshot({ path: join(out, `screenshot-${lang}-1-claimed.png`) });
  await page.waitForTimeout(3200); // settled
  await page.screenshot({ path: join(out, `screenshot-${lang}-2-overview.png`) });
  await close();
}

for (const lang of ['en', 'zh_TW']) {
  const { page, close } = await open(lang, { width: 1280, height: 800 }, `/stage.html?lang=${lang}&scene=epic`, epicSeed);
  await page.addStyleTag({ content: STAGE_CSS });
  await page.frameLocator('#popup').locator('#tabEpic').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, `screenshot-${lang}-3-epic.png`) });
  await close();
}

{
  const { page, close } = await open('en', { width: 440, height: 280 }, '/tile.html?kind=small');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, 'small-tile-440x280.png') });
  await close();
}
{
  const { page, close } = await open('en', { width: 1400, height: 560 }, '/tile.html?kind=marquee');
  await page.waitForTimeout(4200);
  await page.screenshot({ path: join(out, 'marquee-1400x560.png') });
  await close();
}

copyFileSync(join(root, 'public/icon/128.png'), join(out, 'icon-128.png'));
await browser.close();
server.close();
console.log(`wrote store images to ${out}`);
