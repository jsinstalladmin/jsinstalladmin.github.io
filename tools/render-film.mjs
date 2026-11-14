/* ═══════════════════════════════════════════════════════════════════════
   render-film.mjs: the home page scroll film, rendered by the builder.

   There is no image prompt behind this film and there never was. Every
   frame is the site's own 3D engine, driven through the ?audit=1 handles
   (__apply, __cam, __bare, __shot). That is deliberate: a generated
   picture can put the two runs together in the corner, and this company
   does not build corners. A frame that comes out of the engine cannot get
   the twelve inch standoff or the bridge pieces wrong, because the engine
   is the same one that quotes the job.

   Five stages, twenty frames each, one hundred frames at 25fps.

     node tools/render-film.mjs            renders into .film-out/
     node tools/render-film.mjs --write    puts them into video/ and img/
     node tools/render-film.mjs --frames   stops after the PNGs
     node tools/render-film.mjs --port 8777

   Nothing already in video/ is touched unless you pass --write.

   It needs a local server on the site root (see tools/README.md) and
   ffmpeg on the PATH.
   ═════════════════════════════════════════════════════════════════════ */
/* playwright, wherever it lives: installed beside the repo, or in the
   build container's shared tool folder */
const pw = await (async () => {
  for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright/index.js']) {
    try { return await import(p); } catch (e) {}
  }
  throw new Error('playwright not found. Run: npm i -D playwright && npx playwright install chromium');
})();
const chromium = pw.chromium || pw.default.chromium;
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg  = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const PORT = +arg('--port', 8777);
/* fileURLToPath, not url.pathname: a path with a space in it comes back
   percent encoded, so on a drive called "Site Builder" every path handed
   to ffmpeg had %20 in it and ffmpeg could not find a single frame. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = path.join(ROOT, '.film-frames');
const W = 1600, H = 900, FPS = 25, PER_STAGE = 20;

/* the closet the film builds: the U walk-in, so the standoff and both
   bridges are in shot. The stages add to each other, they do not cut. */
const m = (id, h, o) => ({ m: id, h: h ?? null, o: o || {} });
const ROOM  = { w: 96, d: 96, h: 96 };
const SHELL = { type: 'walk-in', shape: 'u', mounting: 'floor', room: ROOM };

const STAGES = [
  { name: 'empty',    runs: {} },

  { name: 'carcass',  runs: {
      back:  [{ w:32, s:[m('OPEN')] }, { w:32, s:[m('OPEN')] }, { w:32, s:[m('OPEN')] }],
      left:  [{ w:36, s:[m('OPEN')] }, { w:36, s:[m('OPEN')] }],
      right: [{ w:36, s:[m('OPEN')] }, { w:36, s:[m('OPEN')] }] } },

  { name: 'hanging',  runs: {
      back:  [{ w:32, s:[m('HANG',40), m('HANG')] }, { w:32, s:[m('OPEN')] },
              { w:32, s:[m('HANG',40), m('HANG')] }],
      left:  [{ w:36, s:[m('HANG')] }, { w:36, s:[m('OPEN')] }],
      right: [{ w:36, s:[m('OPEN')] }, { w:36, s:[m('HANG',40), m('HANG')] }] } },

  { name: 'drawers',  runs: {
      back:  [{ w:32, s:[m('HANG',40), m('HANG')] },
              { w:32, s:[m('DRAWERS',null,{sizes:[7.5,7.5,7.5,7.5]}), m('SHELVES',null,{n:3})] },
              { w:32, s:[m('HANG',40), m('HANG')] }],
      left:  [{ w:36, s:[m('HANG')] }, { w:36, s:[m('SHELVES',null,{n:6})] }],
      right: [{ w:36, s:[m('OPEN')] }, { w:36, s:[m('HANG',40), m('HANG')] }] } },

  { name: 'finished', runs: {
      back:  [{ w:32, s:[m('HANG',40), m('HANG')] },
              { w:32, s:[m('DRAWERS',null,{sizes:[7.5,7.5,7.5,7.5]}), m('SHELVES',null,{n:3})] },
              { w:32, s:[m('HANG',40), m('HANG')] }],
      left:  [{ w:36, s:[m('HANG')] }, { w:36, s:[m('SHELVES',null,{n:6})] }],
      right: [{ w:36, s:[m('SHOE_SLANT')] }, { w:36, s:[m('HANG',40), m('HANG')] }] } },
];

/* Where the camera stands at the first and last frame of each stage, in
   room inches. It starts outside the opening looking straight in at the
   empty room, comes in to eye level as the carcass and the hanging go up,
   then rises and pulls back so the last frame shows the whole U: both
   side runs, the back run, and the twelve inch standoff between them.
   These are the only numbers worth touching to re-choreograph the film. */
const CAM = [
  { from: { at:[52,  52, 179], look:[48, 44, 29], fov:40 }, to: { at:[52,  58, 182], look:[48, 44, 30], fov:40 } },
  { from: { at:[52,  58, 182], look:[48, 44, 30], fov:40 }, to: { at:[52,  72, 187], look:[48, 43, 32], fov:40 } },
  { from: { at:[52,  72, 187], look:[48, 43, 32], fov:40 }, to: { at:[53,  88, 193], look:[48, 43, 35], fov:40 } },
  { from: { at:[53,  88, 193], look:[48, 43, 35], fov:40 }, to: { at:[56, 106, 199], look:[48, 43, 38], fov:40 } },
  { from: { at:[56, 106, 199], look:[48, 43, 38], fov:40 }, to: { at:[59, 122, 206], look:[48, 43, 41], fov:40 } },
];

const lerp  = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)];
/* ease in and out, so a stage does not start and stop with a jolt */
const ease  = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
/* device scale 1: the film is 1600x900 and a second pass of pixels buys
   nothing on a video frame, while it costs about six times the wall clock */
const page = await browser.newPage({ viewport: { width: W + 520, height: H + 120 }, deviceScaleFactor: 1 });
page.on('pageerror', e => { throw e; });

await page.goto(`http://127.0.0.1:${PORT}/design/?audit=1&noao=1`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => typeof window.__apply === 'function', { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => window.__bare(false));

let n = 0;
for (let s = 0; s < STAGES.length; s++) {
  const stage = STAGES[s];
  await page.evaluate(pl => window.__apply(pl), { ...SHELL, runs: stage.runs });
  await page.waitForTimeout(900);

  for (let f = 0; f < PER_STAGE; f++) {
    const t = ease(PER_STAGE === 1 ? 0 : f / (PER_STAGE - 1));
    const c = CAM[s];
    const shot = await page.evaluate(async o => {
      window.__cam(o);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return window.__shot(true);
    }, { at: lerp3(c.from.at, c.to.at, t), look: lerp3(c.from.look, c.to.look, t),
         fov: lerp(c.from.fov, c.to.fov, t) });

    const file = path.join(OUT, String(n).padStart(4, '0') + '.png');
    fs.writeFileSync(file, Buffer.from(shot.split(',')[1], 'base64'));
    n++;
    process.stdout.write(`\r  ${stage.name}  frame ${n}/${STAGES.length * PER_STAGE}   `);
  }
}
console.log('\n  ' + n + ' frames in ' + OUT);
await browser.close();

if (argv.includes('--frames')) process.exit(0);

/* The film that is live was rendered with this choreography and is good.
   Encoding into a holding folder by default means a run of this script
   can never quietly replace it: look at what comes out, then pass
   --write to put it in video/. */
const WRITE  = argv.includes('--write');
const FILMTO = WRITE ? path.join(ROOT, 'video') : path.join(ROOT, '.film-out');
fs.mkdirSync(FILMTO, { recursive: true });
const vid = p => path.join(FILMTO, p);
const COMMON = ['-c:v','libx264','-pix_fmt','yuv420p','-profile:v','high','-preset','slow',
                '-crf','21','-an','-movflags','+faststart',
                '-vf',`scale=${W}:${H}:flags=lanczos`];
/* -g 1 makes every frame a keyframe, and only the scrubbed film needs it:
   the home page sets currentTime from the scroll position, and without it
   the browser shows the nearest keyframe instead of the frame asked for,
   so the film reads as a slideshow. It roughly triples the file, which is
   why the loop does not get it. The loop is played, not scrubbed. */
const SCRUB = ['-g','1'];

console.log('  encoding build-light.mp4');
execFileSync('ffmpeg', ['-y','-framerate',String(FPS),'-i',path.join(OUT,'%04d.png'),
  ...COMMON, ...SCRUB, vid('build-light.mp4')], { stdio: ['ignore','ignore','inherit'] });

/* the video home page loops instead of scrubbing, so it gets the same
   frames forward then backward: it ends where it began and never cuts */
console.log('  encoding build-loop.mp4');
const back = path.join(OUT, 'loop');
fs.mkdirSync(back, { recursive: true });
let k = 0;
for (let i = 0; i < n; i++)  fs.copyFileSync(path.join(OUT, String(i).padStart(4,'0')+'.png'), path.join(back, String(k++).padStart(4,'0')+'.png'));
for (let i = n - 2; i > 0; i--) fs.copyFileSync(path.join(OUT, String(i).padStart(4,'0')+'.png'), path.join(back, String(k++).padStart(4,'0')+'.png'));
execFileSync('ffmpeg', ['-y','-framerate',String(FPS),'-i',path.join(back,'%04d.png'),
  ...COMMON, vid('build-loop.mp4')], { stdio: ['ignore','ignore','inherit'] });

const poster = WRITE ? path.join(ROOT,'img','poster-build.jpg') : path.join(FILMTO,'poster-build.jpg');
console.log('  poster ' + path.relative(ROOT, poster));
execFileSync('ffmpeg', ['-y','-i', path.join(OUT, String(n-1).padStart(4,'0')+'.png'),
  '-vf',`scale=${W}:${H}:flags=lanczos`,'-q:v','4', poster],
  { stdio: ['ignore','ignore','inherit'] });

for (const f of ['build-light.mp4','build-loop.mp4']) {
  const out = execFileSync('ffprobe', ['-v','error','-show_entries','stream=width,height,nb_frames',
    '-show_entries','format=duration','-of','default=nw=1', vid(f)]).toString().trim().replace(/\n/g,'  ');
  console.log('  ' + f.padEnd(18) + out);
}
console.log(WRITE
  ? '\n  written into video/ and img/'
  : '\n  in ' + path.relative(ROOT, FILMTO) + '. Watch them, then run again with --write.');
