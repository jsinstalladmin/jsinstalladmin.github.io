const grid=document.getElementById('fgrid'), count=document.getElementById('fcount'), q=document.getElementById('fq');
const cat = await (await fetch((window.BASE||"")+'assets/data/catalog.json')).json();
const SP=(window.BASE||"")+'img/finishes/sprite.jpg';
let lv='all', term='';
/* A bare "Level 3" tells a customer nothing, so the count line says what the
   band actually is. The full explanation lives in a panel under the grid. */
const LEVEL_NOTE={
  1:'stock white, the cheapest board on the list and the quickest',
  2:'the everyday range of woodgrains, solids and textiles',
  3:'deeper textures and synchronised grains',
  4:'specialty decors held in smaller quantities',
  5:'high gloss and premium panels, the dearest board'};

function chipStyle(f){
  if(f.x<0) return `background:linear-gradient(135deg,var(--paper-3),var(--paper-2));display:grid;place-items:center`;
  return `background-image:url(${SP});background-position:${(f.x/(cat.meta.cols-1))*100}% ${(f.y/(cat.meta.rows-1))*100}%;background-size:${cat.meta.cols*100}% ${cat.meta.rows*100}%`;
}
function draw(){
  const list=cat.finishes.filter(f=>(lv==='all'||String(f.lv)===lv)&&(!term||f.n.toLowerCase().includes(term)));
  grid.innerHTML=list.map(f=>`<button class="fsw" data-n="${f.n.replace(/"/g,'&quot;')}" aria-pressed="false">
    <span class="chip2" style="${chipStyle(f)}">${f.x<0?'<span style="font-size:.6rem;color:var(--muted);letter-spacing:.1em">NO PHOTO</span>':''}</span>
    <span class="nm">${f.n}</span><span class="lv">Level ${f.lv} · ${f.lead} wks</span></button>`).join('');
  const photo=list.filter(f=>f.x>=0).length;
  const noPhoto=list.length-photo;
  count.textContent=`Showing ${list.length} of ${cat.finishes.length} colors${lv!=='all'?`. Level ${lv} is ${LEVEL_NOTE[lv]||''}`:''}.`
    + (noPhoto ? ` ${photo} have a photographed swatch; we bring the other ${noPhoto} as a physical sample to the measure.` : ' All of these have a photographed swatch.');
}
document.querySelectorAll('[data-lv]').forEach(b=>b.addEventListener('click',()=>{
  lv=b.dataset.lv;
  document.querySelectorAll('[data-lv]').forEach(x=>x.setAttribute('aria-pressed',x===b));
  draw();
}));
q?.addEventListener('input',()=>{term=q.value.trim().toLowerCase();draw()});
grid.addEventListener('click',e=>{
  const b=e.target.closest('.fsw'); if(!b) return;
  const on=b.getAttribute('aria-pressed')==='true';
  grid.querySelectorAll('.fsw').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed',String(!on));
  if(!on) sessionStorage.setItem('js_finish',b.dataset.n);
});
draw();
