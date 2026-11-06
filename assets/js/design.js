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
  shoeGap:8, toeKick:3.75, panel:0.75, pin:1.25, counter:36, wallHungBase:6
};

/* ══════════════════════════════════════════════════════════════════════
   DOORS AND WALL FITTINGS AS REAL BUILD CONSTRAINTS

   These used to be notes that rode along to the job sheet and changed nothing.
   A closet does not work that way. Baseboard heat means the run cannot sit on
   the floor. A 34" window sill means the partitions beside it stop at 34". A
   bypass track eats two and a half inches of the depth you had to play with,
   and a bi-fold's leaves stack over the first five inches of each end, which
   is where a drawer front would be.

   Everything below is a dimension an installer measures on site, and each one
   feeds straight into the geometry and therefore into the price: shorter
   partitions are fewer square feet of melamine, a shallower run is a smaller
   top shelf, a blocked end needs a scribe filler. No invented prices — the
   quantities change and his own rates do the rest.
   ══════════════════════════════════════════════════════════════════════ */

export const DOOR_SPEC = {
  'none':    { track:0,   sideBlock:0, pullClear:0,
    note:'Nothing in front of the run, so the full room depth is usable.' },
  'swing-r': { track:0,   sideBlock:1.5, pullClear:0, hinge:'right',
    note:'Hinged right. The jamb shadows about 1½" at that end.' },
  'swing-l': { track:0,   sideBlock:1.5, pullClear:0, hinge:'left',
    note:'Hinged left. The jamb shadows about 1½" at that end.' },
  'double':  { track:0,   sideBlock:1.5, pullClear:0,
    note:'Two leaves. A jamb at each end, about 1½" each.' },
  'bypass':  { track:2.5, sideBlock:0,   pullClear:2.5, half:true,
    note:'The track and the outer leaf take 2½" of depth, and only half the opening is ever open.' },
  'bifold':  { track:1.5, sideBlock:5,   pullClear:3,
    note:'The leaves fold back over about 5" at each end and need 3" clear in front of a drawer.' },
  'barn':    { track:0,   sideBlock:0,   pullClear:1.5, outside:true,
    note:'Rides on a rail outside the opening, so nothing is lost inside.' },
  'pocket':  { track:0,   sideBlock:0,   pullClear:0,
    note:'Slides into the wall. Nothing projects into the room.' }
};

/* Each fitting carries the dimensions an installer would write on the
   measure sheet. `w` is how wide it is along the wall, and the rule says what
   that does to the cabinetry. Defaults are the common real sizes; the customer
   can change any of them. */
export const FIT_SPEC = {
  outlet: { w:4,  rule:'keepClear',  label:'Outlet',
    note:'The back of that section stays open so you can still reach the socket.',
    ask:'Roughly how high off the floor, and does anything need to plug into it?' },
  switch: { w:4,  rule:'keepClear',  label:'Light switch',
    note:'Nothing solid goes in front of it, so it still works with the closet in.',
    ask:'Inside the closet or beside the door? Roughly how high?' },
  /* A vent in the floor and a vent on the wall are two different jobs. The
     toe-kick grille only makes sense for a floor vent — saying it about a wall
     vent, which is what this used to do, is nonsense to anyone who has ever
     seen one. */
  vent:   { w:14, rule:'keepClear', spot:'wall', label:'HVAC vent',
    note:'On the wall, so that section stays open at the back and the air still moves.',
    noteFloor:'In the floor under the run, so that length of toe kick is cut for a grille.',
    ask:'High on the wall, low down, or in the floor? Does it blow into the closet?' },
  heater: { w:48, top:9, rule:'baseLift', label:'Baseboard heater',
    note:'Nothing sits on the floor over baseboard heat. The run goes wall hung, clear of the element, and the toe kick comes off.',
    ask:'How long is the heater, and does it run the whole wall or part of it?' },
  column: { w:6,  rule:'stealWidth', label:'Column',
    note:'Takes its width straight off the wall. The run stops at it.',
    ask:'Which corner is it in, and is it square or boxed out?' },
  slope:  { w:24, cap:60, rule:'capHeight', label:'Sloped ceiling',
    note:'Caps the partitions under it at the low point of the slope.',
    ask:'How low does it get at the lowest point, and which end of the wall?' },
  window: { w:36, cap:34, rule:'capHeight', label:'Window',
    note:'The run under it stops at the sill so the glass stays clear.',
    ask:'How wide is it, how high is the sill, and do you want the run to pass under it?' },
  pipe:   { w:6,  depth:4, rule:'stealDepth', label:'Pipe / bulkhead',
    note:'Pushes the run forward by its own depth where it passes.',
    ask:'Floor to ceiling, or a boxed bulkhead across the top? How far does it stick out?' }
};

/* clearance between a baseboard heater element and anything above it */
const HEATER_CLEAR = 2;

/* The fitting's own fields win over the defaults, so a vent the customer says
   is in the floor carries rule:'floorClear' and one on the wall carries
   rule:'keepClear'. */
const fitSpec = f => ({ ...FIT_SPEC[f.k], ...f });
const fitsOn  = (fittings, wall, rule) =>
  (fittings||[]).filter(f => FIT_SPEC[f.k] && f.wall === wall && fitSpec(f).rule === rule);

/* inches this wall loses to columns and the like, before any bay is laid out */
export function wallLoss(fittings, wall){
  return fitsOn(fittings, wall, 'stealWidth').reduce((a,f) => a + (fitSpec(f).w || 0), 0);
}

/* the deepest a run on this wall can be, given the door and any bulkhead */
export function depthLimit(room, wall, door, fittings){
  const D = DOOR_SPEC[door] || DOOR_SPEC.none;
  const span = wall === 'back' ? room.d : room.w;
  const pipe = fitsOn(fittings, wall, 'stealDepth')
    .reduce((a,f) => Math.max(a, fitSpec(f).depth || 0), 0);
  /* The door hardware and the clearance a drawer front needs to pass it both
     come off the depth available on the wall facing the door. */
  const doorCost = wall === 'back' ? (D.track || 0) + (D.pullClear || 0) : 0;
  return Math.max(SPEC.shelfDepth, span - doorCost - pipe);
}

/* where the bottom of the run has to start, in inches off the floor */
export function baseHeight(mounting, fittings){
  const heat = (fittings||[]).filter(f => f.k === 'heater')
    .reduce((a,f) => Math.max(a, (fitSpec(f).top || 0) + HEATER_CLEAR), 0);
  const base = mounting === 'wall' ? SPEC.wallHungBase : SPEC.toeKick;
  return heat ? Math.max(base, heat) : base;
}

/* the ceiling this bay has, given anything that caps it. `a`..`b` is the bay's
   span in inches along its own wall, measured from the wall's left end. */
export function bayCeiling(fittings, wall, a, b, bayTop){
  let top = bayTop;
  for(const f of fitsOn(fittings, wall, 'capHeight')){
    const sp = fitSpec(f), x0 = sp.at || 0, x1 = x0 + (sp.w || 0);
    const over = Math.min(b, x1) - Math.max(a, x0);
    if(over <= 0) continue;                                    // no overlap, no cap
    /* A window clipping the last two inches of a section is not a reason to
       cut that whole section down to the sill: you scribe the shelf to the
       casing and carry on. It only governs the section once it is genuinely
       in the way, which is a quarter of the section's width or six inches,
       whichever is less. Anything smaller is reported by buildDesign instead
       of silently costing the customer two feet of hanging space. */
    if(over < Math.min(6, (b - a) * 0.25)) continue;
    top = Math.min(top, sp.cap || bayTop);
  }
  return Math.max(SPEC.panel * 2 + 12, top);
}

/* the capHeight fittings this bay only clips, which get scribed rather than
   governing the whole section */
export function bayClips(fittings, wall, a, b){
  const out = [];
  for(const f of fitsOn(fittings, wall, 'capHeight')){
    const sp = fitSpec(f), x0 = sp.at || 0, x1 = x0 + (sp.w || 0);
    const over = Math.min(b, x1) - Math.max(a, x0);
    if(over > 0 && over < Math.min(6, (b - a) * 0.25)) out.push({ sp, over });
  }
  return out;
}

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

/* The basket tables stock Chrome, Matte Black and Satin Nickel. Follow the
   handle finish so the metal in one bay matches. */
const BASKET_FINISH = { nickel:'Satin Nickel', black:'Matte Black', brass:'Chrome' };

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
  LONG_HANG:1, DOUBLE_HANG:1, SHORT_HANG:1, DOOR:1, GLASS_DOOR:1, HAMPER:1, COUNTER:2,
  DRAWERS:2, BASKETS:2, SHOES:2, SHOE_SLANT:2, SHELVES:3, CUBBIES:2, OPEN:2
};
const GROUP = { DOOR:'front', GLASS_DOOR:'front' };

/* ══════════════════════════════════════════════════════════════════════
   WHAT CAN GO WITH WHAT

   Every rule below is a real constraint from building these, not a UI
   preference. Before this, the picker would let you put a tilt-out hamper
   and a bank of pull-out baskets in the same 24" section, or three fillers
   in one bay, and then quietly build something that cannot exist.
   ══════════════════════════════════════════════════════════════════════ */

/* A module that fills whatever height is left. Two of them in one section
   means neither is the height it is supposed to be, so: one. */
const FILLS = id => !!MODULES[id]?.fill;

/* Pull-out hardware that needs the front of the section to itself while it
   is open. A tilt-out hamper swings its whole front DOWN and OUT, straight
   through the path a basket above it would pull along. */
const PULLS_OUT = new Set(['HAMPER','BASKETS','DRAWERS']);

/* Pairs that genuinely cannot share one section, with the reason. */
const CLASH = [
  { a:'HAMPER', b:'BASKETS',
    why:'A tilt-out hamper swings its front down and out, straight through where a pull-out basket would slide. One or the other in a section, not both.' },
  { a:'COUNTER', b:'HAMPER',
    why:'A counter top is a fixed work surface and a hamper has to tilt out from under it. They need separate sections.' },
];

/* Modules with a front that opens: a drawer pulls out, a door swings. Put
   one of these in the section at an inside corner and it opens straight into
   the run returning along the next wall. This is the reason closet companies
   put shelving in a corner, never drawers. */
export const OPENING_FRONT = new Set(['DRAWERS','DOOR','GLASS_DOOR','HAMPER','BASKETS']);

/* Is this section the one sitting in an inside corner? A run on a side wall
   starts clear of the back run's depth, so the back run's FIRST section is
   the one the side run returns across. */
export function cornerBlocked(cfg, wall, bayIndex, bayStart, bayWidth){
  if(!cfg || !cfg.runs) return null;
  const on = w => cfg.runs.some(r => r.wall === w && r.bays.length);
  const dep = cfg.runs.find(r => r.wall === wall)?.depth || SPEC.hangDepth;
  if(wall === 'back'){
    if(on('left')  && bayStart < dep - 0.01)  return 'left';
    const backW = cfg.room.w;
    if(on('right') && bayStart + bayWidth > backW - dep + 0.01) return 'right';
  }
  return null;
}

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

  /* one filler per section */
  if(FILLS(id) && stack.some(st => FILLS(st.m)))
    return { ok:false, why:`This section already has ${MODULES[stack.find(st=>FILLS(st.m)).m].label.toLowerCase()} filling the space left. Take that out first, or pick a part with a fixed height.` };

  /* pairs that cannot physically share a section */
  for(const c of CLASH){
    if((id===c.a && stack.some(st=>st.m===c.b)) || (id===c.b && stack.some(st=>st.m===c.a)))
      return { ok:false, why:c.why };
  }

  /* a section is not a chest of drawers with a hamper in it as well */
  if(PULLS_OUT.has(id) && stack.filter(st => PULLS_OUT.has(st.m)).length >= 2)
    return { ok:false, why:'Two runs of pull-out hardware is already as much as one section takes. A third would leave nothing to hang or fold on.' };

  const need = stack.reduce((a,s) => a + MODULES[s.m].minH, 0) + def.minH;
  if(need > usableH + 0.5)
    return { ok:false, why:`No room left. That needs ${def.minH}" and only ${Math.max(0, usableH - (need - def.minH)).toFixed(0)}" is free.` };

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
  /* A hamper is 28" tall and a closet is 80" of usable height, which leaves
     52" over it. A long hang needs 62" and a double hang needs 70", so
     neither of them fits — which is why "hamper + hanging" could not be built
     and was being drawn hanging through the top shelf. A short hang is the
     real product for that gap: one rod, 38" to 52" of clear drop, shirts and
     folded trousers. Closet companies sell it as its own thing. */
  SHORT_HANG: {
    label:'Short hang', hint:'One rod over something else. Shirts, jackets, folded trousers.',
    spec:'One rod · 38"–54" of drop',
    icon:'M2 5h20M6 9h12M7 9v8M11 9v9M15 9v8M19 9v9',
    defH:46, minH:38, maxH:54, fill:true,
    build(c){
      const {w,d,y,h,G,parts} = c;
      parts.push(P('HANGROD',1,0,0,'Hang rod'));
      G.push({k:'rod', p:[0, y+h-5, 0], s:[w-1,1.4,1.4], m:'metal'});
      hang(G, 0, y+h-5, Math.min(h-9, 34), w, d);
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

      if(!boxW) warn && warn(`A ${w.toFixed(0)}" bay is too narrow for a drawer box. The smallest he stocks is ${DRAWER_BOX.w[0]}" and needs a ${(DRAWER_BOX.w[0]+1).toFixed(0)}" opening.`);
      if(!boxH) warn && warn(`${n} drawers across ${h.toFixed(0)}" gives ${fh.toFixed(1)}" fronts, too short for the ${DRAWER_BOX.h[0]}" box, the shallowest he stocks. Use fewer drawers.`);

      parts.push({code:'DRAWER',qty:n,w,h:fh,d:Math.min(d-2,20),style:c.boxStyle,
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
      parts.push({code:'HAMPER_BASKET',qty:1,w,d,finish:c.basketFinish,note:'Tilt-out hamper basket'});
      /* It was a flat slab with a pull on it, indistinguishable from a door.
         A tilt-out is drawn tilted: the front pivots at its bottom edge and
         leans out, and the wire basket it carries is visible behind it. */
      const TILT = 0.22;                                   // about 13 degrees
      G.push({k:'front', p:[0, y+h/2, d/2 - 0.4 + Math.sin(TILT)*h*0.18],
              s:[w-0.2, h-1, 0.8], m:'front', tilt:-TILT});
      addPull(G, pull, 0, y + h*0.78, d/2 + Math.sin(TILT)*h*0.18, w, h);
      /* the wire basket inside it */
      const HW_ = 0.22, hw = w - 3, hd = d - 5;
      const hb = y + 2.5, ht = y + h - 3;
      const bar = (px,py,pz,sx,sy,sz) => G.push({k:'wire', p:[px,py,pz], s:[sx,sy,sz], m:'metal'});
      const fN = Math.max(4, Math.round(hw/2.4));
      for(let k=0;k<fN;k++) bar(-hw/2 + (hw/(fN-1))*k, hb, -1, HW_, HW_, hd);
      bar(0, ht, -hd/2-1, hw, HW_*1.5, HW_*1.5);
      bar(0, ht,  hd/2-1, hw, HW_*1.5, HW_*1.5);
      for(const sx of [-1,1]) bar(sx*(hw/2), (hb+ht)/2, -1, HW_*1.4, ht-hb, HW_*1.4);
      const vN2 = Math.max(5, Math.round(hw/2.6));
      for(let k=1;k<vN2;k++){
        const px = -hw/2 + (hw/vN2)*k;
        bar(px, (hb+ht)/2, -hd/2-1, HW_, ht-hb, HW_);
        bar(px, (hb+ht)/2,  hd/2-1, HW_, ht-hb, HW_);
      }
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
      parts.push({code:'BASKET',qty:n,w,d,bh:h/n,finish:c.basketFinish,note:`${n} pull-out baskets`});
      /* A chrome wire basket was being drawn as one solid metal block, which
         read as a painted drawer rather than the wire basket it is. It is now
         built the way the real thing is: a wire floor, a perimeter rail top
         and bottom, corner posts, and vertical wires down the front and sides.
         At card size that reads as wire; close up it reads as the product. */
      const BW = 0.22;                       // wire diameter, about 5.5mm
      const bw = w - 2, bd = d - 3;          // basket inside the opening
      for(let i=0;i<n;i++){
        const bh = h/n, cy = y + bh*i, top = cy + bh - 1.2, bot = cy + 0.8;
        const rail = (px,py,pz,sx,sy,sz) => G.push({k:'wire', p:[px,py,pz], s:[sx,sy,sz], m:'metal'});
        // floor: a grid of wires running front to back
        const floorN = Math.max(4, Math.round(bw/2.2));
        for(let k=0;k<floorN;k++)
          rail(-bw/2 + (bw/(floorN-1))*k, bot, 0, BW, BW, bd);
        rail(0, bot, -bd/2+BW, bw, BW, BW);  rail(0, bot, bd/2-BW, bw, BW, BW);
        // top rail, all four sides
        rail(0, top, -bd/2+BW, bw, BW*1.4, BW*1.4);
        rail(0, top,  bd/2-BW, bw, BW*1.4, BW*1.4);
        rail(-bw/2+BW, top, 0, BW*1.4, BW*1.4, bd);
        rail( bw/2-BW, top, 0, BW*1.4, BW*1.4, bd);
        // corner posts
        for(const sx of [-1,1]) for(const sz of [-1,1])
          rail(sx*(bw/2-BW), (bot+top)/2, sz*(bd/2-BW), BW*1.3, top-bot, BW*1.3);
        // vertical wires: front and back faces, then the two ends
        const vN = Math.max(5, Math.round(bw/2.4));
        for(let k=1;k<vN;k++){
          const px = -bw/2 + (bw/vN)*k;
          rail(px, (bot+top)/2, -bd/2+BW, BW, top-bot, BW);
          rail(px, (bot+top)/2,  bd/2-BW, BW, top-bot, BW);
        }
        const eN = Math.max(3, Math.round(bd/3));
        for(let k=1;k<eN;k++){
          const pz = -bd/2 + (bd/eN)*k;
          rail(-bw/2+BW, (bot+top)/2, pz, BW, top-bot, BW);
          rail( bw/2-BW, (bot+top)/2, pz, BW, top-bot, BW);
        }
        // the full-extension runner the basket rides on
        for(const sx of [-1,1])
          G.push({k:'glide', p:[sx*(w/2-0.5), cy + 1.6, 0], s:[0.5, 0.9, d-2], m:'metal'});
      }
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
      /* The grid had no lid, so the top row of cubbies opened straight into
         whatever was above it and the block read as unfinished. A cubby grid
         is a box: it gets a top. */
      G.push({k:'shelf', p:[0, y + h + SPEC.panel/2, 0], s:[w, SPEC.panel, d], m:'carcass'});
      parts.push(P('FIXED', 1, (w*d)/144, (w + d*2)/12, 'Fixed top over the cubby grid'));
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
    label:'Glass door', hint:'Framed glass front. The frame ships without the glass, which is sourced locally.',
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
/* ---- LAYOUT PRESETS ------------------------------------------------------
   A customer does not think in "modules". They think "I want a drawer tower
   there". Handing them thirteen raw parts and asking them to assemble
   cabinetry is a parts bin, not a configurator.

   Each preset is a named, recognisable configuration that expands into a
   real stack. The component list stays underneath for anyone who wants to
   build from scratch — this is a starting point, not a cage. */
export const PRESETS = [
  { id:'double-hang', name:'Double Hanging',   img:'double-hang',
    desc:'Two rods: shirts up top, trousers below. The most storage per foot.',
    stack:[{m:'DOUBLE_HANG',h:null,o:{}}] },

  { id:'double-open', name:'Double Hanging, Open Top', img:'double-hang', art:'double-open', top:false,
    desc:'The same two rods, run clear to the top with no shelf capping it. Taller hanging, nothing sitting above your head.',
    stack:[{m:'DOUBLE_HANG',h:null,o:{}}] },

  { id:'long-hang',   name:'Long Hanging',     img:'long-hang',
    desc:'One full-height rod for dresses and coats.',
    stack:[{m:'LONG_HANG',h:null,o:{}}] },

  { id:'hang-shelf',  name:'Hanging + Shelves', img:'shelves', art:'hang-shelf',
    desc:'A rod below, folded storage above.',
    stack:[{m:'LONG_HANG',h:null,o:{}},{m:'SHELVES',h:18,o:{n:2}}] },

  { id:'shelves',     name:'Adjustable Shelves', img:'shelves',
    desc:'Six shelves on 32mm centres. Move any of them later.',
    stack:[{m:'SHELVES',h:null,o:{n:6}}] },

  { id:'drawer-tower',name:'Drawer Tower',     img:'drawers', art:'drawer-tower',
    desc:'A bank of soft-close drawers with shelving over it.',
    stack:[{m:'DRAWERS',h:34,o:{n:4}},{m:'SHELVES',h:null,o:{n:3}}] },

  /* A double hang needs 70" of its own, so over a 34" drawer bank it asked
     for 104" in an 80" section and was drawn hanging through the top shelf.
     Drawers under a short hang is what this actually is, and what gets built. */
  { id:'hang-drawers',name:'Hanging + Drawers', img:'drawers', art:'hang-drawers',
    desc:'Drawers at the bottom, a hanging rod above. The usual bedroom answer.',
    stack:[{m:'DRAWERS',h:34,o:{n:4}},{m:'SHORT_HANG',h:null,o:{}}] },

  { id:'baskets',     name:'Pull-Out Baskets',  img:'baskets', art:'basket-shelf',
    desc:'Chrome wire on full-extension glides, shelving above.',
    stack:[{m:'BASKETS',h:30,o:{n:3}},{m:'SHELVES',h:null,o:{n:3}}] },

  { id:'shoe-wall',   name:'Shoe Wall',         img:'shoe-slant',
    desc:'Angled shoe shelving the full height of the section.',
    stack:[{m:'SHOE_SLANT',h:null,o:{}}] },

  { id:'hamper',      name:'Hamper + Hanging',  img:'hamper', art:'hamper-hang',
    desc:'Tilt-out laundry hamper with a hanging rod over it. The rod is a short hang, because a hamper takes the bottom 28".',
    stack:[{m:'HAMPER',h:28,o:{}},{m:'SHORT_HANG',h:null,o:{}}] },

  { id:'hamper-shelf', name:'Hamper + Shelves',  img:'hamper',
    desc:'The same tilt-out hamper with folded storage above it instead of hanging.',
    stack:[{m:'HAMPER',h:28,o:{}},{m:'SHELVES',h:null,o:{n:4}}] },

  { id:'cubbies',     name:'Cubbies',           img:'cubbies',
    desc:'A grid of open compartments for bags, hats and folded knits.',
    stack:[{m:'CUBBIES',h:null,o:{n:4}}] },
];

/* the price difference a preset makes, against the cheapest one, so the
   list can read "Incl." / "+$85" the way a customer expects */
/* The open-top variant builds no top shelf, so it is genuinely cheaper. The
   card used to quote both at the same number because this only looked at the
   stack. */
/* Does this ready-made layout physically fit the section it is being offered
   for? Single parts were already checked by canAdd; the ready-made ones were
   not, so one could be clicked into a section too short to hold it. */
export function presetFits(preset, usableH){
  const need = preset.stack.reduce((a,x) => a + (x.h ?? MODULES[x.m].minH), 0);
  return { ok: need <= usableH + 0.5, need };
}

export function presetDelta(preset, bayW, usableH, cat, finish){
  try{
    const mk = (st, top) => buildDesign({ room:{w:bayW+1.5,d:24,h:96}, mounting:'floor',
      finish, frontFinish:finish, pull:'bar4', pullFinish:'nickel',
      runs:[{wall:'back',start:0,depth:24,bays:[{w:bayW,stack:structuredClone(st),top}]}] }, cat).price.price;
    return mk(preset.stack, preset.top !== false);
  }catch(e){ return null; }
}

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
export function makeBay(width, stack, top){
  /* A new bay is EMPTY on purpose. The old default dropped a double-hang into
     every bay, which meant the customer was handed a finished closet and asked
     to nudge it. They are supposed to build it. */
  return { w: width, stack: stack || [], top: top !== false };
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
       spare. The old version still invented height: with nothing spare it
       handed every filler its FULL minH, so a double hang (70" minimum) over
       a 28" hamper was drawn 70" tall inside a 52" gap and its garments hung
       straight out through the top shelf. A filler now gets its fair share of
       what is actually there, and `short` records by how much it is under its
       own minimum so buildDesign can say so. */
    const share = left / fillers.length;
    fillers.forEach(s => {
      s.H = Math.max(0, Math.min(s.def.maxH, Math.min(s.def.minH, share)));
      s.short = s.def.minH - s.H;
    });
    /* anything still spare after every filler hit its minimum is shared out */
    const usedByFillers = fillers.reduce((a,s) => a + s.H, 0);
    let spare = Math.max(0, left - usedByFillers);
    if(spare > 0.01){
      const room = fillers.filter(s => s.H < s.def.maxH - 0.01);
      const bonus = spare / (room.length || 1);
      room.forEach(s => { s.H = Math.min(s.def.maxH, s.H + bonus); s.short = Math.max(0, s.def.minH - s.H); });
    }
  }
  return mods;
}

export function buildDesign(cfg, cat){
  const parts = [], G = [], warnings = [];
  const fittings = cfg.fittings || [];
  const door = DOOR_SPEC[cfg.door] ? cfg.door : 'none';
  const DS = DOOR_SPEC[door];
  /* Baseboard heat lifts the whole run off the floor. That is not a note, it
     is the base line every partition is cut from. */
  const floorY = baseHeight(cfg.mounting, fittings);
  const liftedByHeat = floorY > (cfg.mounting==='wall' ? SPEC.wallHungBase : SPEC.toeKick);
  if(liftedByHeat) warnings.push(
    `Baseboard heat on this wall, so the run hangs clear of it: the bottom of the cabinetry starts ${floorY.toFixed(0)}" off the floor and the toe kick is dropped.`);
  const bayTop = Math.min(SPEC.topShelf, cfg.room.h - 6);
  const usableH = bayTop - floorY;
  const pull = PULLS.find(p=>p.id===cfg.pull) || PULLS[1];
  const pullFin = PULL_FINISHES.find(f=>f.id===cfg.pullFinish) || PULL_FINISHES[0];

  const bayIndex = [];     // flat list so the UI can address every bay

  const runLen = w => (w === 'back' ? cfg.room.w : cfg.room.d);

  for(const run of cfg.runs){
    if(!run.bays.length) continue;
    /* The door's hardware and any bulkhead cap how deep this run can be, so a
       bypass track genuinely makes the run 2½" shallower and the melamine
       bill genuinely smaller. */
    const cap = depthLimit(cfg.room, run.wall, door, fittings);
    const depth = Math.min(run.depth, cap);
    if(run.depth > cap + 0.01) warnings.push(
      `${run.wall[0].toUpperCase()+run.wall.slice(1)} wall: ${DOOR_SPEC[door].note} The run is built ${depth.toFixed(0)}" deep instead of ${run.depth.toFixed(0)}".`);
    run.builtDepth = depth;
    const code = cfg.mounting==='wall' ? 'VP_WALL' : 'VP_FLOOR';
    let x = 0;
    const local = [];
    /* The leaves of a bi-fold stack over the first and last few inches of the
       opening. A drawer or a door front behind that cannot be opened. */
    const block = DS.sideBlock || 0;
    const wallEnd = runLen(run.wall);
    let lastTop = bayTop;                 // the closing panel matches its neighbour

    run.bays.forEach((bay,bi)=>{
      if(bay.w < SPEC.bayMin) warnings.push(`A bay on the ${run.wall} wall is ${bay.w.toFixed(0)}", under the ${SPEC.bayMin}" minimum.`);
      if(bay.w > SPEC.bayMax) warnings.push(`A bay on the ${run.wall} wall is ${bay.w.toFixed(0)}". Past ${SPEC.bayMax}" a ¾" shelf sags.`);

      /* Where this bay sits along the wall, and therefore which window, slope,
         outlet or door leaf it has to live with. */
      const a = (run.start || 0) + x, b = a + bay.w;
      const myTop = bayCeiling(fittings, run.wall, a, b, bayTop);
      const panelH = myTop - floorY + SPEC.panel;
      const bayH = myTop - floorY;
      if(myTop < bayTop - 0.01) warnings.push(
        `Section ${bi+1} on the ${run.wall} wall stops at ${myTop.toFixed(0)}" instead of ${bayTop.toFixed(0)}" to clear what is on the wall there.`);
      for(const { sp, over } of bayClips(fittings, run.wall, a, b)) warnings.push(
        `Section ${bi+1} on the ${run.wall} wall clips the ${(sp.label||'').toLowerCase()} by ${over.toFixed(0)}". That is scribed to the casing on site rather than dropping the whole section, so it is built full height.`);

      // left panel of this bay
      parts.push(P(code,1,(panelH*depth)/144,(panelH+depth)/12,`Partition ${bi+1} — ${run.wall}`));
      local.push({k:'panel', p:[x, floorY+panelH/2, 0], s:[SPEC.panel,panelH,depth], m:'carcass'});

      const inner = bay.w - SPEC.panel;
      const cx = x + bay.w/2;

      /* The top shelf used to go over EVERY section, no question asked, which
         is wrong: a double-hang section run to the ceiling has no shelf over
         it, and forcing one on costs the customer a shelf they did not want
         and 12" of hanging they did. `bay.top === false` builds it open, and
         the hanging then uses the full height. */
      const wantsTop = bay.top !== false;
      if(wantsTop){
        parts.push(P('TOP',1,(inner*depth)/144,(inner+depth*2)/12,`Top shelf at ${myTop.toFixed(0)}"`));
        local.push({k:'shelf', p:[cx, myTop, 0], s:[inner, SPEC.panel, depth], m:'carcass'});
      }

      /* A section in an inside corner has the next run returning across its
         front. A drawer, a door or a hamper there opens into that run and
         cannot be used, which is why a corner gets shelving in a real closet. */
      const corner = cornerBlocked(cfg, run.wall, bi, a, bay.w);
      if(corner){
        const blocked = bay.stack.filter(st => OPENING_FRONT.has(st.m));
        if(blocked.length) warnings.push(
          `Section ${bi+1} is in the corner where the ${corner} wall returns, so ${blocked.map(st=>MODULES[st.m].label.toLowerCase()).join(' and ')} there would open straight into that run. A corner section wants shelving or hanging instead.`);
      }

      /* access checks, all tied to this bay by number so the installer and the
         customer are reading the same sheet */
      const opens = bay.stack.some(st => OPENS.has(st.m));
      if(opens && block && (a < block || b > wallEnd - block)) warnings.push(
        `Section ${bi+1} on the ${run.wall} wall has fronts in it but sits within ${block}" of the end of the opening, where the ${cfg.door === 'bifold' ? 'bi-fold leaves fold back' : 'door jamb sits'}. Those fronts will not open fully.`);
      if(opens && DS.half && bi !== 0 && bi !== run.bays.length - 1) warnings.push(
        `Sliding bypass doors only ever open half the closet. Section ${bi+1} has fronts in it, so one of the two leaves has to be slid across before it can be used.`);
      for(const f of fitsOn(fittings, run.wall, 'keepClear')){
        const sp = fitSpec(f), x0 = sp.at || 0, x1 = x0 + sp.w;
        if(b <= x0 || a >= x1) continue;
        warnings.push(bay.stack.some(st => BLOCKS_WALL.has(st.m))
          ? `There is ${(sp.label||f.k).toLowerCase()} at ${x0.toFixed(0)}" on the ${run.wall} wall, inside section ${bi+1}. ${sp.note} A drawer bank or hamper in that section covers it, so either move it a section along or we relocate the ${(sp.label||f.k).toLowerCase()}.`
          : `There is ${(sp.label||f.k).toLowerCase()} at ${x0.toFixed(0)}" on the ${run.wall} wall, inside section ${bi+1}. The back stays open there, so it keeps working.`);
      }
      for(const f of fitsOn(fittings, run.wall, 'floorClear')){
        const sp = fitSpec(f), x0 = sp.at || 0, x1 = x0 + sp.w;
        if(b <= x0 || a >= x1) continue;
        if(cfg.mounting === 'wall') continue;             // nothing on the floor to block it
        parts.push(P('TK', 1, (sp.w * SPEC.toeKick)/144, sp.w/12, `Toe kick vent cut-out — ${run.wall}`));
        warnings.push(`A floor vent runs under section ${bi+1} on the ${run.wall} wall, so that length of toe kick is cut for a grille.`);
      }

      /* Without a shelf capping it, the section has the shelf's own thickness
         back to divide between its parts. */
      const mods = resolveHeights(bay.stack, wantsTop ? bayH : bayH + SPEC.panel);
      let y = floorY;
      for(const s of mods){
        const sub = [];
        /* Everything this module pushes gets stamped with the module id, so the
           review panel can say "Drawer bank  $1,240" instead of listing forty
           panels. Parts pushed by the carcass code below carry no stamp and
           fall into the base system, which is how closet companies quote. */
        if(s.short > 0.5) warnings.push(
          `Section ${bi+1} on the ${run.wall} wall: ${MODULES[s.m].label.toLowerCase()} needs ${MODULES[s.m].minH}" and only ${s.H.toFixed(0)}" is left after everything else in that section. Take something out, make the section taller, or pick a part that fits.`);
        const mark = parts.length;
        MODULES[s.m].build({ w:inner, d:depth, y:0, h:s.H, G:sub, parts, o:s.o||{}, pull,
                              boxStyle: cfg.boxStyle || DEFAULT_BOX_STYLE,
                              basketFinish: BASKET_FINISH[cfg.pullFinish] || 'Chrome',
                              warn: m => warnings.push(m) });
        for(let i=mark;i<parts.length;i++) parts[i].grp = s.m;
        for(const g of sub) local.push({...g, p:[cx + g.p[0], y + g.p[1], g.p[2]]});
        y += s.H;
      }
      bayIndex.push({ wall:run.wall, bay:bi, x:cx, w:bay.w, h:bayH, top:myTop, depth, stack:bay.stack });
      lastTop = myTop;
      x += bay.w;
    });

    // closing panel at the height of the bay it closes, cleat, toe kick
    const endH = lastTop - floorY + SPEC.panel;
    parts.push(P(code,1,(endH*depth)/144,(endH+depth)/12,`End panel — ${run.wall}`));
    local.push({k:'panel', p:[x, floorY+endH/2, 0], s:[SPEC.panel,endH,depth], m:'carcass'});
    parts.push(P('CLEAT',1,(x*4)/144,x/12,`Hang cleat — ${run.wall}`));
    /* Baseboard heat takes the toe kick away: there is nothing on the floor to
       close in, and a kick over the element is a fire detail nobody wants. */
    if(cfg.mounting!=='wall' && !liftedByHeat){
      parts.push(P('TK',1,(x*SPEC.toeKick)/144,x/12,`Toe kick — ${run.wall}`));
      local.push({k:'toe', p:[x/2, SPEC.toeKick/2, -1.5], s:[x, SPEC.toeKick, depth-3], m:'carcass'});
    }
    /* A door leaf that folds back over the end of the opening needs a scribe
       filler so the cabinetry stops clear of it. Real panel, real square feet,
       real edge band. */
    if(block > 0.01 && run.wall === 'back'){
      const fh = lastTop - floorY + SPEC.panel;
      parts.push(P(code,2,(block*fh)/144,(block+fh)/12,`Scribe filler at the door jamb — ${run.wall}`));
    }
    run.width = x;
    for(const g of local) G.push(place(g, run, cfg.room));
  }

  const F  = cat.finishes.find(f=>f.n===cfg.finish)       || cat.finishes[0];
  const DF = cat.finishes.find(f=>f.n===cfg.frontFinish)  || F;
  const price = priceParts(parts, cat, F, DF, pull, pullFin);
  return { parts, geo:G, price, finish:F, frontFinish:DF, pull, pullFinish:pullFin,
           bays:bayIndex, warnings:[...new Set(warnings)],
           quote:quoteSummary(price, bayIndex, cfg.runs),
           order:orderList(parts, cat, F, DF, pull, pullFin) };
}

function place(g, run, room){
  const [lx,y,lz]=g.p, [sx,sy,sz]=g.s, off=run.start||0, dep=run.builtDepth ?? run.depth;
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
      const box = pickBox(cat, p.w, p.h, p.d, p.style);
      const gl  = pickGlide(cat, p.d, box);
      const front = (p.w*p.h)/144 * DF.sq + ((p.w+p.h)*2)/12 * DF.eb;
      c = ((box?.cost || 0) + gl.cost*2 + front) * p.qty;
      label = `${p.qty} × drawer ${p.h.toFixed(1)}" ${box?.ctor.name || ''} — box ${(box?.cost||0).toFixed(2)}, `
            + `glides ${(gl.cost*2).toFixed(2)} (${gl.l}" ${gl.s}), front ${front.toFixed(2)}`;
    }
    else if(p.code === 'PULL'){ c = pull.cost * pullFin.mult * p.qty; label = p.note + ` (${pullFin.name})`; }
    else if(p.code === 'BASKET'){
      const b = pickBasket(cat, p.w, p.d, p.finish, p.bh);
      c = b.cost * p.qty;
      label = `${p.qty} × pull-out basket ${b.w}×${b.d}×${b.h} ${b.f}`;
    }
    else if(p.code === 'HAMPER_BASKET'){
      const b = pickHamperBasket(cat, p.w, p.d, p.finish);
      c = b.cost * p.qty;
      label = `Tilt-out hamper basket ${b.w}×${b.d}×${b.h} ${b.f}`;
    }
    else if(p.code === 'GLASS_LITE'){ c = (p.w*p.h)/144 * 14.0; label = p.note + ', local glazier, estimate'; }
    else {
      const def = cat.parts[p.code]; if(!def) continue;
      const base = (p.sqft||0) * (F.sq + def.sqft) + (p.edge||0) * F.eb + def.add;
      c = Math.max(base, def.min) * (1 + def.pct) + def.hw;
      c *= (p.qty && p.sqft ? 1 : (p.qty || 1));
    }
    cost += c; lines.push({label, cost:+c.toFixed(2), grp:p.grp, code:p.code});
  }
  const markup = cat.meta.markup;
  return { cost:+cost.toFixed(2), price:+(cost*markup).toFixed(2), markup, lines };
}

/* ---------- the quote the customer actually reads -------------------------
   We price every panel, shelf, dowel and screw and sum it — that is the only
   way to get the number right. But nobody buys a closet by reading a list of
   forty panels. So the same arithmetic is presented the way the trade quotes
   it: one base-system line carrying the carcass and the hanging, then the
   extras itemised, then the total. Nothing is re-priced here. The pennies are
   rounded into the base line so the column always adds up to the total. */
/* modules with a front that has to swing or slide out, and modules that put
   something solid against the wall where an outlet would be */
const OPENS       = new Set(['DRAWERS','DOOR','GLASS_DOOR','HAMPER']);
const BLOCKS_WALL = new Set(['DRAWERS','DOOR','GLASS_DOOR','HAMPER','BASKETS']);

const BASE_GRP = new Set(['LONG_HANG','DOUBLE_HANG','OPEN']);
const OPT_NAME = {
  SHELVES:'Adjustable shelves', DRAWERS:'Drawer bank', BASKETS:'Pull-out baskets',
  SHOES:'Shoe shelving', SHOE_SLANT:'Slanted shoe gallery', CUBBIES:'Cubbies',
  COUNTER:'Counter top', DOOR:'Closed doors', GLASS_DOOR:'Glass doors',
  HAMPER:'Tilt-out hamper'
};
/* what we count for the "×N" on an option line */
function optQty(id, stack){
  const hits = stack.filter(s => s.m === id);
  if(id === 'SHELVES')  return hits.reduce((a,s) => a + (s.o?.n ?? 4), 0);
  if(id === 'DRAWERS')  return hits.reduce((a,s) => a + (s.o?.n ?? 4), 0);
  if(id === 'BASKETS')  return hits.reduce((a,s) => a + (s.o?.n ?? 3), 0);
  return hits.length;
}
const UNIT = { SHELVES:['shelf','shelves'], DRAWERS:['drawer','drawers'], BASKETS:['basket','baskets'] };

export function quoteSummary(price, bays, runs){
  const markup  = price.markup;
  const retail  = c => c * markup;
  const linFt   = runs.reduce((a,r) => a + (r.width || 0), 0) / 12;
  const sections = bays.length;
  const stack   = bays.flatMap(b => b.stack || []);

  const bucket = new Map();
  let baseCost = 0;
  for(const l of price.lines){
    if(!l.grp || BASE_GRP.has(l.grp)){ baseCost += l.cost; continue; }
    bucket.set(l.grp, (bucket.get(l.grp) || 0) + l.cost);
  }

  const options = [...bucket.entries()]
    .map(([id, cost]) => {
      const q = optQty(id, stack), u = UNIT[id];
      return { id,
        label: OPT_NAME[id] || id,
        qty: q,
        note: u ? `${q} ${u[q === 1 ? 0 : 1]}` : (q > 1 ? `×${q}` : ''),
        price: Math.round(retail(cost)) };
    })
    .sort((a,b) => b.price - a.price);

  const total  = Math.round(price.price);
  const optSum = options.reduce((a,o) => a + o.price, 0);

  /* Don't claim the base covers hanging when nothing in the design hangs. */
  const hasHang = stack.some(s => s.m === 'LONG_HANG' || s.m === 'DOUBLE_HANG');

  return {
    sections, linFt:+linFt.toFixed(1),
    baseNote: 'Carcass, partitions, top shelf, cleats and toe kick'
            + (hasHang ? ', plus the hanging rods' : ''),
    baseLabel: `Base system · ${sections} section${sections===1?'':'s'} · ${(+linFt.toFixed(1)).toLocaleString()} linear ft`,
    base: total - optSum,                 // absorbs the rounding, so it adds up
    options, total,
    empty: sections === 0
  };
}

/* ---------- the order list that goes to the back end ---------- */
function orderList(parts, cat, F, DF, pull, pullFin){
  const group = new Map();
  for(const p of parts){
    const def = cat.parts[p.code];
    const name = p.code==='DRAWER' ? `Drawer box + glides (${p.h?.toFixed(1)}"H × ${p.w?.toFixed(1)}"W)`
      : p.code==='PULL' ? `${pull.name}, ${pullFin.name}`
      : p.code==='BASKET' ? 'Pull-out wire basket'
      : p.code==='HAMPER_BASKET' ? 'Tilt-out hamper basket'
      : p.code==='HANGROD' ? 'Hang rod'
      : p.code==='GLASS_LITE' ? `Glass lite ${p.w?.toFixed(1)}" × ${p.h?.toFixed(1)}"`
      : (def?.n || p.code);
    const finish = (p.code==='DRAWER'||p.code==='DOOR') ? DF.n
      : (p.code==='PULL'||p.code==='BASKET'||p.code==='HAMPER_BASKET'||
         p.code==='HANGROD'||p.code==='GLASS_LITE') ? '—' : F.n;
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

/* ---------- SKU pickers, against the real manufacturer sheets -------------
   Every one of these was wrong in a way that cost money or shipped a part
   that cannot be fitted:

   · pickBox searched all three constructions and took the CHEAPEST, so it
     always landed on melamine side-mount — while the page promises
     "soft-close undermount". We were quoting one box and advertising another.
   · pickGlide searched both series, so a side-mount box could be paired with
     an 828 undermount glide. That does not physically mount.
   · pickBasket searched every basket row including the 25" tilt-out HAMPER
     basket, and ignored depth and finish entirely.
   · None of them applied the per-item add-on the sheets specify.

   The sheets price an item the same shape as the parts formula:
        max(price + addOn$, minimum) × (1 + addOn%)                        */

export const BOX_STYLES = [
  { id:'mel-um',   c:'5/8" HRM Mel UnderMount',           name:'Melamine, soft-close undermount',
    note:'The standard box. Soft-close, full extension, hidden runners.' },
  { id:'birch-um', c:'5/8" Solid Birch Dovetail UnderMount', name:'Solid birch dovetail, soft-close undermount',
    note:'Dovetailed solid birch sides. The upgrade you can see when the drawer is open.' },
  { id:'mel-sm',   c:'5/8" HRM Mel Side Mount',           name:'Melamine, side-mount',
    note:'Epoxy side runners. The budget box: visible runners, no soft close.' }
];
export const DEFAULT_BOX_STYLE = 'mel-um';

const addOn = (price, m) => Math.max(price + (m?.add || 0), m?.min || 0) * (1 + (m?.pct || 0));

function boxCtor(cat, styleId){
  const st = BOX_STYLES.find(b => b.id === styleId) || BOX_STYLES[0];
  return { ...st, meta: cat.boxTypes?.[st.c] || null };
}

/* Smallest stocked box that still swallows the opening, within one construction. */
function pickBox(cat, w, h, d, styleId){
  const ctor = boxCtor(cat, styleId);
  const inRange = b => b.w >= w - 0.5 && b.h >= h - 0.5 && b.d >= d - 0.5;
  const same = cat.boxes.filter(b => b.c === ctor.c);
  const fit  = same.filter(inRange);
  const pool = fit.length ? fit : same;
  if(!pool.length) return null;
  const box = fit.length
    ? pool.reduce((a,b) => b.p < a.p ? b : a)          // cheapest that fits
    : pool.reduce((a,b) => b.p > a.p ? b : a);         // nothing fits: biggest, and warn
  return { ...box, ctor, fits: !!fit.length, cost: +addOn(box.p, ctor.meta).toFixed(2) };
}

/* The glide has to belong to the series the box is drilled for. */
function pickGlide(cat, d, boxPick){
  const want = (boxPick?.ctor?.meta?.gt || '').toLowerCase();
  const series = cat.glides.filter(g => !want || g.s.toLowerCase() === want);
  const pool = series.length ? series : cat.glides;
  const fit  = pool.filter(g => g.l >= d - 2);
  const g = fit.length ? fit.reduce((a,b) => b.l < a.l ? b : a)
                       : pool.reduce((a,b) => b.l > a.l ? b : a);
  const key = Object.keys(cat.glideTypes || {}).find(k => k.toLowerCase() === g.s.toLowerCase());
  return { ...g, cost: +addOn(g.p, cat.glideTypes?.[key]).toFixed(2) };
}

/* Pull-out baskets only. The hamper basket lives in its own table and is 25" tall.

   Pick the BIGGEST basket the opening will take — widest, then deepest, then
   tallest — because a basket that is smaller than its opening is wasted space
   the customer paid for. Height matters: the wire table stocks 6", 11" and 17"
   and the first version ignored it, so a 30" run of one basket was quoted the
   6" tray. */
const biggest = (a, x) => {
  if(x.w !== a.w) return x.w > a.w ? x : a;
  if(x.d !== a.d) return x.d > a.d ? x : a;
  return x.h > a.h ? x : a;
};

function pickFromBasketTable(cat, kind, w, d, finish, maxH){
  const all  = cat.baskets.filter(b => b.k === kind);
  const fin  = finish ? all.filter(b => b.f === finish) : all;
  const pool = fin.length ? fin : all;
  const fit  = pool.filter(b =>
    b.w <= w + 0.5 && b.d <= d + 0.5 && (maxH == null || b.h <= maxH + 0.5));
  const b = (fit.length ? fit : pool).reduce(biggest);
  const mk = kind === 'wire' ? cat.basketMarkup?.wire : cat.basketMarkup?.hamper;
  return { ...b, fits: !!fit.length, cost: +addOn(b.p, mk).toFixed(2) };
}

const pickBasket       = (cat,w,d,finish,maxH) => pickFromBasketTable(cat,'wire',w,d,finish,maxH);
const pickHamperBasket = (cat,w,d,finish)      => pickFromBasketTable(cat,'hamper',w,d,finish,null);

/* small helper so the admin calculator can price one bay quickly */
export function quickPrice(width, depth, moduleId, finish, cat){
  const n = Math.max(1, Math.round(width / 30));
  const bays = Array.from({length:n}, ()=> makeBay(width/n, [{m:moduleId,h:null,o:{}}]));
  return buildDesign({ room:{w:width,d:depth,h:96}, mounting:'floor', finish, frontFinish:finish,
    pull:'bar4', pullFinish:'nickel',
    runs:[{wall:'back',start:0,depth,bays}] }, cat);
}
