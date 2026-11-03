import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SPEC, MODULES, MODULE_IDS, PULLS, PULL_FINISHES,
         buildDesign, makeBay, defaultStackFor, canAdd } from './design.js';
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
/* A new run starts with NOTHING in it. The previous version dropped two
   bays and a carcass into the room before the customer had chosen anything,
   which is the same mistake as pre-filling the stack: they were handed a
   closet and asked to adjust it. They get an empty room and build it. */
function seedBays(){ return []; }

/* widths the run can actually be divided into. Anything over 36" needs a
   partition because a 3/4" shelf sags past that span, so those are the only
   widths offered — and a custom entry is clamped into the same range. */
const BAY_PRESETS = [24, 28, 30, 32, 36];
function clampBay(v){
  return Math.min(SPEC.bayMax, Math.max(SPEC.bayMin, Math.round(v * 2) / 2));
}
function freeSpace(wall){
  const r = S.runs[wall]; if(!r) return 0;
  return wallLength(wall) - r.bays.reduce((a,b)=>a+b.w, 0);
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
/* ---- procedural room textures --------------------------------------------
   Built on a canvas rather than shipped as files: a 2048px plank texture is
   ~1.5MB of JPEG, and this costs nothing to download and tiles perfectly. */
let ROOM_TEX = null;
function roomTextures(){
  if(ROOM_TEX) return ROOM_TEX;

  // --- oak plank floor ---
  const fc = document.createElement('canvas'); fc.width = fc.height = 1024;
  const f = fc.getContext('2d');
  const PLANKS = 8, ph = fc.height / PLANKS;
  for(let i = 0; i < PLANKS; i++){
    const tone = 158 + Math.round(Math.sin(i * 2.7) * 10) + (i % 3) * 4;
    f.fillStyle = `rgb(${tone + 12},${tone - 2},${Math.round(tone * 0.84)})`;
    f.fillRect(0, i * ph, fc.width, ph);
    // grain
    for(let g = 0; g < 26; g++){
      const y = i * ph + Math.random() * ph;
      f.strokeStyle = `rgba(${90 + Math.random() * 40},${64 + Math.random() * 30},38,${0.05 + Math.random() * 0.09})`;
      f.lineWidth = 0.6 + Math.random() * 1.5;
      f.beginPath(); f.moveTo(0, y);
      for(let x = 0; x <= fc.width; x += 64)
        f.lineTo(x, y + Math.sin((x + i * 90) / 150) * 2.2);
      f.stroke();
    }
    // the seam between boards, and a stagger so it does not read as stripes
    f.strokeStyle = 'rgba(48,34,20,.42)'; f.lineWidth = 2;
    f.beginPath(); f.moveTo(0, i * ph); f.lineTo(fc.width, i * ph); f.stroke();
    const cut = ((i * 317) % fc.width);
    f.beginPath(); f.moveTo(cut, i * ph); f.lineTo(cut, (i + 1) * ph); f.stroke();
  }
  const floor = new THREE.CanvasTexture(fc);
  floor.wrapS = floor.wrapT = THREE.RepeatWrapping;
  floor.colorSpace = THREE.SRGBColorSpace;
  floor.anisotropy = 8;

  // --- painted wall: very fine tooth, almost flat ---
  const wc = document.createElement('canvas'); wc.width = wc.height = 512;
  const w = wc.getContext('2d');
  w.fillStyle = '#DCD8D1'; w.fillRect(0, 0, 512, 512);
  const img = w.getImageData(0, 0, 512, 512), px = img.data;
  for(let i = 0; i < px.length; i += 4){
    const n = (Math.random() - 0.5) * 7;
    px[i] += n; px[i+1] += n; px[i+2] += n;
  }
  w.putImageData(img, 0, 0);
  const wall = new THREE.CanvasTexture(wc);
  wall.wrapS = wall.wrapT = THREE.RepeatWrapping;
  wall.colorSpace = THREE.SRGBColorSpace;

  ROOM_TEX = { floor, wall };
  return ROOM_TEX;
}

/* How much bedroom to show around the cabinetry. Without this the shell was
   exactly the size of the closet, so the camera sat inside the box and you
   never saw a floor, a wall or a baseboard — it read as a carcass in beige.
   The closet stays at x:0..W, z:0..D; the room extends past it. */
const PAD_X = 46, PAD_Z = 88;

function drawRoom(){
  shell.clear();
  const {w:CW, d:CD, h:H} = S.room;
  const W = CW + PAD_X * 2, D = CD + PAD_Z;
  const T = roomTextures();
  const BASE_H = 4.5, BASE_T = 0.6;          // real baseboard, 4½" tall

  const wallMat = () => new THREE.MeshStandardMaterial({
    map: T.wall, color: 0xDFDDD9, roughness: .97, metalness: 0,
    envMapIntensity: .45, side: THREE.DoubleSide });

  const plane = (w, h, px, py, pz, rx, ry, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(px, py, pz); m.rotation.set(rx, ry, 0);
    m.receiveShadow = true; shell.add(m); return m;
  };

  // walls — the tooth texture repeats on a real-world scale, not per-wall
  const mkWall = (w, h, px, py, pz, rx, ry) => {
    const mat = wallMat();
    mat.map = T.wall.clone(); mat.map.needsUpdate = true;
    mat.map.repeat.set(w / 40, h / 40);
    plane(w, h, px, py, pz, rx, ry, mat);
  };
  const X0 = -PAD_X;                       // room's left wall, in closet coords
  mkWall(W, H, X0 + W/2, H/2, 0, 0, 0);
  mkWall(D, H, X0,       H/2, D/2, 0,  Math.PI/2);
  mkWall(D, H, X0 + W,   H/2, D/2, 0, -Math.PI/2);

  // ceiling, lifted slightly off white so it does not blow out
  plane(W, D, X0 + W/2, H, D/2, Math.PI/2, 0,
    new THREE.MeshStandardMaterial({ color: 0xEFEEEC, roughness: .99, metalness: 0,
      envMapIntensity: .4, side: THREE.DoubleSide }));

  // plank floor — one plank run every 7 inches
  const fmat = new THREE.MeshStandardMaterial({ map: T.floor, roughness: .58, metalness: 0,
    envMapIntensity: .6 });
  fmat.map = T.floor.clone(); fmat.map.needsUpdate = true;
  fmat.map.repeat.set(W / 96, D / 56);
  const fl = plane(W, D, X0 + W/2, 0, D/2, -Math.PI/2, 0, fmat);
  fl.receiveShadow = true;

  // baseboard — the single detail that stops this reading as a grey box
  const bmat = new THREE.MeshStandardMaterial({ color: 0xF6F5F3, roughness: .74, metalness: 0,
    envMapIntensity: .45 });
  const baseboard = (w, px, pz, ry) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, BASE_H, BASE_T), bmat);
    b.position.set(px, BASE_H/2, pz); b.rotation.y = ry;
    b.castShadow = false; b.receiveShadow = true; shell.add(b);
  };
  baseboard(W, X0 + W/2,          BASE_T/2, 0);
  baseboard(D, X0 + BASE_T/2,     D/2,      Math.PI/2);
  baseboard(D, X0 + W - BASE_T/2, D/2,      Math.PI/2);
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
  /* Highlight the selected section.

     This used to be a MeshBasicMaterial with wireframe:true, which draws every
     TRIANGLE edge — including the diagonal across each face. That diagonal was
     the stray line running across the closet in the viewport, and it is most of
     why the drawing read as a sketch. EdgesGeometry draws only the real box
     edges, so the selection reads as a crisp outline on cabinetry. */
  if(S.sel){
    const hit=picks.children.find(o=>o.userData.wall===S.sel.wall&&o.userData.i===S.sel.i);
    if(hit){
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(hit.geometry, 1),
        new THREE.LineBasicMaterial({ color:0xCDA96E, transparent:true, opacity:.95, depthTest:false }));
      outline.position.copy(hit.position);
      outline.scale.set(1.012, 1.004, 1.012);
      outline.renderOrder = 999;
      root.add(outline);

      /* a very faint wash so the chosen section separates from its neighbours */
      const wash = new THREE.Mesh(hit.geometry.clone(),
        new THREE.MeshBasicMaterial({ color:0xCDA96E, transparent:true, opacity:.07, depthWrite:false }));
      wash.position.copy(hit.position); wash.scale.set(1.004,1.0,1.004);
      root.add(wash);
    }
  }
  fitShadowCamera(key,root); renderer.shadowMap.needsUpdate=true;
  if(ao?.setSceneClipBox){ const bb=new THREE.Box3().setFromObject(root); if(!bb.isEmpty()) ao.setSceneClipBox(bb); }
}
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
const ndcFrom=(e)=>{ const r=canvas.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); return ndc; };

/* nothing told you a section could be clicked. Cursor changes over one. */
canvas.addEventListener('pointermove', e=>{
  if(e.buttons) return;                               // orbiting, not hovering
  ray.setFromCamera(ndcFrom(e), cam);
  canvas.style.cursor = ray.intersectObjects(picks.children,false).length ? 'pointer' : 'grab';
});
canvas.addEventListener('pointerdown',e=>{ canvas._dx=e.clientX; canvas._dy=e.clientY; });
canvas.addEventListener('pointerup',e=>{
  if(Math.hypot(e.clientX-canvas._dx, e.clientY-canvas._dy)>5) return;   // that was a drag
  const r=canvas.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,cam);
  const hit=ray.intersectObjects(picks.children,false)[0];
  if(hit){
    S.sel={wall:hit.object.userData.wall,i:hit.object.userData.i};
    rebuild(false);
    /* clicking a section in the drawing jumps to its controls, otherwise the
       selection happens on a tab you are not looking at */
    if(typeof window.gotoStep === 'function') window.gotoStep('3');
  }
});

function frame(){
  const {w:W,d:D,h:H}=S.room;
  const vf=cam.fov*Math.PI/180, asp=Math.max(.6,cam.aspect||1.3);
  /* frame the cabinetry PLUS a margin of room, so floor and baseboard read */
  const fitH = H * 1.34, fitW = (W + PAD_X) * 1.18;
  const dist = Math.max(fitH/2/Math.tan(vf/2), fitW/2/(Math.tan(vf/2)*asp)) * 1.05;
  ctl.target.set(W/2, H*0.42, D*0.30);
  cam.position.set(W/2 + W*0.10, H*0.52, D*0.30 + dist);
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
    const len  = wallLength(wall);
    const used = r.bays.reduce((a,b)=>a+b.w,0);
    const left = len - used;
    const d=document.createElement('div'); d.className='runblk';

    /* which preset widths still fit in what is left of this wall */
    const fits = BAY_PRESETS.filter(w => w <= left + 0.01);

    const strip = r.bays.length
      ? `<div class="baystrip">${r.bays.map((b,i)=>`
          <button class="bay ${S.sel?.wall===wall&&S.sel?.i===i?'on':''}"
            draggable="true" data-wall="${wall}" data-i="${i}" style="flex:${b.w}"
            title="${b.stack.length?b.stack.length+' item'+(b.stack.length===1?'':'s')+' — drag to move it along the wall':'empty — click to fill it, drag to move it'}">
            <span class="bstack">${miniStack(b)}</span>
            <span class="bw">${b.w.toFixed(0)}"</span></button>`).join('')}
          ${left > 2 ? `<span class="bay gap" style="flex:${left}" aria-hidden="true">${left.toFixed(0)}" free</span>` : ''}
        </div>`
      : `<p class="note emptyrun">Nothing on this wall yet. Add your first section below.</p>`;

    d.innerHTML = `<div class="runhd"><b>${wall[0].toUpperCase()+wall.slice(1)} wall</b>
      <span class="${left < -0.5 ? 'over' : ''}">${used.toFixed(0)}" of ${len.toFixed(0)}" used${left>0.5?` · ${left.toFixed(0)}" free`:''}</span></div>
      ${strip}
      <div class="bayacts">
        ${fits.map(w=>`<button class="mini addw" data-bay="addw" data-wall="${wall}" data-w="${w}">+ ${w}"</button>`).join('')}
        ${left >= SPEC.bayMin ? `<button class="mini" data-bay="addfill" data-wall="${wall}">+ Fill the rest (${clampBay(left).toFixed(0)}")</button>` : ''}
        ${r.bays.length ? `<button class="mini" data-bay="del" data-wall="${wall}">− Remove last</button>
        <button class="mini" data-bay="even" data-wall="${wall}">Even them up</button>` : ''}
      </div>`;
    host.appendChild(d);
  }
  $('#bayNote').textContent = `Sections run ${SPEC.bayMin}"–${SPEC.bayMax}" wide. Past ${SPEC.bayMax}" a ¾" shelf sags, so a partition goes in — that is why those are the only widths offered.`;
}

/* ───────── step 3: the selected bay's stack ───────── */
function paintStack(){
  const box=$('#stack');
  if(!S.sel || !S.runs[S.sel.wall]?.bays[S.sel.i]){ box.innerHTML='<p class="note">Pick a bay above, or click one on the drawing.</p>'; return; }
  const bay=S.runs[S.sel.wall].bays[S.sel.i];
  /* same arithmetic buildDesign uses, so the palette agrees with the drawing */
  const floorY = S.mounting==='wall' ? SPEC.wallHungBase : SPEC.toeKick;
  const usable = Math.min(SPEC.topShelf, S.room.h - 6) - floorY;
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
      const img = id.toLowerCase().replace(/_/g,'-');
      const chk = canAdd(bay.stack, id, usable);
      /* the reasons contain inch marks, which close the title attribute */
      const tip = (chk.ok ? d.hint : chk.why).replace(/"/g,'&quot;');
      return `<button data-add="${id}" ${chk.ok?'':'disabled'}
        title="${tip}">
        <img src="${(window.BASE||'')}img/parts/${img}.jpg" alt="" loading="lazy" decoding="async"
             width="420" height="315">
        <i>${d.label}</i>
        <em>${(d.spec||'').replace(/"/g,'&quot;')}</em>${chk.ok?'':'<u>Full</u>'}</button>`}).join('')}</div>`;
}

/* ───────── finishes + hardware ───────── */
const swStyle=f=> f.x<0 ? 'background:linear-gradient(135deg,#E3D9CC,#EFE8DF)'
  : `background-image:url(${(window.BASE||'')}img/finishes/sprite.jpg);background-size:${cat.meta.cols*100}% ${cat.meta.rows*100}%;background-position:${(f.x/(cat.meta.cols-1))*100}% ${(f.y/(cat.meta.rows-1))*100}%`;
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
  /* trim anything that no longer fits rather than discarding the whole run */
  for(const w of Object.keys(S.runs)){
    const r=S.runs[w]; if(!r?.on) continue;
    let room = wallLength(w);
    r.bays = r.bays.filter(b => (room -= b.w) >= -0.01);
  }
  rebuild(true)};
$('#walls').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  if(!b.dataset.shape || b.dataset.shape===S.shape) return;
  applyShape(b.dataset.shape); rebuild(true)};
$('#bays').onclick=e=>{
  const bay=e.target.closest('[data-bay]');
  if(bay){
    const wall = bay.dataset.wall, r = S.runs[wall], act = bay.dataset.bay;
    if(act==='addw' || act==='addfill'){
      const want = act==='addw' ? +bay.dataset.w : clampBay(freeSpace(wall));
      /* never let a section run past the wall it sits on */
      const w = Math.min(want, freeSpace(wall));
      if(w >= SPEC.bayMin - 0.01){
        r.bays.push(makeBay(+w.toFixed(1), []));
        S.sel = { wall, i: r.bays.length - 1 };      // select it so they can fill it
        /* adding an empty section and leaving you on the "divide" tab means the
           next thing you want is one tab away and not obvious. Go there. */
        if(typeof window.gotoStep === 'function') setTimeout(()=>window.gotoStep('3'), 60);
      }
    }
    if(act==='del' && r.bays.length){
      r.bays.pop();
      if(S.sel?.wall===wall && S.sel.i >= r.bays.length) S.sel.i = r.bays.length - 1;
      if(!r.bays.length) S.sel = null;
    }
    if(act==='even') fitRun(wall);
    rebuild(true); return; }
  const b=e.target.closest('.bay');
  if(b){ S.sel={wall:b.dataset.wall,i:+b.dataset.i}; rebuild(false); }
};
/* ---- reorder sections along the wall -------------------------------------
   A run is an ordered list, so moving a section is a splice. Dropping onto a
   bay puts the dragged one in front of it; dropping past the end appends. */
let DRAG = null;
$('#bays').addEventListener('dragstart', e=>{
  const b = e.target.closest('.bay[data-wall]'); if(!b) return;
  DRAG = { wall:b.dataset.wall, i:+b.dataset.i };
  b.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try{ e.dataTransfer.setData('text/plain', b.dataset.i); }catch(_){}
});
$('#bays').addEventListener('dragend', ()=>{
  DRAG = null;
  document.querySelectorAll('.bay.dragging,.bay.over').forEach(x=>x.classList.remove('dragging','over'));
});
$('#bays').addEventListener('dragover', e=>{
  const b = e.target.closest('.bay[data-wall]');
  if(!b || !DRAG || b.dataset.wall !== DRAG.wall) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.bay.over').forEach(x=>x.classList.remove('over'));
  b.classList.add('over');
});
$('#bays').addEventListener('drop', e=>{
  const b = e.target.closest('.bay[data-wall]');
  if(!b || !DRAG || b.dataset.wall !== DRAG.wall) return;
  e.preventDefault();
  const from = DRAG.i, to = +b.dataset.i;
  if(from === to) return;
  const bays = S.runs[DRAG.wall].bays;
  const [moved] = bays.splice(from, 1);
  bays.splice(to, 0, moved);
  S.sel = { wall: DRAG.wall, i: to };
  DRAG = null;
  rebuild(true);
});

$('#stack').onclick=e=>{
  const bay=S.runs[S.sel?.wall]?.bays[S.sel?.i]; if(!bay) return;
  const t=e.target.closest('button'); if(!t) return;
  if(t.dataset.bw){
    const d=+t.dataset.bw, r=S.runs[S.sel.wall];
    /* the ±6" slack let a section be pushed to 18" or 42" — neither of which
       he can build. 18" is under the narrowest drawer box he stocks, and a
       3/4" shelf bows past 36". Clamp to what the shop can actually cut. */
    const next = clampBay(bay.w + d);
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
