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
if(mb&&dr){
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

/* map ↔ region list, linked both ways */
(function(){
  const map=document.querySelector('.usmap'); if(!map) return;
  const set=(id,on)=>{
    map.querySelectorAll(`.srv path[data-r="${id}"], .lab text[data-r="${id}"]`)
       .forEach(e=>e.classList.toggle('hot',on));
    document.querySelectorAll(`.rg[data-r="${id}"]`).forEach(e=>e.classList.toggle('on',on));
  };
  const bind=(el)=>{
    const id=el.dataset.r; if(!id) return;
    el.addEventListener('mouseenter',()=>set(id,true));
    el.addEventListener('mouseleave',()=>set(id,false));
    el.addEventListener('focus',()=>set(id,true));
    el.addEventListener('blur',()=>set(id,false));
  };
  document.querySelectorAll('.rg[data-r]').forEach(bind);
})();
