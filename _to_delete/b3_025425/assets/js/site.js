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
  '.sec > .shell > h2', '.sec-tight > .shell > h2', '.sec .lede', '.sec-tight .lede',
  '.ed > div > p', '.ed > div > ul', '.infobox', '.stepbox', '.svccard', '.relcard',
  '.faqitem', '.dcard', '.rg', '.inc', '.gcell', '.statrow', '.cta-band'
];
document.querySelectorAll(REVEAL.join(',')).forEach(el=>{
  if(!el.hasAttribute('data-rv')) el.setAttribute('data-rv','up');
});
/* a card in a row waits its turn, so a grid lands like a hand of cards */
document.querySelectorAll('.svcgrid, .relgrid, .designs, .stepgrid, .regions, .incs').forEach(g=>{
  [...g.children].forEach((c,i)=>c.style.setProperty('--rvd', (Math.min(i,7)*70)+'ms'));
});
document.querySelectorAll('[data-rv]').forEach(el=>io.observe(el));

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
