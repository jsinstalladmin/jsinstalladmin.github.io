/* ============================================================
   tour.js — the first time through the builder.

   Somebody landing on /design/ is looking at a 3D room, a five-step bar, a
   section strip and a price card, all at once, and nothing tells them which
   one to touch first. This walks them through it: six short steps, each one
   pointing at the thing it is talking about.

   It runs ONCE. After that the only way back in is the ? in the scene
   toolbar, because a tour that reappears is an interruption.
   ============================================================ */
const KEY = 'js_tour_v1';

const STEPS = [
  { sel: '.steptabs',
    title: 'Five steps, start to finish',
    text:  'Your space, the layout, the finish, the handles, then your order with the price. Move with the button at the bottom of each step, or jump straight to any of them up here.' },
  { sel: '#plan', tab: '1',
    title: 'Start with the real room',
    text:  'Width, depth, ceiling, and what the baseboard is doing. Everything after this is cut from these numbers, so it is worth getting them off the wall rather than guessing.' },
  { sel: '#c3d',
    title: 'The drawing is live',
    text:  'Drag to turn it, scroll to zoom. Click any section of the closet and the panel jumps to that section, so you can work on the thing you are looking at.' },
  { sel: '#bays', tab: '2',
    title: 'A section is a top and a bottom',
    text:  'Sections sit anywhere along the wall — drag them, and the bare wall between them is real. Inside each one you choose what goes on top and what goes underneath, and only what can actually go there is offered.' },
  { sel: '.pfoot',
    title: 'The price moves with you',
    text:  'Cabinetry only, off the same parts list we order from, updating on every change. Anything the design wants you to know is behind the button in the corner.' },
  { sel: '#send',
    title: 'Send it when you are happy',
    text:  'The whole drawing travels with it: every panel, rod, drawer box, glide and pull, and whatever you told us about the walls. Nothing gets retyped, so we are most of the way to a quote before anyone visits.' },
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
     Below the target if there is room under it, above it if there is not. */
  function place(sel){
    const t = document.querySelector(sel);
    el.querySelectorAll('.tourhalo').forEach(x => x.remove());
    if(!t){ box.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%)'; return; }
    const r = t.getBoundingClientRect();
    const halo = document.createElement('div');
    halo.className = 'tourhalo';
    halo.style.cssText = `left:${r.left-6}px;top:${r.top-6}px;width:${r.width+12}px;height:${r.height+12}px`;
    el.appendChild(halo);

    const W = box.offsetWidth || 330, H = box.offsetHeight || 190, M = 14;
    let top  = r.bottom + M;
    if(top + H > innerHeight - M) top = Math.max(M, r.top - H - M);
    if(top + H > innerHeight - M) top = Math.max(M, (innerHeight - H) / 2);
    let left = r.left + r.width/2 - W/2;
    left = Math.max(M, Math.min(innerWidth - W - M, left));
    box.style.cssText = `left:${left}px;top:${top}px;transform:none`;
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

  if(!seen) setTimeout(() => show(0), 1200);
}
