// Bundles src/ into one self-contained index.html (open it directly or host it anywhere).
// Usage: npm run build

import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');

const res = await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  target: ['es2020', 'safari15', 'chrome90', 'firefox90'],
  legalComments: 'eof',
  write: false,
  logLevel: 'warning',
});

const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync(join(here, 'src/template.html'), 'utf8');
const marker = '<script>/*__GAME__*/</script>';
if (!tpl.includes(marker)) throw new Error('template is missing the game marker');
const html = tpl.replace(marker, () => `<script>\n${js}</script>`);
writeFileSync(join(here, 'index.html'), html);
console.log(`index.html written: ${(html.length / 1024).toFixed(0)} KB (script ${(js.length / 1024).toFixed(0)} KB)`);
