// Renders the extension icons from docs/assets/icon.svg.
//
//   node scripts/render-icons.mjs
//
// The 128 px icon keeps the artwork at 96 px with 16 px transparent padding, as the Chrome Web Store
// asks; the toolbar sizes use the full canvas. Needs Playwright with Chromium.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, root } from './demo/shared.mjs';

const svg = readFileSync(join(root, 'docs/assets/icon.svg'), 'utf8');
const targets = [
  ...[16, 32, 48, 96].map((size) => ({ size, art: size, file: `public/icon/${size}.png` })),
  { size: 128, art: 96, file: 'public/icon/128.png' },
  { size: 512, art: 512, file: 'docs/assets/icon-512.png' },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { size, art, file } of targets) {
  const pad = (size - art) / 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent;padding:${pad}px">${svg.replace('<svg ', `<svg width="${art}" height="${art}" style="display:block" `)}</body></html>`,
  );
  await page.screenshot({ path: join(root, file), omitBackground: true });
}
await browser.close();
console.log('icons rendered');
