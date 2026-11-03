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
const io = new IntersectionObserver((es)=>{
  for(const e of es) if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
},{rootMargin:'0px 0px -8% 0px', threshold:.08});
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
