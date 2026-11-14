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

if(v){
  /* ONE FILM, AND IT IS THE BRIGHT ONE.

     This used to carry a daylight clip and an evening clip of the same
     closet with a toggle between them, and both of them showed two runs
     meeting in the corner, which is not what this company builds. It is
     one sequence now, rendered by the builder's own engine, so the closet
     in it has the twelve inch return and the pieces that bridge it. */
  const src = () => (window.BASE||"") + 'video/build-loop.mp4';
  const poster = () => (window.BASE||"") + 'img/poster-build.jpg';
  let played = false;

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
  const load = () => {
    v.poster = poster();
    v.querySelector('source').src = src();
    v.load(); played = false;
    v.currentTime = 0;
    pin();
  };

  v.addEventListener('loadeddata', () => { pin(); if(!played) start(); });
  /* The sequence runs forwards and then backwards, so it meets itself and
     can loop without a jump cut. It used to stop on the last frame because
     looping made the clothes flicker in and out. */
  v.loop = true;
  v.setAttribute('loop', '');
  load();
  document.body.dataset.hero = 'light';

  /* replay when it comes back into view; pause when it leaves so a
     hero video never burns battery further down the page */
  new IntersectionObserver(es => {
    for(const e of es){
      if(e.isIntersecting){ if(played){ v.currentTime = 0; played = false; } start(); }
      else v.pause();
    }
  }, {threshold:.25}).observe(v);
}
