/* ============================================================
   vhero.js — variant B hero.
   The clip is a BUILD sequence: empty room → structure → dressed.
   Looping it makes the clothes flicker in and out, so instead we
   play it through once and settle on the finished closet.
   It replays when it scrolls back into view.
   ============================================================ */
/* 0.8 stretched the 20-second build to 25 and it read as slow rather than
   cinematic — you were waiting for the closet rather than watching it go in.
   At 1.0 the clip runs at the speed it was filmed: the same sequence, a fifth
   quicker, and the hold on the finished closet comes sooner. */
const RATE = 1.0;            // 20s source → 20s build.
const v = document.getElementById('hv');
const swap = document.getElementById('heroswap');

if(v){
  const src = h => h==='dark' ? (window.BASE||"")+'video/loop.mp4' : (window.BASE||"")+'video/loop-light.mp4';
  const poster = h => h==='dark' ? (window.BASE||"")+'img/poster.jpg' : (window.BASE||"")+'img/poster-light.jpg';
  let mode = 'light', played = false;

  /* load() resets playbackRate to 1, and the reset lands at different moments
     in different browsers — so pin it on every event that could follow a load. */
  const pin = () => { if(v.playbackRate !== RATE) v.playbackRate = RATE; };
  ['loadstart','loadedmetadata','loadeddata','canplay','play','playing','ratechange']
    .forEach(ev => v.addEventListener(ev, pin));

  const start = () => {
    pin();
    const p = v.play?.();
    if(p && p.catch) p.catch(()=>{ /* autoplay blocked — the poster still reads */ });
    pin();
  };
  const load = h => {
    v.poster = poster(h);
    v.querySelector('source').src = src(h);
    v.load(); played = false;
    v.currentTime = 0;
    pin();
  };

  v.addEventListener('loadeddata', () => { pin(); if(!played) start(); });
  v.addEventListener('ended', () => { played = true; });   // hold on the last frame
  load('light');
  document.body.dataset.hero = 'light';

  swap?.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    const h = b.dataset.h; if(h === mode) return;
    mode = h;
    [...swap.children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    document.body.dataset.hero = h;
    load(h);
  });

  /* replay when it comes back into view; pause when it leaves so a
     hero video never burns battery further down the page */
  new IntersectionObserver(es => {
    for(const e of es){
      if(e.isIntersecting){ if(played){ v.currentTime = 0; played = false; } start(); }
      else v.pause();
    }
  }, {threshold:.25}).observe(v);
}
