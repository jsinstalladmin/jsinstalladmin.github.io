/* header state + targeted reveals */
const hdr = document.getElementById('hdr');
const hero = document.getElementById('hero') || document.querySelector('.phero');
if(hdr){
  const onScroll = () => {
    const past = hero ? window.scrollY > (hero.offsetHeight - 120) : window.scrollY > 40;
    const solid = hero && hero.id==='hero' ? past : window.scrollY > 40;
    hdr.classList.toggle('solid', solid);
    if(document.body.classList.contains('over-dark')) document.body.classList.toggle('over-dark-off', solid);
  };
  addEventListener('scroll', onScroll, {passive:true}); onScroll();
}
/* ── reveal on scroll ─────────────────────────────────────────────────────
   Only the hand-marked headings used to move. Everything that reads as a
   block of its own now comes in as you reach it, and rows of cards come in
   one after another rather than all at once. Marked in JS rather than by
   hand in the HTML so a new section gets it for free. */
const io = new IntersectionObserver((es)=>{
  for(const e of es) if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
},{rootMargin:'0px 0px -8% 0px', threshold:.08});

const REVEAL = [
  '.sec > .shell > h2', '.sec-tight > .shell > h2', '.sec-dark > .shell > h2',
  '.sec .lede', '.sec-tight .lede', '.ed > div > p', '.ed > div > ul',
  '.infobox', '.stepbox', '.svccard', '.relcard', '.faqitem', '.dcard', '.rg',
  '.inc', '.gcell', '.statrow', '.cta-band', '.fswatch', '.lvrow', '.artfig',
  '.finhd > div', '.rmeta div', '.arttable', '.artnote', '.article > h2',
  '.article > p', '.article > .artlist'
];
document.querySelectorAll(REVEAL.join(',')).forEach(el=>{
  if(!el.hasAttribute('data-rv')) el.setAttribute('data-rv','up');
});
/* a card in a row waits its turn, so a grid lands like a hand of cards */
document.querySelectorAll('.svcgrid, .relgrid, .designs, .stepgrid, .regions, .incs, .finwall, .lvgrid, .ggrid, .faqlist')
  .forEach(g=>{
    [...g.children].forEach((c,i)=>c.style.setProperty('--rvd', (Math.min(i,11)*55)+'ms'));
  });
/* paragraphs inside an article arrive in sequence rather than together */
document.querySelectorAll('.article').forEach(a=>{
  [...a.children].forEach((c,i)=>c.style.setProperty('--rvd', (Math.min(i,6)*45)+'ms'));
});
document.querySelectorAll('[data-rv]').forEach(el=>io.observe(el));

/* ── the safety net ──
   A revealed element starts at opacity 0. If the observer never reports it,
   that section stays INVISIBLE, and a fast scroll, a restored scroll position
   or a browser that throttles observers can all cause exactly that. Content
   must never depend on an animation firing.

   So: on scroll, and once after load, anything still waiting that has reached
   the viewport is revealed directly. And whatever happens, everything is
   revealed after six seconds. The animation is decoration; the words are not. */
(function(){
  const left = () => document.querySelectorAll('[data-rv]:not(.in)');
  let queued = false;
  const sweep = () => {
    queued = false;
    const h = innerHeight || 800;
    for(const el of left()){
      const r = el.getBoundingClientRect();
      if(r.top < h * 0.98 && r.bottom > -40){ el.classList.add('in'); io.unobserve(el); }
    }
  };
  const onScroll = () => { if(!queued){ queued = true; requestAnimationFrame(sweep); } };
  addEventListener('scroll', onScroll, {passive:true});
  addEventListener('resize', onScroll, {passive:true});
  addEventListener('load', sweep);
  sweep();
  setTimeout(() => { for(const el of left()){ el.classList.add('in'); io.unobserve(el); } }, 6000);
})();

/* mobile drawer */
const mb=document.getElementById('menuBtn'), dr=document.getElementById('drawer');

/* ── THE DRAWER OPENS AS GROUPS, NOT AS EVERY LINK AT ONCE ──
   The markup is a flat run of <h5>Group</h5> followed by that group's links,
   repeated five times. On a phone that is twenty-five lines, so tapping Menu
   gave you a wall of them: three screens of scrolling to reach Contact, and
   the ten layout pages buried in the middle of it pushing everything else
   down.

   The groups fold here rather than in the markup because the same drawer is
   written into all thirty-seven pages, and a run-time transform cannot get
   out of step with some of them. The links stay in the DOM either way, so
   nothing changes for a crawler, and the drawer is display:none until it is
   opened, so there is no flash of the flat list.

   Which group you open is remembered, so coming back to the menu for a
   second layout does not mean opening Layouts again. */
function foldDrawer(d){
  if(!d || d.dataset.folded) return;
  d.dataset.folded = '1';
  let saved = '';
  try{ saved = localStorage.getItem('js_drawer_open') || ''; }catch(e){}
  [...d.querySelectorAll('h5')].forEach(h => {
    const det = document.createElement('details');
    det.className = 'dgrp';
    const sum = document.createElement('summary');
    sum.textContent = h.textContent;
    det.appendChild(sum);
    const body = document.createElement('div');
    body.className = 'dgrpbd';
    let n = h.nextElementSibling;
    while(n && n.tagName === 'A'){ const next = n.nextElementSibling; body.appendChild(n); n = next; }
    det.appendChild(body);
    det.open = sum.textContent === saved;
    det.addEventListener('toggle', () => {
      if(!det.open) return;
      /* one at a time, so the drawer is never taller than the screen */
      [...d.querySelectorAll('details.dgrp')].forEach(o => { if(o !== det) o.open = false; });
      try{ localStorage.setItem('js_drawer_open', sum.textContent); }catch(e){}
    });
    h.replaceWith(det);
  });
}

if(mb&&dr){
  foldDrawer(dr);
  const set=o=>{dr.classList.toggle('open',o);mb.setAttribute('aria-expanded',o);
    document.documentElement.style.overflow=o?'hidden':''};
  mb.addEventListener('click',()=>set(!dr.classList.contains('open')));
  document.getElementById('drawerX')?.addEventListener('click',()=>set(false));
  dr.addEventListener('click',e=>{if(e.target.tagName==='A')set(false)});
  addEventListener('keydown',e=>{if(e.key==='Escape')set(false)});
}

/* ───────── nav dropdowns ─────────
   CSS opens them on hover and on keyboard focus. This adds the click, which
   is the only thing that works on a touchscreen, where there is no hover to
   speak of and tapping the group name would otherwise just follow nothing.
   One open at a time; Escape and a click anywhere else close it. */
(function(){
  const groups=[...document.querySelectorAll('.nvd')];
  if(!groups.length) return;
  const close=except=>groups.forEach(g=>{
    if(g!==except) g.querySelector('.nvt')?.setAttribute('aria-expanded','false');
  });
  for(const g of groups){
    const btn=g.querySelector('.nvt'); if(!btn) continue;
    btn.addEventListener('click',e=>{
      e.preventDefault();
      const open=btn.getAttribute('aria-expanded')==='true';
      close(g); btn.setAttribute('aria-expanded', open?'false':'true');
    });
    /* leaving the group with the pointer drops the clicked-open state too, so
       it cannot be left stuck open behind the next thing you look at */
    g.addEventListener('mouseleave',()=>btn.setAttribute('aria-expanded','false'));
  }
  addEventListener('keydown',e=>{ if(e.key==='Escape') close(null); });
  addEventListener('click',e=>{ if(!e.target.closest('.nvd')) close(null); });

  /* mark the group the current page lives in, so the nav says where you are
     rather than looking identical on all thirty-seven pages */
  const here = location.pathname.replace(/index\.html$/,'');
  for(const g of groups){
    for(const a of g.querySelectorAll('a')){
      if(new URL(a.getAttribute('href'), location.href).pathname.replace(/index\.html$/,'') === here){
        g.dataset.on='1'; a.setAttribute('aria-current','page');
      }
    }
  }
})();

/* ── The states we work in, and the map beside them ──────────────────────
   Five square boxes in a row rather than five full-width rows with air
   between them, and the towns for whichever one you are pointing at open
   in a single panel directly underneath, instead of each row growing and
   shoving everything below it down the page.

   Nothing moves. Hovering a box highlights that state on the map and
   swaps the panel, and that is all: a map that jumps under the pointer
   is a map you cannot aim at. The highlight stays, because that is the
   part that tells you something. */
(function(){
  const map = document.querySelector('.usmap');
  const boxes = [...document.querySelectorAll('.rgx[data-r]')];
  if(!boxes.length) return;

  const panels = [...document.querySelectorAll('.rgd[data-rd]')];
  let locked = null;                       // set by a click, so touch works too

  const show = id => {
    boxes.forEach(b => b.classList.toggle('on', b.dataset.r === id));
    panels.forEach(p => p.toggleAttribute('data-on', p.dataset.rd === id));
    if(map) map.querySelectorAll('.srv path[data-r], .lab text[data-r]')
      .forEach(e => e.classList.toggle('hot', e.dataset.r === id));
  };
  const first = boxes[0].dataset.r;
  show(first);

  boxes.forEach(b => {
    const id = b.dataset.r;
    b.addEventListener('mouseenter', () => show(id));
    b.addEventListener('focus',      () => show(id));
    /* A tap is a click, not a hover, so on a phone this is how you pick one.
       Tapping the one already open releases it back to the first. */
    b.addEventListener('click', () => { locked = (locked === id) ? null : id; show(locked || first); });
  });

  const host = boxes[0].closest('.regions');
  host?.addEventListener('mouseleave', () => show(locked || first));
})();
