/* ═══════════════════════════════════════════════════════════════════════
   render-images.mjs: the layout pictures, rendered by the builder.

   The twelve pieces a customer can put in a tower each need two pictures:
   a square one for the menu (img/nav/<preset>.jpg) and a taller one for
   the layout page (img/parts/<key>.jpg). Both come out of the site's own
   3D engine through the ?audit=1 handles, for the same reason the film
   does: a drawn or generated picture can show something this company does
   not build, and an engine render cannot.

     node tools/render-images.mjs                  renders to .image-out/
     node tools/render-images.mjs --write          puts them in img/
     node tools/render-images.mjs --only drawers   one piece
     node tools/render-images.mjs --port 8777

   It needs a local server on the site root (see tools/README.md).
   Nothing is overwritten unless you pass --write.
   ═════════════════════════════════════════════════════════════════════ */
const pw = await (async () => {
  for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright/index.js']) {
    try { return await import(p); } catch (e) {}
  }
  throw new Error('playwright not found. Run: npm i -D playwright && npx playwright install chromium');
})();
const chromium = pw.chromium || pw.default.chromium;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const arg  = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const PORT  = +arg('--port', 8777);
const ONLY  = arg('--only', null);
const WRITE = argv.includes('--write');
/* fileURLToPath, not url.pathname: a path with a space in it comes back
   percent encoded, so on a drive called "Site Builder" every path handed
   to ffmpeg had %20 in it and ffmpeg could not find a single frame. */
const ROOT  = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT   = path.join(ROOT, '.image-out');

/* preset id -> the part-image key design.js asks for. Keep this in step
   with the `img:` field on each entry of PRESETS in assets/js/design.js;
   the script checks it against the page and stops if they have drifted. */
const PART_KEY = {
  'hanging':'long-hang', 'adjustable-shelves':'shelves', 'cubbies':'cubbies',
  'shoe-shelving':'shoes', 'slanted-shoe':'shoe-slant', 'leave-open':'open',
  'drawers':'drawers', 'pull-out-baskets':'baskets', 'pull-out-shelves':'pullout',
  'tilt-out-hamper':'hamper', 'closed-door':'door', 'glass-door':'glass-door',
};
const NAV_PX = 480, PART_W = 900, PART_H = 1200;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'nav'),   { recursive: true });
fs.mkdirSync(path.join(OUT, 'parts'), { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ids = ONLY ? [ONLY] : Object.keys(PART_KEY);
const done = [], failed = [];

for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await page.goto(`http://127.0.0.1:${PORT}/design/?audit=1&preset=${id}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__cam === 'function', { timeout: 30000 });
  await page.waitForTimeout(3200);

  const check = await page.evaluate(async () => {
    const mod = await import('/assets/js/design.js');
    const p = new URLSearchParams(location.search).get('preset');
    const hit = mod.PRESETS.find(x => x.id === p);
    return { img: hit && hit.img, bays: (window.__cur.bays || []).length };
  });
  if (!check.bays) { console.log(`  SKIP ${id}: the preset built nothing`); await page.close(); continue; }
  if (check.img !== PART_KEY[id])
    throw new Error(`PART_KEY is out of step: design.js says ${id} -> ${check.img}, this script says ${PART_KEY[id]}`);

  /* straight on, the tower filling the frame with a little air round it.
     The distance is solved from the tower's own size and the field of
     view, so a short piece and a full-height one both sit the same in
     their frame instead of one being a speck. */
  const shot = await page.evaluate(async () => {
    const c = window.__cur, b = (c.bays || [])[0];
    const FOV = 26, half = Math.max(b.w, b.h) / 2 * 1.10;
    const dist = half / Math.tan(FOV * Math.PI / 360);
    window.__bare(true);
    window.__cam({ at: [b.alongRoom, b.h / 2 + 2, b.depth + dist], look: [b.alongRoom, b.h / 2 + 2, 0], fov: FOV });
    await new Promise(r => setTimeout(r, 1100));
    return window.__shot(true);
  });
  /* A page error is worth knowing about but not worth losing the other
     eleven renders over, so it is held and reported at the end. */
  if (errs.length) failed.push(`${id}: ${errs.join(' | ')}`);

  const raw = path.join(OUT, id + '.png');
  fs.writeFileSync(raw, Buffer.from(shot.split(',')[1], 'base64'));

  /* The canvas is 16:9 and the tower is centred in it, so scaling the
     whole frame into a square tile leaves the piece as a thin strip with
     half the tile empty either side. Crop to the shape the tile wants
     first, around the middle where the tower is, and then scale. */
  const [iw, ih] = execFileSync('ffprobe', ['-v','error','-select_streams','v',
    '-show_entries','stream=width,height','-of','csv=p=0:s=x', raw]).toString().trim().split('x').map(Number);
  const jpg = (file, ar, w, h) => {
    const cw = Math.min(iw, Math.round(ih * ar));
    execFileSync('ffmpeg', ['-loglevel','error','-y','-i',raw,'-vf',
      `crop=${cw}:${ih}:${Math.round((iw - cw) / 2)}:0,scale=${w}:${h}:flags=lanczos`,
      '-frames:v','1','-update','1','-q:v','4', file], { stdio:['ignore','ignore','inherit'] });
  };
  jpg(path.join(OUT,'nav',   id + '.jpg'),              1,    NAV_PX, NAV_PX);
  jpg(path.join(OUT,'parts', PART_KEY[id] + '.jpg'), 0.75,    PART_W, PART_H);

  fs.unlinkSync(raw);
  done.push(id);
  console.log(`  ok  ${id.padEnd(20)} nav/${id}.jpg  parts/${PART_KEY[id]}.jpg`);
  await page.close();
}
await browser.close();

if (WRITE) {
  for (const id of done) {
    fs.copyFileSync(path.join(OUT,'nav', id + '.jpg'),               path.join(ROOT,'img','nav', id + '.jpg'));
    fs.copyFileSync(path.join(OUT,'parts', PART_KEY[id] + '.jpg'),   path.join(ROOT,'img','parts', PART_KEY[id] + '.jpg'));
  }
  console.log(`\n  ${done.length} pieces written into img/nav/ and img/parts/`);
} else {
  console.log(`\n  ${done.length} pieces in ${OUT}. Look at them, then run again with --write.`);
}
if (failed.length) {
  console.error('\n  page errors, the pictures above were still written:');
  for (const f of failed) console.error('    ' + f);
  process.exitCode = 1;
}
