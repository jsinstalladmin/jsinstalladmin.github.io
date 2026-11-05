import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SPEC, MODULES, MODULE_IDS, PULLS, PULL_FINISHES,
         buildDesign, makeBay, defaultStackFor, canAdd, PRESETS,
         presetDelta } from './design.js';
import { makeRenderer, setupLighting, fitShadowCamera, loadSharedMaps,
         panelGeo, makeComposer } from './render.js';
import { initSheet, finishMaterial, scaledMaterial, hardwareMaterial,
         clothMaterials, clearCaches } from './materials.js';

const cat = await (await fetch((window.BASE||"")+'assets/data/catalog.json')).json();
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
  straight:{label:'Straight wall', walls:['back'],                art:'M3 17h18', note:'One run'},
  l       :{label:'L-shape',       walls:['back','left'],         art:'M3 17h18M3 17V5', note:'Two walls'},
  u       :{label:'U-shape',       walls:['back','left','right'], art:'M3 5v12h18V5', note:'Three walls'}
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
/* ?noao=1 skips ambient occlusion — a useful escape hatch on weak hardware */
if(!new URLSearchParams(location.search).has('noao')){
  const {w,h}=sizeNow(); const m=makeComposer(renderer,scene,cam,w,h); composer=m.composer; ao=m.ao;
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
})();

/* ───────── room + closet ───────── */
/* ---- procedural room textures --------------------------------------------
   Built on a canvas rather than shipped as files: a 2048px plank texture is
   ~1.5MB of JPEG, and this costs nothing to download and tiles perfectly. */
let ROOM_TEX = null;
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

  /* Derive relief and sheen from the albedo so the three always agree. */
  const { normal: floorNor, rough: floorRgh } = derive(fc, 2.1, [0.62, 0.95]);
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
const PAD_X = 46, PAD_Z = 88;

function drawRoom(){
  shell.clear();
  const {w:CW, d:CD, h:H} = S.room;
  const W = CW + PAD_X * 2, D = CD + PAD_Z;
  const T = roomTextures();
  const BASE_H = 4.5, BASE_T = 0.6;          // real baseboard, 4½" tall

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
  const X0 = -PAD_X;                       // room's left wall, in closet coords
  mkWall(W, H, X0 + W/2, H/2, 0, 0, 0);
  mkWall(D, H, X0,       H/2, D/2, 0,  Math.PI/2);
  mkWall(D, H, X0 + W,   H/2, D/2, 0, -Math.PI/2);

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
        const d = fitDist(H * 1.22, (W + PAD_X * 0.6) * 1.1) * 1.04;
        return { t:[W/2, H*0.45, 0], p:[W/2, H*0.47, d] };
      }
      const b = focusBay();
      const midY = SPEC.toeKick + b.h / 2;
      const dist = fitDist(b.h * 1.52, Math.max(b.w, 24) * 2.9);
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
      const dist = fitDist(H * 1.34, (W + PAD_X) * 1.18) * 1.05;
      return { t:[W/2, H*0.42, D*0.30], p:[W/2 + W*0.10, H*0.52, D*0.30 + dist] };
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
function rebuild(reframe){
  cur=buildDesign(cfg(),cat);
  drawRoom(); drawCloset(cur); resize();
  if(reframe){ resize(); frame(); }
  paintAll();
}
function paintAll(){ paintSteps(); paintBays(); paintStack(); paintPrice(); paintQuote(); paintOrder(); markSteps();
  /* steps 3 and 5 look at one section, so changing which one is selected has
     to move the camera too, not just the panel */
  const st = document.body.dataset.step;
  if((st === '2' || st === '4') && cur?.bays?.length) flyTo(st, 520);
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
    iconBtn('data-t', k, k===S.type, t.art, t.label, t.note)).join('');
  /* Three stacked rows each with one number in the middle wasted most of the
     panel and you could not type a real measurement into any of them. Three
     columns, and the number is an input: type 103 if the wall is 103. */
  $('#dims').innerHTML=[['w','Wall width',36,288,6],['d','Depth',12,48,2],['h','Ceiling',84,132,2]]
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
  $('#walls').innerHTML = `<h4 class="subh">Shape of the run</h4><div class="pills icons icons-3">`+
    Object.entries(SHAPES).map(([k,s])=>
      iconBtn('data-shape', k, k===S.shape, s.art, s.label, s.note)).join('')+`</div>`;
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
            title="${b.stack.length?b.stack.length+' item'+(b.stack.length===1?'':'s')+', drag to move it along the wall':'empty, click to fill it or drag to move it'}">
            <span class="bstack">${miniStack(b)}</span>
            <span class="bw">${b.w.toFixed(0)}"</span></button>`).join('')}
          ${left > 2 ? `<span class="bay gap" style="flex:${left}" aria-hidden="true">${left.toFixed(0)}" free</span>` : ''}
        </div>`
      : `<p class="note emptyrun">Nothing on this wall yet. Add your first section below.</p>`;

    d.innerHTML = `<div class="runhd"><b>${wall[0].toUpperCase()+wall.slice(1)} wall</b>
      <span class="${left < -0.5 ? 'over' : ''}">${used.toFixed(0)}" of ${len.toFixed(0)}" used${left>0.5?` · ${left.toFixed(0)}" free`:''}</span></div>
      ${strip}
      <div class="addrow">
        ${fits.length || left >= SPEC.bayMin
          ? `<span class="addlbl">Add a section</span>`
          : `<span class="addlbl full">Wall is full &middot; ${len.toFixed(0)}" used</span>`}
        <div class="addgrid">
          ${fits.map(w=>`<button class="wcard" data-bay="addw" data-wall="${wall}" data-w="${w}">
            <span class="wbar"><span style="width:${(w/SPEC.bayMax)*100}%"></span></span>
            <b>${w}"</b></button>`).join('')}
          ${left >= SPEC.bayMin ? `<button class="wcard fill" data-bay="addfill" data-wall="${wall}">
            <span class="wbar"><span style="width:100%"></span></span>
            <b>Rest ${clampBay(left).toFixed(0)}"</b></button>` : ''}
        </div>
        ${r.bays.length ? `<div class="addutil">
          <button class="mini" data-bay="even" data-wall="${wall}">Even them up</button>
          <button class="mini danger" data-bay="del" data-wall="${wall}">Remove last</button>
        </div>` : ''}
      </div>`;
    host.appendChild(d);
  }
  $('#bayNote').textContent = `Sections run ${SPEC.bayMin}"–${SPEC.bayMax}" wide. Past ${SPEC.bayMax}" a ¾" shelf sags, so a partition goes in. That is why those are the only widths offered.`;
}

/* ───────── step 2b: what goes in the selected section ─────────
   This used to be its own tab, and it used to show two pickers: a row of
   "layouts" and a grid of "pieces". They were the same control. A layout is
   just a section pre-filled with pieces, so both now live in one grid, with
   the ready-made ones first and badged.

   It also used to dead-end: no section selected meant an empty panel telling
   you to go and pick one. If sections exist, one of them is selected. */
function paintStack(){
  const box = $('#stack');
  const run = S.sel && S.runs[S.sel.wall];
  if(!run?.bays[S.sel?.i]){
    /* nothing chosen, but something exists: choose it rather than dead-end */
    const wall = Object.keys(S.runs).find(k => S.runs[k]?.on && S.runs[k].bays.length);
    if(wall){ S.sel = { wall, i:0 }; return paintStack(); }
    box.innerHTML = `<p class="note emptysel">Add a section above and its parts appear here.</p>`;
    return;
  }
  const bay = S.runs[S.sel.wall].bays[S.sel.i];
  /* same arithmetic buildDesign uses, so the palette agrees with the drawing */
  const floorY = S.mounting === 'wall' ? SPEC.wallHungBase : SPEC.toeKick;
  const usable = Math.min(SPEC.topShelf, S.room.h - 6) - floorY;

  const cheapest = PRESETS.reduce((lo, p) => {
    const v = presetDelta(p, bay.w, usable, cat, S.finish);
    return (v != null && (lo == null || v < lo)) ? v : lo; }, null);

  /* A preset made of two modules was showing one module's photo, so
     "Hanging + Shelves" was a picture of shelves with no rod in it. The card
     now draws the actual stack, top module above bottom module, in the same
     order it will be built. */
  const partImg = id => (window.BASE||'') + 'img/parts/' + id.toLowerCase().replace(/_/g,'-') + '.jpg';
  const presetCards = PRESETS.map(pre => {
    const price = presetDelta(pre, bay.w, usable, cat, S.finish);
    const delta = (price != null && cheapest != null) ? Math.round(price - cheapest) : null;
    const tag   = delta == null ? '' : delta <= 0 ? 'Incl.' : '+' + money(delta);
    const ids   = [...new Set(pre.stack.map(x => x.m))].reverse();   // top of stack first
    const art   = ids.length > 1
      ? `<span class="pstack">${ids.map(id =>
          `<img src="${partImg(id)}" alt="" loading="lazy" decoding="async">`).join('')}</span>`
      : `<img src="${(window.BASE||'')}img/parts/${pre.img}.jpg" alt="" loading="lazy" decoding="async"
             width="420" height="315">`;
    return `<button class="pcard ready" data-preset="${pre.id}" title="${pre.desc.replace(/"/g,'&quot;')}">
      ${art}<i>${pre.name}</i><em>${pre.desc}</em>
      <span class="pbadge">Ready-made</span>${tag ? `<u>${tag}</u>` : ''}</button>`;
  }).join('');

  const partCards = MODULE_IDS.map(id => {
    const d = MODULES[id], img = id.toLowerCase().replace(/_/g,'-');
    const chk = canAdd(bay.stack, id, usable);
    const tip = (chk.ok ? d.hint : chk.why).replace(/"/g,'&quot;');
    return `<button class="pcard" data-add="${id}" ${chk.ok?'':'disabled'} title="${tip}">
      <img src="${(window.BASE||'')}img/parts/${img}.jpg" alt="" loading="lazy" decoding="async"
           width="420" height="315">
      <i>${d.label}</i><em>${(d.spec||'').replace(/"/g,'&quot;')}</em>
      ${chk.ok ? '' : '<u class="full">No room</u>'}</button>`;
  }).join('');

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
      return `<div class="srow ${st.h==null?'flex':''}">
        <span class="sico"><svg viewBox="0 0 24 32"><path d="${d.icon}"/></svg></span>
        <span class="sname"><b>${d.label}</b><i>${st.h==null?'fills the space':(st.h+'" tall')}</i></span>
        ${d.opt?`<span class="sopt"><button data-opt="-1" data-i="${i}">−</button><i>${(st.o?.[d.opt.key] ?? d.opt.def)}</i><button data-opt="1" data-i="${i}">+</button></span>`:''}
        <span class="sacts">
          <button data-mv="1"  data-i="${i}" title="Move up"    ${i===bay.stack.length-1?'disabled':''}>↑</button>
          <button data-mv="-1" data-i="${i}" title="Move down"  ${i===0?'disabled':''}>↓</button>
          <button data-hh="-4" data-i="${i}" title="Shorter">▾</button>
          <button data-hh="4"  data-i="${i}" title="Taller">▴</button>
          <button data-rm="${i}" title="Remove" ${bay.stack.length<2?'disabled':''}>×</button>
        </span></div>`;
    }).join('')}</div>` : `<p class="note emptybay">This section is empty. Pick anything below to put in it.</p>`}

    <h4 class="subh">What goes in this section</h4>
    <p class="note" style="margin:-2px 0 10px">Ready-made layouts first, then single parts. Everything can be changed after.</p>
    <div class="pgrid">${presetCards}${partCards}</div>`;
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
function paintFin(which){
  const box=$(which==='carcass'?'#fin1':'#fin2');
  const cur=which==='carcass'?S.finish:(S.frontFinish||S.finish);
  const term=($('#fq').value||'').trim().toLowerCase();
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
  </div>`;
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
$('#types').onclick=e=>{const b=e.target.closest('button');if(!b)return;applyType(b.dataset.t);rebuild(true)};
/* Clamp when the field is committed, not on every keystroke, or typing "10"
   on the way to "108" snaps to the 36" minimum under your fingers. */
$('#dims').addEventListener('change', e=>{
  const i = e.target.closest('input[data-dim]'); if(!i) return;
  const k = i.dataset.dim, mn = +i.min, mx = +i.max;
  const v = Math.round(Number(i.value));
  S.room[k] = Number.isFinite(v) ? Math.min(mx, Math.max(mn, v)) : S.room[k];
  rebuild(true);
});
$('#dims').addEventListener('keydown', e=>{
  if(e.key === 'Enter' && e.target.matches('input[data-dim]')){ e.preventDefault(); e.target.blur(); }
});
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
        /* no tab jump: you are already looking at the right panel */
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
    if(pre){ bay.stack = structuredClone(pre.stack); rebuild(true); }
    return;
  }
  if(t.dataset.move){
    const d=+t.dataset.move, bays=S.runs[S.sel.wall].bays, i=S.sel.i, j=i+d;
    if(j>=0 && j<bays.length){ const [m]=bays.splice(i,1); bays.splice(j,0,m); S.sel.i=j; rebuild(true); }
    return;
  }
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
    key.color.setHex(S.evening?0xffd9a8:0xfffdfa)}};
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
$('#breakdown').onclick=()=>{
  if(window.gotoStep) window.gotoStep('5');
  const el=$('#quotebox');
  if(el) el.scrollIntoView({behavior:'smooth',block:'nearest'});
};

/* ───────── go ───────── */
const sheet=new Image(); sheet.crossOrigin='anonymous';
sheet.onload=()=>{ initSheet(sheet,cat.meta); clearCaches();
  paintFin('carcass'); paintFin('fronts'); rebuild(true); };
sheet.onerror=()=>{ paintFin('carcass'); paintFin('fronts'); rebuild(true); };
sheet.src=(window.BASE||"")+'img/finishes/sprite.jpg';
paintPulls(); rebuild(true); resize();
