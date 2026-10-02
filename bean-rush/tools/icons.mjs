// Renders the app icons (PNG) from an inline SVG: node tools/icons.mjs
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fa9ff"/><stop offset="0.62" stop-color="#bfe6ff"/><stop offset="1" stop-color="#ff9fd6"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 ${268 + pad * 0.2}) scale(${1 - pad / 512})">
    <ellipse cx="0" cy="190" rx="120" ry="22" fill="#2b2d5c" opacity=".25"/>
    <circle cx="-118" cy="40" r="34" fill="#ff86c8" stroke="#2b2d5c" stroke-width="14"/>
    <circle cx="118" cy="40" r="34" fill="#ff86c8" stroke="#2b2d5c" stroke-width="14"/>
    <rect x="-100" y="-190" width="200" height="370" rx="100" fill="#ff86c8" stroke="#2b2d5c" stroke-width="16"/>
    <path d="M-100 40 h200 v40 h-200z" fill="#ffd23f" opacity=".0"/>
    <ellipse cx="0" cy="-70" rx="74" ry="52" fill="#ffe8d4"/>
    <ellipse cx="-30" cy="-68" rx="22" ry="27" fill="#fff" stroke="#2b2d5c" stroke-width="6"/>
    <ellipse cx="30" cy="-68" rx="22" ry="27" fill="#fff" stroke="#2b2d5c" stroke-width="6"/>
    <ellipse cx="-27" cy="-63" rx="12" ry="15" fill="#1d1b2e"/>
    <ellipse cx="33" cy="-63" rx="12" ry="15" fill="#1d1b2e"/>
    <circle cx="-31" cy="-69" r="4.5" fill="#fff"/><circle cx="29" cy="-69" r="4.5" fill="#fff"/>
    <path d="M-62 -168 l26 34 30 -50 30 50 26 -34 -12 62 h-88z" fill="#ffd23f" stroke="#2b2d5c" stroke-width="10" stroke-linejoin="round" transform="translate(0 -40)"/>
  </g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-512.png', 512, 0], ['icon-192.png', 192, 0], ['apple-touch-icon.png', 180, 0], ['icon-maskable-512.png', 512, 90]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: join(here, '..', name), omitBackground: false });
  console.log('wrote', name);
}
await browser.close();
