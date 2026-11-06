import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SPEC, MODULES, MODULE_IDS, PULLS, PULL_FINISHES,
         buildDesign, makeBay, defaultStackFor, canAdd, PRESETS,
         presetDelta, presetFits, DOOR_SPEC, FIT_SPEC, wallLoss, depthLimit, wallGap,
         baseHeight } from './design.js';
import { makeRenderer, setupLighting, fitShadowCamera, loadSharedMaps,
         panelGeo, makeComposer } from './render.js';
import { initSheet, finishMaterial, scaledMaterial, hardwareMaterial,
         clothMaterials, clearCaches } from './materials.js';

/* The catalogue fetch is kicked off by an inline script in the page <head>,
   long before this module graph has finished downloading, so by the time we
   get here it is usually already in hand. This used to be a plain fetch on
   this line, which meant the request did not even leave the browser until
   three.js and every module below it had been parsed and evaluated. */
const cat = await (window.__CAT || Promise.resolve(null))
  .then(c => c || fetch((window.BASE||"")+'assets/data/catalog.json').then(r=>r.json()));
const $ = s => document.querySelector(s);
const money = n => '$'+Math.round(n||0).toLocaleString();

/* ───────── types: which walls are available ───────── */
/* Every one of these was a bare text pill. A customer picking a room type is
   making a visual choice, so each gets a drawing of the thing it is. Paths are
   stroked on a 24x22 box, same grid as the run-shape icons. */
const TYPES = {
  'reach-in':{label:'Reach-in',  walls:['back'],                  w:72, d:24, h:96,
    note:'One wall, doors across the front',
    art:'M2 3h20v16H2z M2 8h20 M6 11h12 M8 11v5 M12 11v6 M16 11v5'},
  'walk-in' :{label:'Walk-in',   walls:['back','left','right'],   w:108,d:120,h:96,
    note:'Cabinetry on two or three walls',
    art:'M2 3h20v17H2z M8 3v17 M16 3v17 M2 8h6 M2 13h6 M16 8h6 M16 13h6 M9 7.5h6 M12 7.5v5'},
  'pantry'  :{label:'Pantry',    walls:['back'],                  w:56, d:16, h:96,
    note:'Shallow, shelf-heavy, floor to ceiling',
    art:'M4 2h16v18H4z M4 6.5h16 M4 11h16 M4 15.5h16 M9 3.6v1.6 M13 3.6v1.6'},
  'garage'  :{label:'Garage',    walls:['back'],                  w:144,d:20, h:108,
    note:'Deep base units under an overhead shelf',
    art:'M2 4h20 M2 11h20v9H2z M9 11v9 M15 11v9 M5 15.5h2'},
  'laundry' :{label:'Laundry',   walls:['back'],                  w:96, d:24, h:96,
    note:'Counter over the machines, storage above',
    art:'M2 6h20 M4 9h7v10H4z M13 9h7v10h-7z M7.5 12.1a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8 M16.5 12.1a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8'}
};

const MOUNTS = [
  { k:'floor', label:'On the floor', note:'Toe kick to the floor',
    art:'M4 3h16v13H4z M4 8h16 M4 12h16 M2 19h20 M6 16v3 M18 16v3' },
  { k:'wall',  label:'Wall-hung',    note:'Clear floor underneath',
    art:'M4 2h16v12H4z M4 7h16 M4 11h16 M2 20h20 M8 14v2 M16 14v2' }
];

/* ───────── room shape: which walls the run goes on ───────── */
const SHAPES = {
  straight:{label:'Straight',  walls:['back'],                 art:'M3 17h18', note:'One wall'},
  l       :{label:'L-shape',       walls:['back','left'],         art:'M3 17h18M3 17V5', note:'Two walls'},
  u       :{label:'U-shape',       walls:['back','left','right'], art:'M3 5v12h18V5', note:'Three walls'},
  /* Custom does not pick walls for you. It turns each wall on and off by hand,
     because real closets are not always one of three shapes: an L that opens
     the other way, a back wall plus the right return only, and so on. */
  custom  :{label:'Custom',        walls:['back'], custom:true,
            art:'M3 5h18v12H3z', note:'Pick the walls yourself', dash:true}
};
const WALL_LABEL = { back:'Back wall', left:'Left wall', right:'Right wall' };

/* ══════════════════════════════════════════════════════════════════════
   DOORS AND WALL FITTINGS

   Everything a real closet has that a catalogue layout ignores, and all of it
   is a real build constraint rather than a note. The rules live in DOOR_SPEC
   and FIT_SPEC in design.js, because that is where the cabinetry is cut: a
   bypass track takes 2½" off the usable depth, a 34" window sill caps the
   partitions under it at 34", baseboard heat takes the whole run off the floor
   and with it the toe kick, a column takes its own width off the wall. Each of
   those changes the square footage, so each of them changes the price.
   ══════════════════════════════════════════════════════════════════════ */
const DOORS = [
  { id:'none',   label:'Open / no doors', note:'Nothing in the way',
    art:'M4 5h16v14' },
  { id:'swing-r',label:'Swing, right',    note:'Hinged on the right',
    art:'M5 3h14v18H5z M19 12h2 M5 3a16 16 0 0 1 14 9' },
  { id:'swing-l',label:'Swing, left',     note:'Hinged on the left',
    art:'M5 3h14v18H5z M3 12h2 M19 3a16 16 0 0 0-14 9' },
  { id:'double', label:'Double / french', note:'Two leaves, meet in the middle',
    art:'M3 3h18v18H3z M12 3v18 M9 12h1 M14 12h1' },
  { id:'bypass', label:'Sliding bypass',  note:'One leaf passes the other',
    art:'M3 4h18v7H3z M3 13h18v7H3z M16 7.5h3 M5 16.5h3' },
  { id:'bifold', label:'Bi-fold',         note:'Folds back in panels',
    art:'M3 3h5v18H3z M8 3h5v18H8z M13 3h5v18h-5z M18 3h3v18h-3z' },
  { id:'barn',   label:'Barn door',       note:'Rides on a rail outside',
    art:'M2 5h20 M4 7h16v14H4z M12 13h2' },
  { id:'pocket', label:'Pocket door',     note:'Slides into the wall',
    art:'M3 3v18 M6 5h9v14H6z M17 12h3 M21 3v18' }
];
const FITTINGS = [
  { id:'outlet',  label:'Outlet',          art:'M7 3h10v18H7z M11 8h2 M11 13h2' },
  { id:'switch',  label:'Light switch',    art:'M7 3h10v18H7z M10 9h4v6h-4z' },
  { id:'vent',    label:'HVAC vent',       art:'M3 5h18v14H3z M5 9h14 M5 12h14 M5 15h14' },
  { id:'heater',  label:'Baseboard heater',art:'M2 8h20v8H2z M6 8v8 M10 8v8 M14 8v8 M18 8v8' },
  { id:'column',  label:'Column',          art:'M8 3h8v18H8z M6 3h12 M6 21h12' },
  { id:'slope',   label:'Sloped ceiling',  art:'M3 20h18 M3 20L21 6 M21 6v14' },
  { id:'window',  label:'Window',          art:'M3 4h18v16H3z M12 4v16 M3 12h18' },
  { id:'pipe',    label:'Pipe / bulkhead', art:'M4 3h6v18H4z M10 7h10v5H10z' }
];

const S = {
  type:'reach-in', shape:'straight', room:{w:72,d:24,h:96}, mounting:'floor',
  finish: cat.finishes.find(f=>f.x>=0)?.n || cat.finishes[0].n,
  frontFinish:null, pull:'bar4', pullFinish:'nickel',
  runs:{}, sel:null, spin:false, evening:false,
  door:'none',
  /* The baseboard is not decoration, it is the reason a closet does not sit
     flush to the wall. `handling` says what happens where the run meets it,
     and `measured` says whether the width they gave was taken wall to wall or
     between the baseboards, which changes how much wall there actually is. */
  base:{ h:4.5, t:0.75, measured:'wall', handling:'scribe' },
  /* A back on every section. Off, because a built-in closet's back is the
     wall and that is what gets installed. */
  backs:false,
  /* Where two runs meet. 'into' gives the corner to the back wall and starts
     the side run clear of it; 'stop' holds both runs back so the corner stays
     a bare square. Both get built; they are different closets. */
  corner:'into',
  /* When you ask to change ONE part of a section, this is which one. Null
     means the picker is showing everything, the way it always did. */
  swap:null,
  /* [{k, wall, at}] where at is inches along that wall from its left end */
  fittings:[]
};
/* how far off the wall the run really stands, in inches */
const baseGap = () => wallGap(S.base);
const qp=new URLSearchParams(location.search);
const qt=qp.get('type')||'';
if(/reach/.test(qt)) S.type='reach-in'; else if(/walk/.test(qt)) S.type='walk-in';
else if(/pantr/.test(qt)) S.type='pantry'; else if(/garage/.test(qt)) S.type='garage';
else if(/laundry/.test(qt)) S.type='laundry';
try{ const f=sessionStorage.getItem('js_finish'); if(f&&cat.finishes.some(x=>x.n===f)) S.finish=f; }catch(e){}

/* ───────── run / bay setup ───────── */
const placedFittings = () => S.fittings.filter(f => f.placed);

/* How much of this wall is actually available to build on. A column or a
   bulkhead takes its own width straight off the wall before a single section
   is laid out, which is why adding one narrows the layout rather than just
   printing a note. */
/* The back wall is the WHOLE back wall. It used to have the side runs'
   depth taken off BOTH ends, so a 108" room showed a 60" back wall on the
   layout tab while step 1 said 108 — and the deduction was wrong twice over,
   because the side runs are already pushed clear of the back run by their
   `start` offset in cfg(). The back run goes corner to corner; the side runs
   begin where it ends. That is how the cabinetry actually goes in. */
function wallLength(wall){
  const base = wall==='back' ? S.room.w : S.room.d - SPEC.hangDepth;
  /* Standing in front of the baseboard costs the run the thickness of the
     base at BOTH ends — but only if the number they gave was measured wall to
     wall. If they measured between the baseboards, it is already right. */
  const bb = (baseGap() > 0 && S.base.measured === 'wall') ? baseGap()*2 : 0;
  return Math.max(SPEC.bayMin, base - bb - wallLoss(placedFittings(), wall));
}
/* The deepest this wall's run can be once the door hardware and anything
   projecting from the wall have had their share. */
function wallDepthCap(wall){
  return depthLimit(S.room, wall, S.door, placedFittings());
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

/* ═══════════ WHERE A SECTION SITS ON THE WALL ═══════════
   A section used to have a width and nothing else: the run was one unbroken
   line starting in the corner, and the only thing you could do was reorder.
   Real walls are not like that. A radiator, a door swing, a window, or simply
   where the customer wants it, all mean a run may start part way along and
   may have a genuine hole in the middle.

   So every section now carries `at`: inches from the LEFT CORNER of its wall.
   Sections are kept sorted by `at`, so the index of a section in this array is
   still the index the 3D drawing and the quote use. Gaps are not stored; they
   are worked out from the spaces between, which means a gap can never drift
   out of agreement with the sections either side of it. */

/* every section's position, filling in anything that predates `at` */
function layout(wall){
  const r = S.runs[wall]; if(!r) return [];
  let run = 0;
  const out = r.bays.map((b,i) => {
    const at = (typeof b.at === 'number' && isFinite(b.at)) ? b.at : run;
    run = at + b.w;
    return { bay:b, i, at, w:b.w, end:at + b.w };
  });
  out.sort((a,b) => a.at - b.at);
  return out;
}
/* keep the array in wall order, because index IS position everywhere else */
function sortRun(wall){
  const r = S.runs[wall]; if(!r) return;
  const L = layout(wall);
  L.forEach(s => { s.bay.at = s.at; });
  r.bays = L.map(s => s.bay);
}
/* the stretches of bare wall, in order, including the two ends */
function gapsOn(wall){
  const len = wallLength(wall), L = layout(wall), out = [];
  let cur = 0;
  for(const s of L){
    if(s.at - cur > 0.05) out.push({ at:cur, w:s.at - cur, before:s.i });
    cur = Math.max(cur, s.end);
  }
  if(len - cur > 0.05) out.push({ at:cur, w:len - cur, before:null });
  return out;
}
/* the first stretch of bare wall a section this wide would fit in */
function firstFit(wall, w){
  for(const g of gapsOn(wall)) if(g.w >= w - 0.01) return g.at;
  return null;
}
/* how far a section can travel without crossing its neighbours or the corners */
function travelRange(wall, index){
  const len = wallLength(wall), L = layout(wall);
  const k = L.findIndex(s => s.i === index);
  if(k < 0) return { lo:0, hi:Math.max(0, len) };
  const me = L[k];
  return { lo: k > 0 ? L[k-1].end : 0,
           hi: (k < L.length-1 ? L[k+1].at : len) - me.w };
}
/* put a section at a given distance from the corner, clamped to what is free */
function moveSection(wall, index, at){
  const { lo, hi } = travelRange(wall, index);
  const b = S.runs[wall].bays[index]; if(!b) return null;
  b.at = Math.max(lo, Math.min(hi, Math.round(at * 2) / 2));   // nearest ½"
  sortRun(wall);
  return b.at;
}
/* what design.js needs: sections with the bare wall between them spelled out */
function withGaps(wall){
  const len = wallLength(wall), out = [];
  let cur = 0;
  for(const s of layout(wall)){
    if(s.at - cur > 0.05) out.push({ w:+(s.at - cur).toFixed(2), gap:true });
    out.push(s.bay);
    cur = s.end;
  }
  return out;
}
/* keep a run's bays summing to the wall. Called whenever a bay is added or
   removed, so the drawing can never run past the wall it sits on. */
function fitRun(wall){
  const r=S.runs[wall]; if(!r||!r.bays.length) return;
  const len=wallLength(wall), each=+(len/r.bays.length).toFixed(1);
  r.bays.forEach(b=>b.w=each);
}
function applyShape(s, keep){
  S.shape = SHAPES[s] ? s : 'straight';
  const def = SHAPES[S.shape];
  /* Custom keeps whatever walls were already on, so switching to it from an
     L-shape starts from that L rather than wiping the design. */
  const walls = def.custom
    ? (keep && Object.keys(S.runs).filter(w => S.runs[w]?.on).length
        ? Object.keys(S.runs).filter(w => S.runs[w]?.on) : def.walls)
    : def.walls;
  const prev = S.runs || {};
  S.runs = {};
  /* two passes: every run has to exist before wallLength() can subtract the
     side runs' depth from the back wall */
  for(const w of walls) S.runs[w] = { on:true, depth:prev[w]?.depth ?? SPEC.hangDepth, bays:[] };
  for(const w of walls) S.runs[w].bays = (keep && prev[w]?.bays?.length) ? prev[w].bays : seedBays(w);
  S.sel = walls.includes(S.sel?.wall) ? S.sel : { wall:walls[0], i:0 };
}
/* turn one wall on or off without losing the others */
function toggleWall(w){
  if(S.runs[w]?.on){
    if(Object.values(S.runs).filter(r=>r?.on).length < 2) return;   // never zero walls
    delete S.runs[w];
  } else {
    S.runs[w] = { on:true, depth:SPEC.hangDepth, bays:[] };
  }
  if(!S.runs[S.sel?.wall]) S.sel = { wall:Object.keys(S.runs)[0], i:0 };
}
function applyType(t){
  S.type=t; const T=TYPES[t];
  S.room={w:T.w,d:T.d,h:T.h};
  applyShape(S.shape);
}
applyType(S.type);

/* Every layout page links straight in here with ?preset=drawer-tower, so the
   customer lands on the section they were just reading about, already drawn
   and already priced, instead of on an empty room with a blank panel. */
const qPre = qp.get('preset');
if(qPre){
  const pre = PRESETS.find(p => p.id === qPre);
  const wall = Object.keys(S.runs).find(w => S.runs[w]?.on);
  if(pre && wall){
    const nb = makeBay(clampBay(Math.min(32, wallLength(wall))),
                       structuredClone(pre.stack), true);
    nb.at = 0;
    S.runs[wall].bays.push(nb);
    S.sel = { wall, i:0 };
  }
}

function cfg(){
  const runs=[];
  for(const wall of ['back','left','right']){
    const r=S.runs[wall]; if(!r||!r.on) continue;
    /* The back run takes the corner unless they asked for it to stop short.
       The side runs always begin clear of the back run's depth, because two
       boxes cannot occupy the same cubic foot. */
    const backDepth = Math.min(S.runs.back?.depth ?? SPEC.hangDepth, wallDepthCap('back'));
    const start = wall==='back'
      ? ((S.runs.left?.on && S.corner==='stop') ? SPEC.hangDepth : 0)
      : backDepth;
    /* clamp here, not only inside buildDesign, so the plan drawing, the click
       volumes and the quote are all reading the same depth */
    runs.push({wall, start, depth:Math.min(r.depth, wallDepthCap(wall)), bays:withGaps(wall)});
  }
  return { room:S.room, mounting:S.mounting, finish:S.finish,
           frontFinish:S.frontFinish||S.finish, pull:S.pull, pullFinish:S.pullFinish,
           door:S.door, base:S.base, backs:S.backs, corner:S.corner,
           fittings:S.fittings.filter(f=>f.placed), runs };
}

/* ───────── scene ───────── */
const canvas=$('#c3d');
const renderer=makeRenderer(canvas);
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(40,1,20,1500);
const ctl=new OrbitControls(cam,canvas);
ctl.enableDamping=true; ctl.dampingFactor=.075;
/* Down to the floor line but never under it, and up to a steep plan view but
   never straight down, which gimbal-locks the orbit and gives a flat diagram. */
ctl.maxPolarAngle=Math.PI/2-0.03; ctl.minPolarAngle=0.20;
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

/* declared before resize() touches it — a `let` below its first use is a
   temporal dead zone and throws the moment resize fires early */
let needsFrame = true;
let drawnOnce = false;
/* set by the first rebuild — the signal that the scene is genuinely ready to
   be looked at. A new room has no cabinetry in it yet, so counting objects in
   the closet group would leave the loading state up forever. */
let built = false;
/* Declared up here, with needsFrame, for the same reason it is: the render
   loop below starts on the first frame while this module is still evaluating
   its top-level await. A `let` further down the file is in its temporal dead
   zone at that moment and every frame throws. */
let fly = null;
const _cp = new THREE.Vector3(), _ct = new THREE.Vector3();

function sizeNow(){ const r=canvas.parentElement.getBoundingClientRect();
  return {w:Math.max(320,r.width|0), h:Math.max(260,r.height|0)}; }
function resize(){ const {w,h}=sizeNow(); renderer.setSize(w,h,false);
  cam.aspect=w/h; cam.updateProjectionMatrix(); if(composer) composer.setSize(w,h);
  needsFrame = true; }
addEventListener('resize',resize);
/* ?noao=1 skips ambient occlusion — a useful escape hatch on weak hardware.
   The composer is built AFTER the first frame is on screen, not before it.
   Building it up front meant downloading and compiling the whole
   post-processing chain, then compiling its shaders, all while the customer
   looked at an empty panel. The closet now appears first and the ambient
   occlusion fades in behind it a moment later. */
let aoWanted = !new URLSearchParams(location.search).has('noao');
function startComposer(){
  if(!aoWanted) return;
  aoWanted = false;
  const {w,h} = sizeNow();
  makeComposer(renderer,scene,cam,w,h).then(m=>{
    composer = m.composer; ao = m.ao;
    if(ao?.setSceneClipBox){
      const bb = new THREE.Box3().setFromObject(root);
      if(!bb.isEmpty()) ao.setSceneClipBox(bb);
    }
    needsFrame = true;
  }).catch(()=>{});
}

let visible = true;
new IntersectionObserver(es=>{ for(const e of es) visible = e.isIntersecting; },{threshold:.02}).observe(canvas);

/* ---- RENDER ON DEMAND ----------------------------------------------------
   This loop used to run a full composer pass — RenderPass, a 16-sample GTAO,
   SMAA and OutputPass, four full-screen passes — sixty times a second for as
   long as the page was open, whether or not anything had changed. On a laptop
   that pins a GPU core and spins the fan on a static picture.

   Now a frame is drawn only when something asks for one: the camera moved,
   the design changed, the canvas resized, or OrbitControls is still settling
   its damping. Idle cost is one requestAnimationFrame callback that returns
   immediately. preserveDrawingBuffer (set in makeRenderer) is what lets the
   last frame persist between draws. */
ctl.addEventListener('change', () => { needsFrame = true; });

(function loop(){
  requestAnimationFrame(loop);
  if(!visible) return;

  if(stepFly(performance.now())) needsFrame = true;
  if(S.spin){ ctl.autoRotate = true; ctl.update(); needsFrame = true; }
  else {
    ctl.autoRotate = false;
    /* update() returns true while damping is still moving the camera */
    if(ctl.update()) needsFrame = true;
  }

  if(!needsFrame) return;
  needsFrame = false;
  if(composer) composer.render(); else renderer.render(scene, cam);

  /* First frame with the closet actually in it. Everything that makes the
     picture nicer rather than present waits for this moment and then goes in
     order: the real floor and walls first, because that is what you can see,
     then the post-processing chain behind it. */
  if(!drawnOnce && built){
    drawnOnce = true;
    document.getElementById('bload')?.classList.add('gone');
    const idle = window.requestIdleCallback || (f => setTimeout(f, 90));
    idle(() => { upgradeRoom(); idle(startComposer, {timeout:1500}); }, {timeout:900});
  }
})();

/* ───────── room + closet ───────── */
/* ---- procedural room textures --------------------------------------------
   Built on a canvas rather than shipped as files: a 2048px plank texture is
   ~1.5MB of JPEG, and this costs nothing to download and tiles perfectly. */
let ROOM_TEX = null;
let ROOM_FLAT = null;
let ROOM_FULL = false;

/* ---- the cheap room, for the first frame ---------------------------------
   The real floor below is a 2048px plank painting plus a Sobel pass over four
   million pixels to derive its relief and sheen. That is over half a second of
   main-thread work, and it was all happening BEFORE the customer saw anything
   at all. So the room is drawn twice: once in flat colour, which costs
   nothing, and once properly a moment after the closet is on screen. Same
   eight-by-eight pixel textures stand in for the real ones so every clone and
   repeat below works unchanged. */
function flatRoomTex(){
  const mk = (hex, lin) => {
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const x = c.getContext('2d'); x.fillStyle = hex; x.fillRect(0,0,8,8);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if(!lin) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { floor:mk('#AD8E67'), wall:mk('#E8E8E7'),
           floorNor:mk('#8080ff',true), floorRgh:mk('#cfcfcf',true) };
}

/* Called once, at idle, after the closet has been drawn. */
function upgradeRoom(){
  if(ROOM_FULL) return;
  ROOM_FULL = true;
  drawRoom();
  needsFrame = true;
}

/* Turn one painted canvas into the relief and sheen maps that go with it.
   Sobel on luminance gives the slope at every pixel; that slope is the normal.
   Roughness comes off the same luminance, darker meaning duller, so the grain
   and the joints catch light differently from the board face. Deriving both
   from the albedo means they can never drift out of register with it. */
function derive(canvas, strength, [roughLo, roughHi]){
  const n = canvas.width, src = canvas.getContext('2d').getImageData(0, 0, n, n).data;
  const lum = new Float32Array(n * n);
  for(let i = 0, p = 0; i < lum.length; i++, p += 4)
    lum[i] = (src[p] * 0.299 + src[p+1] * 0.587 + src[p+2] * 0.114) / 255;

  const nc = document.createElement('canvas'); nc.width = nc.height = n;
  const rc = document.createElement('canvas'); rc.width = rc.height = n;
  const nctx = nc.getContext('2d'), rctx = rc.getContext('2d');
  const nimg = nctx.createImageData(n, n), rimg = rctx.createImageData(n, n);
  const at = (x, y) => lum[((y + n) % n) * n + ((x + n) % n)];

  for(let y = 0; y < n; y++) for(let x = 0; x < n; x++){
    const dx = (at(x-1,y-1) + 2*at(x-1,y) + at(x-1,y+1))
             - (at(x+1,y-1) + 2*at(x+1,y) + at(x+1,y+1));
    const dy = (at(x-1,y-1) + 2*at(x,y-1) + at(x+1,y-1))
             - (at(x-1,y+1) + 2*at(x,y+1) + at(x+1,y+1));
    let nx = dx * strength, ny = dy * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * n + x) * 4;
    nimg.data[i]   = (nx * 0.5 + 0.5) * 255;
    nimg.data[i+1] = (ny * 0.5 + 0.5) * 255;
    nimg.data[i+2] = (nz * 0.5 + 0.5) * 255;
    nimg.data[i+3] = 255;
    const r = (roughHi - (roughHi - roughLo) * lum[y * n + x]) * 255;
    rimg.data[i] = rimg.data[i+1] = rimg.data[i+2] = r;
    rimg.data[i+3] = 255;
  }
  nctx.putImageData(nimg, 0, 0); rctx.putImageData(rimg, 0, 0);
  const normal = new THREE.CanvasTexture(nc);   // linear, never sRGB
  const rough  = new THREE.CanvasTexture(rc);
  return { normal, rough };
}

function roomTextures(){
  if(ROOM_TEX) return ROOM_TEX;
  if(!ROOM_FULL) return (ROOM_FLAT = ROOM_FLAT || flatRoomTex());

  /* ---------------------------------------------------------------------
     The old floor was a flat albedo: painted stripes, painted grain lines,
     one butt joint per row and nothing else. No normal map and no roughness
     map, which is why it read as wallpaper rather than wood. Light had
     nothing to catch on.

     This version builds three maps off one pass:
       albedo     real plank layout, staggered joints, cathedral figure
       normal     derived from luminance, so grain and seams have relief
       roughness  grain and joints are duller than the board face, which is
                  what actually sells wood under a moving light
     --------------------------------------------------------------------- */
  const S = 2048, ROWS = 6, ph = S / ROWS;
  const fc = document.createElement('canvas'); fc.width = fc.height = S;
  const f = fc.getContext('2d');
  const rnd = (a, b) => a + Math.random() * (b - a);

  for(let i = 0; i < ROWS; i++){
    const y0 = i * ph;
    /* Butt joints walk along the row instead of sitting in one place, and
       every row starts at a different offset, so no joint lines up with the
       row above it. A single cut per row read as a tiled pattern. */
    let x = -rnd(0.15, 0.85) * S;
    while(x < S){
      const len = rnd(0.34, 0.72) * S;
      /* each board gets its own colour, and roughly one in six is a notably
         darker or lighter board, which is what real oak looks like laid */
      const odd  = Math.random() < 0.10;
      const base = odd ? rnd(146, 158) : rnd(164, 180);
      const r = base + rnd(10, 18), g = base - rnd(1, 5), b = base * rnd(0.72, 0.79);
      f.save();
      f.beginPath(); f.rect(x, y0, len, ph); f.clip();
      f.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      f.fillRect(x, y0, len, ph);

      // cathedral figure: a few nested arcs running the length of the board
      const arcs = 2 + (Math.random() * 3 | 0);
      for(let a = 0; a < arcs; a++){
        const cy = y0 + rnd(0.15, 0.85) * ph, amp = rnd(4, 15), cx = x + rnd(0.2, 0.8) * len;
        for(let k = 0; k < 5; k++){
          f.strokeStyle = `rgba(${(r*0.52)|0},${(g*0.44)|0},${(b*0.4)|0},${rnd(0.05, 0.14)})`;
          f.lineWidth = rnd(0.8, 2.6);
          f.beginPath();
          f.moveTo(x, cy + k * rnd(2, 5));
          f.quadraticCurveTo(cx, cy + k * rnd(2, 5) - amp, x + len, cy + k * rnd(2, 5));
          f.stroke();
        }
      }
      // fine pore lines along the board
      for(let gl = 0; gl < 46; gl++){
        const yy = y0 + Math.random() * ph;
        f.strokeStyle = `rgba(${(r*0.46)|0},${(g*0.4)|0},40,${rnd(0.03, 0.1)})`;
        f.lineWidth = rnd(0.4, 1.3);
        f.beginPath(); f.moveTo(x, yy);
        for(let xx = x; xx <= x + len; xx += 48)
          f.lineTo(xx, yy + Math.sin((xx + i * 90) / 170) * 1.8);
        f.stroke();
      }
      f.restore();

      /* Every joint is a chamfer, not a line: a dark groove with a lit lip on
         one side. That pair is what the normal map turns into a real edge. */
      const groove = (gx, gy, gw, gh, vert) => {
        const grad = vert ? f.createLinearGradient(gx, 0, gx + gw, 0)
                          : f.createLinearGradient(0, gy, 0, gy + gh);
        grad.addColorStop(0,   'rgba(255,248,236,.16)');
        grad.addColorStop(.42, 'rgba(42,28,16,.55)');
        grad.addColorStop(.62, 'rgba(42,28,16,.42)');
        grad.addColorStop(1,   'rgba(255,248,236,.07)');
        f.fillStyle = grad; f.fillRect(gx, gy, gw, gh);
      };
      groove(x - 2.5, y0, 5, ph, true);      // butt joint
      x += len;
    }
    groove_row(f, y0, S);                     // the long edge between rows
  }
  function groove_row(ctx, y0, W){
    const g = ctx.createLinearGradient(0, y0 - 3, 0, y0 + 3);
    g.addColorStop(0,   'rgba(255,248,236,.14)');
    g.addColorStop(.45, 'rgba(38,25,14,.6)');
    g.addColorStop(1,   'rgba(255,248,236,.06)');
    ctx.fillStyle = g; ctx.fillRect(0, y0 - 3, W, 6);
  }

  const floor = new THREE.CanvasTexture(fc);
  floor.wrapS = floor.wrapT = THREE.RepeatWrapping;
  floor.colorSpace = THREE.SRGBColorSpace;
  floor.anisotropy = 16;

  /* Derive relief and sheen from the albedo so the three always agree.
     Derived at half resolution: the Sobel pass is per pixel, so 1024 is four
     times cheaper than 2048, and a normal map carrying grain this fine is
     indistinguishable at any camera distance you can actually reach. */
  const half = document.createElement('canvas'); half.width = half.height = S / 2;
  half.getContext('2d').drawImage(fc, 0, 0, S / 2, S / 2);
  const { normal: floorNor, rough: floorRgh } = derive(half, 2.1, [0.62, 0.95]);
  for(const t of [floorNor, floorRgh]){
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  }

  // --- painted wall: very fine tooth, almost flat ---
  const wc = document.createElement('canvas'); wc.width = wc.height = 512;
  const w = wc.getContext('2d');
  w.fillStyle = '#E8E8E7'; w.fillRect(0, 0, 512, 512);
  const img = w.getImageData(0, 0, 512, 512), px = img.data;
  for(let i = 0; i < px.length; i += 4){
    const n = (Math.random() - 0.5) * 7;
    px[i] += n; px[i+1] += n; px[i+2] += n;
  }
  w.putImageData(img, 0, 0);
  const wall = new THREE.CanvasTexture(wc);
  wall.wrapS = wall.wrapT = THREE.RepeatWrapping;
  wall.colorSpace = THREE.SRGBColorSpace;

  ROOM_TEX = { floor, floorNor, floorRgh, wall };
  return ROOM_TEX;
}

/* How much bedroom to show around the cabinetry. Without this the shell was
   exactly the size of the closet, so the camera sat inside the box and you
   never saw a floor, a wall or a baseboard — it read as a carcass in beige.
   The closet stays at x:0..W, z:0..D; the room extends past it. */
/* The room used to be drawn 46" wider on each side and 88" deeper than the
   room the customer typed, so the camera had somewhere to stand. The cost was
   that a run spanning the whole wall stopped 46" short of both corners, which
   made every layout look like it floated in the middle of the room. The room
   is now exactly the room they measured: x runs 0..w, z runs 0..d, and a
   section at x=0 is physically in the corner. The camera stands outside the
   box; the walls are FrontSide with inward normals, so whichever one is
   between the camera and the closet simply is not drawn. */

function drawRoom(){
  shell.clear();
  const {w:CW, d:CD, h:H} = S.room;
  const W = CW, D = CD;
  const T = roomTextures();
  /* drawn at the size they actually told us, so the gap you can see between
     the cabinetry and the wall is the gap that is really there */
  const BASE_H = +S.base.h || 4.5, BASE_T = +S.base.t || 0.75;

  /* FrontSide, with every normal pointing INTO the room. That is what makes
     the 360 work: orbit round the back and the near wall simply is not drawn,
     so you look straight through it at the back of the closet instead of at a
     flat grey panel. Double-sided walls were boxing the camera in. */
  const wallMat = () => new THREE.MeshStandardMaterial({
    map: T.wall, color: 0xE4E4E3, roughness: .95, metalness: 0,
    envMapIntensity: .45, side: THREE.FrontSide });

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
  const X0 = 0;                            // room's left wall IS closet x = 0
  mkWall(W, H, X0 + W/2, H/2, 0,   0,  0);            // back,  faces +z
  mkWall(D, H, X0,       H/2, D/2, 0,  Math.PI/2);    // left,  faces +x
  mkWall(D, H, X0 + W,   H/2, D/2, 0, -Math.PI/2);    // right, faces -x
  mkWall(W, H, X0 + W/2, H/2, D,   0,  Math.PI);      // front, faces -z

  /* No ceiling. It only ever existed to close the box, and it blocked the
     plan view, which is the one angle where you can read the whole layout at
     once. The room reads fine without it because the walls stop at H. */

  /* Plank floor. One tile covers 96" x 56", so six rows gives boards about
     9" wide, which is a real wide-plank size. Albedo, relief and sheen all
     repeat together or the grain slides off its own shadow. */
  const fmat = new THREE.MeshStandardMaterial({
    map: T.floor, normalMap: T.floorNor, roughnessMap: T.floorRgh,
    roughness: 1, metalness: 0, envMapIntensity: .55 });
  fmat.normalScale = new THREE.Vector2(0.55, 0.55);
  for(const k of ['map','normalMap','roughnessMap']){
    fmat[k] = fmat[k].clone(); fmat[k].needsUpdate = true;
    fmat[k].repeat.set(W / 52, D / 40);
  }
  const fl = plane(W, D, X0 + W/2, 0, D/2, -Math.PI/2, 0, fmat);
  fl.receiveShadow = true;

  // baseboard — the single detail that stops this reading as a grey box
  const bmat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: .62, metalness: 0,
    envMapIntensity: .45 });
  const baseboard = (w, px, pz, ry) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, BASE_H, BASE_T), bmat);
    b.position.set(px, BASE_H/2, pz); b.rotation.y = ry;
    b.castShadow = false; b.receiveShadow = true; shell.add(b);
  };
  /* ── Where the cabinetry covers it, the baseboard is NOT drawn ──────────
     This is the whole "it is not up to the wall" problem, and it was the
     drawing's fault rather than the geometry's: the run's back face has
     always been exactly on the wall, but the baseboard was drawn straight
     through it, full length. Because the sections are open at the back and
     the base is 4.5" against a 3.75" toe kick, three quarters of an inch of
     white baseboard showed INSIDE every section, right at floor level. A
     white strip behind the cabinetry is the exact thing your eye reads as
     "that is standing off the wall".

     Notched or removed, the base is behind the run and you cannot see it,
     so it is not drawn there. Standing in FRONT of it, you can see it and
     it stays, because then it really is there. */
  const covered = wall => {
    if(S.base.handling === 'front') return [];      // it is genuinely visible
    const r = S.runs[wall]; if(!r?.on || !r.bays?.length) return [];
    const off = wall === 'back' ? 0 : SPEC.hangDepth;
    return layout(wall)
      .map(sb => [off + sb.at, off + sb.at + sb.w])
      .sort((a, b) => a[0] - b[0]);
  };
  /* one length of base, minus the stretches the cabinetry sits on */
  const baseRun = (len, gaps, place) => {
    let at = 0;
    for(const [from, to] of gaps){
      if(from > at + 0.02) place(at, Math.min(from, len));
      at = Math.max(at, Math.min(to, len));
    }
    if(at < len - 0.02) place(at, len);
  };

  baseRun(W, covered('back'),  (a, b) => baseboard(b - a, X0 + (a + b) / 2, BASE_T / 2, 0));
  baseRun(D, covered('left'),  (a, b) => baseboard(b - a, X0 + BASE_T / 2, (a + b) / 2, Math.PI / 2));
  baseRun(D, covered('right'), (a, b) => baseboard(b - a, X0 + W - BASE_T / 2, (a + b) / 2, Math.PI / 2));
  baseboard(W, X0 + W/2, D - BASE_T/2, 0);          // the near wall, never built on
}

function drawCloset(res){
  root.clear(); picks.clear();
  const baseC=finishMaterial(res.finish,shared,'carcass');
  const baseF=finishMaterial(res.frontFinish,shared,'front');
  res.geo.forEach((g,i)=>{
    /* The floor was 0.3", which is thicker than a basket wire. Wire is drawn
       at about 0.22" and was being fattened into a bar. */
    const [sx,sy,sz]=g.s.map(v=>Math.max(0.1,v));
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
    const y=baseHeight(S.mounting, placedFittings())+b.h/2;
    const local={p:[b.x,y,0]};
    const G = res.wallGap || 0;
    const along = (r.start||0) + G + b.x;
    const pos = r.wall==='left'  ? [G + r.depth/2, y, along]
              : r.wall==='right' ? [S.room.w - G - r.depth/2, y, along]
              : [along, y, G + r.depth/2];
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
      /* depthTest:false drew this outline straight THROUGH the cabinetry, so
         every panel looked see-through and the whole drawing read as a wire
         sketch rather than solid boxes. The outline now respects depth and is
         pushed a hair toward the camera with polygonOffset, which keeps it
         crisp on the near faces without ghosting through the far ones. */
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(hit.geometry, 1),
        new THREE.LineBasicMaterial({ color:0xCDA96E, transparent:true, opacity:.95,
          depthTest:true, depthWrite:false,
          polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
      outline.position.copy(hit.position);
      outline.scale.set(1.006, 1.002, 1.006);
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
  canvas.style.cursor = ray.intersectObjects(picks.children,false).length ? 'ew-resize' : 'grab';
});
/* ══════════════════════════════════════════════════════════════════════
   DRAG A SECTION ALONG ITS WALL, IN THE DRAWING

   Up to now a section could only be reordered from the little strip in the
   side panel, which nobody found. Press on a section in the 3D view and pull
   it left or right and it walks along the run, swapping with its neighbours
   as it passes them. The orbit controls are switched off for the duration so
   the camera does not spin while you are placing cabinetry.

   The maths: project the run's own left-to-right axis into screen space once
   on pointerdown, then every move is a dot product of the pointer delta onto
   that axis. That way dragging right always moves the section right no
   matter where the camera happens to be standing.
   ══════════════════════════════════════════════════════════════════════ */
let SDRAG = null;

function runAxisScreen(wall){
  /* two points one inch apart along the run, projected to screen */
  const { w:W, d:D } = S.room, dep = S.runs[wall]?.depth ?? SPEC.hangDepth;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  if(wall === 'left')       { a.set(dep/2, 40, 0);       b.set(dep/2, 40, 1); }
  else if(wall === 'right') { a.set(W-dep/2, 40, 0);     b.set(W-dep/2, 40, 1); }
  else                      { a.set(0, 40, dep/2);       b.set(1, 40, dep/2); }
  a.project(cam); b.project(cam);
  const vx = (b.x - a.x), vy = -(b.y - a.y);           // NDC y is flipped
  const len = Math.hypot(vx, vy) || 1;
  return { x:vx/len, y:vy/len, pxPerInch: len * canvas.clientWidth / 2 };
}

canvas.addEventListener('pointerdown', e=>{
  canvas._dx = e.clientX; canvas._dy = e.clientY;
  ray.setFromCamera(ndcFrom(e), cam);
  const hit = ray.intersectObjects(picks.children, false)[0];
  if(!hit) return;
  const { wall, i } = hit.object.userData;
  const bays = S.runs[wall]?.bays; if(!bays || !bays[i]) return;
  SDRAG = { wall, i, axis:runAxisScreen(wall), x0:e.clientX, y0:e.clientY,
            at0: bays[i].at ?? 0, moved:false };
  DRAGGING = true;
  ctl.enabled = false;
  canvas.setPointerCapture?.(e.pointerId);
  canvas.style.cursor = 'grabbing';
});

const dragSectionTo = onFrame(pt => {
  if(!SDRAG) return;
  /* how far along the wall, in inches, has the pointer travelled */
  const dx = pt.x - SDRAG.x0, dy = pt.y - SDRAG.y0;
  const along = (dx * SDRAG.axis.x + dy * SDRAG.axis.y) / Math.max(1, SDRAG.axis.pxPerInch);
  if(Math.abs(along) > 0.75) SDRAG.moved = true;
  if(!SDRAG.moved) return;

  const at = moveSection(SDRAG.wall, SDRAG.i, SDRAG.at0 + along);
  SDRAG.i = S.runs[SDRAG.wall].bays.findIndex(b => (b.at ?? 0) === at && b.w);
  if(SDRAG.i < 0) SDRAG.i = 0;
  S.sel = { wall:SDRAG.wall, i:SDRAG.i };
  showAtTip(SDRAG.wall, SDRAG.i, pt.x, pt.y);
  rebuild(false);
});
canvas.addEventListener('pointermove', e=>{
  if(!SDRAG) return;
  dragSectionTo({ x:e.clientX, y:e.clientY });
});

/* ---- the running measurement -------------------------------------------
   While a section is being moved, the one number that matters is how far it
   now sits from the corner of the wall. It follows the pointer, in the 3D
   view and on the strip alike, and disappears the moment you let go. */
function showAtTip(wall, i, px, py){
  let tip = $('#attip');
  if(!tip){
    tip = document.createElement('div'); tip.id = 'attip';
    document.body.appendChild(tip);
  }
  const L = layout(wall), me = L.find(x => x.i === i);
  if(!me) return;
  const len = wallLength(wall);
  const right = Math.max(0, len - me.end);
  const G = baseGap();
  tip.innerHTML = `<b>${(me.at+G).toFixed(1).replace(/\.0$/,'')}"</b> from the left corner`
    + `<span>${me.w.toFixed(0)}" section &middot; ${(right+G).toFixed(1).replace(/\.0$/,'')}" to the right corner`
    + (G ? ` &middot; ${G}" off the wall at the baseboard` : '') + `</span>`;
  tip.style.left = px + 'px';
  tip.style.top  = py + 'px';
  tip.dataset.on = '1';
}
const hideAtTip = () => { const t = $('#attip'); if(t) delete t.dataset.on; };

/* inches between where the section started and where it sits now */
function offsetOf(bays, from, now){
  let d = 0;
  if(now > from) for(let k = from; k < now; k++) d += bays[k].w;
  else           for(let k = now; k < from; k++) d -= bays[k].w;
  return d;
}

const endSectionDrag = () => {
  if(!SDRAG) return;
  const wasMove = SDRAG.moved;
  SDRAG = null; DRAGGING = false; ctl.enabled = true; canvas.style.cursor = 'grab';
  hideAtTip();
  if(wasMove) rebuild(true);              // reprice once, at the end
};
canvas.addEventListener('pointerup', endSectionDrag);
canvas.addEventListener('pointercancel', endSectionDrag);
canvas.addEventListener('pointerup',e=>{
  if(Math.hypot(e.clientX-canvas._dx, e.clientY-canvas._dy)>5) return;   // that was a drag
  if(SDRAG?.moved) return;                                               // that was a reorder
  const r=canvas.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,cam);
  const hit=ray.intersectObjects(picks.children,false)[0];
  if(hit){
    S.sel={wall:hit.object.userData.wall,i:hit.object.userData.i};
    rebuild(false);
    /* Dividing the wall and filling it are one panel now, so clicking a
       section on the drawing just selects it. It used to yank you onto
       another tab, which is what made adding two sections in a row feel
       like the thing was fighting you. */
    if(typeof window.gotoStep === 'function') window.gotoStep('2');
  }
});

function frame(){
  const v = view('1');
  ctl.target.set(...v.t); cam.position.set(...v.p); ctl.update();
}

/* ══════════════════════════════════════════════════════════════════════
   CAMERA CHOREOGRAPHY

   A configurator should look at the thing you are choosing. Picking a
   handle while staring at the whole wall from twelve feet away is how you
   end up with nobody noticing handles exist. So every step owns a camera
   move: wide for the room, straight-on for dividing it up, in on the
   selected section while you fill it, and right up on a drawer front when
   you are choosing the pull.

   Nothing here locks the camera. The move is a starting position; drag and
   you take over immediately.
   ══════════════════════════════════════════════════════════════════════ */
function fitDist(fitH, fitW){
  const vf = cam.fov * Math.PI / 180, asp = Math.max(.6, cam.aspect || 1.3);
  return Math.max(fitH / 2 / Math.tan(vf / 2), fitW / 2 / (Math.tan(vf / 2) * asp));
}

/* The bay the customer is working on, in WORLD coordinates.

   bayIndex stores x along its own run, not along the room, because place()
   maps a run onto whichever wall it sits on. Reading b.x as a world x is
   right for the back wall and wrong by the width of the room for the other
   two, which is how you end up flying the camera into a corner on a U-shape. */
function focusBay(){
  const { w:W, d:D, h:H } = S.room;
  const b = cur?.bays?.length
    ? (S.sel ? cur.bays.find(x => x.wall === S.sel.wall && x.bay === S.sel.i) : null) || cur.bays[0]
    : null;
  if(!b) return { x:W/2, z:D*0.3, w:Math.min(W,36), h:H*0.7, wall:'back' };
  const dep = b.depth;
  const at = b.wall === 'left'  ? { x:dep*0.5,     z:b.x }
           : b.wall === 'right' ? { x:W - dep*0.5, z:b.x }
           : b.wall === 'island'? { x:b.x,         z:D*0.5 }
           :                      { x:b.x,         z:dep*0.5 };
  return { ...at, w:b.w, h:b.h, wall:b.wall };
}

/* The handle step has to look at a front with a pull on it. Picking the
   selected bay blindly put the camera inside a run of shoe shelves, which
   have no hardware at all. Walk the stacks for a module that takes one. */
const TAKES_PULL = new Set(['DRAWERS','DOOR','GLASS_DOOR','HAMPER']);
function pullFace(){
  const { w:W, d:D, h:H } = S.room;
  if(!cur?.bays?.length) return null;
  const order = S.sel
    ? [...cur.bays].sort((a,b) =>
        (b.wall === S.sel.wall && b.bay === S.sel.i) - (a.wall === S.sel.wall && a.bay === S.sel.i))
    : cur.bays;
  for(const b of order){
    const stack = b.stack || [];
    let y = SPEC.toeKick;
    const tot = stack.reduce((a,s) => a + (s.h || MODULES[s.m].defH), 0) || 1;
    const scale = stack.length ? b.h / tot : 1;
    for(const sItem of stack){
      const hh = (sItem.h || MODULES[sItem.m].defH) * scale;
      if(TAKES_PULL.has(sItem.m)){
        const dep = b.depth;
        const at = b.wall === 'left'  ? { x:dep*0.5,     z:b.x }
                 : b.wall === 'right' ? { x:W - dep*0.5, z:b.x }
                 : b.wall === 'island'? { x:b.x,         z:D*0.5 }
                 :                      { x:b.x,         z:dep*0.5 };
        return { ...at, y:y + hh/2, w:Math.max(b.w, 18), h:Math.max(hh, 16), wall:b.wall };
      }
      y += hh;
    }
  }
  return null;
}

/* Stand off the face of the run the bay belongs to, not always off +Z. */
function standOff(b, dist){
  switch(b.wall){
    case 'left':  return [ b.x + dist, b.z ];
    case 'right': return [ b.x - dist, b.z ];
    default:      return [ b.x,        b.z + dist ];
  }
}

function view(step){
  const { w:W, d:D, h:H } = S.room;
  switch(String(step)){
    case '2': {
      /* Layout. With a section selected, go in on it. With nothing selected
         yet, show the wall straight on so the widths read true. */
      if(!S.sel || !cur?.bays?.length){
        const d = fitDist(H * 1.12, (W + 10) * 1.02);
        return { t:[W/2, H*0.46, 0], p:[W/2, H*0.48, d] };
      }
      const b = focusBay();
      const midY = baseHeight(S.mounting, placedFittings()) + b.h / 2;
      /* Frame the section being edited WITH its neighbours. Fitting the bay
         alone cropped the rest of the run against the edge of the canvas,
         which read as a broken drawing rather than a close-up. Show the whole
         run when it is short, and the bay plus about one either side when it
         is long. */
      const runW = (cur?.bays || []).filter(x => x.wall === b.wall)
                     .reduce((a, x) => a + x.w, 0) || b.w;
      const ctx = Math.min(Math.max(runW, b.w) * 1.12, Math.max(b.w, 24) * 3.4);
      const dist = fitDist(b.h * 1.42, ctx);
      const [px, pz] = standOff(b, dist);
      return { t:[b.x, midY, b.z], p:[px, midY + b.h * 0.06, pz] };
    }
    case '3': {            // finishes: three-quarter, so grain runs across panels
      const dist = fitDist(H * 1.1, W * 0.78);
      return { t:[W*0.5, H*0.45, D*0.25], p:[W*0.5 + dist*0.56, H*0.56, D*0.25 + dist*0.84] };
    }
    case '4': {            // handles: frame something that actually HAS one
      const f = pullFace();
      if(!f) return view('3');          // nothing in the design takes a pull yet
      const dist = fitDist(f.h * 1.5, f.w * 1.5);
      const [px, pz] = standOff(f, dist);
      /* a slight three-quarter, so the pull reads as a solid object rather
         than a line drawn flat on a front */
      const off = dist * 0.3;
      return { t:[f.x, f.y, f.z],
               p:[px + (f.wall === 'back' ? off : 0), f.y + f.h * 0.3,
                  pz + (f.wall === 'back' ? 0 : off)] };
    }
    default: {             // 1 and 6: the whole room
      /* The room used to be drawn with 46" of padding on each side, so the
         framing had to allow for scenery that is no longer there. Fitting the
         real room leaves it swimming in empty canvas, so the margins came in
         with it. */
      const dist = fitDist(H * 1.14, (W + 14) * 1.02);
      return { t:[W/2, H*0.46, D*0.30], p:[W/2 + W*0.04, H*0.54, D*0.30 + dist] };
    }
  }
}

const easeInOut = x => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;

function flyTo(step, ms = 760){
  const v = view(step);
  fly = { t0: performance.now(), ms,
          p0: cam.position.clone(), t0v: ctl.target.clone(),
          p1: new THREE.Vector3(...v.p), t1: new THREE.Vector3(...v.t) };
  needsFrame = true;
}

function stepFly(now){
  if(!fly) return false;
  const k = Math.min(1, (now - fly.t0) / fly.ms), e = easeInOut(k);
  cam.position.copy(_cp.copy(fly.p0).lerp(fly.p1, e));
  ctl.target.copy(_ct.copy(fly.t0v).lerp(fly.t1, e));
  ctl.update();
  if(k >= 1) fly = null;
  return true;
}

/* Any drag, wheel or touch hands control straight back to the customer. */
for(const ev of ['pointerdown','wheel','touchstart'])
  canvas.addEventListener(ev, () => { fly = null; }, { passive:true });

/* The step tabs are plain inline script so the panel still works if this
   module fails to load. Wrap rather than replace, so that stays true. */
(function hookSteps(){
  const orig = window.gotoStep;
  if(typeof orig !== 'function') return;
  window.gotoStep = function(n){ orig(n); flyTo(n); };
})();

/* ───────── render pass ───────── */
let cur=null;
/* ── Dragging ──────────────────────────────────────────────────────────
   Sliding a section along a wall used to run the whole machine on every
   single pointermove: the room's walls, floor, textures and baseboards were
   thrown away and rebuilt, the canvas was re-measured, all nine panels were
   re-rendered from scratch, and the camera was told to fly somewhere. At
   sixty of those a second the drag could not keep up with the pointer.

   None of that work is about the thing being dragged. While DRAGGING is on,
   the room stays where it is, the camera stays where it is, and only the
   cabinetry and the two things that actually change — the strip and the
   price — are redrawn. Everything else catches up once the pointer is let
   go, which is also when the price is worth reading. */
let DRAGGING = false;

function rebuild(reframe){
  cur=buildDesign(cfg(),cat);
  if(!DRAGGING) drawRoom();
  drawCloset(cur);
  if(!DRAGGING) resize();
  if(reframe){ resize(); frame(); }
  if(DRAGGING) paintWhileDragging(); else paintAll();
  built = true;
}
function paintAll(){ paintSteps(); paintPlan(); paintDoors(); paintBays(); paintStack(); paintPrice(); paintQuote(); paintOrder(); paintFinTabs(); markSteps();
  /* steps 3 and 5 look at one section, so changing which one is selected has
     to move the camera too, not just the panel */
  const st = document.body.dataset.step;
  if((st === '2' || st === '4') && cur?.bays?.length) flyTo(st, 520);
}
/* The two things that move while you drag. When the drag started ON the
   strip, the strip is deliberately left alone: repainting it would destroy
   the very button the pointer is captured on and the drag would die on the
   first frame. That one moves its own element instead. */
function paintWhileDragging(){ if(!TDRAG) paintBays(); paintPrice(); }

/* One update per displayed frame, not one per pointer event. A trackpad
   fires far more moves than the screen can show, and every extra one was a
   full rebuild thrown away before anyone saw it. */
function onFrame(fn){
  let pending = null, queued = false;
  return arg => {
    pending = arg;
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; const a = pending; pending = null; fn(a); });
  };
}

/* tick the steps that have been satisfied, so the bar reads as progress
   rather than six identical buttons */
function markSteps(){
  const anyBay   = Object.values(S.runs).some(r => r?.on && r.bays.length);
  const anyFill  = Object.values(S.runs).some(r => r?.on && r.bays.some(b => b.stack.length));
  const done = { '1':true, '2':anyFill || anyBay, '3':!!S.finish, '4':!!S.pull, '5':anyFill };
  document.querySelectorAll('.steptabs [data-tab]').forEach(t=>{
    if(done[t.dataset.tab]) t.dataset.done='1'; else delete t.dataset.done;
  });
}

/* ───────── step 1: space ───────── */
const iconBtn = (attr, val, on, art, label, note) =>
  `<button ${attr}="${val}" aria-pressed="${on}" title="${(note||'').replace(/"/g,'&quot;')}">
     <svg viewBox="0 0 24 22" aria-hidden="true"><path d="${art}"/></svg>
     <i>${label}</i>${note?`<u>${note}</u>`:''}</button>`;

function paintSteps(){
  $('#types').className='pills icons icons-3';
  $('#types').innerHTML=Object.entries(TYPES).map(([k,t])=>
    iconBtn('data-t', k, k===S.type && S.shape!=='custom', t.art, t.label, t.note)).join('')
    + iconBtn('data-shape', 'custom', S.shape==='custom', SHAPES.custom.art,
              'Custom', 'Pick the walls yourself');

  /* Custom is the only mode that asks which walls, because it is the only
     one where the answer is not already implied. */
  const onWalls = Object.keys(S.runs).filter(w=>S.runs[w]?.on);
  $('#wallpick').innerHTML = S.shape==='custom' ? `
      <span class="addlbl">Which walls get cabinetry</span>
      <div class="wallgrid">${['back','left','right'].map(w=>`
        <button data-wall-t="${w}" aria-pressed="${onWalls.includes(w)}">
          <!-- A plan of the room with the one wall that gets cabinetry drawn
               solid. The three used to be near-identical line glyphs; this
               reads the same way as the floor plan underneath it. -->
          <svg class="wico" viewBox="0 0 28 24" aria-hidden="true">
            <rect class="wrm" x="3" y="3" width="22" height="18" rx="1.5"/>
            <rect class="wbar" ${
              w==='back'  ? 'x="3" y="3" width="22" height="5"'  :
              w==='left'  ? 'x="3" y="3" width="5"  height="18"' :
                            'x="20" y="3" width="5" height="18"'} rx="1.5"/>
            ${w==='back'
              ? '<path class="wtk" d="M7 11.5h3M12.5 11.5h3M18 11.5h3"/>'
              : w==='left'
              ? '<path class="wtk" d="M11.5 7v3M11.5 12.5v3M11.5 18v-3"/>'
              : '<path class="wtk" d="M16.5 7v3M16.5 12.5v3M16.5 18v-3"/>'}
          </svg>
          <i>${WALL_LABEL[w]}</i>
          <u>${onWalls.includes(w) ? `${wallLength(w).toFixed(0)}" run` : 'Not used'}</u>
        </button>`).join('')}</div>` : '';
  /* Three stacked rows each with one number in the middle wasted most of the
     panel and you could not type a real measurement into any of them. Three
     columns, and the number is an input: type 103 if the wall is 103. */
  /* The three steppers were removed: the same three numbers are typed under
     the floor plan, which is the clearer of the two and the one that shows
     you the shape you are describing. This still runs if the element is put
     back. */
  if($('#dims')) $('#dims').innerHTML=[['w','Wall width',36,288,6],['d','Depth',12,48,2],['h','Ceiling',84,132,2]]
    .map(([k,l,mn,mx,st])=>`<div class="dim">
      <span class="dimlbl">${l}</span>
      <div class="dimrow">
        <button data-k="${k}" data-s="-${st}" data-mn="${mn}" data-mx="${mx}" aria-label="Less ${l}">−</button>
        <label class="diminput"><input type="number" inputmode="numeric" data-dim="${k}"
          value="${S.room[k]}" min="${mn}" max="${mx}" step="1" aria-label="${l} in inches"><i>in</i></label>
        <button data-k="${k}" data-s="${st}" data-mn="${mn}" data-mx="${mx}" aria-label="More ${l}">+</button>
      </div>
      <span class="dimrange">${mn}&ndash;${mx}"</span></div>`).join('');
  $('#mount').className='pills icons icons-2';
  $('#mount').innerHTML=MOUNTS.map(m=>
    iconBtn('data-m', m.k, m.k===S.mounting, m.art, m.label, m.note)).join('');
  $('#walls').hidden = false;
  /* "Shape of the run" used to be its own question underneath, which asked
     the customer the same thing twice: a walk-in already implies more than
     one wall. The walls are now part of choosing the closet, and Custom is
     the last card in that same row. */
  $('#walls').innerHTML = '';
}

/* ══════════════════════════════════════════════════════════════════════
   THE FLOOR PLAN

   A plan view of the room with the measurements ON the drawing, which is how
   anybody who has ever measured a closet thinks about it: width across the
   back, depth down the sides, height up. Typing into the plan is the same
   state as the steppers above it, so the two can never disagree.

   Fittings are dropped onto a wall and dragged along it. Their position is
   stored in inches from that wall's left end, so it survives a resize.
   ══════════════════════════════════════════════════════════════════════ */
const PLAN_W = 400, PLAN_H = 300, PLAN_PAD = 46;

function planGeom(){
  const { w:W, d:D } = S.room;
  const sx = (PLAN_W - PLAN_PAD * 2) / Math.max(W, 1);
  const sy = (PLAN_H - PLAN_PAD * 2) / Math.max(D, 1);
  const k  = Math.min(sx, sy);
  const w  = W * k, d = D * k;
  return { k, w, d, x0:(PLAN_W - w) / 2, y0:(PLAN_H - d) / 2 };
}

/* where a fitting sits, in plan coordinates */
function fitXY(f, g){
  const { w:W, d:D } = S.room;
  const t = Math.max(0, Math.min(1, f.at / Math.max(1, f.wall === 'back' ? W : D)));
  if(f.wall === 'back')  return { x:g.x0 + t * g.w, y:g.y0,            a:0   };
  if(f.wall === 'left')  return { x:g.x0,           y:g.y0 + t * g.d,  a:90  };
  return                        { x:g.x0 + g.w,     y:g.y0 + t * g.d,  a:-90 };
}

function paintPlan(){
  const host = $('#plan'); if(!host) return;
  const g = planGeom();
  const onWalls = Object.keys(S.runs).filter(w => S.runs[w]?.on);
  /* the depth the run is actually built to, after the door hardware and any
     bulkhead have taken theirs, so the plan agrees with the drawing and the
     quote rather than with what was asked for */
  const depth = k => Math.min(S.runs[k]?.depth ?? SPEC.hangDepth, wallDepthCap(k)) * g.k;

  /* the cabinetry footprint, so the plan shows what the 3D shows */
  const runRects = onWalls.map(w =>
      w === 'back'  ? `<rect class="prun" x="${g.x0}" y="${g.y0}" width="${g.w}" height="${depth(w)}"/>`
    : w === 'left'  ? `<rect class="prun" x="${g.x0}" y="${g.y0}" width="${depth(w)}" height="${g.d}"/>`
    :                 `<rect class="prun" x="${g.x0 + g.w - depth(w)}" y="${g.y0}" width="${depth(w)}" height="${g.d}"/>`
  ).join('');

  /* A fitting is not a point. A 36" window and a 4" outlet do very different
     things to a wall, so each pin draws its real width to scale along the wall
     it sits on, with the icon centred on it. Dragging still grabs the whole
     group, so the gesture is unchanged. */
  const pins = S.fittings.map((f, i) => {
    const p = fitXY(f, g), def = FITTINGS.find(x => x.id === f.k);
    const spanPx = Math.max(10, (+f.w || 4) * g.k);
    return `<g class="ppin ${S.pinSel === i ? 'on' : ''} ${f.placed ? '' : 'draft'}" data-pin="${i}"
               transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.a})">
      <rect class="pspan" x="0" y="-4" width="${spanPx.toFixed(1)}" height="8" rx="3"/>
      <g transform="translate(${(spanPx/2).toFixed(1)},0)">
        <rect x="-9" y="-9" width="18" height="18" rx="5"/>
        <svg x="-6" y="-6" width="12" height="12" viewBox="0 0 24 24"><path d="${def?.art||''}"/></svg>
      </g>
    </g>`;
  }).join('');

  host.innerHTML = `
    <svg class="plansvg" viewBox="0 0 ${PLAN_W} ${PLAN_H}" role="img"
         aria-label="Floor plan of the closet">
      <defs><pattern id="pgrid" width="12" height="12" patternUnits="userSpaceOnUse">
        <path d="M12 0H0V12" fill="none" stroke="rgba(26,18,10,.06)" stroke-width="1"/></pattern></defs>
      <rect width="${PLAN_W}" height="${PLAN_H}" fill="url(#pgrid)"/>
      <rect class="proom" x="${g.x0}" y="${g.y0}" width="${g.w}" height="${g.d}"/>
      ${runRects}
      <line class="pdim" x1="${g.x0}" y1="${g.y0-18}" x2="${g.x0+g.w}" y2="${g.y0-18}"/>
      <line class="ptick" x1="${g.x0}" y1="${g.y0-23}" x2="${g.x0}" y2="${g.y0-13}"/>
      <line class="ptick" x1="${g.x0+g.w}" y1="${g.y0-23}" x2="${g.x0+g.w}" y2="${g.y0-13}"/>
      <line class="pdim" x1="${g.x0-18}" y1="${g.y0}" x2="${g.x0-18}" y2="${g.y0+g.d}"/>
      <line class="ptick" x1="${g.x0-23}" y1="${g.y0}" x2="${g.x0-13}" y2="${g.y0}"/>
      <line class="ptick" x1="${g.x0-23}" y1="${g.y0+g.d}" x2="${g.x0-13}" y2="${g.y0+g.d}"/>
      ${pins}
    </svg>
    <div class="pfields">
      <label class="pfield"><span>Width</span>
        <input type="number" data-dim="w" value="${S.room.w}" min="36" max="288" aria-label="Wall width in inches"><i>in</i></label>
      <label class="pfield"><span>Depth</span>
        <input type="number" data-dim="d" value="${S.room.d}" min="12" max="360" aria-label="Room depth in inches"><i>in</i></label>
      <label class="pfield"><span>Ceiling</span>
        <input type="number" data-dim="h" value="${S.room.h}" min="84" max="132" aria-label="Ceiling height in inches"><i>in</i></label>
    </div>
    <div class="basebox">
      <b>The baseboard</b>
      <p class="note">A closet cannot sit flush to a wall that has a baseboard on it. What we do here changes the drawing, the width you have to play with and the price.</p>
      <div class="pfields">
        <label class="pfield"><span>How tall</span>
          <input type="number" data-base="h" value="${S.base.h}" min="0" max="12" step="0.25" aria-label="Baseboard height in inches"><i>in</i></label>
        <label class="pfield"><span>How thick</span>
          <input type="number" data-base="t" value="${S.base.t}" min="0" max="3" step="0.125" aria-label="Baseboard thickness in inches"><i>in</i></label>
      </div>
      <em class="baseq">The width and depth above — where did you measure from?</em>
      <div class="segrow">
        <button type="button" data-bmeas="wall" class="${S.base.measured==='wall'?'on':''}">Wall to wall</button>
        <button type="button" data-bmeas="baseboard" class="${S.base.measured==='baseboard'?'on':''}">Baseboard to baseboard</button>
      </div>
      ${Object.values(S.runs).filter(r=>r?.on).length > 1 ? `
      <em class="baseq">Where two walls meet, what happens in the corner?</em>
      <div class="segrow col">
        <button type="button" data-corner="into" class="${S.corner==='into'?'on':''}">
          <b>Run the back wall into the corner</b><span>Nothing is wasted, but the last foot of that section is deep and awkward to reach. Shelves there, not drawers.</span></button>
        <button type="button" data-corner="stop" class="${S.corner==='stop'?'on':''}">
          <b>Stop both runs at the corner</b><span>The side panel meets the back panel and the corner is left bare. You lose the square, and every inch you keep is easy to reach.</span></button>
      </div>` : ''}
      <em class="baseq">Do the sections need a back?</em>
      <div class="segrow col">
        <button type="button" data-backs="0" class="${S.backs?'':'on'}">
          <b>No back &mdash; the wall is the back</b><span>How a built-in closet normally goes in. Nothing to pay for.</span></button>
        <button type="button" data-backs="1" class="${S.backs?'on':''}">
          <b>Build a back on every section</b><span>For a block wall, a garage, or plaster you would rather not look at. Adds board and hardware to every section.</span></button>
      </div>
      <em class="baseq">And where the cabinetry meets it?</em>
      <div class="segrow col">
        <button type="button" data-bhand="scribe" class="${S.base.handling==='scribe'?'on':''}">
          <b>Notch the panels round it</b><span>Cut on site. The run sits back to bare wall.</span></button>
        <button type="button" data-bhand="remove" class="${S.base.handling==='remove'?'on':''}">
          <b>Take the base off behind the run</b><span>It is not put back. The run sits back to bare wall.</span></button>
        <button type="button" data-bhand="front" class="${S.base.handling==='front'?'on':''}">
          <b>Stand in front of it</b><span>Nothing is cut. The run stands ${(+S.base.t||0)}" off the wall.</span></button>
      </div>
    </div>`;
}

function paintDoors(){
  const d = $('#doors'); if(!d) return;
  d.innerHTML = DOORS.map(x =>
    iconBtn('data-door', x.id, x.id === S.door, x.art, x.label, x.note)).join('');
  const f = $('#fittings'); if(!f) return;
  f.innerHTML = FITTINGS.map(x =>
    `<button class="fitbtn" data-fit="${x.id}"
       title="${(FIT_SPEC[x.id]?.note || '').replace(/"/g,'&quot;')}">
       <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${x.art}"/></svg>
       <i>${x.label}</i></button>`).join('');
  const list = $('#fitlist'); if(!list) return;

  /* Each dimension that changes the build gets its own stepper, labelled with
     what it is rather than with a letter. Change the sill from 34" to 48" and
     the partitions under the window grow with it. */
  /* "How far along the wall" was never enough. An electrician's socket at 16"
     and a switch at 48" are different problems for the same cabinetry, and the
     crew turning up to install needs the height as a number, not as a sentence
     someone typed in a box. */
  const DIMS = {
    w:     { lbl:'wide',  step:2, min:2,  max:120 },
    hi:    { lbl:'off the floor', step:2, min:0,  max:120 },
    cap:   { lbl:'high',  step:2, min:18, max:84  },
    top:   { lbl:'tall',  step:1, min:4,  max:24  },
    depth: { lbl:'deep',  step:1, min:1,  max:16  }
  };
  const dimRow = (x, i) => Object.keys(DIMS)
    .filter(k => x[k] != null)
    .map(k => `<span class="fdim"><button data-fdim="${k}" data-i="${i}" data-s="-1" title="Less">&minus;</button>
        <i>${(+x[k]).toFixed(0)}" ${DIMS[k].lbl}</i>
        <button data-fdim="${k}" data-i="${i}" data-s="1" title="More">+</button></span>`).join('');

  list.innerHTML = S.fittings.length
    ? S.fittings.map((x,i) => {
        const def = FITTINGS.find(y => y.id === x.k);
        const sp  = FIT_SPEC[x.k] || {};
        const len = x.wall ? (x.wall === 'back' ? S.room.w : S.room.d) : 0;
        return `<div class="fitrow ${x.placed?'':'unplaced'} ${S.pinSel===i?'sel':''}" data-pinrow="${i}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${def?.art||''}"/></svg>
          <b>${def?.label || x.k}</b>
          <span>${x.placed ? `${WALL_LABEL[x.wall]} &middot; ${Math.round(x.at)}" from the left`
                + (x.hi != null ? ` &middot; ${Math.round(x.hi)}" off the floor` : '') : 'Pick its wall'}</span>
          <button data-fitrm="${i}" title="Remove">&times;</button>

          <div class="fwall">
            <em>Which wall is it on?</em>
            ${['back','left','right'].map(w => `<button class="${x.placed && x.wall===w ? 'on':''}"
                data-fwall="${w}" data-i="${i}" ${S.runs[w]?.on ? '' : 'disabled title="No cabinetry on that wall"'}>
                ${WALL_LABEL[w].replace(' wall','')}</button>`).join('')}
          </div>

          ${x.placed ? `<div class="fat">
            <em>How far along that wall, from the left corner?</em>
            <span class="fdim"><button data-fat="-1" data-i="${i}" title="Left">&minus;</button>
              <i>${Math.round(x.at)}" of ${Math.round(len)}"</i>
              <button data-fat="1" data-i="${i}" title="Right">+</button></span>
            <span class="fdims">${dimRow(x, i)}</span>
          </div>` : ''}

          ${x.k === 'vent' ? `<div class="fwall vspot">
            <em>Where is the vent?</em>
            <button class="${x.spot==='floor'?'on':''}" data-fspot="floor" data-i="${i}">In the floor</button>
            <button class="${x.spot!=='floor'?'on':''}" data-fspot="wall"  data-i="${i}">On the wall</button>
          </div>` : ''}

          <label class="fnote">
            <em>Anything you want to tell us about it, in your own words</em>
            <textarea data-fnote="${i}" rows="2"
              placeholder="${(sp.ask || 'Where exactly is it, and does it need to stay reachable?').replace(/"/g,'&quot;')}">${(x.note||'').replace(/</g,'&lt;')}</textarea>
          </label>

          <em class="fwhat">${(x.spot === 'floor' ? (sp.noteFloor || sp.note) : sp.note) || ''}</em>
        </div>`;
      }).join('')
    : `<p class="note">Nothing marked yet. Add whatever is on your walls, say where it is in your own words, and it goes on the drawing, into the price and onto the job sheet. A window caps the partitions under it at the sill, baseboard heat takes the run off the floor, a column takes its width off the wall.</p>`;
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
  const host=$('#bays');
  /* #stack gets docked INSIDE a run block (see dockStack), so park it back in
     its own wrapper before this innerHTML wipe or the picker — and the one
     click handler bound to it — is destroyed on every repaint. */
  const parked=$('#stack'); if(parked) $('#stackHome').appendChild(parked);
  host.innerHTML='';
  const walls = ['back','left','right'].filter(w => S.runs[w]?.on);

  for(const wall of walls){
    const r=S.runs[wall];
    const len  = wallLength(wall);
    const used = r.bays.reduce((a,b)=>a+b.w,0);
    const left = len - used;
    /* One wall is open at a time: the one being worked on. The others fold to
       a single line so you can jump between them without scrolling past
       everything on the first. A wall with nothing on it stays open, because
       there is nothing to fold. */
    const open = (S.sel?.wall === wall) || walls.length === 1 || !r.bays.length;
    const d=document.createElement('div');
    d.className='runblk' + (open ? '' : ' folded');
    d.dataset.wall=wall;

    /* which preset widths still fit in what is left of this wall */
    const fits = BAY_PRESETS.filter(w => w <= left + 0.01);
    const pct  = len ? Math.min(100, (used/len)*100) : 0;

    /* ---- the wall, drawn to scale ---------------------------------------
       Every section sits at its real distance from the left corner and can be
       dragged anywhere along the wall, corner to corner, with the inches
       shown while you move it. The bare wall between sections is drawn as a
       gap you can click to drop a section straight into. */
    const pc = v => ((v / Math.max(1, len)) * 100).toFixed(3) + '%';
    const strip = r.bays.length
      ? `<div class="baytrack" data-track="${wall}">
          ${gapsOn(wall).filter(g => g.w > 1.5).map(g => {
            const fits = g.w >= SPEC.bayMin - 0.01;
            return `<button class="gapslot ${fits ? 'can' : ''}"
              style="left:${pc(g.at)};width:${pc(g.w)}"
              data-bay="${fits ? 'addgap' : 'nofit'}" data-wall="${wall}"
              data-at="${g.at.toFixed(1)}" data-gw="${g.w.toFixed(1)}"
              title="${fits
                ? `${g.w.toFixed(0)}&quot; of bare wall at ${g.at.toFixed(0)}&quot; from the corner. Click to put a section here.`
                : `${g.w.toFixed(0)}&quot; of wall, under the ${SPEC.bayMin}&quot; minimum for a section.`}">
              <span class="gapn">${g.w.toFixed(0)}"</span>
              ${fits ? '<span class="gapadd">+</span>' : ''}</button>`;
          }).join('')}
          ${layout(wall).map(sb => `<button class="bay ${S.sel?.wall===wall&&S.sel?.i===sb.i?'on':''}"
            style="left:${pc(sb.at)};width:${pc(sb.w)}"
            data-wall="${wall}" data-i="${sb.i}" data-drag="1"
            title="${sb.bay.stack.length ? sb.bay.stack.length+' item'+(sb.bay.stack.length===1?'':'s') : 'empty'} &middot; ${sb.at.toFixed(0)}&quot; from the corner. Drag it anywhere along the wall.">
            <span class="bstack">${miniStack(sb.bay)}</span>
            <span class="bw">${sb.w.toFixed(0)}"</span>
            <span class="bat">${(sb.at+baseGap()).toFixed(0)}"</span></button>`).join('')}
        </div>
        <div class="bruler"><span>${(+baseGap().toFixed(2))}"</span>
          ${baseGap() ? `<em>measured from the wall corner, the run starts ${baseGap()}" out at the baseboard</em>` : ''}
          <span>${(+(len+baseGap()).toFixed(2))}"</span></div>`
      : `<p class="note emptyrun">Nothing on this wall yet. Pick a width below and it lands in the left corner, where you can drag it anywhere along the wall.</p>`;

    /* The width buttons used to be five bare numbers with a little bar, which
       says nothing about why you would pick one. Each now says what that width
       is actually for, and the "rest of the wall" option is spelled out. */
    const WHY = {
      24:'The narrowest we build. A drawer bank, shoes, or a tight return.',
      28:'A single hanging section without wasting wall.',
      30:'The usual drawer and hanging width. Fits a 30" drawer box.',
      32:'Roomy hanging, or four drawers across.',
      36:'The widest a ¾" shelf spans without bowing.'
    };
    const addBlock = !r.bays.length || left >= SPEC.bayMin
      ? `<div class="addrow">
          <div class="addhd">
            <b>${r.bays.length ? 'Add another section' : 'Add your first section'}</b>
            <span>${left.toFixed(0)}" of wall still free &middot; sections run ${SPEC.bayMin}&ndash;${SPEC.bayMax}" wide</span>
          </div>
          <div class="addgrid">
            ${fits.map(w=>`<button class="wcard" data-bay="addw" data-wall="${wall}" data-w="${w}">
              <b>${w}"</b>
              <span class="wbar"><span style="width:${(w/SPEC.bayMax)*100}%"></span></span>
              <em>${WHY[w]||''}</em></button>`).join('')}
            ${left >= SPEC.bayMin ? `<button class="wcard fill" data-bay="addfill" data-wall="${wall}">
              <b>${clampBay(left).toFixed(0)}"</b>
              <span class="wbar"><span style="width:100%"></span></span>
              <em>Fill what is left of the wall in one section.</em></button>` : ''}
          </div>
          ${r.bays.length > 1 ? `<div class="addutil one">
            <button class="mini" data-bay="even" data-wall="${wall}">Make them all the same width</button>
          </div>` : ''}
        </div>`
      : `<div class="addrow"><div class="addhd full">
          <b>This wall is full</b>
          <span>All ${len.toFixed(0)}" used. Narrow a section to make room for another, or work on a different wall.</span>
        </div>${r.bays.length > 1 ? `<div class="addutil one">
          <button class="mini" data-bay="even" data-wall="${wall}">Make them all the same width</button>
        </div>` : ''}</div>`;

    d.innerHTML = `<button class="runhd" data-fold="${wall}" aria-expanded="${open}"
        title="${open ? 'Fold this wall away' : 'Open this wall'}">
        <span class="runname"><svg class="runchev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg>
          <b>${wall[0].toUpperCase()+wall.slice(1)} wall</b></span>
        <span class="runmeta ${left < -0.5 ? 'over' : ''}">
          <span class="runbar"><span style="width:${pct.toFixed(1)}%"></span></span>
          <i>${r.bays.length} section${r.bays.length===1?'':'s'} &middot; ${used.toFixed(0)}" of ${len.toFixed(0)}"${left>0.5?` &middot; ${left.toFixed(0)}" free`:''}</i>
        </span></button>
      <div class="runbody">
        ${strip}
        ${r.bays.length > 0 ? `<div class="trackacts">
          <span class="tahint">Drag any section along the wall. The gaps are real bare wall.</span>
          <button class="btn-mini" data-bay="tidy" data-wall="${wall}"
            title="Push every section back into the left corner, shoulder to shoulder">Into the corner</button>
          ${r.bays.length > 1 ? `<button class="btn-mini" data-bay="even" data-wall="${wall}"
            title="Equal sections with equal air between them, across the whole wall">Space them evenly</button>` : ''}
        </div>` : ''}
        <div class="stackslot"></div>
        ${addBlock}
      </div>`;
    host.appendChild(d);
  }
  $('#bayNote').textContent = `Past ${SPEC.bayMax}" a ¾" shelf sags under a normal load, so a partition goes in instead. That is why those are the only widths offered.`;
}

/* ───────── step 2b: what goes in the selected section ─────────
   This used to be its own tab, and it used to show two pickers: a row of
   "layouts" and a grid of "pieces". They were the same control. A layout is
   just a section pre-filled with pieces, so both now live in one grid, with
   the ready-made ones first and badged.

   It also used to dead-end: no section selected meant an empty panel telling
   you to go and pick one. If sections exist, one of them is selected. */
/* The parts picker belongs directly under the section being edited, on the
   wall being edited. Working on the back wall, section 3: the cards for
   section 3 render immediately beneath the back wall's section strip, so the
   image you click and the box it lands in are never more than a glance apart.
   The node itself is reused rather than rebuilt, so the single click handler
   bound to #stack survives the move. */
function dockStack(){
  const box = $('#stack'); if(!box) return;
  const slot = S.sel ? $(`#bays .runblk[data-wall="${S.sel.wall}"] .stackslot`) : null;
  (slot || $('#stackHome')).appendChild(box);
}

const ART_GONE = new Set();
window.__artGone = n => ART_GONE.add(n);

/* Nobody thinks "index 0". They think "the bottom one". The stack is stored
   bottom-up, so index 0 is the floor end. */
function slotName(i, n){
  if(n <= 1) return 'this part';
  if(i === 0) return 'the bottom part';
  if(i === n - 1) return 'the top part';
  if(n === 3) return 'the middle part';
  return `part ${i + 1} from the bottom`;
}

/* Which section the one-slot picker was opened for. Selecting a different
   section anywhere — the strip, the 3D, the arrows — must close it, and
   there are five places that move the selection, so the check lives here
   rather than being repeated in all of them. */
let SWAP_FOR = null;

function paintStack(){
  const box = $('#stack');
  if(S.swap != null && SWAP_FOR !== (S.sel ? S.sel.wall + '|' + S.sel.i : null)){
    S.swap = null; SWAP_FOR = null;
  }
  const run = S.sel && S.runs[S.sel.wall];
  if(!run?.bays[S.sel?.i]){
    /* If the chosen wall exists but has nothing on it yet, STAY on it. This
       used to jump the selection to whichever wall did have sections, which
       meant opening an empty wall immediately bounced you back to the full
       one and the empty wall could never be worked on. */
    if(run?.on){
      /* The wall's own strip already says "Nothing on this wall yet. Pick a
         width below" right above this, so printing it again here was the same
         sentence twice in the same box. The picker just stays empty. */
      box.innerHTML = '';
      dockStack();
      return;
    }
    const wall = Object.keys(S.runs).find(k => S.runs[k]?.on && S.runs[k].bays.length);
    if(wall){ S.sel = { wall, i:0 }; return paintStack(); }
    box.innerHTML = `<p class="note emptysel">Add a section above and its parts appear here.</p>`;
    dockStack();
    return;
  }
  const bay = S.runs[S.sel.wall].bays[S.sel.i];
  /* same arithmetic buildDesign uses, so the palette agrees with the drawing */
  const floorY = baseHeight(S.mounting, placedFittings());
  /* the height THIS section actually has, not the room's best case: a window
     or a slope over it means fewer inches to divide between the parts */
  const usable = (cur?.bays?.find(x => x.wall === S.sel.wall && x.bay === S.sel.i)?.h)
    ?? (Math.min(SPEC.topShelf, S.room.h - 6) - floorY);

  const cheapest = PRESETS.reduce((lo, p) => {
    const v = presetDelta(p, bay.w, usable, cat, S.finish);
    return (v != null && (lo == null || v < lo)) ? v : lo; }, null);

  /* A preset made of two modules was showing one module's photo, so
     "Hanging + Shelves" was a picture of shelves with no rod in it. The card
     now draws the actual stack, top module above bottom module, in the same
     order it will be built. */
  const partImg = id => (window.BASE||'') + 'img/parts/' + id.toLowerCase().replace(/_/g,'-') + '.jpg';
  /* Which ready-made layout is this section already set to? Compare the
     module order, so switching between layouts shows you what you are on
     rather than making you guess. */
  const sig = st => st.map(x => x.m).join('>');
  const nowSig = sig(bay.stack);
  const matched = PRESETS.find(p => sig(p.stack) === nowSig
                                 && p.top !== false);
  const presetCards = PRESETS.map(pre => {
    const price = presetDelta(pre, bay.w, usable, cat, S.finish);
    const delta = (price != null && cheapest != null) ? Math.round(price - cheapest) : null;
    const tag   = delta == null ? '' : delta <= 0 ? 'Incl.' : '+' + money(delta);
    const ids   = [...new Set(pre.stack.map(x => x.m))].reverse();   // top of stack first
    /* A layout made of two parts used to show its two part photos stacked one
       on top of the other, which reads as two things rather than one section.
       `pre.art` names a single picture of the whole layout. If that file is
       not on the server yet the img's own onerror swaps the stacked pair back
       in, so the cards keep working either way and the new pictures light up
       the moment they are dropped into img/parts/. */
    /* The fallback is only a STACK when the layout really is two parts. A
       one-module layout such as the open-top double hang falls back to its
       single picture; putting it in a two-row stack left the bottom half of
       the card empty. */
    const single = id => `<img src="${partImg(id)}" alt="" loading="lazy" decoding="async"
             width="420" height="560">`;
    const stacked = ids.length > 1
      ? `<span class="pstack">${ids.map(id =>
          `<img src="${partImg(id)}" alt="" loading="lazy" decoding="async">`).join('')}</span>`
      : single(ids[0] || 'OPEN');
    /* ART_GONE remembers which combined pictures are not on the server yet, so
       the browser asks for each missing file once rather than on every repaint
       of the panel. The moment the file is dropped into img/parts/ and the
       page is reloaded, the card uses it. */
    const art = (pre.art && !ART_GONE.has(pre.art))
      ? `<img src="${(window.BASE||'')}img/parts/${pre.art}.jpg" alt="" loading="lazy" decoding="async"
             width="420" height="560"
             onerror="window.__artGone&&window.__artGone('${pre.art}');this.outerHTML=${JSON.stringify(stacked).replace(/"/g,'&quot;')}">`
      : ids.length > 1 ? stacked
      : `<img src="${(window.BASE||'')}img/parts/${pre.img}.jpg" alt="" loading="lazy" decoding="async"
             width="420" height="315">`;
    const on = matched?.id === pre.id;
    const fit = presetFits(pre, usable);
    return `<button class="pcard ready" data-preset="${pre.id}" aria-pressed="${on}"
                    ${fit.ok ? '' : 'disabled'}
                    title="${(fit.ok ? pre.desc : `${pre.name} needs ${fit.need}" and this section only has ${usable.toFixed(0)}". Make the section taller or pick something shorter.`).replace(/"/g,'&quot;')}">
      ${art}<i>${pre.name}</i>
      <span class="phov"><em>${fit.ok ? pre.desc : `Needs ${fit.need}", this section has ${usable.toFixed(0)}".`}</em></span>
      <span class="pbadge">${on ? 'Current' : 'Ready-made'}</span>${
        fit.ok ? (tag ? `<u>${tag}</u>` : '') : '<u class="full">Too tall</u>'}</button>`;
  }).join('');

  const partCards = MODULE_IDS.map(id => {
    const d = MODULES[id], img = id.toLowerCase().replace(/_/g,'-');
    const chk = canAdd(bay.stack, id, usable);
    const tip = (chk.ok ? d.hint : chk.why).replace(/"/g,'&quot;');
    return `<button class="pcard" data-add="${id}" ${chk.ok?'':'disabled'} title="${tip}">
      <img src="${(window.BASE||'')}img/parts/${img}.jpg" alt="" loading="lazy" decoding="async"
           width="420" height="315">
      <i>${d.label}</i>
      <span class="phov"><em>${(d.hint||'').replace(/"/g,'&quot;')}</em>
        <b>${(d.spec||'').replace(/"/g,'&quot;')}</b></span>
      ${chk.ok ? '' : '<u class="full">No room</u>'}</button>`;
  }).join('');

  /* ── Changing one part of a section ────────────────────────────────────
     A double hang is a rod over a rod. Wanting a drawer bank under the top
     rod meant finding "Drawers" in a flat list of twenty-odd things, adding
     it, then deleting the one you meant to replace and hoping the order came
     out right. Pressing Change on a row asks the question the other way
     round: here is that one slot, here is everything that fits in it. */
  const swapOpen = S.swap != null && bay.stack[S.swap] != null;
  let swapCards = '';
  if(swapOpen){
    const without = bay.stack.filter((_, k) => k !== S.swap);
    const cur_ = bay.stack[S.swap];
    swapCards = MODULE_IDS.map(id => {
      const d = MODULES[id], img = id.toLowerCase().replace(/_/g,'-');
      const chk = id === cur_.m ? { ok:true } : canAdd(without, id, usable);
      const on  = id === cur_.m;
      const tip = (chk.ok ? d.hint : chk.why).replace(/"/g,'&quot;');
      return `<button class="pcard" data-swapto="${id}" aria-pressed="${on}"
                      ${chk.ok?'':'disabled'} title="${tip}">
        <img src="${(window.BASE||'')}img/parts/${img}.jpg" alt="" loading="lazy" decoding="async"
             width="420" height="315">
        <i>${d.label}</i>
        <span class="phov"><em>${(d.hint||'').replace(/"/g,'&quot;')}</em>
          <b>${(d.spec||'').replace(/"/g,'&quot;')}</b></span>
        ${on ? '<span class="pbadge">Current</span>' : ''}
        ${chk.ok ? '' : '<u class="full">Will not fit here</u>'}</button>`;
    }).join('');
  }

  box.innerHTML = `
    <div class="selhd"><b>${S.sel.wall[0].toUpperCase()+S.sel.wall.slice(1)} wall · section ${S.sel.i+1} of ${S.runs[S.sel.wall].bays.length}</b>
      <span class="selacts">
        <span class="wadj"><button data-bw="-2" title="Narrower">−</button><i>${bay.w.toFixed(0)}" wide</i><button data-bw="2" title="Wider">+</button></span>
        <span class="movw">
          <button data-move="-1" ${S.sel.i===0?'disabled':''} title="Move left along the wall">&#9664;</button>
          <button data-move="1" ${S.sel.i>=S.runs[S.sel.wall].bays.length-1?'disabled':''} title="Move right along the wall">&#9654;</button>
        </span>
        <button class="rmsec" data-rmsec="1" title="Remove this section">Remove section</button>
      </span></div>

    ${bay.stack.length ? `<div class="stacklist">${bay.stack.slice().reverse().map((st,ri)=>{
      const i=bay.stack.length-1-ri, d=MODULES[st.m];
      /* The name and the controls are on separate lines. Seven controls and a
         part name never fitted across a 460px panel: the name was squeezed to
         "D..." and the buttons ran into each other. */
      return `<div class="srow ${st.h==null?'flex':''}">
        <span class="sico"><svg viewBox="0 0 24 32"><path d="${d.icon}"/></svg></span>
        <span class="sname"><b>${d.label}</b><i>${st.h==null?'fills the space':(st.h+'" tall')}</i></span>
        <span class="srhs">
          ${d.opt?`<span class="sopt"><button data-opt="-1" data-i="${i}" title="Fewer">−</button><i>${(st.o?.[d.opt.key] ?? d.opt.def)}</i><button data-opt="1" data-i="${i}" title="More">+</button></span>`:''}
          <button class="sswap ${S.swap===i?'on':''}" data-swap="${i}"
            title="Show only what can go in this part of the section">Change</button>
          <span class="sacts">
            <button data-mv="1"  data-i="${i}" title="Move up"    ${i===bay.stack.length-1?'disabled':''}>↑</button>
            <button data-mv="-1" data-i="${i}" title="Move down"  ${i===0?'disabled':''}>↓</button>
            <button data-hh="-4" data-i="${i}" title="Shorter">▾</button>
            <button data-hh="4"  data-i="${i}" title="Taller">▴</button>
            <button data-rm="${i}" title="Remove this part">×</button>
          </span>
        </span></div>`;
    }).join('')}</div>` : `<p class="note emptybay">This section is empty. Pick anything below to put in it.</p>`}

    ${swapOpen ? `
    <h4 class="subh">Change ${slotName(S.swap, bay.stack.length)}</h4>
    <p class="note" style="margin:-2px 0 10px">
      It is <b>${MODULES[bay.stack[S.swap].m].label}</b> at the moment. Everything below fits
      ${slotName(S.swap, bay.stack.length)} of this section with the rest of it left alone.
      <button class="swapback" data-swapback="1" type="button">Show everything instead</button></p>
    <div class="pgrid">${swapCards}</div>`
    : `
    <h4 class="subh">${bay.stack.length ? 'Change this section to' : 'What goes in this section'}</h4>
    <p class="note" style="margin:-2px 0 10px">${bay.stack.length
      ? `Currently ${matched ? `<b>${matched.name}</b>` : 'a custom stack'}. Pick another layout to swap the lot, or press <b>Change</b> on any part above to swap just that one.`
      : 'Ready-made layouts first, then single parts. Everything can be changed after.'}</p>
    <div class="pgrid">${presetCards}${partCards}</div>`}`;
  dockStack();
}

/* ───────── finishes + hardware ───────── */
const swStyle=f=> f.col ? `background:${f.col}`
  : f.x<0 ? 'background:linear-gradient(135deg,#E3D9CC,#EFE8DF)'
  : `background-image:url(${(window.BASE||'')}img/finishes/sprite.jpg);background-size:${cat.meta.cols*100}% ${cat.meta.rows*100}%;background-position:${(f.x/(cat.meta.cols-1))*100}% ${(f.y/(cat.meta.rows-1))*100}%`;
/* The levels are the manufacturer's own price bands, not something invented
   for the website. Level is what the decorative surface costs: the board,
   the edgebanding and the lead time are otherwise identical. Saying so in the
   panel stops "Level 4" reading as a made-up tier. */
const FAMS=[
  {lv:1,n:'Standard white', why:'The house white. Cheapest board, one week.'},
  {lv:2,n:'Everyday',       why:'Woodgrains and solid colours. Two to three weeks.'},
  {lv:3,n:'Textured',       why:'Grain you can feel, synchronised to the print.'},
  {lv:4,n:'Specialty',      why:'Imported decors. Three to four weeks.'},
  {lv:5,n:'High gloss',     why:'Mirror finish and heavy texture. Longest lead.'}];
/* Which of the two is open. Carcass by default, but if the design has fronts
   in it and the customer has not chosen a front finish yet, that is the one
   worth putting in front of them. */
let FINTAB = 'carcass';
const HAS_FRONTS = new Set(['DRAWERS','DOOR','GLASS_DOOR','HAMPER']);
const designHasFronts = () =>
  (cur?.bays || []).some(b => (b.stack||[]).some(st => HAS_FRONTS.has(st.m)));

/* The switch between the two, with a live chip of each, so the fronts picker
   is one click away instead of 79 swatches further down the page. */
function paintFinTabs(){
  const host = $('#fintabs'); if(!host) return;
  const fronts = designHasFronts();
  if(!fronts && FINTAB === 'fronts') FINTAB = 'carcass';
  const sw = n => {
    const f = cat.finishes.find(x => x.n === n) || cat.finishes[0];
    return `<span class="ftc" style="${swStyle(f)}"></span>`;
  };
  const frontNow = S.frontFinish || S.finish;
  host.innerHTML = `
    <button class="ftab ${FINTAB==='carcass'?'on':''}" data-fintab="carcass" aria-pressed="${FINTAB==='carcass'}">
      ${sw(S.finish)}<i>Carcass<em>${S.finish}</em></i></button>
    <button class="ftab ${FINTAB==='fronts'?'on':''}" data-fintab="fronts"
      aria-pressed="${FINTAB==='fronts'}" ${fronts?'':'disabled'}
      title="${fronts?'The finish on your drawer and door fronts':'Add a drawer, a door or a hamper and this turns on'}">
      ${sw(frontNow)}<i>Drawer &amp; door fronts<em>${
        !fronts ? 'Nothing with a front yet'
        : (S.frontFinish ? S.frontFinish : 'Same as the carcass')}</em></i></button>`;
  $('#finpane1').hidden = FINTAB !== 'carcass';
  $('#finpane2').hidden = FINTAB !== 'fronts';
  /* a line that says what you are actually changing */
  const note = fronts
    ? (FINTAB === 'fronts'
        ? 'Only the drawer and door fronts change. The shelves and partitions keep the carcass finish.'
        : 'This changes the shelves, partitions and top shelf. Your drawer and door fronts are set on the other tab.')
    : 'Nothing in this design has a front on it yet, so one finish covers the whole closet.';
  host.insertAdjacentHTML('beforeend', `<p class="ftnote">${note}</p>`);
}

function paintFin(which){
  const box=$(which==='carcass'?'#fin1':'#fin2'); if(!box) return;
  const cur=which==='carcass'?S.finish:(S.frontFinish||S.finish);
  const term=($('#fq')?.value||'').trim().toLowerCase();
  box.innerHTML=FAMS.map(fam=>{
    const l=cat.finishes.filter(f=>f.lv===fam.lv&&(!term||f.n.toLowerCase().includes(term)));
    if(!l.length) return '';
    return `<div class="fam"><div class="famhd">
        <b>${fam.n}</b><span>${l.length} · from $${Math.min(...l.map(f=>f.sq)).toFixed(2)}/sq ft</span>
      </div>
      <p class="famwhy">${fam.why}</p>
      <div class="swrow">${l.map(f=>`<button class="sw ${f.x<0?'nophoto':''}"
        data-n="${f.n.replace(/"/g,'&quot;')}" data-w="${which}"
        aria-pressed="${f.n===cur}" title="${f.n.replace(/"/g,'&quot;')}${f.x<0?' (colour only, no sample photo yet)':''}">
        <span class="swc" style="${swStyle(f)}"></span>
        <i>${f.n.replace(/\s*\(1 week lead time\)/,'')}</i></button>`).join('')}</div></div>`;
  }).join('');
  const f=cat.finishes.find(x=>x.n===cur);
  if(f) $(which==='carcass'?'#finNote1':'#finNote2').innerHTML=
    `<b>${f.n}</b> <span class="muted">· Level ${f.lv} · $${f.sq.toFixed(2)}/sq ft · ${f.lead} ${f.lead==='1'?'week':'weeks'}</span>`;
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
/* The review step shows the same number three ways: the base system, the
   extras, the total. Supplier cost never appears here: that is Joseph's
   margin and it does not belong on a public page. */
function paintQuote(){
  const q = cur.quote, el = $('#quotebox');
  if(!el) return;
  if(!q || q.empty){
    el.innerHTML = `<p class="qnone">Nothing in the design yet. Add a section on step 2 and the itemisation builds itself.</p>`;
    return;
  }
  const shape = S.type==='walk-in' ? ` (${SHAPES[S.shape].label})` : '';
  el.innerHTML = `<div class="qcard">
    <div class="qtop">
      <span><span class="ql">Your design</span><b>${TYPES[S.type].label} closet${shape}</b></span>
      <span class="qref">${designRef()}<br>${cur.finish.n}</span>
    </div>
    <div class="qsec">
      <span class="ql">Base system</span>
      <div class="qrow"><i>${q.baseLabel}<small>${q.baseNote}</small></i><b>${money(q.base)}</b></div>
    </div>
    <div class="qsec">
      <span class="ql">Your options</span>
      ${q.options.length
        ? q.options.map(o=>`<div class="qrow"><i>${o.label}${o.note?`<small>${o.note}</small>`:''}</i><b>${money(o.price)}</b></div>`).join('')
        : `<p class="qnone">No extras yet. Shelves, drawers, baskets and doors itemise here as you add them.</p>`}
    </div>
    <div class="qtot">
      <span><span class="ql">Estimated total</span><em>Cabinetry only · installation quoted separately</em></span>
      <b>${money(q.total)}</b>
    </div>
  </div>
  ${(S.door !== 'none' || S.fittings.some(f=>f.placed||f.note)) ? `<div class="qnotes">
    <span class="ql">Built around what is already there</span>
    ${S.door !== 'none' ? `<div class="qnrow"><b>${
      DOORS.find(d=>d.id===S.door)?.label || ''}</b><span>${
      DOOR_SPEC[S.door]?.note || ''}</span></div>` : ''}
    ${S.fittings.filter(f=>f.placed||f.note).map(f=>`<div class="qnrow"><b>${
      FITTINGS.find(x=>x.id===f.k)?.label || f.k}</b><span>${
      f.placed ? `${WALL_LABEL[f.wall]} &middot; ${Math.round(f.at)}" from the left` : 'Wall not given'}${
      f.w!=null?`, ${Math.round(f.w)}" wide`:''}${
      f.cap!=null?`, capped at ${Math.round(f.cap)}"`:''}${
      f.top!=null?`, ${Math.round(f.top)}" tall`:''}${
      f.depth!=null?`, ${Math.round(f.depth)}" deep`:''}${
      f.spot?`, ${f.spot === 'floor' ? 'in the floor' : 'on the wall'}`:''} &middot; ${
      (f.spot === 'floor' ? (FIT_SPEC[f.k]?.noteFloor || FIT_SPEC[f.k]?.note) : FIT_SPEC[f.k]?.note) || ''}${
      /* what the customer typed, in their words, verbatim onto the job sheet */
      f.note && f.note.trim()
        ? `</span><q class="qnsaid">&ldquo;${f.note.trim().replace(/</g,'&lt;').replace(/\n/g,' ')}&rdquo;</q><span>`
        : ''}</span></div>`).join('')}
    <p class="qnnote">These are not notes on a job sheet. The total above is already built around them: the partitions, the top shelf, the depth of the run and the toe kick are all cut to what is actually on your wall.</p>
  </div>` : ''}`;
}
/* A short handle so he and the customer are looking at the same design.
   Deterministic: same choices in, same code out. */
function designRef(){
  const t = { 'reach-in':'R','walk-in':'W','pantry':'P','garage':'G','laundry':'L' }[S.type] || 'C';
  const seed = JSON.stringify([S.type,S.shape,S.room,S.mounting,S.finish,S.frontFinish,
    cur.bays.map(b=>[b.wall,+b.w.toFixed(1),(b.stack||[]).map(x=>[x.m,x.o?.n??0])])]);
  let h = 0x811c9dc5;
  for(let i=0;i<seed.length;i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${t}${cur.bays.length}-${h.toString(36).toUpperCase().slice(0,5).padStart(5,'0')}`;
}
function paintOrder(){
  $('#order').innerHTML=`<table><thead><tr><th>Item</th><th>Qty</th><th>Sq ft</th><th>Finish</th></tr></thead><tbody>`+
    cur.order.map(o=>`<tr><td>${o.item}</td><td class="num">${o.qty}</td><td class="num">${o.sq_ft||'&ndash;'}</td><td class="fin">${o.finish}</td></tr>`).join('')+
    `</tbody></table>`;
  $('#orderCount').textContent=`${cur.order.length} line items`;
}

/* ───────── events ───────── */
$('#types').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.shape==='custom'){ applyShape('custom', true); rebuild(true); return; }
  if(!b.dataset.t) return;
  /* coming back out of Custom, a closet type picks its own walls again */
  S.shape = TYPES[b.dataset.t].walls.length>1 ? 'u' : 'straight';
  applyType(b.dataset.t); rebuild(true)};
$('#wallpick').onclick=e=>{const b=e.target.closest('[data-wall-t]');if(!b)return;
  toggleWall(b.dataset.wallT); rebuild(true)};
/* Clamp when the field is committed, not on every keystroke, or typing "10"
   on the way to "108" snaps to the 36" minimum under your fingers. */
$('#dims')?.addEventListener('change', e=>{
  const i = e.target.closest('input[data-dim]'); if(!i) return;
  const k = i.dataset.dim, mn = +i.min, mx = +i.max;
  const v = Math.round(Number(i.value));
  S.room[k] = Number.isFinite(v) ? Math.min(mx, Math.max(mn, v)) : S.room[k];
  rebuild(true);
});
$('#dims')?.addEventListener('keydown', e=>{
  if(e.key === 'Enter' && e.target.matches('input[data-dim]')){ e.preventDefault(); e.target.blur(); }
});
$('#mount').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.mounting=b.dataset.m;rebuild(false)};
if($('#dims')) $('#dims').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  const k=b.dataset.k,s=+b.dataset.s;
  S.room[k]=Math.max(+b.dataset.mn,Math.min(+b.dataset.mx,S.room[k]+s));
  /* trim anything that no longer fits rather than discarding the whole run */
  for(const w of Object.keys(S.runs)){
    const r=S.runs[w]; if(!r?.on) continue;
    let room = wallLength(w);
    r.bays = r.bays.filter(b => (room -= b.w) >= -0.01);
  }
  rebuild(true)};
/* ---- floor plan: doors, fittings, and dragging a fitting along a wall ---- */
$('#doors').onclick=e=>{const b=e.target.closest('[data-door]');if(!b)return;
  /* The door is a build constraint now, not a note: a bypass track takes 2½"
     off the depth and a bi-fold blocks the ends of the opening, so the whole
     design and the price have to be recomputed. */
  S.door=b.dataset.door; rebuild(); };
$('#fittings').onclick=e=>{const b=e.target.closest('[data-fit]');if(!b)return;
  /* It lands UNPLACED. Dropping it straight onto the back wall at a made-up
     position stated a measurement the customer had never given, and now that
     these change the cabinetry, a guessed position would change the price.
     It arrives with the real dimensions an installer would measure — a 36"
     window, a 48" heater, a 14" floor vent — all editable, and none of them
     touch the build until the pin is on a wall. */
  const sp = FIT_SPEC[b.dataset.fit] || {};
  S.fittings.push({ k:b.dataset.fit, wall:null, at:0, placed:false, note:'',
    ...(b.dataset.fit==='vent' ? { spot:'wall', rule:'keepClear' } : {}),
    w:sp.w, ...(sp.cap!=null?{cap:sp.cap}:{}), ...(sp.top!=null?{top:sp.top}:{}),
    ...(sp.depth!=null?{depth:sp.depth}:{}), ...(sp.hi!=null?{hi:sp.hi}:{}) });
  S.pinSel = S.fittings.length-1; paintPlan(); paintDoors(); };
$('#fitlist').onclick=e=>{
  const rm=e.target.closest('[data-fitrm]');
  if(rm){ S.fittings.splice(+rm.dataset.fitrm,1); S.pinSel=null; rebuild(); return; }

  /* Picking the wall is what places it. Dragging a pin around a 400px plan to
     say "the outlet is on the back wall" was a puzzle, not a control. */
  const wb=e.target.closest('[data-fwall]');
  if(wb && !wb.disabled){
    const f=S.fittings[+wb.dataset.i], w=wb.dataset.fwall;
    const len = w==='back' ? S.room.w : S.room.d;
    if(!f.placed || f.wall!==w) f.at = Math.round(Math.max(0, Math.min(len - (f.w||4), len/2 - (f.w||4)/2)));
    f.wall=w; f.placed=true; S.pinSel=+wb.dataset.i; rebuild(); return;
  }
  const at=e.target.closest('[data-fat]');
  if(at){
    const f=S.fittings[+at.dataset.i];
    const len = f.wall==='back' ? S.room.w : S.room.d;
    f.at = Math.max(0, Math.min(len - (f.w||4), Math.round(f.at + 2*(+at.dataset.fat))));
    rebuild(); return;
  }
  /* A vent in the floor and a vent on the wall are two different problems. */
  const sp=e.target.closest('[data-fspot]');
  if(sp){
    const f=S.fittings[+sp.dataset.i];
    f.spot=sp.dataset.fspot;
    f.rule = f.spot==='floor' ? 'floorClear' : 'keepClear';
    rebuild(); return;
  }
  const dim=e.target.closest('[data-fdim]');
  if(dim){
    const L={ w:[2,2,120], hi:[2,0,120], cap:[2,18,84], top:[1,4,24], depth:[1,1,16] }[dim.dataset.fdim];
    const f=S.fittings[+dim.dataset.i], k=dim.dataset.fdim;
    f[k]=Math.min(L[2], Math.max(L[1], (+f[k]||0) + L[0]*(+dim.dataset.s)));
    rebuild(); return;
  }
  /* Selecting a row highlights it on the plan. It must NOT repaint the list:
     paintDoors() rewrites #fitlist.innerHTML, so a click that landed on the
     note box destroyed the very textarea it had just focused and nothing
     could ever be typed into it. Form controls are left alone, and the
     highlight is a class toggle rather than a re-render. */
  const row=e.target.closest('[data-pinrow]');
  if(row && !e.target.closest('input,textarea,select,label')){
    S.pinSel=+row.dataset.pinrow;
    paintPlan(); markPinRow();
  }
};
/* highlight the selected row without rebuilding it */
function markPinRow(){
  document.querySelectorAll('#fitlist .fitrow').forEach((r,n)=>
    r.classList.toggle('sel', n===S.pinSel));
}
/* What they type is kept on the fitting and travels into the quote. Repainting
   on every keystroke would blow away the box they are typing in, so the note is
   stored on input and the panel is only redrawn when they leave the field. */
$('#fitlist').addEventListener('input', e=>{
  const t=e.target.closest('[data-fnote]'); if(!t) return;
  S.fittings[+t.dataset.fnote].note = t.value;
});
$('#fitlist').addEventListener('change', e=>{
  if(e.target.closest('[data-fnote]')) paintQuote();
});
/* The plan DRAWS what is on the walls. It is a drawing, not a control: the
   wall and the position are picked with real buttons in the list below it,
   where you can also say in your own words what the thing is. A pin you had to
   drag around a 400px plan to place a light switch was a puzzle. */
(function planFields(){
  const host=$('#plan'); if(!host) return;
  /* Clicking a drawn fitting selects its row in the list below, so you can see
     which one you are editing. It does not drag: where it sits is set with the
     wall buttons and the position stepper in that row. */
  host.addEventListener('click', e=>{
    const g=e.target.closest('[data-pin]'); if(!g) return;
    S.pinSel=+g.dataset.pin; paintPlan(); paintDoors();
    const row=document.querySelector(`[data-pinrow="${S.pinSel}"]`);
    row?.scrollIntoView({block:'nearest', behavior:'smooth'});
  });
  /* typing a measurement straight onto the plan is the same state as the
     steppers above it */
  host.addEventListener('change', e=>{
    const i=e.target.closest('input[data-dim]'); if(!i) return;
    const k=i.dataset.dim, v=Math.round(Number(i.value));
    S.room[k]=Number.isFinite(v)?Math.min(+i.max,Math.max(+i.min,v)):S.room[k];
    rebuild(true);
  });
  host.addEventListener('keydown', e=>{
    if(e.key==='Enter' && e.target.matches('input[data-dim]')){ e.preventDefault(); e.target.blur(); }
  });
  /* the baseboard: two numbers and two decisions, all of which move the run */
  host.addEventListener('change', e=>{
    const i=e.target.closest('input[data-base]'); if(!i) return;
    const k=i.dataset.base, v=Number(i.value);
    if(Number.isFinite(v)) S.base[k]=Math.min(+i.max, Math.max(+i.min, v));
    rebuild(true);
  });
  host.addEventListener('click', e=>{
    const m=e.target.closest('[data-bmeas]');
    if(m){ S.base.measured=m.dataset.bmeas; rebuild(true); return; }
    const h=e.target.closest('[data-bhand]');
    if(h){ S.base.handling=h.dataset.bhand; rebuild(true); return; }
    const bk=e.target.closest('[data-backs]');
    if(bk){ S.backs = bk.dataset.backs === '1'; rebuild(true); return; }
    const cn=e.target.closest('[data-corner]');
    if(cn){ S.corner = cn.dataset.corner; rebuild(true); }
  });
})();

$('#walls').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.wallT){ toggleWall(b.dataset.wallT); rebuild(true); return; }
  if(!b.dataset.shape || b.dataset.shape===S.shape) return;
  /* keep the walls already chosen when stepping into Custom */
  applyShape(b.dataset.shape, SHAPES[b.dataset.shape]?.custom); rebuild(true)};
$('#bays').onclick=e=>{
  /* Open a wall by clicking its header. Selecting a section on it is what
     normally opens it, so this is for looking at a wall you are not editing. */
  const fold=e.target.closest('[data-fold]');
  if(fold){
    const w=fold.dataset.fold, r=S.runs[w];
    const blk=fold.closest('.runblk');
    if(blk.classList.contains('folded')){
      /* opening a wall selects something on it, which folds the others */
      S.sel = r?.bays.length ? { wall:w, i:0 } : { wall:w, i:0 };
      rebuild(true);
    } else {
      blk.classList.add('folded'); fold.setAttribute('aria-expanded','false');
    }
    return;
  }
  const bay=e.target.closest('[data-bay]');
  if(bay){
    const wall = bay.dataset.wall, r = S.runs[wall], act = bay.dataset.bay;
    if(act==='nofit') return;
    if(act==='addw' || act==='addfill' || act==='addgap'){
      /* "addgap" is the empty stretch of wall drawn beside the sections that
         are already there. Clicking it means "put one HERE, next to that one",
         which is what the gap looks like it should do. It fills the gap. */
      /* A section goes into a real stretch of bare wall. If the gap that was
         clicked is known, it goes there; otherwise it takes the first stretch
         it fits in, which is normally the corner. */
      const atHint = bay.dataset.at !== undefined ? +bay.dataset.at : null;
      const room   = bay.dataset.gw !== undefined ? +bay.dataset.gw
                   : (atHint !== null ? 0 : Math.max(...gapsOn(wall).map(g=>g.w), 0));
      const want = act==='addw' ? +bay.dataset.w : clampBay(room || freeSpace(wall));
      const w = Math.min(want, atHint !== null ? room : Math.max(...gapsOn(wall).map(g=>g.w), 0));
      if(w >= SPEC.bayMin - 0.01){
        const at = atHint !== null ? atHint : firstFit(wall, w);
        if(at === null) return;
        const nb = makeBay(+w.toFixed(1), []); nb.at = at;
        r.bays.push(nb); sortRun(wall);
        S.sel = { wall, i: r.bays.findIndex(b => b === nb) };
        /* adding an empty section and leaving you on the "divide" tab means the
           next thing you want is one tab away and not obvious. Go there. */
        /* no tab jump: you are already looking at the right panel */
      }
    }
    if(act==='del' && r.bays.length){
      const k = (S.sel?.wall===wall && r.bays[S.sel.i]) ? S.sel.i : r.bays.length-1;
      r.bays.splice(k,1);
      if(S.sel?.wall===wall && S.sel.i >= r.bays.length) S.sel.i = r.bays.length - 1;
      if(!r.bays.length) S.sel = null;
    }
    if(act==='even'){
      /* Spread evenly across the whole wall rather than squashing them into
         the corner: equal sections, equal air between them. */
      const n = r.bays.length;
      if(n){
        const len = wallLength(wall), each = clampBay(len / n);
        r.bays.forEach(b => b.w = each);
        const slack = Math.max(0, len - each * n), step = n > 1 ? slack / (n - 1) : 0;
        r.bays.forEach((b, k) => b.at = +(k * (each + step)).toFixed(1));
        sortRun(wall);
      }
    }
    if(act==='tidy'){
      /* push every section back into the corner, shoulder to shoulder */
      let run = 0;
      for(const b of layout(wall).map(s=>s.bay)){ b.at = run; run += b.w; }
      sortRun(wall);
    }
    rebuild(true); return; }
  const b=e.target.closest('.bay');
  if(b){ S.sel={wall:b.dataset.wall,i:+b.dataset.i}; S.swap=null; rebuild(false); }
};
/* ---- reorder sections along the wall -------------------------------------
   A run is an ordered list, so moving a section is a splice. Dropping onto a
   bay puts the dragged one in front of it; dropping past the end appends. */
let DRAG = null;
/* ---- dragging a section along the wall, on the strip --------------------
   Pointer events rather than HTML5 drag and drop: HTML5 drag can only tell
   you what you dropped ON, which is enough to swap two things over and no
   use at all for saying "put it 37 inches from the corner". This reads the
   pointer against the track, which is drawn to scale, so the strip and the
   wall are the same measurement. */
let TDRAG = null;

$('#bays').addEventListener('pointerdown', e => {
  const b = e.target.closest('.bay[data-drag]'); if(!b) return;
  const track = b.closest('.baytrack'); if(!track) return;
  const wall = track.dataset.track, i = +b.dataset.i;
  const bay = S.runs[wall]?.bays[i]; if(!bay) return;
  TDRAG = { wall, i, el:b, x0:e.clientX, at0:bay.at ?? 0,
            px:track.getBoundingClientRect().width, len:wallLength(wall), moved:false };
  DRAGGING = true;
  b.setPointerCapture?.(e.pointerId);
  b.classList.add('dragging');
});

const dragOnTrack = onFrame(pt => {
  if(!TDRAG) return;
  const inches = ((pt.x - TDRAG.x0) / Math.max(1, TDRAG.px)) * TDRAG.len;
  if(Math.abs(inches) > 0.4) TDRAG.moved = true;
  if(!TDRAG.moved) return;
  const at = moveSection(TDRAG.wall, TDRAG.i, TDRAG.at0 + inches);
  /* move the element itself rather than repainting the panel on every frame:
     a repaint would destroy the node the pointer is captured on */
  TDRAG.el.style.left = ((at / Math.max(1, TDRAG.len)) * 100).toFixed(3) + '%';
  const lbl = TDRAG.el.querySelector('.bat');
  if(lbl) lbl.textContent = (at + baseGap()).toFixed(0) + '"';
  TDRAG.i = S.runs[TDRAG.wall].bays.findIndex(b2 => b2 === S.runs[TDRAG.wall].bays[TDRAG.i]);
  showAtTip(TDRAG.wall, TDRAG.i, pt.x, pt.y);
  rebuild(false);
});
$('#bays').addEventListener('pointermove', e => {
  if(!TDRAG) return;
  dragOnTrack({ x:e.clientX, y:e.clientY });
});

const endTrackDrag = () => {
  if(!TDRAG) return;
  const { moved, wall, el } = TDRAG;
  el.classList.remove('dragging');
  TDRAG = null; DRAGGING = false; hideAtTip();
  if(moved){ sortRun(wall); rebuild(true); }      // reprice once, at the end
};
$('#bays').addEventListener('pointerup', endTrackDrag);
$('#bays').addEventListener('pointercancel', endTrackDrag);

$('#stack').onclick=e=>{
  const bay=S.runs[S.sel?.wall]?.bays[S.sel?.i]; if(!bay) return;
  const t=e.target.closest('button'); if(!t) return;
  /* "Remove last" was the only way to delete a section, so getting rid of the
     second of four meant deleting three. This removes the selected one. */
  if(t.dataset.rmsec){
    const bays = S.runs[S.sel.wall].bays;
    bays.splice(S.sel.i, 1);
    S.sel = bays.length ? { wall:S.sel.wall, i:Math.min(S.sel.i, bays.length-1) } : null;
    rebuild(true); return;
  }
  if(t.dataset.preset){
    const pre = PRESETS.find(p=>p.id===t.dataset.preset);
    if(pre){ bay.stack = structuredClone(pre.stack); bay.top = true; rebuild(true); }
    return;
  }
  /* the top shelf is a choice per section, not a law */
  /* The top deck is what ties the partitions together and squares the box.
     It was offered as a choice; it is not one. Every section gets one. */
  if(t.dataset.move){
    /* Slide it along the wall. Held against a neighbour it swaps with it, so
       the arrows still reorder when there is no room to simply move. */
    const d = +t.dataset.move, wall = S.sel.wall, i = S.sel.i;
    const { lo, hi } = travelRange(wall, i);
    const here = bay.at ?? 0;
    const want = here + d * 6;                       // 6" a press
    if((d < 0 && here > lo + 0.01) || (d > 0 && here < hi - 0.01)){
      moveSection(wall, i, want);
    } else {
      const bays = S.runs[wall].bays, j = i + d;
      if(j >= 0 && j < bays.length){                 // nothing between them: swap
        const a = bays[i], b2 = bays[j], aAt = a.at ?? 0, bAt = b2.at ?? 0;
        if(d > 0){ a.at = bAt + b2.w - a.w; b2.at = aAt; }
        else      { a.at = bAt;             b2.at = aAt + a.w - b2.w; }
        sortRun(wall);
      }
    }
    S.sel.i = S.runs[wall].bays.findIndex(b => b === bay);
    rebuild(true); return;
  }
  if(t.dataset.bw){
    const d=+t.dataset.bw, r=S.runs[S.sel.wall];
    /* the ±6" slack let a section be pushed to 18" or 42" — neither of which
       he can build. 18" is under the narrowest drawer box he stocks, and a
       3/4" shelf bows past 36". Clamp to what the shop can actually cut. */
    const next = clampBay(bay.w + d);
    const delta = next - bay.w;
    /* Growing into the free wall beside it is what you mean when you widen a
       section you have just dropped into a gap. Only once the wall is full
       does widening have to come out of a neighbour. */
    /* It grows into the bare wall on its right, then into the bare wall on its
       left by sliding back, and it never grows through a neighbour. */
    const wall = S.sel.wall, i = S.sel.i;
    if(delta <= 0){ bay.w = next; }
    else {
      const { hi } = travelRange(wall, i);
      const at = bay.at ?? 0;
      const rightRoom = (hi - at);                   // free wall on its right
      if(rightRoom >= delta - 0.01){ bay.w = next; }
      else {
        const { lo } = travelRange(wall, i);
        const leftRoom = at - lo;
        if(rightRoom + leftRoom >= delta - 0.01){
          bay.at = +(at - (delta - rightRoom)).toFixed(1);
          bay.w = next;
        }
      }
    }
    sortRun(wall); S.sel.i = S.runs[wall].bays.findIndex(b => b === bay);
  }
  else if(t.dataset.add){ const d=MODULES[t.dataset.add];
    bay.stack.unshift({m:t.dataset.add, h:d.fill?null:d.defH, o:d.opt?{[d.opt.key]:d.opt.def}:{}});
    /* Dropping a drawer bank into an empty section used to leave 46" of
       nothing above it — not a closet, just a chest with air over it. If what
       was added has a fixed height and nothing is filling the space left, the
       section is completed with whatever still fits, so every section you can
       build is a section we could install. */
    if(!bay.stack.some(st => MODULES[st.m].fill)){
      const floorY = baseHeight(S.mounting, placedFittings());
      const room = (cur?.bays?.find(x=>x.wall===S.sel.wall&&x.bay===S.sel.i)?.h
                    ?? (Math.min(SPEC.topShelf, S.room.h-6) - floorY))
                   - bay.stack.reduce((a,st)=>a+(st.h ?? MODULES[st.m].defH),0);
      const top = ['SHORT_HANG','SHELVES','OPEN'].find(id =>
        MODULES[id].minH <= room + 0.5 && canAdd(bay.stack, id, room + bay.stack.reduce((a,st)=>a+(st.h??MODULES[st.m].defH),0)).ok);
      if(top) bay.stack.push({ m:top, h:null, o:MODULES[top].opt?{[MODULES[top].opt.key]:MODULES[top].opt.def}:{} });
    }
  }
  /* An empty section is a perfectly good state — it is what you get the moment
     you add one — so the last part can be deleted like any other. Refusing to
     delete it meant the only way out of a wrong choice was deleting the whole
     section and starting again. */
  /* open the one-slot picker for this row */
  else if(t.dataset.swap!==undefined){
    const i = +t.dataset.swap;
    S.swap = (S.swap === i) ? null : i;
    SWAP_FOR = S.sel ? S.sel.wall + '|' + S.sel.i : null;
    paintStack(); return;
  }
  else if(t.dataset.swapback!==undefined){ S.swap = null; paintStack(); return; }
  /* put a different part in that slot, keeping its height and its options
     where the new part has the same option to keep */
  else if(t.dataset.swapto!==undefined){
    const i = S.swap, old = bay.stack[i];
    if(old == null){ S.swap = null; paintStack(); return; }
    const id = t.dataset.swapto, d = MODULES[id];
    if(id === old.m){ S.swap = null; paintStack(); return; }
    const keepOpt = d.opt && old.o && old.o[d.opt.key] != null
      && old.o[d.opt.key] >= d.opt.min && old.o[d.opt.key] <= d.opt.max;
    bay.stack[i] = {
      m:id,
      h: d.fill ? null : Math.min(d.maxH, Math.max(d.minH, old.h ?? d.defH)),
      o: d.opt ? { [d.opt.key]: keepOpt ? old.o[d.opt.key] : d.opt.def } : {}
    };
    S.swap = null;
  }
  else if(t.dataset.rm!==undefined){ bay.stack.splice(+t.dataset.rm,1); S.swap = null; }
  else if(t.dataset.mv){ const i=+t.dataset.i, j=i+ +t.dataset.mv;
    if(j>=0&&j<bay.stack.length){ const [x]=bay.stack.splice(i,1); bay.stack.splice(j,0,x); } }
  else if(t.dataset.hh){ const s=bay.stack[+t.dataset.i], d=MODULES[s.m];
    s.h=Math.max(d.minH,Math.min(d.maxH,(s.h ?? d.defH)+ +t.dataset.hh)); }
  else if(t.dataset.opt){ const s=bay.stack[+t.dataset.i], d=MODULES[s.m]; if(!d.opt) return;
    s.o=s.o||{}; s.o[d.opt.key]=Math.max(d.opt.min,Math.min(d.opt.max,(s.o[d.opt.key]??d.opt.def)+ +t.dataset.opt)); }
  else return;
  rebuild(false);
};
$('#fintabs')?.addEventListener('click', e=>{
  const t=e.target.closest('[data-fintab]'); if(!t || t.disabled) return;
  FINTAB=t.dataset.fintab; paintFinTabs();
});
const onFin=e=>{const b=e.target.closest('.sw');if(!b)return;
  if(b.dataset.w==='carcass') S.finish=b.dataset.n; else S.frontFinish=b.dataset.n;
  clearCaches(); rebuild(false); paintFin(b.dataset.w); paintFinTabs();};
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
    key.color.setHex(S.evening?0xffd9a8:0xfffdfa)}};
document.querySelectorAll('.acc > summary').forEach(s=>s.addEventListener('click',()=>setTimeout(resize,280)));
/* ───────── sending the design to the office ─────────
   Clicking this used to drop the design into storage and jump straight to the
   contact page, which left the customer wondering what, if anything, had just
   been sent. Now it says exactly what travels with the enquiry, and only then
   goes on to ask who they are and where the room is. */
function quotePackage(){
  return {
    summary:`${TYPES[S.type].label} · ${S.room.w}"×${S.room.d}"×${S.room.h}" · ${cur.bays.length} section${cur.bays.length===1?'':'s'} · ${cur.finish.n}`,
    price:Math.round(cur.price.price), type:S.type,
    typeLabel: S.type==='reach-in'?'Reach-In Closets':S.type==='walk-in'?'Walk-In Closets':S.type==='pantry'?'Pantries':S.type==='garage'?'Garage Storage':'Laundry Rooms',
    room:S.room, mounting:S.mounting,
    backs: S.backs ? 'A back panel on every section' : 'No backs — the wall is the back',
    corner: Object.values(S.runs).filter(r=>r?.on).length > 1
      ? (S.corner === 'into'
          ? 'The back wall runs into the corner; the side run starts clear of it'
          : 'Both runs stop at the corner and the corner square is left bare')
      : null,
    baseboard:{ height:S.base.h, thickness:S.base.t,
                measuredFrom:S.base.measured,
                handling: S.base.handling==='scribe' ? 'Panels notched round the baseboard on site'
                        : S.base.handling==='remove' ? 'Baseboard taken off behind the run'
                        : `Run stands ${S.base.t}" in front of the baseboard`,
                standsOffWall: baseGap() },
    finish:cur.finish.n, frontFinish:cur.frontFinish.n,
    pull:cur.pull.name, pullFinish:cur.pullFinish.name,
    bays:cur.bays.map(b=>({wall:b.wall,width:+b.w.toFixed(1),topShelf:b.top!==false,
      stack:b.stack.map(s=>({module:MODULES[s.m].label, height:s.h, options:s.o||{}}))})),
    order:cur.order, warnings:cur.warnings,
    door: DOORS.find(d=>d.id===S.door)?.label || 'Open / no doors',
    /* Everything the customer told us about this thing travels: which wall,
       how far along it, how high off the floor, how big it is, and what they
       said about it in their own words. Sending only the name meant the crew
       arrived knowing there was an outlet and nothing else. */
    fittings: S.fittings.filter(f=>f.placed).map(f=>({
      item: FITTINGS.find(x=>x.id===f.k)?.label || f.k,
      wall: WALL_LABEL[f.wall],
      inchesAlong: Math.round(f.at),
      ...(f.hi    != null ? { heightOffFloor: Math.round(f.hi) } : {}),
      ...(f.w     != null ? { widthInches:    Math.round(f.w)  } : {}),
      ...(f.cap   != null ? { sillOrLowPoint: Math.round(f.cap)} : {}),
      ...(f.top   != null ? { tallInches:     Math.round(f.top)} : {}),
      ...(f.depth != null ? { sticksOutInches:Math.round(f.depth)} : {}),
      ...(f.spot  ? { where: f.spot === 'floor' ? 'In the floor' : 'On the wall' } : {}),
      note: f.note || '' })),
    generated:new Date().toISOString()
  };
}
$('#send').onclick=()=>{
  const q = quotePackage();
  try{ localStorage.setItem('js_quote', JSON.stringify(q)); }catch(e){}
  const dl = $('#sendDlg'), list = $('#sendList');
  if(!dl || !list){ location.href=(window.BASE||'')+'contact.html'; return; }
  const parts = q.order.reduce((a,o)=>a+(+o.qty||0),0);
  const line = (k,v) => `<div class="sl"><span>${k}</span><b>${v}</b></div>`;
  list.innerHTML =
      line('The room', `${q.room.w}" wide · ${q.room.d}" deep · ${q.room.h}" high`)
    + line('The drawing', `${q.bays.length} section${q.bays.length===1?'':'s'}, wall by wall`)
    + line('Every part', `${parts} panels, shelves, rods, boxes, glides and pulls`)
    + line('Finish', q.finish === q.frontFinish ? q.finish : `${q.finish} carcass · ${q.frontFinish} fronts`)
    + line('Hardware', `${q.pull} in ${q.pullFinish}`)
    + line('Doors', q.door)
    + line('Backs', q.backs)
    + (q.corner ? line('The corner', q.corner) : '')
    + line('Baseboard', `${q.baseboard.height}" tall, ${q.baseboard.thickness}" thick · `
        + `measured ${q.baseboard.measuredFrom === 'wall' ? 'wall to wall' : 'baseboard to baseboard'} · `
        + q.baseboard.handling)
    + (q.fittings.length ? line('On the walls', q.fittings.map(f =>
        [f.item, f.wall, f.inchesAlong + '" along',
         f.heightOffFloor != null ? f.heightOffFloor + '" up' : null,
         f.where, f.note ? '“' + f.note + '”' : null
        ].filter(Boolean).join(' · ')).join('<br>')) : '')
    + line('Estimate', money(q.price) + ' for the cabinetry')
    + (q.warnings?.length ? `<div class="sl warn"><span>Worth saying</span><b>${q.warnings.join(' ')}</b></div>` : '');
  dl.showModal();
};
$('#sendCancel')?.addEventListener('click', ()=> $('#sendDlg').close());
$('#sendGo')?.addEventListener('click', ()=>{
  try{ localStorage.setItem('js_quote', JSON.stringify(quotePackage())); }catch(e){}
  location.href=(window.BASE||'')+'contact.html';
});
$('#dlOrder').onclick=()=>{
  const rows=[['Item','Qty','Sq ft','Edgeband ft','Finish','Detail'],
    ...cur.order.map(o=>[o.item,o.qty,o.sq_ft,o.edgeband_ft,o.finish,o.detail])];
  const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const u=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  const a=document.createElement('a'); a.href=u; a.download='closet-order.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
};
$('#breakdown').onclick=()=>{
  if(window.gotoStep) window.gotoStep('5');
  const el=$('#quotebox');
  if(el) el.scrollIntoView({behavior:'smooth',block:'nearest'});
};

/* ───────── go ───────── */
/* ---- the finish sheet -------------------------------------------------
   This is 160 KB of finish photography used to colour the 3D model. Nothing
   on the first screen needs it, so it is fetched at low priority.

   TWO BUGS LIVED HERE AND BOTH ARE FIXED BELOW.

   1. It carried loading='lazy'. An Image that is never put into the document
      is never "in view", so a lazy one never loads at all. onload therefore
      never fired, and because the swatch list was painted from inside onload,
      step 3 showed an EMPTY finish picker on the live site. Lazy loading only
      ever means anything for an <img> in the page, so it is gone.

   2. Painting the swatch list from inside onload was wrong anyway. The list
      is built from catalog.json, which is already in hand; only the 3D
      material colours need the photography. So the list is painted straight
      away, and the sheet landing just repaints it with the real swatches. If
      the sheet 404s, the picker still works. */
paintPulls();
paintFin('carcass'); paintFin('fronts');
rebuild(true); resize();

const sheet = new Image();
sheet.crossOrigin = 'anonymous';
sheet.fetchPriority = 'low';
sheet.onload = () => {
  initSheet(sheet, cat.meta); clearCaches();
  paintFin('carcass'); paintFin('fronts');
  rebuild(false);
};
sheet.onerror = () => {
  console.warn('[builder] finish photography did not load; swatches fall back to flat colour');
};
sheet.src = (window.BASE||"") + 'img/finishes/sprite.jpg';
