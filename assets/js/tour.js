/* ============================================================
   tour.js — the first time through the builder.

   Somebody landing on /design/ is looking at a 3D room, a five-step bar, a
   section strip and an order card, all at once, and nothing tells them which
   one to touch first. This walks them through it: six short steps, each one
   pointing at the thing it is talking about.

   It runs ONCE. After that the only way back in is the ? in the scene
   toolbar, because a tour that reappears is an interruption.
   ============================================================ */
const KEY = 'js_tour_v1';

const STEPS = [
  { sel: '.steptabs',
    title: 'Five steps, start to finish',
    text:  'Your space, the layout, the color, the handles, then your order. Move with the button at the bottom of each step, or jump straight to any of them up here.' },
  { sel: '#plan', tab: '1',
    title: 'Start with the real room',
    text:  'Width, depth, ceiling, and what the baseboard is doing. Everything after this is cut from these numbers, so it is worth getting them off the wall rather than guessing.' },
  { sel: '#c3d',
    title: 'The drawing is live',
    text:  'Drag to turn it, scroll to zoom. Click any section of the closet and the panel jumps to that section, so you can work on the thing you are looking at.' },
  { sel: '#bays', tab: '2',
    title: 'A section is a top and a bottom',
    text:  'Sections sit anywhere along the wall. Drag them, and the bare wall between them is real. Inside each one you choose what goes on top and what goes underneath, and only what can actually go there is offered.' },
  { sel: '.pfoot',
    title: 'The design checks itself',
    text:  'Every change is measured against the real parts we build from, so the closet on screen is one that can actually be made. Anything the design wants you to know is behind the button in the corner.' },
  { sel: '#send',
    title: 'Send it when you are happy',
    text:  'The whole drawing travels with it: a measured drawing of every wall, the overhead view, and every panel, rod, drawer box, glide and pull on the list. Nothing gets retyped, so we are most of the way to a quote before anyone visits.' },
];

export function mountTour(){
  const host = document.querySelector('#c3d');
  if(!host) return;

  let seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch(e){ seen = true; }

  const el = document.createElement('div');
  el.className = 'tour';
  el.hidden = true;
  el.innerHTML = `<div class="tourbox" role="dialog" aria-modal="false" aria-labelledby="tourh">
      <span class="tourn"></span>
      <h3 id="tourh"></h3>
      <p></p>
      <div class="tourdots" aria-hidden="true"></div>
      <div class="touracts">
        <button type="button" class="tourskip">Skip the tour</button>
        <span class="tourgo">
          <button type="button" class="btn btn-ghost btn-sm tourback">Back</button>
          <button type="button" class="btn btn-fill btn-sm tournext">Next</button>
        </span>
      </div>
    </div>`;
  document.body.appendChild(el);

  const box  = el.querySelector('.tourbox');
  const n    = el.querySelector('.tourn');
  const h    = el.querySelector('h3');
  const p    = el.querySelector('p');
  const dots = el.querySelector('.tourdots');
  const back = el.querySelector('.tourback');
  const next = el.querySelector('.tournext');
  let i = 0;

  /* The box sits beside whatever the step is about, and never off the screen.

     Three things used to go wrong here. The panel the step points at lives
     inside .pscroll, which scrolls on its own, so a target below that box's
     fold was measured at a position nobody could see and the ring landed off
     the bottom of the window. Tall targets made it worse: "Your space" is
     1043px of panel inside a 502px scroll box, so even scrolled to the top it
     cannot all be ringed. And the overlay dimmed and blurred the very thing
     it was pointing at, because the scrim sat on top of everything.

     So: scroll it into view first, clamp the ring to what is actually on
     screen, and let the ring's own shadow be the only scrim, which leaves the
     thing inside it completely untouched. */
  function draw(sel){
    const t = document.querySelector(sel);
    el.querySelectorAll('.tourhalo').forEach(x => x.remove());
    el.classList.toggle('dim', !t);
    if(!t){ box.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%)'; return; }

    const M = 14, PAD = 6;
    const r = t.getBoundingClientRect();
    /* the visible slice of it, so a panel taller than the window still gets a
       ring with both ends on screen */
    const top   = Math.max(M, r.top - PAD);
    const bot   = Math.min(innerHeight - M, r.bottom + PAD);
    const left  = Math.max(M, r.left - PAD);
    const right = Math.min(innerWidth - M, r.right + PAD);
    const w = Math.max(0, right - left), h = Math.max(0, bot - top);
    if(w < 4 || h < 4){ el.classList.add('dim');
      box.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%)'; return; }

    const halo = document.createElement('div');
    halo.className = 'tourhalo';
    halo.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
    el.appendChild(halo);

    /* below, above, beside, and only then over the middle */
    const BW = box.offsetWidth || 330, BH = box.offsetHeight || 190;
    let bx, by;
    if(bot + M + BH <= innerHeight - M){ by = bot + M; bx = left + w/2 - BW/2; }
    else if(top - M - BH >= M){          by = top - M - BH; bx = left + w/2 - BW/2; }
    else if(right + M + BW <= innerWidth - M){ bx = right + M; by = top + h/2 - BH/2; }
    else if(left - M - BW >= M){         bx = left - M - BW; by = top + h/2 - BH/2; }
    else {                               bx = (innerWidth - BW)/2; by = (innerHeight - BH)/2; }
    bx = Math.max(M, Math.min(innerWidth  - BW - M, bx));
    by = Math.max(M, Math.min(innerHeight - BH - M, by));
    box.style.cssText = `left:${bx}px;top:${by}px;transform:none`;
  }

  /* Scroll it where it can be seen, then measure on the next frame.

     behavior:'instant' matters: the site sets html{scroll-behavior:smooth},
     so a plain scrollIntoView animates over several hundred milliseconds and
     everything measured on the next frame is still at the OLD position. On a
     phone, where a step's target can be three thousand pixels down the page,
     that put the ring far off screen and it was dropped as degenerate. And
     'center' rather than 'nearest', so a target taller than the window is
     centred on its middle instead of left hanging off one edge. */
  function place(sel){
    const t = document.querySelector(sel);
    if(t){
      try { t.scrollIntoView({ block:'center', inline:'nearest', behavior:'instant' }); }
      catch(e){ try { t.scrollIntoView(false); } catch(e2){} }
    }
    requestAnimationFrame(() => draw(sel));
  }

  function show(k){
    i = Math.max(0, Math.min(STEPS.length - 1, k));
    const s = STEPS[i];
    /* Half the things the tour points at live on a step that is not open, so
       it opens that step first. Pointing at a hidden element put the box in
       the corner with the ring nowhere. */
    if(s.tab){
      const tab = document.querySelector(`.steptabs [data-tab="${s.tab}"]`);
      if(tab && tab.getAttribute('aria-selected') !== 'true') tab.click();
    }
    n.textContent = `Step ${i+1} of ${STEPS.length}`;
    h.textContent = s.title;
    p.textContent = s.text;
    dots.innerHTML = STEPS.map((_, j) => `<span class="${j <= i ? 'on' : ''}"></span>`).join('');
    back.disabled = i === 0;
    next.textContent = i === STEPS.length - 1 ? 'Start designing' : 'Next';
    el.hidden = false;
    /* two frames: one for the tab to swap, one for the layout to settle */
    requestAnimationFrame(() => requestAnimationFrame(() => place(s.sel)));
  }

  function close(){
    el.hidden = true;
    el.querySelectorAll('.tourhalo').forEach(x => x.remove());
    try { localStorage.setItem(KEY, '1'); } catch(e){}
  }

  back.onclick = () => show(i - 1);
  next.onclick = () => (i === STEPS.length - 1) ? close() : show(i + 1);
  el.querySelector('.tourskip').onclick = close;
  el.addEventListener('click', e => { if(e.target === el) close(); });
  addEventListener('keydown', e => {
    if(el.hidden) return;
    if(e.key === 'Escape') close();
    if(e.key === 'ArrowRight') next.click();
    if(e.key === 'ArrowLeft' && i > 0) back.click();
  });
  addEventListener('resize', () => { if(!el.hidden) place(STEPS[i].sel); });

  /* the ? in the scene toolbar brings it back */
  document.addEventListener('click', e => {
    if(e.target.closest('[data-a="tour"]')) show(0);
  });

  /* THE TOUR WAITS FOR THE GATE.
     It used to fire 1.2 seconds after load, which on a first visit put a
     card about "five steps, start to finish" on top of the question asking
     which closet they wanted, over a panel of five steps they could not
     see. It starts when the gate closes, and straight away when there is
     no gate, which is how anybody arriving on a ?plan= link gets here. */
  if(seen) return;
  const begin = () => setTimeout(() => show(0), 900);
  /* The builder says when the gate is out of the way, and says it straight
     away when it never opened one. Checking gate.hidden here would be a
     race: this module runs before the builder has finished deciding. */
  if(document.getElementById('gate')) addEventListener('js:gate-closed', begin, { once:true });
  else begin();
}
