// Renders the popup's Epic tab for the README into docs/assets/epic-<lang>.png (2x, fictional games).
//
//   npm run build
//   node scripts/demo/epic-shot.mjs
//
// Needs Playwright with Chromium.
import { join } from 'node:path';
import { chromium, demoEpicSeed, mockExtension, root, startServer } from './shared.mjs';

const server = await startServer();
const browser = await chromium.launch();
for (const lang of ['en', 'zh_TW']) {
  const context = await browser.newContext({ viewport: { width: 380, height: 200 }, deviceScaleFactor: 2, locale: lang.replace('_', '-') });
  await mockExtension(context, lang, demoEpicSeed(Date.now()));
  const page = await context.newPage();
  await page.goto(`${server.origin}/popup.html`);
  await page.click('#tabEpic');
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(root, `docs/assets/epic-${lang}.png`), fullPage: true });
  await context.close();
}
await browser.close();
server.close();
console.log('wrote docs/assets/epic-en.png and epic-zh_TW.png');
