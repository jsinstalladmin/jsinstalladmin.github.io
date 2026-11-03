/* ====================================================================
   Scroll-scrubbed hero.

   Engine values are deliberate: #hero height 700vh / scrub 0.3 / lerp 0.18.

   Two things have to be true or this hero shows a blank screen, and both
   have bitten us:

   1) The video must have DECODED A FRAME. At scroll 0 the seek target and
      currentTime are both 0, so `diff === 0` and no seek ever fires --
      meaning nothing is ever painted. prime() nudges currentTime to force
      the first frame out.

   2) The server must answer HTTP RANGE REQUESTS. `python3 -m http.server`
      does not: it ignores Range and never sends Accept-Ranges. Chrome then
      leaves video.duration as NaN, the `if (video.duration)` guard below is
      falsy forever, and you scroll seven screen-heights of frame zero.
      That is what _server/serve.py exists to fix.

   Because (2) is environmental and out of our hands on someone else's
   machine, FALLBACK() below collapses the hero to a normal one-screen hero
   if scrubbing has not started working within 3.5 seconds. A static hero is
   a fine hero. A 700vh void is not.
   ==================================================================== */
const video = document.getElementById('hv');
const cap   = document.getElementById('cap');
const hero  = document.getElementById('hero');
const DEBUG = new URLSearchParams(location.search).has('debug');

if (video && cap && hero) {
  const CAPS = {
    dark:[
      ['An empty room is the cheapest it will ever be.','Before anything is cut, we measure the walls, the baseboard and the ceiling you actually have.'],
      ['Then the structure goes in.','Vertical panels every 24 to 36 inches. Past 36, three-quarter-inch melamine sags.'],
      ['Hanging gets assigned, not guessed.','Long hang at 66 inches. Double hang at 80 and 40. Top shelf at 84.'],
      ['Lighting lands on the fixed shelves.','Adjustable shelves move, so they cannot carry a wired strip. We will tell you that before you pay for it.'],
      ['And then it is yours.','Measured, built and installed by the same crew. Usually in a single day.']
    ],
    light:[
      ['Daylight version, same build.','Some rooms want the drama. Some want to disappear into the house. Both are the same cabinetry.'],
      ['Structure first.','Vertical panels every 24 to 36 inches, carried on a rail into the studs.'],
      ['Hanging assigned by garment length.','Coats at 66. Shirts and folded trousers at 80 and 40.'],
      ['Shelving on 32mm centres.','So you can move any adjustable shelf later without drilling anything new.'],
      ['Finished, in one day.','We take the packaging with us and patch what we drilled.']
    ]
  };

  let mode = 'light', ready = false, scrubWorks = false, fellBack = false;
  document.body.dataset.hero = 'light';

  /* ---- captions ---- */
  const render = i => {
    const n = CAPS[mode].length;
    const [h, p] = CAPS[mode][Math.max(0, Math.min(n - 1, i))];
    if (cap.dataset.i == i) return;
    cap.dataset.i = i;
    cap.innerHTML = `<h1>${h}</h1><p>${p}</p>`;
  };
  const setCaps = prog => render(Math.floor(prog * CAPS[mode].length * 0.999));
  render(0);

  /* ---- debug readout: /?debug=1 ---- */
  let dbg = null;
  if (DEBUG) {
    dbg = document.createElement('div');
    dbg.style.cssText = 'position:fixed;z-index:999;left:10px;top:10px;padding:9px 12px;' +
      'font:11px/1.55 ui-monospace,Menlo,monospace;white-space:pre;color:#0f0;' +
      'background:rgba(0,0,0,.82);border-radius:8px;pointer-events:none';
    document.body.appendChild(dbg);
  }

  /* ---- force the first frame to decode ---- */
  function prime() {
    ready = true;
    try { video.currentTime = 0.04; } catch (e) {}
  }
  video.addEventListener('loadedmetadata', prime);
  if (video.readyState >= 1) prime();
  video.load();

  /* ---- graceful degradation ----------------------------------------
     Collapse to a single-screen static hero. Called when the video is
     unusable OR when scrubbing has demonstrably not started.            */
  function fallback(why) {
    if (fellBack) return;
    fellBack = true;
    hero.style.height = '100svh';
    document.body.dataset.heroFallback = why;
    render(0);
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    console.warn('[hero] scrub unavailable (' + why + ') — using static hero. ' +
                 'Serve the site through _server/serve.py, which answers Range requests.');
  }

  /* a video that errors out, or still has no finite duration after 3.5s,
     is never going to scrub */
  video.addEventListener('error', () => fallback('video-error'));
  setTimeout(() => {
    if (!scrubWorks) fallback(Number.isFinite(video.duration) ? 'no-seek' : 'no-duration');
  }, 3500);

  /* ---- the engine ---- */
  const start = () => {
    if (!window.gsap || !window.ScrollTrigger) return setTimeout(start, 60);
    gsap.registerPlugin(ScrollTrigger);

    const vp = { t: 0 };
    gsap.to(vp, { t: 1, ease: 'none', scrollTrigger: {
      trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: 0.3,
      onUpdate: s => setCaps(s.progress)
    }});

    (function tick() {
      const dur = video.duration;
      if (ready && Number.isFinite(dur) && dur > 0 && !video.seeking) {
        const target = vp.t * (dur - 0.05);
        const cur = video.currentTime;
        const diff = target - cur;
        if (Math.abs(diff) > 0.008) {
          video.currentTime = cur + diff * 0.18;
          /* proof of life: currentTime actually moved off the first frame */
          if (!scrubWorks && cur > 0.0001) scrubWorks = true;
        }
      }
      if (dbg) dbg.textContent =
        'readyState  ' + video.readyState +
        '\nduration    ' + video.duration +
        '\ncurrentTime ' + (video.currentTime || 0).toFixed(3) +
        '\nseekable    ' + (video.seekable.length ? video.seekable.end(0).toFixed(2) : 'NONE  <-- server has no Range support') +
        '\nbuffered    ' + (video.buffered.length ? video.buffered.end(0).toFixed(2) : '0') +
        '\nscrubWorks  ' + scrubWorks +
        '\nfellBack    ' + (fellBack ? document.body.dataset.heroFallback : 'no') +
        '\ngsap        ' + (!!window.gsap) +
        '\nerror       ' + (video.error ? video.error.code + ' ' + video.error.message : 'none');
      requestAnimationFrame(tick);
    })();
  };
  start();

  /* ---- daylight / evening ---- */
  const swap = document.getElementById('heroswap');
  swap?.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const h = b.dataset.h;
    if (h === mode) return;
    mode = h;
    [...swap.children].forEach(c => c.setAttribute('aria-pressed', c === b));
    document.body.dataset.hero = h;
    ready = false;
    video.poster = h === 'dark' ? (window.BASE||"")+'img/poster.jpg' : (window.BASE||"")+'img/poster-light.jpg';
    video.src    = h === 'dark' ? (window.BASE||"")+'video/hero.mp4' : (window.BASE||"")+'video/hero-light.mp4';
    video.load();                 // prime() re-fires on the new loadedmetadata
    cap.dataset.i = -1;
    render(0);
  });
}
