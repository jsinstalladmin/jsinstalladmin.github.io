/* ============================================================
   design.js — the closet model.

   The old engine planned sections FOR the customer. This one does
   not plan anything: the customer defines the space, divides each
   run into BAYS of whatever width they want, and fills each bay
   with a STACK of modules they choose. Nothing is auto-assigned.

        Run  = one wall of cabinetry
        Bay  = a vertical column between two panels (24"–36")
        Stack= what is inside that bay, bottom to top

   One pass produces the geometry, the full order list and the
   price, so the drawing, the quote and the order can never drift.
   All dimensions in INCHES.
   ============================================================ */

export const SPEC = {
  topShelf:84, longHang:66, dhUpper:80, dhLower:40,
  bayMin:24, bayMax:36, hangDepth:24, shelfDepth:14,
  shoeGap:8, toeKick:3.5, panel:0.75, pin:1.25, counter:36, wallHungBase:6
};

/* ---------- decorative pulls ----------
   ⚠ PLACEHOLDER PRICES. His ClosetPro catalogue prices construction
   hardware only (cams, dowels, Euro screws) — it has no decorative
   pulls at all. Replace `cost` below with his real supplier prices. */
export const PULLS = [
  { id:'none',  name:'Push to open',   cost:0.00, len:0,  kind:'none',  note:'No pull. Press the front to open.' },
  { id:'bar4',  name:'4" bar pull',    cost:4.50, len:4,  kind:'bar',   note:'Slim round bar. The default.' },
  { id:'bar6',  name:'6" bar pull',    cost:5.80, len:6,  kind:'bar',   note:'Longer bar for wide drawers.' },
  { id:'bar12', name:'12" bar pull',   cost:9.40, len:12, kind:'bar',   note:'Appliance-length, for tall fronts.' },
  { id:'edge',  name:'Edge pull',      cost:7.20, len:0,  kind:'edge',  note:'Integrated into the top edge. Nothing protrudes.' },
  { id:'knob',  name:'Round knob',     cost:3.40, len:1.2,kind:'knob',  note:'Traditional. One per front.' },
  { id:'cup',   name:'Cup pull',       cost:6.10, len:3,  kind:'cup',   note:'Shaker style, opens from underneath.' }
];
export const PULL_FINISHES = [
  { id:'nickel', name:'Brushed nickel', hex:0xC2C6C9, rough:0.26, mult:1.00 },
  { id:'black',  name:'Matte black',    hex:0x1E1E20, rough:0.52, mult:1.05 },
  { id:'brass',  name:'Antique brass',  hex:0xA8824C, rough:0.34, mult:1.18 }
];

/* ============================================================
   MODULE CATALOGUE — everything that can go in a bay.
   Each one knows its own height rules, its parts and its geometry.
   ============================================================ */
const P = (code,qty,sqft,edge,note) => ({code,qty,sqft,edge,note});

/* Real drawer hardware from his ClosetPro catalogue — 129 box SKUs and 10
   glide lengths. This matters because a drawer FRONT is melamine cut to any
   size, but the BOX behind it is an ordered part that only exists in these
   sizes. If no box fits behind the front the bank cannot actually be built,
   which is the kind of thing you want to find out on the website and not on
   installation day. */
export const DRAWER_BOX = {
  w: [18.75, 24.75, 30.75, 36, 36.75],
  h: [7.5, 8.75, 10, 15, 18.75, 25],
  d: [16, 20, 24, 30, 31]
};
const GLIDES = [10, 12, 14, 16, 18, 20, 22, 24, 30];
const fit = (list, max) => { const ok = list.filter(v => v <= max); return ok.length ? Math.max(...ok) : null; };

/* ---- what can actually go in one bay -------------------------------------
   Without these, five long hangs could be dropped into a single 84" bay.
   Each one is a fill module with a 62" minimum, so resolveHeights() split the
   leftover five ways and then clamped every slice back UP to 62" — 310" of
   cabinetry in a 7-foot opening, which is what was punching through the
   ceiling in the 3D view.

   LIMIT  = how many of this module belong in one bay
   GROUP  = modules in the same group are mutually exclusive (one front only) */
export const LIMIT = {
  LONG_HANG:1, DOUBLE_HANG:1, DOOR:1, GLASS_DOOR:1, HAMPER:1, COUNTER:2,
  DRAWERS:2, BASKETS:2, SHOES:2, SHOE_SLANT:2, SHELVES:3, CUBBIES:2, OPEN:2
};
const GROUP = { DOOR:'front', GLASS_DOOR:'front' };

/* The real constraint is vertical: everything in the bay has to fit between
   the toe kick and the top shelf at its own minimum height. */
export function canAdd(stack, id, usableH){
  const def = MODULES[id];
  if(!def) return { ok:false, why:'Unknown part.' };

  const n = stack.filter(s => s.m === id).length;
  const lim = LIMIT[id] ?? 2;
  if(n >= lim)
    return { ok:false, why: lim === 1
      ? `Only one ${def.label.toLowerCase()} per section.`
      : `${lim} ${def.label.toLowerCase()} is the most that fits in one section.` };

  if(GROUP[id] && stack.some(s => GROUP[s.m] === GROUP[id]))
    return { ok:false, why:'This section already has a front on it.' };

  const need = stack.reduce((a,s) => a + MODULES[s.m].minH, 0) + def.minH;
  if(need > usableH + 0.5)
    return { ok:false, why:`No room left — that needs ${def.minH}" and only ${Math.max(0, usableH - (need - def.minH)).toFixed(0)}" is free.` };

  return { ok:true };
}

export const MODULES = {
  LONG_HANG: {
    label:'Long hang', hint:'Coats and dresses. One rod with full clearance below.',
    spec:'Rod at 66\" · needs 62\" min',
    icon:'M2 4h20M6 8h12M7 8v18M11 8v20M15 8v17M19 8v19',
    defH:70, minH:62, maxH:84, fill:true,
    build(c){
      const {w,d,y,h,G,parts} = c;
      parts.push(P('HANGROD',1,0,0,'Hang rod'));
      G.push({k:'rod', p:[0, y+h-6, 0], s:[w-1, 1.4, 1.4], m:'metal'});
      hang(G, 0, y+h-6, Math.min(h-10, 52), w, d);
    }
  },
  DOUBLE_HANG: {
    label:'Double hang', hint:'Shirts and folded trousers. Two rods, twice the capacity.',
    spec:'Rods at 80\" and 40\" · needs 70\" min',
    icon:'M2 3h20M6 7h12M7 7v5M11 7v6M15 7v5M19 7v6M2 15h20M6 19h12M7 19v5M11 19v6M15 19v5M19 19v6',
    defH:78, minH:70, maxH:84, fill:true,
    build(c){
      const {w,d,y,h,G,parts} = c;
      const mid = y + h/2;
      parts.push(P('FIXED',1,(w*d)/144,w/12,'Divider shelf'));
      G.push({k:'shelf', p:[0, mid, 0], s:[w, SPEC.panel, d], m:'carcass'});
      parts.push(P('HANGROD',2,0,0,'Hang rods ×2'));
      G.push({k:'rod', p:[0, y+h-5, 0], s:[w-1,1.4,1.4], m:'metal'});
      G.push({k:'rod', p:[0, mid-5, 0], s:[w-1,1.4,1.4], m:'metal'});
      hang(G, 0, y+h-5, Math.min(h/2-8, 34), w, d);
      hang(G, 0, mid-5,  Math.min(h/2-8, 32), w, d);
    }
  },
  SHELVES: {
    label:'Adjustable shelves', hint:'Folded knits, bags, boxes. Moves on 32mm centres.',
    spec:'Adjustable on 32mm centres · 12\"–84\"',
    icon:'M2 4h20M2 11h20M2 18h20M2 25h20',
    defH:42, minH:12, maxH:84, fill:true, opt:{key:'n',label:'Shelves',min:1,max:10,def:4},
    build(c){
      const {w,d,y,h,G,parts,o} = c;
      const n = clamp(o.n ?? Math.max(2,Math.round(h/13)), 1, 10);
      parts.push(P('ADJ',n,(w*d)/144*n,(w/12)*n,`${n} adjustable shelves`));
      for(let i=1;i<=n;i++) G.push({k:'shelf', p:[0, y + (h/(n+1))*i, 0], s:[w, SPEC.panel, d], m:'carcass'});
    }
  },
  DRAWERS: {
    label:'Drawers', hint:'Soft-close undermount glides. Nine box sizes.',
    spec:'Boxes 7½\"–25\" tall · bank 10\"–48\"',
    icon:'M2 3h20v6H2zM2 12h20v6H2zM2 21h20v6H2z',
    defH:34, minH:10, maxH:48, opt:{key:'n',label:'Drawers',min:1,max:8,def:4},
    build(c){
      const {w,d,y,h,G,parts,o,pull,warn} = c;
      const n = clamp(o.n ?? Math.max(2,Math.round(h/8.5)), 1, 8);
      const fh = h/n;

      /* the front is cut to fh; the box behind it has to be a real SKU */
      const boxW = fit(DRAWER_BOX.w, w - 1.0);        // 1/2" glide each side
      const boxD = fit(DRAWER_BOX.d, d - 2.0);
      const boxH = fit(DRAWER_BOX.h, fh - 1.0);       // front overlays the box
      const glide = fit(GLIDES, boxD || 0);

      if(!boxW) warn && warn(`A ${w.toFixed(0)}" bay is too narrow for a drawer box — the smallest he stocks is ${DRAWER_BOX.w[0]}" and needs a ${(DRAWER_BOX.w[0]+1).toFixed(0)}" opening.`);
      if(!boxH) warn && warn(`${n} drawers across ${h.toFixed(0)}" gives ${fh.toFixed(1)}" fronts — too short for the ${DRAWER_BOX.h[0]}" box, the shallowest he stocks. Use fewer drawers.`);

      parts.push({code:'DRAWER',qty:n,w,h:fh,d:Math.min(d-2,20),
        note:`${n} drawers, ${fh.toFixed(1)}" fronts` +
             (boxW&&boxH&&boxD ? ` · ${boxW}"×${boxH}"×${boxD}" boxes, ${glide}" glides` : ' · NO STOCK BOX FITS')});
      for(let i=0;i<n;i++){
        const cy = y + fh*i + fh/2;
        G.push({k:'front', p:[0, cy, d/2-0.4], s:[w-0.2, fh-0.18, 0.8], m:'front'});
        addPull(G, pull, 0, cy, d/2, w, fh);
      }
      /* A drawer bank is capped. The module used to emit fronts and nothing
         else, so the top drawer had open carcass above it and you could see
         straight over it — which is both wrong on screen and wrong in the
         shop: the fixed top carries the upper glides and stops the bank
         racking. It is a real part and it gets priced. */
      G.push({k:'shelf', p:[0, y + h + SPEC.panel/2, 0], s:[w, SPEC.panel, d], m:'carcass'});
      parts.push(P('FIXED', 1, (w*d)/144, (w + d*2)/12, 'Fixed top over the drawer bank'));

      if(pull && pull.id!=='none') parts.push({code:'PULL',qty:n,note:`${n} × ${pull.name}`});
    }
  },
  SHOES: {
    label:'Shoe shelving', hint:'Flat shelves at 8" spacing.',
    spec:'Shelves at 8\" spacing · 16\"–84\"',
    icon:'M2 3h20M2 8h20M2 13h20M2 18h20M2 23h20M2 28h20',
    defH:40, minH:16, maxH:84, fill:true,
    build(c){
      const {w,d,y,h,G,parts} = c;
      const n = Math.max(2, Math.floor(h/SPEC.shoeGap));
      parts.push(P('SHOE',n,(w*d)/144*n,(w/12)*n,`${n} shoe shelves at 8"`));
      for(let i=1;i<=n;i++) G.push({k:'shelf', p:[0, y + SPEC.shoeGap*i, 0], s:[w, SPEC.panel, d], m:'carcass'});
    }
  },
  SHOE_SLANT: {
    label:'Slanted shoe', hint:'Angled shelf with a fence. Shows the whole shoe.',
    spec:'Angled shelves at 8\" spacing · 16\"–84\"',
    icon:'M2 7l20-4M2 14l20-4M2 21l20-4M2 28l20-4',
    defH:40, minH:16, maxH:84, fill:true,
    build(c){
      const {w,d,y,h,G,parts} = c;
      const n = Math.max(2, Math.floor(h/10));
      parts.push(P('SHOE_SLANT',n,(w*d)/144*n,(w/12)*n,`${n} slanted shoe shelves with fence`));
      for(let i=1;i<=n;i++){
        G.push({k:'shelf', p:[0, y + (h/(n+1))*i, 0], s:[w, SPEC.panel, d], m:'carcass', tilt:-0.18});
        G.push({k:'shelf', p:[0, y + (h/(n+1))*i + 1.4, d/2-0.8], s:[w, 2, SPEC.panel], m:'carcass'});
      }
    }
  },
  HAMPER: {
    label:'Tilt-out hamper', hint:'Chrome basket on a flap stay. Laundry off the floor.',
    spec:'26\"–32\" tall · 18\" basket',
    icon:'M2 3h20M4 9h16l-2 18H6z',
    defH:28, minH:26, maxH:32,
    build(c){
      const {w,d,y,h,G,parts,pull} = c;
      parts.push({code:'HAMPER',qty:1,note:'Tilt-down hamper'});
      parts.push({code:'BASKET',qty:1,w,note:'Chrome tilt basket'});
      G.push({k:'front', p:[0, y+h/2, d/2-0.4], s:[w-0.2, h-1, 0.8], m:'front'});
      addPull(G, pull, 0, y+h/2, d/2, w, h);
      if(pull && pull.id!=='none') parts.push({code:'PULL',qty:1,note:`1 × ${pull.name}`});
    }
  },
  BASKETS: {
    label:'Pull-out baskets', hint:'Chrome wire on full-extension glides.',
    spec:'Chrome wire on full extension · 10\"–48\"',
    icon:'M3 5h18v5H3zM3 13h18v5H3zM3 21h18v5H3zM7 7h10M7 15h10M7 23h10',
    defH:30, minH:10, maxH:48, opt:{key:'n',label:'Baskets',min:1,max:6,def:3},
    build(c){
      const {w,d,y,h,G,parts,o} = c;
      const n = clamp(o.n ?? 3, 1, 6);
      parts.push({code:'BASKET',qty:n,w,note:`${n} pull-out chrome baskets`});
      for(let i=0;i<n;i++) G.push({k:'basket', p:[0, y+(h/n)*i+(h/n)/2, 0], s:[w-2, (h/n)-2, d-3], m:'metal'});
      /* same as the drawer bank — the runners mount to a fixed top */
      G.push({k:'shelf', p:[0, y + h + SPEC.panel/2, 0], s:[w, SPEC.panel, d], m:'carcass'});
      parts.push(P('FIXED', 1, (w*d)/144, (w + d*2)/12, 'Fixed top over the basket run'));
    }
  },
  CUBBIES: {
    label:'Cubbies', hint:'A grid of small openings. Bags, hats, folded knits.',
    spec:'Grid of openings · 12\"–60\"',
    icon:'M2 3h9v9H2zM13 3h9v9h-9zM2 15h9v9H2zM13 15h9v9h-9z',
    defH:36, minH:12, maxH:60, opt:{key:'n',label:'Rows',min:1,max:5,def:3},
    build(c){
      const {w,d,y,h,G,parts,o} = c;
      const rows = clamp(o.n ?? 3, 1, 5), cols = Math.max(1, Math.round(w/14));
      parts.push(P('CUBBY',rows*cols,(w*d)/144*rows + (h*d)/144*(cols-1), (w/12)*rows + (h/12)*(cols-1), `${rows}×${cols} cubby grid`));
      for(let r=1;r<rows;r++) G.push({k:'shelf', p:[0, y+(h/rows)*r, 0], s:[w, SPEC.panel, d], m:'carcass'});
      for(let cI=1;cI<cols;cI++) G.push({k:'panel', p:[-w/2 + (w/cols)*cI, y+h/2, 0], s:[SPEC.panel, h, d], m:'carcass'});
    }
  },
  COUNTER: {
    label:'Counter top', hint:'A work surface. Folding, packing, a laundry bench.',
    spec:'Work surface at 36\" · 1¼\"–3\" thick',
    icon:'M1 10h22v4H1zM4 16h16v12H4z',
    defH:2, minH:1.25, maxH:3,
    build(c){
      const {w,d,y,h,G,parts} = c;
      parts.push(P('FIXED',1,(w*d)/144,(w+d)/12,'Counter top'));
      G.push({k:'counter', p:[0, y+h/2, 0], s:[w, h, d], m:'carcass'});
    }
  },
  DOOR: {
    label:'Closed door', hint:'A slab door over the whole bay.',
    spec:'Slab front · 12\"–84\" tall',
    icon:'M3 2h18v28H3zM18 15h2',
    defH:48, minH:12, maxH:84, fill:true,
    build(c){
      const {w,d,y,h,G,parts,pull} = c;
      parts.push(P('DOOR',1,(w*h)/144,((w+h)*2)/12,'Slab door'));
      G.push({k:'front', p:[0, y+h/2, d/2-0.3], s:[w-0.2, h-0.4, 0.75], m:'front'});
      addPull(G, pull, w/2-3, y+h/2, d/2, 2, h, true);
      if(pull && pull.id!=='none') parts.push({code:'PULL',qty:1,note:`1 × ${pull.name}`});
    }
  },
  GLASS_DOOR: {
    label:'Glass door', hint:'Framed glass front. The frame ships without the glass — glass is sourced locally.',
    spec:'Framed glass front · 12\"–84\" tall',
    icon:'M3 2h18v28H3zM6 5h12v22H6zM18 15h2',
    defH:48, minH:12, maxH:84, fill:true,
    build(c){
      const {w,d,y,h,G,parts,pull} = c;
      parts.push(P('DOOR',1,(w*h)/144*0.35,((w+h)*2)/12,'Glass door frame'));
      parts.push({code:'GLASS_LITE',qty:1,w:w-4,h:h-4,note:'Glass lite — supplied locally'});
      const t=1.6;
      G.push({k:'front', p:[0, y+t/2, d/2-0.3], s:[w-0.2,t,0.75], m:'front'});
      G.push({k:'front', p:[0, y+h-t/2, d/2-0.3], s:[w-0.2,t,0.75], m:'front'});
      G.push({k:'front', p:[-w/2+t/2, y+h/2, d/2-0.3], s:[t,h,0.75], m:'front'});
      G.push({k:'front', p:[ w/2-t/2, y+h/2, d/2-0.3], s:[t,h,0.75], m:'front'});
      G.push({k:'glass', p:[0, y+h/2, d/2-0.3], s:[w-t*2-0.4, h-t*2-0.4, 0.2], m:'glass'});
      addPull(G, pull, w/2-3, y+h/2, d/2, 2, h, true);
      if(pull && pull.id!=='none') parts.push({code:'PULL',qty:1,note:`1 × ${pull.name}`});
    }
  },
  OPEN: {
    label:'Leave open', hint:'Empty space. Long coats, a laundry basket, a step stool.',
    spec:'Empty space · 6\"–84\" tall',
    icon:'M3 2h18v28H3z',
    defH:30, minH:6, maxH:84, fill:true,
    build(){}
  }
};
export const MODULE_IDS = Object.keys(MODULES);

const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* a rail of individual garments */
function hang(G, cx, rodY, len, w, d){
  const usable = w - 2.5, pitch = 2.6;
  const n = Math.max(3, Math.floor(usable/pitch)), step = usable/n;
  for(let i=0;i<n;i++){
    const j = ((i*37)%11)/11;
    const L = len * (0.84 + j*0.16);
    G.push({k:'cloth', p:[cx - usable/2 + step*(i+0.5), rodY-2.2-L/2, 0],
            s:[step*0.8, L, Math.min(d-8, 12+j*3)], m:'cloth'});
  }
}

/* draw the chosen pull onto a front */
function addPull(G, pull, cx, cy, faceZ, w, h, vertical){
  if(!pull || pull.id==='none') return;
  const z = faceZ + 0.6;
  if(pull.kind==='knob'){ G.push({k:'pull', p:[cx, cy, z], s:[1.2,1.2,1.2], m:'pullmat'}); return; }
  if(pull.kind==='edge'){ G.push({k:'pull', p:[cx, cy + h/2 - 0.5, faceZ+0.1], s:[w*0.9, 0.7, 0.5], m:'pullmat'}); return; }
  if(pull.kind==='cup'){ G.push({k:'pull', p:[cx, cy, z], s:[Math.min(w*0.4,3.2), 1.1, 1.0], m:'pullmat'}); return; }
  const L = Math.min(pull.len || 4, (vertical?h:w) * 0.8);
  G.push({k:'pull', p:[cx, cy, z], s: vertical ? [0.6, L, 0.6] : [L, 0.6, 0.6], m:'pullmat'});
}

/* ============================================================
   BUILD — runs → bays → stacks → geometry + order list
   ============================================================ */
export function makeBay(width, stack){
  /* A new bay is EMPTY on purpose. The old default dropped a double-hang into
     every bay, which meant the customer was handed a finished closet and asked
     to nudge it. They are supposed to build it. */
  return { w: width, stack: stack || [] };
}
export function defaultStackFor(type){
  return ({
    'reach-in':[{m:'DOUBLE_HANG',h:null,o:{}}],
    'walk-in' :[{m:'DOUBLE_HANG',h:null,o:{}}],
    'pantry'  :[{m:'SHELVES',h:null,o:{n:6}}],
    'garage'  :[{m:'SHELVES',h:null,o:{n:4}}],
    'laundry' :[{m:'SHELVES',h:null,o:{n:3}}],
  }[type]) || [{m:'DOUBLE_HANG',h:null,o:{}}];
}

/* resolve module heights inside one bay: fixed ones keep their height,
   `fill` ones share whatever is left */
function resolveHeights(stack, total){
  const mods = stack.map(s=>({...s, def:MODULES[s.m]}));
  let used = 0; const fillers = [];
  for(const s of mods){
    if(s.h != null){ s.H = clamp(s.h, s.def.minH, s.def.maxH); used += s.H; }
    else if(s.def.fill){ fillers.push(s); }
    else { s.H = s.def.defH; used += s.H; }
  }
  const left = Math.max(0, total - used);
  if(fillers.length){
    /* Give each filler its minimum first, then share whatever is genuinely
       spare. Clamping a slice back up to minH — which is what this used to do
       — invented height that the bay does not have. */
    const floor = fillers.reduce((a,s) => a + s.def.minH, 0);
    const spare = Math.max(0, left - floor);
    const bonus = spare / fillers.length;
    fillers.forEach(s => s.H = Math.min(s.def.maxH, s.def.minH + bonus));
  }
  return mods;
}

export function buildDesign(cfg, cat){
  const parts = [], G = [], warnings = [];
  const floorY = cfg.mounting==='wall' ? SPEC.wallHungBase : SPEC.toeKick;
  const bayTop = Math.min(SPEC.topShelf, cfg.room.h - 6);
  const usableH = bayTop - floorY;
  const pull = PULLS.find(p=>p.id===cfg.pull) || PULLS[1];
  const pullFin = PULL_FINISHES.find(f=>f.id===cfg.pullFinish) || PULL_FINISHES[0];

  const bayIndex = [];     // flat list so the UI can address every bay

  for(const run of cfg.runs){
    if(!run.bays.length) continue;
    const depth = run.depth;
    const code = cfg.mounting==='wall' ? 'VP_WALL' : 'VP_FLOOR';
    const panelH = bayTop - floorY + SPEC.panel;
    let x = 0;
    const local = [];

    run.bays.forEach((bay,bi)=>{
      if(bay.w < SPEC.bayMin) warnings.push(`A bay on the ${run.wall} wall is ${bay.w.toFixed(0)}" — under the ${SPEC.bayMin}" minimum.`);
      if(bay.w > SPEC.bayMax) warnings.push(`A bay on the ${run.wall} wall is ${bay.w.toFixed(0)}" — past ${SPEC.bayMax}" a ¾" shelf sags.`);

      // left panel of this bay
      parts.push(P(code,1,(panelH*depth)/144,(panelH+depth)/12,`Partition ${bi+1} — ${run.wall}`));
      local.push({k:'panel', p:[x, floorY+panelH/2, 0], s:[SPEC.panel,panelH,depth], m:'carcass'});

      const inner = bay.w - SPEC.panel;
      const cx = x + bay.w/2;

      // top shelf over every bay
      parts.push(P('TOP',1,(inner*depth)/144,(inner+depth*2)/12,'Top shelf at 84"'));
      local.push({k:'shelf', p:[cx, bayTop, 0], s:[inner, SPEC.panel, depth], m:'carcass'});

      // the stack
      const mods = resolveHeights(bay.stack, usableH);
      let y = floorY;
      for(const s of mods){
        const sub = [];
        MODULES[s.m].build({ w:inner, d:depth, y:0, h:s.H, G:sub, parts, o:s.o||{}, pull,
                              warn: m => warnings.push(m) });
        for(const g of sub) local.push({...g, p:[cx + g.p[0], y + g.p[1], g.p[2]]});
        y += s.H;
      }
      bayIndex.push({ wall:run.wall, bay:bi, x:cx, w:bay.w, h:usableH, depth, stack:bay.stack });
      x += bay.w;
    });

    // closing panel, cleat, toe kick
    parts.push(P(code,1,(panelH*depth)/144,(panelH+depth)/12,`End panel — ${run.wall}`));
    local.push({k:'panel', p:[x, floorY+panelH/2, 0], s:[SPEC.panel,panelH,depth], m:'carcass'});
    parts.push(P('CLEAT',1,(x*4)/144,x/12,`Hang cleat — ${run.wall}`));
    if(cfg.mounting!=='wall'){
      parts.push(P('TK',1,(x*SPEC.toeKick)/144,x/12,`Toe kick — ${run.wall}`));
      local.push({k:'toe', p:[x/2, SPEC.toeKick/2, -1.5], s:[x, SPEC.toeKick, depth-3], m:'carcass'});
    }
    run.width = x;
    for(const g of local) G.push(place(g, run, cfg.room));
  }

  const F  = cat.finishes.find(f=>f.n===cfg.finish)       || cat.finishes[0];
  const DF = cat.finishes.find(f=>f.n===cfg.frontFinish)  || F;
  const price = priceParts(parts, cat, F, DF, pull, pullFin);
  return { parts, geo:G, price, finish:F, frontFinish:DF, pull, pullFinish:pullFin,
           bays:bayIndex, warnings:[...new Set(warnings)], order:orderList(parts, cat, F, DF, pull, pullFin) };
}

function place(g, run, room){
  const [lx,y,lz]=g.p, [sx,sy,sz]=g.s, off=run.start||0, dep=run.depth;
  switch(run.wall){
    case 'left':   return {...g, p:[ dep/2 + lz, y, off + lx ], s:[sz,sy,sx]};
    case 'right':  return {...g, p:[ room.w - dep/2 - lz, y, off + lx ], s:[sz,sy,sx]};
    case 'island': return {...g, p:[ off + lx, y, room.d/2 + lz ], s:[sx,sy,sz]};
    default:       return {...g, p:[ off + lx, y, dep/2 + lz ], s:[sx,sy,sz]};
  }
}

/* ---------- price engine (his real formula) ---------- */
export function priceParts(parts, cat, F, DF, pull, pullFin){
  let cost = 0; const lines = [];
  for(const p of parts){
    let c = 0, label = p.note || p.code;
    if(p.code === 'DRAWER'){
      const box = pickBox(cat,p.w,p.h,p.d), gl = pickGlide(cat,p.d);
      const front = (p.w*p.h)/144 * DF.sq + ((p.w+p.h)*2)/12 * DF.eb;
      c = (box.p + gl.p*2 + front) * p.qty;
      label = `${p.qty} × drawer ${p.h.toFixed(1)}" — box ${box.p.toFixed(2)}, glides ${(gl.p*2).toFixed(2)}, front ${front.toFixed(2)}`;
    }
    else if(p.code === 'PULL'){ c = pull.cost * pullFin.mult * p.qty; label = p.note + ` (${pullFin.name})`; }
    else if(p.code === 'HANGROD'){ c = 9.0 * p.qty; label = p.note; }
    else if(p.code === 'BASKET'){ const b = pickBasket(cat,p.w); c = b.p * p.qty; label = `${p.qty} × basket ${b.w}×${b.d}`; }
    else if(p.code === 'GLASS_LITE'){ c = (p.w*p.h)/144 * 14.0; label = p.note + ' — local glazier, estimate'; }
    else {
      const def = cat.parts[p.code]; if(!def) continue;
      const base = (p.sqft||0) * (F.sq + def.sqft) + (p.edge||0) * F.eb + def.add;
      c = Math.max(base, def.min) * (1 + def.pct) + def.hw;
      c *= (p.qty && p.sqft ? 1 : (p.qty || 1));
    }
    cost += c; lines.push({label, cost:+c.toFixed(2)});
  }
  const markup = cat.meta.markup;
  return { cost:+cost.toFixed(2), price:+(cost*markup).toFixed(2), markup, lines };
}

/* ---------- the order list that goes to the back end ---------- */
function orderList(parts, cat, F, DF, pull, pullFin){
  const group = new Map();
  for(const p of parts){
    const def = cat.parts[p.code];
    const name = p.code==='DRAWER' ? `Drawer box + glides (${p.h?.toFixed(1)}"H × ${p.w?.toFixed(1)}"W)`
      : p.code==='PULL' ? `${pull.name} — ${pullFin.name}`
      : p.code==='BASKET' ? 'Pull-out / tilt basket'
      : p.code==='HANGROD' ? 'Hang rod'
      : p.code==='GLASS_LITE' ? `Glass lite ${p.w?.toFixed(1)}" × ${p.h?.toFixed(1)}"`
      : (def?.n || p.code);
    const finish = (p.code==='DRAWER'||p.code==='DOOR') ? DF.n
      : (p.code==='PULL'||p.code==='BASKET'||p.code==='HANGROD'||p.code==='GLASS_LITE') ? '—' : F.n;
    const key = name+'|'+finish;
    const g = group.get(key) || { item:name, finish, qty:0, sqft:0, edge_ft:0, notes:new Set() };
    g.qty += p.qty || 1;
    g.sqft += p.sqft || 0;
    g.edge_ft += p.edge || 0;
    if(p.note) g.notes.add(p.note);
    group.set(key,g);
  }
  return [...group.values()].map(g=>({
    item:g.item, finish:g.finish, qty:Math.round(g.qty),
    sq_ft:+g.sqft.toFixed(2), edgeband_ft:+g.edge_ft.toFixed(2),
    detail:[...g.notes].slice(0,3).join('; ')
  })).sort((a,b)=>a.item.localeCompare(b.item));
}

function pickBox(cat,w,h,d){
  const fit = cat.boxes.filter(b=>b.w>=w-0.5 && b.h>=h-0.5 && b.d>=d-0.5);
  return fit.length ? fit.reduce((a,b)=>b.p<a.p?b:a) : cat.boxes.reduce((a,b)=>b.p>a.p?b:a);
}
function pickGlide(cat,d){
  const fit = cat.glides.filter(g=>g.l>=d-2);
  return fit.length ? fit.reduce((a,b)=>b.l<a.l?b:a) : cat.glides.reduce((a,b)=>b.l>a.l?b:a);
}
function pickBasket(cat,w){
  const h = cat.baskets.filter(b=>b.w<=w);
  return (h.length?h:cat.baskets).reduce((a,b)=>b.w>a.w?b:a);
}

/* small helper so the admin calculator can price one bay quickly */
export function quickPrice(width, depth, moduleId, finish, cat){
  const n = Math.max(1, Math.round(width / 30));
  const bays = Array.from({length:n}, ()=> makeBay(width/n, [{m:moduleId,h:null,o:{}}]));
  return buildDesign({ room:{w:width,d:depth,h:96}, mounting:'floor', finish, frontFinish:finish,
    pull:'bar4', pullFinish:'nickel',
    runs:[{wall:'back',start:0,depth,bays}] }, cat);
}
