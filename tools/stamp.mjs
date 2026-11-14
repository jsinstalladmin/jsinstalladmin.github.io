/* ═══════════════════════════════════════════════════════════════════════
   stamp.mjs: put a version on every script and stylesheet the pages load.

   GitHub Pages serves assets with a long cache life and Safari honours it
   hard. The result, three times running, was a fix that was on the server
   and not in the browser: the page ran a builder.js from yesterday, drew
   the old pale room, and the work looked like it had never happened.

   A URL that changes when the file changes is the only cure. This stamps
   every <script src> and <link href> that points at assets/js or
   assets/css with ?v=<stamp>, and stamps the relative imports INSIDE those
   modules too, because a stamped builder.js that imports a bare
   './design.js' still gets yesterday's design.js.

     node tools/stamp.mjs            stamps with today's date and a counter
     node tools/stamp.mjs --check    says what is unstamped, writes nothing

   Run it after any change under assets/, before shipping.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

/* The stamp is a hash of every asset the pages load, so it changes when
   and only when something they load has changed. Re-running it with no
   edits rewrites nothing. */
const assetFiles = [];
for (const dir of ['assets/js', 'assets/css']) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) if (/\.(js|css)$/.test(f)) assetFiles.push(path.join(dir, f));
}
assetFiles.sort();
const h = crypto.createHash('sha1');
for (const f of assetFiles) h.update(f).update(fs.readFileSync(path.join(ROOT, f)).toString().replace(/\?v=[a-f0-9]{8}/g, ''));
const STAMP = h.digest('hex').slice(0, 8);

const htmlFiles = [];
(function walk(d){
  for (const e of fs.readdirSync(d, { withFileTypes:true })) {
    if (e.isDirectory()) { if (!/^(_|node_modules|\.)/.test(e.name)) walk(path.join(d, e.name)); }
    else if (e.name.endsWith('.html')) htmlFiles.push(path.join(d, e.name));
  }
})(ROOT);

let changed = 0, unstamped = [];
const stampUrl = u => u.replace(/\?v=[a-f0-9]{8}/, '') + '?v=' + STAMP;

for (const f of [...htmlFiles, ...assetFiles.map(a => path.join(ROOT, a))]) {
  const before = fs.readFileSync(f, 'utf8');
  let s = before;
  if (f.endsWith('.html')) {
    s = s.replace(/(<script[^>]*\ssrc=")([^"]*assets\/(?:js|css)\/[^"?]+(?:\?v=[a-f0-9]{8})?)(")/g,
                  (_, a, u, b) => a + stampUrl(u) + b);
    s = s.replace(/(<link[^>]*\shref=")([^"]*assets\/css\/[^"?]+(?:\?v=[a-f0-9]{8})?)(")/g,
                  (_, a, u, b) => a + stampUrl(u) + b);
    /* the import map points at the vendored three, which also wants it */
    s = s.replace(/("[^"]*assets\/vendor\/[^"?]+\.js)(\?v=[a-f0-9]{8})?(")/g,
                  (_, u, __, b) => u + '?v=' + STAMP + b);
  } else if (f.endsWith('.js')) {
    /* a stamped entry that imports a bare sibling still gets the old one */
    s = s.replace(/(from\s+'\.\/[A-Za-z0-9._-]+\.js)(\?v=[a-f0-9]{8})?(')/g,
                  (_, u, __, b) => u + '?v=' + STAMP + b);
    s = s.replace(/(import\(\s*'\.\/[A-Za-z0-9._-]+\.js)(\?v=[a-f0-9]{8})?(')/g,
                  (_, u, __, b) => u + '?v=' + STAMP + b);
  }
  if (s !== before) {
    if (CHECK) unstamped.push(path.relative(ROOT, f));
    else { fs.writeFileSync(f, s); changed++; }
  }
}

if (CHECK) {
  console.log(unstamped.length ? 'needs stamping (' + STAMP + '):\n  ' + unstamped.join('\n  ')
                               : 'everything is stamped ' + STAMP);
  process.exitCode = unstamped.length ? 1 : 0;
} else {
  console.log(`stamp ${STAMP}: ${changed} file${changed === 1 ? '' : 's'} updated`);
}
