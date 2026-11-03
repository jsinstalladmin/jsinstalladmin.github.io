import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SPEC, MODULES, MODULE_IDS, PULLS, PULL_FINISHES,
         buildDesign, makeBay, defaultStackFor } from './design.js';
import { makeRenderer, setupLighting, fitShadowCamera, loadSharedMaps,
         panelGeo, makeComposer } from './render.js';
import { initSheet, finishMaterial, scaledMaterial, hardwareMaterial,
         clothMaterials, clearCaches } from './materials.js';

const cat = await (await fetch((window.BASE||"")+'assets/data/catalog.json')).json();
const $ = s => document.querySelector(s);
const money = n => '$'+Math.round(n||0).toLocaleString();

/* ───────── types: which walls are available ───────── */
const TYPES = {
  'reach-in':{label:'Reach-in',  walls:['back'],                  w:72, d:24, h:96},
  'walk-in' :{label:'Walk-in',   walls:['back','left','right'],   w:108,d:120,h:96},
  'pantry'  :{label:'Pantry',    walls:['back'],                  w:56, d:16, h:96},
  'garage'  :{label:'Garage',    walls:['back'],                  w:144,d:20, h:108},
  'laundry' :{label:'Laundry',   walls:['back'],                  w:96, d:24, h:96}
};

/* ───────── room shape: which walls the run goes on ───────── */
const SHAPES = {
  straight:{label:'Straight wall', walls:['back'],                  art:'M3 17h18'},
  l       :{label:'L-shape',       walls:['back','left'],           art:'M3 17h18M3 17V5'},
  u       :{label:'U-shape',       walls:['back','left','right'],   art:'M3 5v12h18V5'}
};

const S = {
  type:'reach-in', shape:'straight', room:{w:72,d:24,h:96}, mounting:'floor',
  finish: cat.finishes.find(f=>f.x>=0)?.n || cat.finishes[0].n,
  frontFinish:null, pull:'bar4', pullFinish:'nickel',
  runs:{}, sel:null, spin:false, evening:false
};
const qp=new URLSearchParams(location.search);
const qt=qp.get('type')||'';
if(/reach/.test(qt)) S.type='reach-in'; else if(/walk/.test(qt)) S.type='walk-in';
else if(/pantr/.test(qt)) S.type='pantry'; else if(/garage/.test(qt)) S.type='garage';
else if(/laundry/.test(qt)) S.type='laundry';
try{ const f=sessionStorage.getItem('js_finish'); if(f&&cat.finishes.some(x=>x.n===f)) S.finish=f; }catch(e){}

/* ───────── run / bay setup ───────── */
function wallLength(wall){
  if(wall==='back') return S.room.w - (S.runs.left?SPEC.hangDepth:0) - (S.runs.right?SPEC.hangDepth:0);
  return S.room.d - SPEC.hangDepth;
}
function seedBays(wall){
  const len = wallLength(wall);
  const n = Math.max(1, Math.round(len/30));
  return Array.from({length:n}, ()=> makeBay(+(len/n).toFixed(1), []));   // empty: they fill it
}
/* keep a run's bays summing to the wall. Called whenever a bay is added or
   removed, so the drawing can never run past the wall it sits on. */
function fitRun(wall){
  const r=S.runs[wall]; if(!r||!r.bays.length) return;
  const len=wallLength(wall), each=+(len/r.bays.length).toFixed(1);
  r.bays.forEach(b=>b.w=each);
}
function applyShape(s){
  S.shape = SHAPES[s] ? s : 'straight';
  const walls = SHAPES[S.shape].walls;
  S.runs = {};
  /* two passes: every run has to exist before wallLength() can subtract the
     side runs' depth from the back wall */
  for(const w of walls) S.runs[w] = { on:true, depth:SPEC.hangDepth, bays:[] };
  for(const w of walls) S.runs[w].bays = seedBays(w);
  S.sel = {wall:'back', i:0};
}
function applyType(t){
  S.type=t; const T=TYPES[t];
  S.room={w:T.w,d:T.d,h:T.h};
  applyShape(S.shape);
}
applyType(S.type);

function cfg(){
  const runs=[];
  for(const wall of ['back','left','right']){
    const r=S.runs[wall]; if(!r||!r.on) continue;
    const start = wall==='back' ? (S.runs.left?.on?SPEC.hangDepth:0) : SPEC.hangDepth;
    runs.push({wall, start, depth:r.depth, bays:r.bays});
  }
  return { room:S.room, mounting:S.mounting, finish:S.finish,
           frontFinish:S.frontFinish||S.finish, pull:S.pull, pullFinish:S.pullFinish, runs };
}

/* ───────── scene ───────── */
const canvas=$('#c3d');
const renderer=makeRenderer(canvas);
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(40,1,20,1500);
const ctl=new OrbitControls(cam,canvas);
ctl.enableDamping=true; ctl.dampingFactor=.075; ctl.maxPolarAngle=Math.PI/2-0.03;
ctl.minDistance=40; ctl.maxDistance=900; ctl.autoRotateSpeed=0.8;
const { key }=setupLighting(scene,renderer);
const shared=loadSharedMaps();
const root=new THREE.Group(), shell=new THREE.Group(), picks=new THREE.Group();
scene.add(root,shell,picks);
const HW=hardwareMaterial(), CLOTH=clothMaterials();
const GLASS=new THREE.MeshPhysicalMaterial({color:0xE8F0F2,transmission:.9,thickness:.4,
  roughness:.06,metalness:0,ior:1.5,transparent:true,opacity:.42});
let PULLMAT=hardwareMaterial();
let composer=null, ao=null;

function sizeNow(){ const r=canvas.parentElement.getBoundingClientRect();
  return {w:Math.max(320,r.width|0), h:Math.max(260,r.height|0)}; }
function resize(){ const {w,h}=sizeNow(); renderer.setSize(w,h,false);
  cam.aspect=w/h; cam.updateProjectionMatrix(); if(composer) composer.setSize(w,h); }
addEventListener('resize',resize);
/* ?noao=1 skips ambient occlusion — a useful escape hatch on weak hardware */
if(!new URLSearchParams(location.search).has('noao')){
  const {w,h}=sizeNow(); const m=makeComposer(renderer,scene,cam,w,h); composer=m.composer; ao=m.ao;
}

let visible=true;
new IntersectionObserver(es=>{for(const e of es) visible=e.isIntersecting;},{threshold:.02}).observe(canvas);
(function loop(){ requestAnimationFrame(loop); if(!visible) return;
  ctl.autoRotate=S.spin; ctl.update();
  if(composer) composer.render(); else renderer.render(scene,cam); })();

/* ───────── room + closet ───────── */
function drawRoom(){
  shell.clear();
  const {w:W,d:D,h:H}=S.room;
  const mk=(w,h,px,py,pz,rx,ry,col)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
      new THREE.MeshStandardMaterial({color:col||0xD9D6D0,roughness:.97,metalness:0,side:THREE.DoubleSide}));
    m.position.set(px,py,pz); m.rotation.set(rx,ry,0); m.receiveShadow=true; shell.add(m); };
  mk(W,H, W/2,H/2,0, 0,0);
  mk(D,H, 0,H/2,D/2, 0,Math.PI/2);
  mk(D,H, W,H/2,D/2, 0,-Math.PI/2);
  mk(W,D, W/2,H,D/2, Math.PI/2,0, 0xE9E6E1);
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(W,D),
    new THREE.MeshStandardMaterial({color:0x7E6950,roughness:.66,metalness:0}));
  fl.rotation.x=-Math.PI/2; fl.position.set(W/2,0,D/2); fl.receiveShadow=true; shell.add(fl);
}
function drawCloset(res){
  root.clear(); picks.clear();
  const baseC=finishMaterial(res.finish,shared,'carcass');
  const baseF=finishMaterial(res.frontFinish,shared,'front');
  res.geo.forEach((g,i)=>{
    const [sx,sy,sz]=g.s.map(v=>Math.max(0.3,v));
    let mat;
    if(g.m==='metal') mat=HW;
    else if(g.m==='pullmat') mat=PULLMAT;
    else if(g.m==='glass') mat=GLASS;
    else if(g.m==='cloth') mat=CLOTH[(Math.abs(Math.round(g.p[0]+g.p[2]))|0)%CLOTH.length];
    else { const face=Math.max(sx,sy), other=Math.max(Math.min(sx,sy),sz);
      mat=scaledMaterial(g.m==='front'?baseF:baseC, face, other, shared, i); }
    const m=new THREE.Mesh(panelGeo(sx,sy,sz),mat);
    m.position.set(...g.p);
    if(g.tilt) m.rotation.x=g.tilt;
    m.castShadow=m.receiveShadow=true;
    root.add(m);
  });
  // invisible pick volumes, one per bay, so you can click the closet to edit it
  const run = r => cfg().runs.find(x=>x.wall===r);
  res.bays.forEach(b=>{
    const r=run(b.wall); if(!r) return;
    const g=new THREE.Mesh(new THREE.BoxGeometry(b.w-1, b.h, b.depth),
      new THREE.MeshBasicMaterial({visible:false}));
    const y=(S.mounting==='wall'?SPEC.wallHungBase:SPEC.toeKick)+b.h/2;
    const local={p:[b.x,y,0]};
    const pos = r.wall==='left'  ? [r.depth/2, y, (r.start||0)+b.x]
              : r.wall==='right' ? [S.room.w-r.depth/2, y, (r.start||0)+b.x]
              : [(r.start||0)+b.x, y, r.depth/2];
    g.position.set(...pos);
    g.userData={wall:b.wall,i:b.bay};
    picks.add(g);
  });
  // highlight the selected bay
  if(S.sel){
    const hit=picks.children.find(o=>o.userData.wall===S.sel.wall&&o.userData.i===S.sel.i);
    if(hit){
      const e=new THREE.Mesh(hit.geometry.clone(),
        new THREE.MeshBasicMaterial({color:0xCDA96E,wireframe:true,transparent:true,opacity:.75}));
      e.position.copy(hit.position); e.scale.set(1.02,1.01,1.02); root.add(e);
    }
  }
  fitShadowCamera(key,root); renderer.shadowMap.needsUpdate=true;
  if(ao?.setSceneClipBox){ const bb=new THREE.Box3().setFromObject(root); if(!bb.isEmpty()) ao.setSceneClipBox(bb); }
}
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
canvas.addEventListener('pointerdown',e=>{ canvas._dx=e.clientX; canvas._dy=e.clientY; });
canvas.addEventListener('pointerup',e=>{
  if(Math.hypot(e.clientX-canvas._dx, e.clientY-canvas._dy)>5) return;   // that was a drag
  const r=canvas.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,cam);
  const hit=ray.intersectObjects(picks.children,false)[0];
  if(hit){ S.sel={wall:hit.object.userData.wall,i:hit.object.userData.i}; rebuild(false); }
});

function frame(){
  const {w:W,d:D,h:H}=S.room;
  const vf=cam.fov*Math.PI/180, asp=Math.max(.6,cam.aspect||1.3);
  const dist=Math.max((H*1.08/2)/Math.tan(vf/2),(W*1.08/2)/(Math.tan(vf/2)*asp))*1.14;
  ctl.target.set(W/2,H*0.45,D*0.44);
  cam.position.set(W/2+W*0.08,H*0.56,D*0.44+dist);
  ctl.update();
}

/* ───────── render pass ───────── */
let cur=null;
function rebuild(reframe){
  cur=buildDesign(cfg(),cat);
  drawRoom(); drawCloset(cur); resize();
  if(reframe){ resize(); frame(); }
  paintAll();
}
function paintAll(){ paintSteps(); paintBays(); paintStack(); paintPrice(); paintOrder(); }

/* ───────── step 1: space ───────── */
function paintSteps(){
  $('#types').innerHTML=Object.entries(TYPES).map(([k,t])=>
    `<button data-t="${k}" aria-pressed="${k===S.type}">${t.label}</button>`).join('');
  $('#dims').innerHTML=[['w','Wall width',36,288,6],['d','Depth',12,48,2],['h','Ceiling',84,132,2]]
    .map(([k,l,mn,mx,st])=>`<div class="step"><span>${l}</span>
      <button data-k="${k}" data-s="-${st}" data-mn="${mn}" data-mx="${mx}">−</button>
      <b>${S.room[k]}"</b>
      <button data-k="${k}" data-s="${st}" data-mn="${mn}" data-mx="${mx}">+</button></div>`).join('');
  $('#mount').innerHTML=[['floor','On the floor'],['wall','Wall-hung']].map(([k,l])=>
    `<button data-m="${k}" aria-pressed="${k===S.mounting}">${l}</button>`).join('');
  $('#walls').hidden = false;
  $('#walls').innerHTML = `<h4 class="subh">Shape of the run</h4><div class="pills shapes">`+
    Object.entries(SHAPES).map(([k,s])=>
      `<button data-shape="${k}" aria-pressed="${k===S.shape}">
         <svg viewBox="0 0 24 22" aria-hidden="true"><path d="${s.art}"/></svg>
         <i>${s.label}</i></button>`).join('')+`</div>`;
}

/* ───────── step 2: bays ───────── */
function miniStack(bay, h){
  const tot=bay.stack.reduce((a,s)=>a+(s.h||MODULES[s.m].defH),0)||1;
  return bay.stack.slice().reverse().map(s=>{
    const d=MODULES[s.m];
    const pct=((s.h||d.defH)/tot)*100;
    return `<span class="mb" style="height:${pct}%" title="${d.label}">
      <svg viewBox="0 0 24 32"><path d="${d.icon}"/></svg></span>`;
  }).join('');
}
function paintBays(){
  const host=$('#bays'); host.innerHTML='';
  for(const wall of ['back','left','right']){
    const r=S.runs[wall]; if(!r||!r.on) continue;
    const len=wallLength(wall);
    const used=r.bays.reduce((a,b)=>a+b.w,0);
    const d=document.createElement('div'); d.className='runblk';
    d.innerHTML=`<div class="runhd"><b>${wall[0].toUpperCase()+wall.slice(1)} wall</b>
      <span class="${Math.abs(used-len)>1?'over':''}">${used.toFixed(0)}" of ${len.toFixed(0)}"</span></div>
      <div class="baystrip">${r.bays.map((b,i)=>`
        <button class="bay ${S.sel?.wall===wall&&S.sel?.i===i?'on':''} ${b.w<SPEC.bayMin||b.w>SPEC.bayMax?'bad':''}"
          data-wall="${wall}" data-i="${i}" style="flex:${b.w}">
          <span class="bstack">${miniStack(b)}</span>
          <span class="bw">${b.w.toFixed(0)}"</span></button>`).join('')}
      </div>
      <div class="bayacts">
        <button class="mini" data-bay="add" data-wall="${wall}">+ Add bay</button>
        <button class="mini" data-bay="del" data-wall="${wall}" ${r.bays.length<2?'disabled':''}>− Remove</button>
        <button class="mini" data-bay="even" data-wall="${wall}">Even them up</button>
      </div>`;
    host.appendChild(d);
  }
  $('#bayNote').textContent=`Bays run ${SPEC.bayMin}"–${SPEC.bayMax}". Past ${SPEC.bayMax}" a ¾" shelf sags, so we put a partition in.`;
}

/* ───────── step 3: the selected bay's stack ───────── */
function paintStack(){
  const box=$('#stack');
  if(!S.sel || !S.runs[S.sel.wall]?.bays[S.sel.i]){ box.innerHTML='<p class="note">Pick a bay above, or click one on the drawing.</p>'; return; }
  const bay=S.runs[S.sel.wall].bays[S.sel.i];
  box.innerHTML=`
    <div class="selhd"><b>${S.sel.wall[0].toUpperCase()+S.sel.wall.slice(1)} wall · bay ${S.sel.i+1}</b>
      <span class="wadj"><button data-bw="-2">−</button><i>${bay.w.toFixed(0)}" wide</i><button data-bw="2">+</button></span></div>
    <div class="stacklist">${bay.stack.slice().reverse().map((s,ri)=>{
      const i=bay.stack.length-1-ri, d=MODULES[s.m];
      return `<div class="srow ${s.h==null?'flex':''}">
        <span class="sico"><svg viewBox="0 0 24 32"><path d="${d.icon}"/></svg></span>
        <span class="sname"><b>${d.label}</b><i>${s.h==null?'fills the space':(s.h+'" tall')}</i></span>
        ${d.opt?`<span class="sopt"><button data-opt="-1" data-i="${i}">−</button><i>${(s.o?.[d.opt.key] ?? d.opt.def)}</i><button data-opt="1" data-i="${i}">+</button></span>`:''}
        <span class="sacts">
          <button data-mv="1"  data-i="${i}" title="Move up"    ${i===bay.stack.length-1?'disabled':''}>↑</button>
          <button data-mv="-1" data-i="${i}" title="Move down"  ${i===0?'disabled':''}>↓</button>
          <button data-hh="-4" data-i="${i}" title="Shorter">▾</button>
          <button data-hh="4"  data-i="${i}" title="Taller">▴</button>
          <button data-rm="${i}" title="Remove" ${bay.stack.length<2?'disabled':''}>×</button>
        </span></div>`;
    }).join('')}</div>
    <h4 class="subh">Add to this bay</h4>
    <div class="palette">${MODULE_IDS.map(id=>{const d=MODULES[id];
      return `<button data-add="${id}" title="${d.hint}">
        <svg viewBox="0 0 24 32"><path d="${d.icon}"/></svg><i>${d.label}</i></button>`}).join('')}</div>`;
}

/* ───────── finishes + hardware ───────── */
const swStyle=f=> f.x<0 ? 'background:linear-gradient(135deg,#E3D9CC,#EFE8DF)'
  : `background-image:url(/img/finishes/sprite.jpg);background-size:${cat.meta.cols*100}% ${cat.meta.rows*100}%;background-position:${(f.x/(cat.meta.cols-1))*100}% ${(f.y/(cat.meta.rows-1))*100}%`;
const FAMS=[{lv:2,n:'Everyday'},{lv:3,n:'Textured'},{lv:4,n:'Specialty'},{lv:5,n:'High gloss'}];
function paintFin(which){
  const box=$(which==='carcass'?'#fin1':'#fin2');
  const cur=which==='carcass'?S.finish:(S.frontFinish||S.finish);
  const term=($('#fq').value||'').trim().toLowerCase();
  box.innerHTML=FAMS.map(fam=>{
    const l=cat.finishes.filter(f=>f.lv===fam.lv&&(!term||f.n.toLowerCase().includes(term)));
    if(!l.length) return '';
    return `<div class="fam"><div class="famhd"><b>${fam.n}</b><span>${l.length} · $${Math.min(...l.map(f=>f.sq)).toFixed(2)}/sq ft</span></div>
      <div class="swrow">${l.map(f=>`<button class="sw" data-n="${f.n.replace(/"/g,'&quot;')}" data-w="${which}"
        aria-pressed="${f.n===cur}" aria-label="${f.n.replace(/"/g,'&quot;')}" style="${swStyle(f)}"></button>`).join('')}</div></div>`;
  }).join('');
  const f=cat.finishes.find(x=>x.n===cur);
  if(f) $(which==='carcass'?'#finNote1':'#finNote2').innerHTML=
    `<b>${f.n}</b> <span class="muted">· Level ${f.lv} · $${f.sq.toFixed(2)}/sq ft · ${f.lead} wks</span>`;
}
function paintPulls(){
  $('#pulls').innerHTML=PULLS.map(p=>`<button data-pull="${p.id}" aria-pressed="${p.id===S.pull}" title="${p.note}">
    <span class="pz p-${p.kind}"></span><i>${p.name}</i></button>`).join('');
  $('#pullfin').innerHTML=PULL_FINISHES.map(f=>`<button data-pf="${f.id}" aria-pressed="${f.id===S.pullFinish}">
    <span class="dotm" style="background:#${f.hex.toString(16).padStart(6,'0')}"></span>${f.name}</button>`).join('');
  const p=PULLS.find(x=>x.id===S.pull);
  $('#pullNote').innerHTML=`<b>${p.name}</b> <span class="muted">· ${p.cost?'$'+p.cost.toFixed(2)+' each':'no charge'}</span><br>${p.note}`;
}

/* ───────── price + order ───────── */
function paintPrice(){
  $('#price').textContent=money(cur.price.price);
  const nb=cur.bays.length;
  $('#priceSub').textContent=`${nb} bay${nb>1?'s':''} · ${cur.parts.length} parts · ${cur.finish.lead} week lead`;
  $('#warn').hidden=!cur.warnings.length;
  $('#warn').innerHTML=cur.warnings.map(w=>`<span>${w}</span>`).join('');
}
function paintOrder(){
  $('#order').innerHTML=`<table><thead><tr><th>Item</th><th>Qty</th><th>Sq ft</th><th>Finish</th></tr></thead><tbody>`+
    cur.order.map(o=>`<tr><td>${o.item}</td><td class="num">${o.qty}</td><td class="num">${o.sq_ft||'—'}</td><td class="fin">${o.finish}</td></tr>`).join('')+
    `</tbody></table>`;
  $('#orderCount').textContent=`${cur.order.length} line items`;
}

/* ───────── events ───────── */
$('#types').onclick=e=>{const b=e.target.closest('button');if(!b)return;applyType(b.dataset.t);rebuild(true)};
$('#mount').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.mounting=b.dataset.m;rebuild(false)};
$('#dims').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  const k=b.dataset.k,s=+b.dataset.s;
  S.room[k]=Math.max(+b.dataset.mn,Math.min(+b.dataset.mx,S.room[k]+s));
  for(const w of Object.keys(S.runs)) if(S.runs[w]?.on) S.runs[w].bays=seedBays(w);
  rebuild(true)};
$('#walls').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  if(!b.dataset.shape || b.dataset.shape===S.shape) return;
  applyShape(b.dataset.shape); rebuild(true)};
$('#bays').onclick=e=>{
  const bay=e.target.closest('[data-bay]');
  if(bay){ const r=S.runs[bay.dataset.wall], len=wallLength(bay.dataset.wall);
    if(bay.dataset.bay==='add'){ r.bays.push(makeBay(28, [])); fitRun(bay.dataset.wall); }
    if(bay.dataset.bay==='del'&&r.bays.length>1){ r.bays.pop(); fitRun(bay.dataset.wall);
      if(S.sel?.wall===bay.dataset.wall && S.sel.i>=r.bays.length) S.sel.i=r.bays.length-1; }
    if(bay.dataset.bay==='even') fitRun(bay.dataset.wall);
    rebuild(true); return; }
  const b=e.target.closest('.bay');
  if(b){ S.sel={wall:b.dataset.wall,i:+b.dataset.i}; rebuild(false); }
};
$('#stack').onclick=e=>{
  const bay=S.runs[S.sel?.wall]?.bays[S.sel?.i]; if(!bay) return;
  const t=e.target.closest('button'); if(!t) return;
  if(t.dataset.bw){
    const d=+t.dataset.bw, r=S.runs[S.sel.wall];
    const next = Math.max(SPEC.bayMin-6, Math.min(SPEC.bayMax+6, bay.w + d));
    const delta = next - bay.w;
    const others = r.bays.filter(b=>b!==bay);
    if(others.length){                       // take it from (or give it to) the neighbours
      const share = delta/others.length;
      if(others.every(b=>b.w - share >= 18)){ bay.w=next; others.forEach(b=>b.w=+(b.w-share).toFixed(1)); }
    } else bay.w = next;
  }
  else if(t.dataset.add){ const d=MODULES[t.dataset.add];
    bay.stack.unshift({m:t.dataset.add, h:d.fill?null:d.defH, o:d.opt?{[d.opt.key]:d.opt.def}:{}}); }
  else if(t.dataset.rm!==undefined && bay.stack.length>1){ bay.stack.splice(+t.dataset.rm,1); }
  else if(t.dataset.mv){ const i=+t.dataset.i, j=i+ +t.dataset.mv;
    if(j>=0&&j<bay.stack.length){ const [x]=bay.stack.splice(i,1); bay.stack.splice(j,0,x); } }
  else if(t.dataset.hh){ const s=bay.stack[+t.dataset.i], d=MODULES[s.m];
    s.h=Math.max(d.minH,Math.min(d.maxH,(s.h ?? d.defH)+ +t.dataset.hh)); }
  else if(t.dataset.opt){ const s=bay.stack[+t.dataset.i], d=MODULES[s.m]; if(!d.opt) return;
    s.o=s.o||{}; s.o[d.opt.key]=Math.max(d.opt.min,Math.min(d.opt.max,(s.o[d.opt.key]??d.opt.def)+ +t.dataset.opt)); }
  else return;
  rebuild(false);
};
const onFin=e=>{const b=e.target.closest('.sw');if(!b)return;
  if(b.dataset.w==='carcass') S.finish=b.dataset.n; else S.frontFinish=b.dataset.n;
  clearCaches(); rebuild(false); paintFin(b.dataset.w)};
$('#fin1').onclick=onFin; $('#fin2').onclick=onFin;
$('#fq').oninput=()=>{paintFin('carcass');paintFin('fronts')};
$('#pulls').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.pull=b.dataset.pull;paintPulls();rebuild(false)};
$('#pullfin').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  S.pullFinish=b.dataset.pf;
  const f=PULL_FINISHES.find(x=>x.id===S.pullFinish);
  PULLMAT=hardwareMaterial(); PULLMAT.color.setHex(f.hex); PULLMAT.roughness=f.rough;
  paintPulls(); rebuild(false)};
$('#scene').onclick=e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.a;
  if(a==='spin'){S.spin=!S.spin;b.setAttribute('aria-pressed',S.spin)}
  if(a==='reset') frame();
  if(a==='evening'){S.evening=!S.evening;b.setAttribute('aria-pressed',S.evening);
    scene.environmentIntensity=S.evening?.34:1; key.intensity=S.evening?.55:1.25;
    key.color.setHex(S.evening?0xffd9a8:0xfff4e8)}};
document.querySelectorAll('.acc > summary').forEach(s=>s.addEventListener('click',()=>setTimeout(resize,280)));
$('#send').onclick=()=>{
  localStorage.setItem('js_quote',JSON.stringify({
    summary:`${TYPES[S.type].label} · ${S.room.w}"×${S.room.d}"×${S.room.h}" · ${cur.bays.length} bays · ${cur.finish.n}`,
    price:Math.round(cur.price.price), type:S.type,
    typeLabel: S.type==='reach-in'?'Reach-In Closets':S.type==='walk-in'?'Walk-In Closets':S.type==='pantry'?'Pantries':S.type==='garage'?'Garage Storage':'Laundry Rooms',
    room:S.room, mounting:S.mounting,
    finish:cur.finish.n, frontFinish:cur.frontFinish.n,
    pull:cur.pull.name, pullFinish:cur.pullFinish.name,
    bays:cur.bays.map(b=>({wall:b.wall,width:+b.w.toFixed(1),
      stack:b.stack.map(s=>({module:MODULES[s.m].label, height:s.h, options:s.o||{}}))})),
    order:cur.order, warnings:cur.warnings,
    generated:new Date().toISOString()
  }));
  location.href='/contact.html';
};
$('#dlOrder').onclick=()=>{
  const rows=[['Item','Qty','Sq ft','Edgeband ft','Finish','Detail'],
    ...cur.order.map(o=>[o.item,o.qty,o.sq_ft,o.edgeband_ft,o.finish,o.detail])];
  const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const u=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  const a=document.createElement('a'); a.href=u; a.download='closet-order.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
};
$('#breakdown').onclick=()=>{ const d=$('#bdbox');
  if(!d.hidden){d.hidden=true;return;} d.hidden=false;
  d.innerHTML=`<p class="bdnote">Supplier cost per line. Your price applies our markup and includes delivery and installation.</p>`+
    cur.price.lines.map(l=>`<div class="bdl"><span>${l.label}</span><b>${money(l.cost)}</b></div>`).join('')+
    `<div class="bdl tot"><span><b>Installed</b></span><b>${money(cur.price.price)}</b></div>`;
};

/* ───────── go ───────── */
const sheet=new Image(); sheet.crossOrigin='anonymous';
sheet.onload=()=>{ initSheet(sheet,cat.meta); clearCaches();
  paintFin('carcass'); paintFin('fronts'); rebuild(true); };
sheet.onerror=()=>{ paintFin('carcass'); paintFin('fronts'); rebuild(true); };
sheet.src=(window.BASE||"")+'img/finishes/sprite.jpg';
paintPulls(); rebuild(true); resize();
