// Derives a claude.ai Artifact page from index.html: the Artifact host supplies the document
// skeleton (doctype/head/body, charset, viewport), so those wrappers are stripped here.
// Usage: node tools/artifact.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) throw new Error('usage: node tools/artifact.mjs <out.html>');
let html = readFileSync(join(here, '..', 'index.html'), 'utf8');
const drop = [
  /<!doctype html>\s*/i,
  /<html[^>]*>\s*/i,
  /<\/html>\s*/i,
  /<head>\s*/i,
  /<\/head>\s*/i,
  /<body>\s*/i,
  /<\/body>\s*/i,
  /<meta charset="utf-8">\s*/i,
  /<meta name="viewport"[^>]*>\s*/i,
  /<meta name="apple-mobile-web-app-[^>]*>\s*/gi,
  /<meta name="mobile-web-app-capable"[^>]*>\s*/i,
  /<link rel="manifest"[^>]*>\s*/i,
  /<link rel="apple-touch-icon"[^>]*>\s*/i,
];
for (const re of drop) html = html.replace(re, '');
// title first so the host finds it in the first 8 KB
const title = html.match(/<title>[^<]*<\/title>\s*/i)[0];
html = title + html.replace(title, '');
writeFileSync(out, html);
console.log('artifact page written:', out, (html.length / 1024).toFixed(0) + ' KB');
