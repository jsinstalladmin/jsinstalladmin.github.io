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
      ['An empty room is <em>the cheapest it will ever be</em>.',
       'Nothing is cut until we have the real numbers: wall length, ceiling height, baseboard depth and how far out of square the corners run.'],
      ['Then <em>the structure</em> goes in.',
       'Vertical panels every 24 to 36 inches, hung on a rail screwed into the studs. Past 36 inches a three-quarter-inch shelf starts to sag.'],
      ['Hanging gets <em>assigned</em>, not guessed.',
       'Long hang on a rod at 66 inches for coats and dresses. Double hang at 80 and 40 for shirts and folded trousers. Top shelf at 84.'],
      ['Drawers run on <em>soft-close undermount</em> glides.',
       'Full extension, hidden runners, nine box heights from 7.5 to 25 inches. The box is sized to the opening, not the other way round.'],
      ['And then <em>it is yours</em>.',
       'Measured, drawn, built and fitted by the same crew. Most closets go in inside a day and we take the packaging with us.']
    ],
    light:[
      ['Daylight version, <em>same build</em>.',
       'Some rooms want the drama, some want to disappear into the house. Underneath it is the same cabinetry and the same hardware.'],
      ['<em>Structure</em> first.',
       'Three-quarter-inch thermally fused laminate, the same board used in commercial casework. Every exposed edge is banded so it cannot swell.'],
      ['Hanging assigned by <em>garment length</em>.',
       'Coats and dresses at 66 inches. Shirts and folded trousers double-hung at 80 and 40. Nothing is left to a catalogue default.'],
      ['Shelving on <em>32mm centres</em>.',
       'Every adjustable shelf moves later without drilling anything new. Fixed shelves carry the loads and the wired lighting.'],
      ['Finished, <em>in one day</em>.',
       'We patch what we drilled, take the offcuts away, and leave you the parts list for what is on your wall.']
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

  video.addEventListener('error', () => fallback('video-error'));

  /* Decide on CAPABILITY, not on whether a seek has happened yet.
     A video reporting a finite duration AND a non-empty seekable range can be
     scrubbed, full stop. The earlier test -- "did currentTime move?" -- was
     wrong: at the top of the page the seek target IS 0, so no seek is ever
     requested, and a perfectly working hero collapsed itself before the
     visitor had scrolled a pixel. Verified live: duration 20.17, seekable
     20.17, no error, and it still fell back. */
  const capable = () =>
    Number.isFinite(video.duration) && video.duration > 0 && video.seekable.length > 0;

  let probes = 0;
  const probe = setInterval(() => {
    if (capable()) { scrubWorks = true; clearInterval(probe); return; }
    if (++probes >= 12) {                       // 6s, then give up for real
      clearInterval(probe);
      fallback(Number.isFinite(video.duration) ? 'not-seekable' : 'no-duration');
    }
  }, 500);

  /* ══════════════════════════════════════════════════════════════════
     ON A PHONE, THE VIDEO JUST PLAYS

     Scrubbing a video with the scroll position is a desktop idea. On a
     phone it fights the browser: the address bar collapses and the viewport
     height changes under the sticky element, momentum scrolling overshoots
     the seek, and iOS will not seek a video that has not been touched. Seven
     screen-heights of a hero that stutters is worse than no effect at all,
     and it put the whole page seven scrolls away from the first section.

     So on a phone the hero is one screen tall and the film plays behind it
     on a loop, which is what it was shot for.

     The Daylight / Evening switch goes with it (hidden in site.css, in the
     max-860 block), because swapping to a second video over a cellular
     connection to change a look you cannot compare side by side is not worth
     a tap. But the light film's first caption is "Daylight version, same
     build." -- a line that only means anything NEXT TO that switch. With the
     switch gone it is the first thing a phone visitor reads and it refers to
     a choice they cannot see. A phone gets its own headline instead.
     ══════════════════════════════════════════════════════════════════ */
  const PHONE_CAP = [
    'Closets built <em>to the inch</em>, installed <em>in a day</em>.',
    'We measure your room, draw it, build it and fit it. Three-quarter-inch ' +
    'thermally fused laminate, every exposed edge banded, sections never wider ' +
    'than the 36 inches a shelf can carry without sagging.'
  ];

  /* THE PHONE HERO HAD NOWHERE TO GO.
     On a laptop the hero is seven screens of scrub and the visitor meets the
     buttons further down the page. On a phone it is one screen that holds
     still, and it was a headline, a paragraph and a dead end: the two things
     this page exists to get someone to do were both below the fold with no
     sign they were there. The hero carries them now.

     .hero-cap is pointer-events:none so a drag over the caption still turns
     the film; the row turns them back on for itself only. */
  const B = window.BASE || '';
  const PHONE_ACTS =
    `<span class="hero-acts">` +
      `<a class="btn btn-accent" href="${B}contact.html">Book a free measure</a>` +
      `<a class="btn btn-ghost-light" href="${B}design/">Design yours in 3D</a>` +
    `</span>`;
  const phoneCap = () =>
    `<h1>${PHONE_CAP[0]}</h1><p>${PHONE_CAP[1]}</p>${PHONE_ACTS}`;
  const PHONE = matchMedia('(max-width:860px)').matches
             || matchMedia('(pointer:coarse)').matches;

  if (PHONE) {
    clearInterval(probe);
    fellBack = true;                       // nothing below should wire scroll
    hero.style.height = '100svh';
    document.body.dataset.heroMode = 'play';
    video.muted = true; video.loop = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.autoplay = true;
    cap.innerHTML = phoneCap();
    cap.dataset.i = 'phone';
    const go = () => video.play().catch(() => {});
    video.addEventListener('canplay', go, { once:true });
    go();
    /* a phone that refuses to autoplay still gets the poster, which is a
       frame of the same film */
    document.addEventListener('touchstart', go, { once:true, passive:true });
  }

  /* ---- the engine ---- */
  const start = () => {
    if (PHONE) return;
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
        if (Math.abs(diff) > 0.008) video.currentTime = cur + diff * 0.18;
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
    if (PHONE) {
      cap.innerHTML = phoneCap();
      cap.dataset.i = 'phone';
      video.play().catch(() => {});
    } else {
      cap.dataset.i = -1;
      render(0);
    }
  });
}
