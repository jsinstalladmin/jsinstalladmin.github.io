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
  outlet: { w:4,  hi:16, rule:'keepClear',  label:'Outlet',
    note:'The back of that section stays open so you can still reach the socket.',
    ask:'Roughly how high off the floor, and does anything need to plug into it?' },
  switch: { w:4,  hi:48, rule:'keepClear',  label:'Light switch',
    note:'Nothing solid goes in front of it, so it still works with the closet in.',
    ask:'Inside the closet or beside the door? Roughly how high?' },
  /* A vent in the floor and a vent on the wall are two different jobs. The
     toe-kick grille only makes sense for a floor vent — saying it about a wall
     vent, which is what this used to do, is nonsense to anyone who has ever
     seen one. */
  vent:   { w:14, hi:10, rule:'keepClear', spot:'wall', label:'HVAC vent',
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
  pipe:   { w:6,  depth:4, hi:0, rule:'stealDepth', label:'Pipe / bulkhead',
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
/* The front overlays the box and covers the gap over the glide, so a front is
   the box plus one inch. Every bank is now built from these and only these,
   which is why the parts list can no longer come out saying NO STOCK BOX
   FITS: the customer is choosing a real SKU, not a height we divide into. */
export const DRAWER_REVEAL = 1.0;
export const DRAWER_SIZES = DRAWER_BOX.h.map(h => ({
  h,                                   // the box, as he stocks it
  front: +(h + DRAWER_REVEAL).toFixed(2),
  label: ({7.5:'7½"', 8.75:'8¾"', 10:'10"', 15:'15"', 18.75:'18¾"', 25:'25"'})[h] || h + '"',
  use:   ({ 7.5:'Socks, ties, belts, jewellery trays',
            8.75:'The everyday drawer. Folded tees and underwear',
            10:'Folded knits and gym kit',
            15:'Jeans, sweaters, bulk',
            18.75:'Deep storage, bedding, handbags',
            25:'A single deep drawer. Bedding or a laundry drop' })[h] || ''
}));
/* four everyday drawers, which is the 34" bank every closet company sells */
export const defaultDrawerSizes = n =>
  Array.from({ length: Math.max(1, Math.min(8, n || 4)) }, () => 7.5);
export const drawerBankHeight = sizes =>
  (sizes || []).reduce((a, h) => a + h + DRAWER_REVEAL, 0);

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
  HANG:2, LONG_HANG:1, DOUBLE_HANG:1, SHORT_HANG:1, DOOR:1, GLASS_DOOR:1, HAMPER:1, COUNTER:2,
  DRAWERS:2, BASKETS:2, SHOES:2, SHOE_SLANT:2, SHELVES:3, CUBBIES:2, OPEN:2
};
const GROUP = { DOOR:'front', GLASS_DOOR:'front' };

/* ══════════════════════════════════════════════════════════════════════
   WHAT GOES ON TOP AND WHAT GOES AT THE BOTTOM

   A section is a bottom piece and a top piece, and the two are not
   interchangeable. A drawer bank at eye level cannot be opened, a hamper
   tilts down to the floor, and a short hang only exists as the thing above
   something else. The picker used to offer all fourteen pieces for either
   half of the section, so you could build a drawer bank over a rod and the
   drawing would show it.

   SLOT says where each piece can actually go. It is a build rule, not a
   preference, and the reason for each one is below.
   ══════════════════════════════════════════════════════════════════════ */
export const SLOT = {
  /* `top` and `bottom` say which half a piece can be STORED in. That is what
     slots() and writeSlots() need, and it has not changed.

     `whole` and `over` say when a piece is worth OFFERING, which is a
     different question. A section with nothing underneath is ONE TALL
     OPENING. A section with something underneath has a SHORT OPENING left
     above it. Those want different lists, and using one flag for both is why
     the top picker offered long hang, short hang and double hang side by
     side: in a whole section a short hang is just a long hang mounted low,
     and over a drawer bank neither a long hang nor a double hang fits, so
     both were quietly resolved down to the short hang anyway. Three cards,
     one result. */
  /* The rod. Either half, every time: on its own it hangs long, over
     something it hangs short, and one in each half is a double hang. */
  HANG       : { top:true,  bottom:true,  whole:true,  over:true  },
  /* Kept only so designs saved before the three became one still draw.
     whole:false and over:false mean they are never offered again. */
  LONG_HANG  : { top:true,  bottom:true,  whole:false, over:false },
  DOUBLE_HANG: { top:true,  bottom:false, whole:false, over:false },
  SHORT_HANG : { top:true,  bottom:false, whole:false, over:false },
  SHELVES    : { top:true,  bottom:true,  whole:true,  over:true  },
  CUBBIES    : { top:true,  bottom:true,  whole:true,  over:true  },
  SHOES      : { top:true,  bottom:true,  whole:true,  over:true  },
  SHOE_SLANT : { top:true,  bottom:true,  whole:true,  over:true  },
  OPEN       : { top:true,  bottom:true,  whole:true,  over:true  },
  /* pull-out hardware. A drawer you cannot see into is not a drawer, and a
     tilt-out hamper swings down to the floor */
  DRAWERS    : { top:false, bottom:true,  whole:true,  over:false },
  BASKETS    : { top:false, bottom:true,  whole:true,  over:false },
  HAMPER     : { top:false, bottom:true,  whole:true,  over:false },
  /* a worktop is not a piece of the section, it is the cap on the bottom
     piece, so it is offered as a tick on that piece rather than as a slot */
  COUNTER    : { top:false, bottom:false, cap:true },
  /* A FRONT COVERS THE WHOLE SECTION. Offered in the top half it drew a door
     across the upper part only, with the drawers below it still showing, and
     the glass lite was then cut to whatever height that half happened to be.
     No shop builds that, so a front is now a whole-section choice and the
     lite is always cut to the real opening. */
  DOOR       : { top:true,  bottom:false, whole:true,  over:false },
  GLASS_DOOR : { top:true,  bottom:false, whole:true,  over:false },
};
export const canSit = (id, slot) => !!(SLOT[id] || { top:true, bottom:true })[slot];

/* Should this piece be OFFERED in this half right now? `hasOther` is whether
   the other half of the section is already filled, which is what decides
   whether this half is a whole opening or the short one left over. */
export function canOffer(id, slot, hasOther){
  const r = SLOT[id];
  /* `legacy` pieces still build, so a design saved before the three hanging
     products became one still draws correctly. They are never offered again. */
  if(MODULES[id]?.legacy) return false;
  if(!r || r.cap) return false;
  if(!r[slot]) return false;
  if(slot === 'bottom') return true;
  return hasOther ? r.over !== false : r.whole !== false;
}

/* Read a stored stack as the two halves it really is. A stack is still how a
   section is stored, priced and sent to the office, so nothing downstream had
   to change: this is the view of it the picker works in. */
export function slots(stack){
  const st = stack || [];
  const ci = st.findIndex(x => x.m === 'COUNTER');
  const rest = st.map((x,i) => ({ x, i })).filter(e => e.x.m !== 'COUNTER');
  if(!rest.length) return { bottom:null, top:null, counter:ci >= 0, bi:-1, ti:-1 };
  if(rest.length === 1){
    /* One piece on its own is the TOP of the section — it fills the whole
       thing — unless it is something that can only sit on the floor, like a
       drawer bank or a hamper, in which case it is the bottom with nothing
       chosen above it yet. */
    const only = rest[0];
    return canSit(only.x.m, 'top')
      ? { bottom:null, top:only.x, counter:ci >= 0, bi:-1, ti:only.i }
      : { bottom:only.x, top:null, counter:ci >= 0, bi:only.i, ti:-1 };
  }
  return { bottom:rest[0].x, top:rest[rest.length-1].x, counter:ci >= 0,
           bi:rest[0].i, ti:rest[rest.length-1].i };
}

/* Put a piece in one half of a section and leave the other half alone. The
   heights follow from what the piece is: a drawer bank is as tall as its
   boxes, the top piece fills whatever is left, and a fixed-height piece at
   the bottom keeps its own height. */
export function setSlot(bay, slot, id){
  const s = slots(bay.stack);
  const def = MODULES[id];
  const keep = slot === 'top' ? s.bottom : s.top;
  const made = { m:id, h:null, o:{} };
  if(def.sizes) made.o = { sizes: defaultDrawerSizes(4) };
  else if(def.opt) made.o = { [def.opt.key]: def.opt.def };
  const next = slot === 'top'
    ? { bottom: (keep && keep.m !== id) ? keep : (s.bottom && s.bottom.m !== id ? s.bottom : null), top: made }
    : { bottom: made, top: keep && keep.m !== id ? keep : null };
  return writeSlots(bay, next.bottom, next.top, s.counter);
}
export function clearSlot(bay, slot){
  const s = slots(bay.stack);
  return writeSlots(bay, slot === 'bottom' ? null : s.bottom,
                         slot === 'top'    ? null : s.top,
                    slot === 'bottom' ? false : s.counter);
}
export function setCounter(bay, on){
  const s = slots(bay.stack);
  return writeSlots(bay, s.bottom, s.top, !!on && !!s.bottom);
}
/* The one place a section's stack is written, so it can never come out in an
   order the rest of the engine does not expect: bottom, worktop, top. */
export function writeSlots(bay, bottom, top, counter){
  const out = [];
  if(bottom){
    const d = MODULES[bottom.m];
    out.push({ ...bottom, h: d.sizes ? null : (bottom.h ?? d.defH) });
  }
  if(counter && bottom) out.push({ m:'COUNTER', h:2, o:{} });
  if(top){
    const d = MODULES[top.m];
    out.push({ ...top, h: (d.fill && bottom) ? null : (d.sizes ? null : (d.fill ? null : d.defH)) });
  }
  bay.stack = out;
  bay.top = true;                       // every section is built with its shelf
  return bay;
}


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
export function canAdd(stack, id, usableH, inCorner, slot){
  const def = MODULES[id];
  if(!def) return { ok:false, why:'Unknown part.' };

  /* Filling one half of a section is a different question from adding to an
     open-ended stack. The writer decides the heights — the bottom gets a
     fixed one, the top fills what is left — so "this section already has
     something filling the space" is not a reason to refuse, and neither is
     the per-section limit, because a half holds one piece by definition.
     What still applies: the corner, the pairs that physically clash, and
     whether the two halves fit between the toe kick and the top shelf. */
  if(slot){
    if(!canSit(id, slot))
      return { ok:false, why:`${def.label} cannot go ${slot === 'top' ? 'at the top of' : 'under'} a section.` };
    if(inCorner && OPENING_FRONT.has(id))
      return { ok:false, why:`This section is in the corner where the ${inCorner} wall returns across its front, so ${def.label.toLowerCase()} here would open straight into that run and could not be used. A corner section takes shelving or hanging.` };
    for(const c of CLASH){
      if((id===c.a && stack.some(st=>st.m===c.b)) || (id===c.b && stack.some(st=>st.m===c.a)))
        return { ok:false, why:c.why };
    }
    const other = stack.reduce((a,st) => a + MODULES[st.m].minH, 0);
    if(def.minH + other > usableH + 0.5)
      return { ok:false, why:`${def.label} needs ${def.minH}" and only ${Math.max(0, usableH - other).toFixed(0)}" is free in this section. Make the section taller or pick something shorter.` };
    return { ok:true };
  }

  /* A section in an inside corner has the next run returning across its
     front. This used to be built and then flagged in the warnings, which is
     the wrong way round: it cannot be used, so it is not offered. */
  if(inCorner && OPENING_FRONT.has(id))
    return { ok:false, why:`This section is in the corner where the ${inCorner} wall returns across its front, so ${def.label.toLowerCase()} here would open straight into that run and could not be used. A corner section takes shelving or hanging.` };

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
  /* ══════════════════════════════════════════════════════════════════
     ONE hanging piece, not three.

     "Long hang", "short hang" and "double hang" were sold to the customer as
     three different products, and they are not. They are ONE product — a rod
     — and the three names describe how much DROP it ended up with, which is
     decided by what else is in the section:

       rod in the top, nothing under it     → the full drop. A long hang.
       rod in the top, drawers under it     → whatever is left. A short hang.
       rod in the top AND a rod underneath  → two rods. A double hang.

     Offering them as separate cards meant the customer picked an outcome
     instead of a part, and then the engine quietly overrode them anyway: a
     "long hang" chosen over a drawer bank could not have 62" so it was
     resolved down to a short one. Now the rod is the choice and the drop
     follows from the section, which is how the shop actually builds it.
     ══════════════════════════════════════════════════════════════════ */
  HANG: {
    label:'Hanging', img:'long-hang',
    hint:'A rod with a shelf over it. Put one in the top half on its own and it hangs full length; put drawers or a hamper underneath and it shortens to suit; put a rod in both halves and you have a double hang.',
    spec:'One rod · 38" of drop minimum',
    icon:'M2 4h20M6 8h12M7 8v18M11 8v20M15 8v17M19 8v19',
    defH:null, minH:38, maxH:84, fill:true,
    build(c){
      const {w,d,y,h,G,parts,capped} = c;
      /* The shelf is what the rod sockets screw into, and when this piece is
         the bottom half it is also the divider under the rod above. If the
         section's own top shelf already caps this piece, that shelf IS the
         one, so it does not get a second 3/4" under the first. */
      let rodTop = y + h;
      if(!capped){
        parts.push(P('FIXED', 1, (w*d)/144, (w + d*2)/12, 'Shelf over the rod'));
        G.push({k:'shelf', p:[0, y + h - SPEC.panel/2, 0], s:[w, SPEC.panel, d], m:'carcass'});
        rodTop = y + h - SPEC.panel;
      }
      const rodY = rodTop - 2.5;
      parts.push(P('HANGROD',1,0,0,'Hang rod'));
      G.push({k:'rod', p:[0, rodY, 0], s:[w-1, 1.4, 1.4], m:'metal'});
      /* the garments drop as far as the space allows and no further, which is
         the whole point: the same piece reads long or short on its own */
      hang(G, 0, rodY, Math.max(10, Math.min(rodY - y - 2, 74)), w, d);
    }
  },
  LONG_HANG: {
    legacy:true, label:'Long hang', hint:'Coats and dresses. One rod with full clearance below.',
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
    legacy:true, label:'Double hang', hint:'Shirts and folded trousers. Two rods, twice the capacity.',
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
    legacy:true, label:'Short hang', hint:'A shelf with a rod under it, over drawers or a hamper. Shirts and folded trousers.',
    spec:'Shelf with a rod under it · 38"–54" of drop',
    icon:'M2 5h20M6 9h12M7 9v8M11 9v9M15 9v8M19 9v9',
    defH:46, minH:38, maxH:54, fill:true,
    /* A rod on its own, with open air over it, is not a thing anybody builds
       and it did not read as one either. A short hang is a SHELF with a rod
       hung under it: the shelf is what the rod sockets screw into, and it is
       where the folded stack goes. If the section's own top shelf is already
       capping this module, that shelf IS the one — so it does not get a
       second one 3/4" under the first. */
    build(c){
      const {w,d,y,h,G,parts,capped} = c;
      let rodTop = y + h;                                  // underside of the shelf
      if(!capped){
        parts.push(P('FIXED', 1, (w*d)/144, (w + d*2)/12, 'Shelf over the short hang'));
        G.push({k:'shelf', p:[0, y + h - SPEC.panel/2, 0], s:[w, SPEC.panel, d], m:'carcass'});
        rodTop = y + h - SPEC.panel;
      }
      const rodY = rodTop - 2.5;                           // where the sockets go
      parts.push(P('HANGROD',1,0,0,'Hang rod'));
      G.push({k:'rod', p:[0, rodY, 0], s:[w-1,1.4,1.4], m:'metal'});
      hang(G, 0, rodY, Math.min(rodY - y - 2, 34), w, d);
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
    defH:34, minH:8.5, maxH:48,
    /* `sizes` is the bank, bottom to top, in real box heights. It used to be a
       count: four drawers in a 34" bank gave 8.5" fronts and a box that
       happened to fit, but five in the same bank gave 6.8" fronts and the
       parts list printed NO STOCK BOX FITS and went to the supplier like
       that. Each drawer is now a SKU the customer picked. */
    sizes: true,
    build(c){
      const {w,d,y,G,parts,o,pull,warn} = c;
      const sizes = (Array.isArray(o.sizes) && o.sizes.length)
        ? o.sizes.filter(x => DRAWER_BOX.h.includes(+x)).map(Number)
        : defaultDrawerSizes(o.n);
      const n = sizes.length;

      const boxW = fit(DRAWER_BOX.w, w - 1.0);        // 1/2" glide each side
      const boxD = fit(DRAWER_BOX.d, d - 2.0);
      const glide = fit(GLIDES, boxD || 0);
      if(!boxW) warn && warn(`A ${w.toFixed(0)}" section is too narrow for a drawer box. The smallest he stocks is ${DRAWER_BOX.w[0]}" and needs a ${(DRAWER_BOX.w[0]+1).toFixed(0)}" opening.`);

      /* one line per SIZE, because that is how they are ordered */
      const byH = new Map();
      sizes.forEach(h => byH.set(h, (byH.get(h) || 0) + 1));
      for(const [bh, qty] of byH){
        /* the BOX height goes to the pricer, because that is the SKU. The
           front is an inch taller and is said in the note. */
        parts.push({ code:'DRAWER', qty, w, h:bh,
          d: boxD || Math.min(d-2, 20), boxW, boxD, style:c.boxStyle,
          note: `${qty} × ${bh}" box` +
                (boxW && boxD ? ` · ${boxW}"W × ${bh}"H × ${boxD}"D, ${glide}" glides` : '') +
                ` · ${(bh + DRAWER_REVEAL).toFixed(2)}" front` });
      }
      let fy = y;
      for(const bh of sizes){
        const fh = bh + DRAWER_REVEAL;
        const cy = fy + fh/2;
        G.push({k:'front', p:[0, cy, d/2-0.4], s:[w-0.2, fh-0.18, 0.8], m:'front'});
        addPull(G, pull, 0, cy, d/2, w, fh);
        fy += fh;
      }
      const h = drawerBankHeight(sizes);
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
      /* The slant runs DOWN towards the front, so you look into the shoe
         rather than at its heel, and a metal rail along the low front edge
         is what stops it sliding off. It was tilted the other way, with a
         wooden lip, which is neither how it is built nor how it looks. */
      const T = 0.18;                       // front edge low, back edge high
      for(let i=1;i<=n;i++){
        const yS = y + (h/(n+1))*i;
        G.push({k:'shelf', p:[0, yS, 0], s:[w, SPEC.panel, d], m:'carcass', tilt:T});
        /* the rail sits just above the shelf's front edge, which the tilt has
           carried down and forward */
        G.push({k:'rail',
                p:[0, yS - (d/2)*Math.sin(T) + 1.05, (d/2)*Math.cos(T) - 0.45],
                s:[w, 0.5, 0.5], m:'metal'});
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
      parts.push({code:'HAMPER',qty:1,note:'Tilt-down hamper mechanism'});
      parts.push({code:'HAMPER_BASKET',qty:1,w,d,finish:c.basketFinish,note:'Tilt-out hamper basket'});
      /* The front of a tilt-out is a slab the same as any other front: board,
         four banded edges, and it takes the fronts finish. It was being drawn
         but never billed, so a hamper was costed as the mechanism and the wire
         basket with the panel on the front of it free. */
      parts.push(P('DOOR',1,(w*h)/144,((w+h)*2)/12,'Tilt-out hamper front'));
      /* A tilt-out pivots on a hinge at the BOTTOM of its front, so the front
         swings down and out and the wire basket comes with it. It was being
         rotated about its own centre instead, which pushed the bottom edge
         forward and pulled the top edge back: the front came away from the
         carcass and read as a loose panel leaning against the closet.

         Rotating a panel of height H about its bottom edge puts its centre at
         (H/2·cos θ) up and (H/2·sin θ) out, which is what keeps the hinge line
         exactly where the cabinetry is. */
      const TILT = 0.30;                                   // about 17 degrees
      const fh = h - 0.6;                                  // the front panel
      const hinge = { y: y + 0.3, z: d/2 - 0.4 };          // bottom front edge
      const fcY = hinge.y + (fh/2) * Math.cos(TILT);
      const fcZ = hinge.z + (fh/2) * Math.sin(TILT);
      G.push({k:'front', p:[0, fcY, fcZ], s:[w-0.2, fh, 0.78], m:'front', tilt:TILT});
      /* the pull sits on the front, near its top edge, and leans with it */
      const pY = hinge.y + (fh - 2.2) * Math.cos(TILT);
      const pZ = hinge.z + (fh - 2.2) * Math.sin(TILT) + 0.4;
      addPull(G, pull, 0, pY, pZ, w, fh);
      /* the wire basket is carried by the front, so it leans the same way and
         you can see into it. Each wire is placed in the basket's own frame and
         then rotated about the same hinge. */
      const HW_ = 0.22, hw = w - 3, hd = d - 4.2;
      const hb = y + 2.2, ht = y + h - 3.4;
      /* every wire is placed where it would sit with the hamper shut, then
         swung about the hinge with the front, so the basket leans out with it
         instead of staying square behind a tilted panel */
      const cT = Math.cos(TILT), sT = Math.sin(TILT);
      const bar = (px,py,pz,sx,sy,sz) => {
        const dy = py - hinge.y, dz = pz - hinge.z;
        G.push({ k:'wire', m:'metal', tilt:TILT,
                 p:[px, hinge.y + dy*cT - dz*sT, hinge.z + dy*sT + dz*cT],
                 s:[sx,sy,sz] });
      };
      const fN = Math.max(4, Math.round(hw/2.4));
      for(let k=0;k<fN;k++) bar(-hw/2 + (hw/(fN-1))*k, hb, -0.6, HW_, HW_, hd);
      bar(0, ht, -hd/2-0.6, hw, HW_*1.5, HW_*1.5);
      bar(0, ht,  hd/2-0.6, hw, HW_*1.5, HW_*1.5);
      for(const sx of [-1,1]) bar(sx*(hw/2), (hb+ht)/2, -0.6, HW_*1.4, ht-hb, HW_*1.4);
      const vN2 = Math.max(5, Math.round(hw/2.6));
      for(let k=1;k<vN2;k++){
        const px = -hw/2 + (hw/vN2)*k;
        bar(px, (hb+ht)/2, -hd/2-0.6, HW_, ht-hb, HW_);
        bar(px, (hb+ht)/2,  hd/2-0.6, HW_, ht-hb, HW_);
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
        /* THE MID RAIL. A real chrome basket has a horizontal wire running
           right round it about halfway up, welded across every vertical: it is
           what stops the sides splaying under a load. Without it the verticals
           hung off the top rail with nothing tying them together and the basket
           read as a loose comb rather than one welded piece. A deep basket gets
           two of them, which is also how they are made. */
        const mids = (top - bot) > 7 ? 2 : 1;
        for(let r=1; r<=mids; r++){
          const my = bot + (top - bot) * (r / (mids + 1));
          rail(0, my, -bd/2+BW, bw, BW*1.15, BW*1.15);
          rail(0, my,  bd/2-BW, bw, BW*1.15, BW*1.15);
          rail(-bw/2+BW, my, 0, BW*1.15, BW*1.15, bd);
          rail( bw/2-BW, my, 0, BW*1.15, BW*1.15, bd);
        }
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
      /* Past about 26" a single slab is too wide: it sags on its hinges, it
         needs a metre of swing in front of it, and no shop builds one. It
         goes in as a pair on a centre stile. Two leaves is two sets of edges
         and two pulls, so it is priced as two. */
      const leaves = w > 26 ? 2 : 1;
      const lw = w / leaves;
      parts.push(P('DOOR',leaves,(lw*h)/144*leaves,((lw+h)*2)/12*leaves,
                   leaves===2 ? 'Slab doors, a pair' : 'Slab door'));
      for(let i=0;i<leaves;i++){
        const cx = leaves===1 ? 0 : (i===0 ? -lw/2 : lw/2);
        G.push({k:'front', p:[cx, y+h/2, d/2-0.3], s:[lw-0.2, h-0.4, 0.75], m:'front'});
        /* pulls meet at the centre stile on a pair, and sit on the lock side
           of a single */
        const px = leaves===1 ? w/2-3 : (i===0 ? lw/2-2.4 : -lw/2+2.4);
        addPull(G, pull, cx + px, y+h/2, d/2, 2, h, true);
      }
      if(pull && pull.id!=='none') parts.push({code:'PULL',qty:leaves,note:`${leaves} × ${pull.name}`});
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
/* ══════════════════════════════════════════════════════════════════════
   WHOLE-ROOM PLANS

   A PRESET fills one section. A PLAN lays out a whole room: the type, the
   dimensions and every section on every wall. The room pages each show three
   builds with "See the build" across the photograph, and until now that said
   nothing and went nowhere. Each one is a plan, so pressing it opens the
   builder with that room already drawn and already priced, and the customer
   starts from the thing they just looked at instead of an empty box.

   Every width here divides its wall exactly and sits inside the 24"–36"
   section range, and every stack obeys the same rules the picker enforces.
   They are starting points: everything in them can be changed.
   ══════════════════════════════════════════════════════════════════════ */
const m = (id, h, o) => ({ m:id, h: h ?? null, o: o || {} });

export const ROOM_PLANS = {
  /* ── walk-in ─────────────────────────────────────────────────────── */
  'walkin-l': { name:'L-Shape walk-in', type:'walk-in', shape:'l',
    room:{w:78,d:84,h:96},
    runs:{ back:[ {w:26,s:[m('HANG',40), m('HANG')]},
                  {w:26,s:[m('DRAWERS',null,{sizes:[7.5,7.5,7.5,7.5]}), m('SHELVES',null,{n:3})]},
                  {w:26,s:[m('HANG',40), m('HANG')]} ],
           left:[ {w:30,s:[m('HANG')]},
                  {w:30,s:[m('SHOE_SLANT')]} ] } },

  'walkin-u': { name:'U-Shape walk-in', type:'walk-in', shape:'u',
    room:{w:96,d:96,h:96},
    runs:{ back:[ {w:32,s:[m('HANG',40), m('HANG')]},
                  {w:32,s:[m('DRAWERS',null,{sizes:[7.5,7.5,7.5,7.5]}), m('SHELVES',null,{n:3})]},
                  {w:32,s:[m('HANG',40), m('HANG')]} ],
           left:[ {w:36,s:[m('HANG')]},
                  {w:36,s:[m('SHELVES',null,{n:6})]} ],
           right:[{w:36,s:[m('SHOE_SLANT')]},
                  {w:36,s:[m('HANG',40), m('HANG')]} ] } },

  /* The island itself is not cabinetry against a wall, so the builder draws
     the three runs round it. The island is sized on the day, against the
     walkway the room actually leaves. */
  'walkin-island': { name:'Walk-in with an island', type:'walk-in', shape:'u',
    room:{w:120,d:120,h:96},
    runs:{ back:[ {w:30,s:[m('HANG',40), m('HANG')]},
                  {w:30,s:[m('HANG',40), m('HANG')]},
                  {w:30,s:[m('DRAWERS',null,{sizes:[7.5,7.5,7.5,7.5]}), m('SHELVES',null,{n:3})]},
                  {w:30,s:[m('HANG',40), m('HANG')]} ],
           left:[ {w:32,s:[m('HANG')]},
                  {w:32,s:[m('SHELVES',null,{n:6})]},
                  {w:32,s:[m('HANG',40), m('HANG')]} ],
           right:[{w:32,s:[m('SHOE_SLANT')]},
                  {w:32,s:[m('BASKETS',30,{n:3}), m('SHELVES',null,{n:3})]},
                  {w:32,s:[m('HANG',40), m('HANG')]} ] } },

  /* ── reach-in ────────────────────────────────────────────────────── */
  'reachin-essential': { name:'Essential reach-in', type:'reach-in', shape:'straight',
    room:{w:72,d:24,h:96},
    runs:{ back:[ {w:36,s:[m('HANG',40), m('HANG')]}, {w:36,s:[m('HANG',40), m('HANG')]} ] } },

  'reachin-drawers': { name:'Reach-in with drawers', type:'reach-in', shape:'straight',
    room:{w:72,d:24,h:96},
    runs:{ back:[ {w:24,s:[m('HANG',40), m('HANG')]},
                  {w:24,s:[m('DRAWERS',null,{sizes:[7.5,7.5,7.5,7.5]}), m('SHELVES',null,{n:3})]},
                  {w:24,s:[m('HANG',40), m('HANG')]} ] } },

  'reachin-premium': { name:'Premium reach-in', type:'reach-in', shape:'straight',
    room:{w:96,d:24,h:96},
    runs:{ back:[ {w:24,s:[m('HAMPER',28), m('HANG')]},
                  {w:36,s:[m('HANG',40), m('HANG')]},
                  {w:36,s:[m('SHOE_SLANT')]} ] } },

  /* ── garage ──────────────────────────────────────────────────────── */
  'garage-wall-run': { name:'Garage wall run', type:'garage', shape:'straight',
    room:{w:144,d:20,h:108}, mounting:'wall',
    runs:{ back:[ {w:36,s:[m('SHELVES',null,{n:4})]}, {w:36,s:[m('SHELVES',null,{n:4})]},
                  {w:36,s:[m('SHELVES',null,{n:4})]}, {w:36,s:[m('SHELVES',null,{n:4})]} ] } },

  /* These two were IDENTICAL: four bays of shelves each, which is the wall
     run's photograph and nothing like the lockers' photograph. Lockers are
     three tall closed cabinets you cannot see into, which is the whole point
     of buying them, so that is what this builds now. */
  'garage-lockers': { name:'Garage lockers', type:'garage', shape:'straight',
    room:{w:120,d:20,h:108},
    runs:{ back:[ {w:38,s:[m('DOOR')]}, {w:38,s:[m('DOOR')]}, {w:38,s:[m('DOOR')]} ] } },

  /* The workbench photograph has drawers under the WHOLE counter, not under
     one bay with shelf towers either side, and a tall closed cabinet closing
     the right-hand end. */
  'garage-bench': { name:'Garage workbench', type:'garage', shape:'straight',
    room:{w:144,d:20,h:108},
    runs:{ back:[ {w:34,s:[m('DRAWERS',null,{sizes:[7.5,7.5,7.5]}), m('COUNTER',2), m('SHELVES',null,{n:3})]},
                  {w:34,s:[m('DRAWERS',null,{sizes:[7.5,7.5,7.5]}), m('COUNTER',2), m('SHELVES',null,{n:3})]},
                  {w:34,s:[m('DRAWERS',null,{sizes:[7.5,7.5,7.5]}), m('COUNTER',2), m('SHELVES',null,{n:3})]},
                  {w:34,s:[m('DOOR')]} ] } },

  /* ── laundry ─────────────────────────────────────────────────────── */
  /* The machines stand in the OPEN section under the counter, which is why
     that section is 36" of nothing rather than cabinetry. */
  /* The right-hand bay in the photograph is a rod under a shelf, which is
     where the shirts come out of the dryer onto. It was a shelf tower. */
  'laundry-counter': { name:'Laundry folding counter', type:'laundry', shape:'straight',
    room:{w:96,d:24,h:96},
    runs:{ back:[ {w:32,s:[m('OPEN',36), m('COUNTER',2), m('SHELVES',null,{n:3})]},
                  {w:32,s:[m('OPEN',36), m('COUNTER',2), m('SHELVES',null,{n:3})]},
                  {w:32,s:[m('HANG')]} ] } },

  /* Reading the photograph left to right: a tall closed cabinet, the two
     machines under the counter, the tilt-out hamper still under that same
     counter, a rod, and an open shelf tower on the end. The tall cabinet was
     missing and the hamper had no counter over it. */
  'laundry-full': { name:'Full-wall laundry', type:'laundry', shape:'straight',
    room:{w:144,d:24,h:96},
    runs:{ back:[ {w:24,s:[m('DOOR')]},
                  {w:30,s:[m('OPEN',36), m('COUNTER',2), m('SHELVES',null,{n:3})]},
                  {w:30,s:[m('OPEN',36), m('COUNTER',2), m('SHELVES',null,{n:3})]},
                  {w:30,s:[m('HAMPER',28), m('COUNTER',2), m('SHELVES',null,{n:3})]},
                  {w:30,s:[m('HANG')]} ] } },

  /* The laundry closet photograph is a STACKED pair, not a side-by-side pair
     under a counter: one tall open bay for the machines, a narrow shelf tower
     beside it, and a rod on the end. There is no counter in it at all. */
  'laundry-compact': { name:'Laundry closet', type:'laundry', shape:'straight',
    room:{w:72,d:24,h:96},
    runs:{ back:[ {w:28,s:[m('OPEN')]},
                  {w:20,s:[m('SHELVES',null,{n:5})]},
                  {w:24,s:[m('HANG')]} ] } },

  /* ── pantry ──────────────────────────────────────────────────────── */
  'pantry-essential': { name:'Essential pantry', type:'pantry', shape:'straight',
    room:{w:56,d:16,h:96},
    runs:{ back:[ {w:28,s:[m('SHELVES',null,{n:7})]}, {w:28,s:[m('SHELVES',null,{n:7})]} ] } },

  /* Both of these opened as something other than the photograph on the card,
     which is the one thing a "see the build" link must not do. Read off the
     photographs again: the basket pantry is THREE bays, with the baskets and
     the drawers stacked in the SAME middle one and a shelf tower either side;
     the counter pantry runs its worktop across the WHOLE wall with drawers
     under every bay and open shelving over every bay, not one counter bay
     next to a full-height tower. */
  'pantry-baskets': { name:'Pantry with baskets and drawers', type:'pantry', shape:'straight',
    room:{w:84,d:16,h:96},
    runs:{ back:[ {w:28,s:[m('SHELVES',null,{n:7})]},
                  {w:28,s:[m('DRAWERS',null,{sizes:[10,8.75]}), m('BASKETS',null,{n:4})]},
                  {w:28,s:[m('SHELVES',null,{n:7})]} ] } },

  'pantry-counter': { name:'Counter pantry', type:'pantry', shape:'straight',
    room:{w:72,d:16,h:96},
    runs:{ back:[ {w:36,s:[m('DRAWERS',null,{sizes:[15,15]}), m('COUNTER',2), m('SHELVES',null,{n:2})]},
                  {w:36,s:[m('DRAWERS',null,{sizes:[15,15]}), m('COUNTER',2), m('SHELVES',null,{n:2})]} ] } },

  /* ── linen ───────────────────────────────────────────────────────── */
  /* A linen closet is a shallow reach-in, so that is the type it opens as. */
  'linen-standard': { name:'Linen closet', type:'reach-in', shape:'straight',
    room:{w:48,d:14,h:96},
    runs:{ back:[ {w:24,s:[m('SHELVES',null,{n:7})]}, {w:24,s:[m('SHELVES',null,{n:7})]} ] } },

  'linen-drawers': { name:'Linen closet with drawers', type:'reach-in', shape:'straight',
    room:{w:48,d:14,h:96},
    runs:{ back:[ {w:24,s:[m('DRAWERS',null,{sizes:[15,10,8.75]}), m('SHELVES',null,{n:5})]},
                  {w:24,s:[m('DRAWERS',null,{sizes:[15,10,8.75]}), m('SHELVES',null,{n:5})]} ] } },
};

/* ---- LAYOUT PRESETS ------------------------------------------------------
   A customer does not think in "modules". They think "I want a drawer tower
   there". Handing them thirteen raw parts and asking them to assemble
   cabinetry is a parts bin, not a configurator.

   Each preset is a named, recognisable configuration that expands into a
   real stack. The component list stays underneath for anyone who wants to
   build from scratch — this is a starting point, not a cage. */
/* ── A PRESET IS ONE PIECE, NOT A COMBINATION ──
   These used to be ten combinations: "Hanging + Drawers", "Hamper +
   Hanging", "Drawer Tower", "Double Hanging". That is the wrong unit. A
   combination is just two pieces stacked, so the list showed drawers twice,
   hanging five times, and nothing at all for a door, a glass front, flat
   shoe shelves or an open bay. Someone reading it could not tell what the
   actual choices were.

   The list is the ELEVEN PIECES the builder will put in a section, which is
   the same list canOffer() works from. Each one says which half of a section
   it can go in, because that is the question the layout pages answer:

     either half   hanging · adjustable shelves · cubbies · shoe shelving ·
                   slanted shoe · leave it open
     bottom only   drawers · pull-out baskets · tilt-out hamper
     whole section closed door · glass door

   The ten old ids are kept underneath as aliases so a link someone already
   has, or a page that has not been updated, still lands on something. */
export const PRESETS = [
  { id:'hanging', name:'Hanging', img:'long-hang', slot:'either',
    desc:'One rod. On its own it hangs full length; over drawers or a hamper it shortens to suit; one in each half is a double hang.',
    stack:[{m:'HANG',h:null,o:{}}] },

  { id:'adjustable-shelves', name:'Adjustable shelves', img:'shelves', slot:'either',
    desc:'Shelves on 32mm pin centres, so the spacing you pick now is not the spacing you are stuck with.',
    stack:[{m:'SHELVES',h:null,o:{n:6}}] },

  { id:'cubbies', name:'Cubbies', img:'cubbies', slot:'either',
    desc:'A grid of open compartments for bags, hats and folded knits.',
    stack:[{m:'CUBBIES',h:null,o:{n:4}}] },

  { id:'shoe-shelving', name:'Shoe shelving', img:'shoes', slot:'either',
    desc:'Flat shelves at 8 inch spacing, the cheapest way to get shoes off the floor.',
    stack:[{m:'SHOES',h:null,o:{}}] },

  { id:'slanted-shoe', name:'Slanted shoe', img:'shoe-slant', slot:'either',
    desc:'Angled shelves with a front rail, so you see the whole shoe rather than its toe.',
    stack:[{m:'SHOE_SLANT',h:null,o:{}}] },

  { id:'leave-open', name:'Leave it open', img:'open', slot:'either',
    desc:'Empty space. Long coats, a laundry basket, a vacuum, the washing machine.',
    stack:[{m:'OPEN',h:null,o:{}}] },

  { id:'drawers', name:'Drawers', img:'drawers', slot:'bottom',
    desc:'Soft-close undermount glides, nine stocked box heights from 7½ to 25 inches.',
    stack:[{m:'DRAWERS',h:34,o:{n:4}}] },

  { id:'pull-out-baskets', name:'Pull-out baskets', img:'baskets', slot:'bottom',
    desc:'Chrome wire on full extension, so you see the back without unloading the front.',
    stack:[{m:'BASKETS',h:30,o:{n:3}}] },

  { id:'tilt-out-hamper', name:'Tilt-out hamper', img:'hamper', slot:'bottom',
    desc:'A basket on a flap stay. Laundry off the floor and out of sight.',
    stack:[{m:'HAMPER',h:28,o:{}}] },

  { id:'closed-door', name:'Closed door', img:'door', slot:'whole',
    desc:'A slab front across the whole section. Dust out, mess hidden.',
    stack:[{m:'DOOR',h:null,o:{}}] },

  { id:'glass-door', name:'Glass door', img:'glass-door', slot:'whole',
    desc:'A framed glass front. You can see what is in there without opening it.',
    stack:[{m:'GLASS_DOOR',h:null,o:{}}] },
];

/* The ten combination ids the old layout pages linked with. Each one points
   at the piece that page was really about, so an old link still opens
   something sensible instead of an empty room. */
export const PRESET_ALIAS = {
  'double-hang':'hanging', 'long-hang':'hanging', 'hang-shelf':'hanging',
  'hang-drawers':'drawers', 'drawer-tower':'drawers',
  'shelves':'adjustable-shelves', 'baskets':'pull-out-baskets',
  'shoe-wall':'slanted-shoe', 'hamper':'tilt-out-hamper', 'cubbies':'cubbies'
};

/* the price difference a preset makes, against the cheapest one, so the
   list can read "Incl." / "+$85" the way a customer expects */
/* The open-top variant builds no top shelf, so it is genuinely cheaper. The
   card used to quote both at the same number because this only looked at the
   stack. */
/* Does this ready-made layout physically fit the section it is being offered
   for? Single parts were already checked by canAdd; the ready-made ones were
   not, so one could be clicked into a section too short to hold it. */
export function presetFits(preset, usableH, inCorner){
  /* A corner section has the next run returning across its front, so a layout
     with a drawer bank, a hamper or baskets in it cannot be opened there. */
  if(inCorner){
    const blocked = preset.stack.filter(x => OPENING_FRONT.has(x.m));
    if(blocked.length) return { ok:false, corner:inCorner,
      why:`${blocked.map(x=>MODULES[x.m].label.toLowerCase()).join(' and ')} would open into the ${inCorner} wall's run` };
  }
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
/* A 32" rod was getting eleven garments on it at a 2.6" pitch, and a double
   hang got twenty-two. Packed that tight it stopped reading as a closet and
   started reading as clutter, and it buried the cabinetry the customer is
   actually choosing. A 5.2" pitch with a hard cap of six puts a few garments
   on the rail to give it scale and leaves the carcass visible, which is the
   thing being sold. */
function hang(G, cx, rodY, len, w, d){
  const usable = w - 2.5, pitch = 5.2;
  const n = Math.max(3, Math.min(6, Math.floor(usable/pitch))), step = usable/n;
  for(let i=0;i<n;i++){
    const j = ((i*37)%11)/11;
    const L = len * (0.84 + j*0.16);
    /* `garment` tells the renderer to use the tapered shape rather than a
       panel. A rail of these used to be a row of rounded bricks. `yaw` turns
       each one a little so the rail is not a line of identical objects. */
    G.push({k:'cloth', shape:'garment', yaw:(j - 0.5) * 0.5,
            p:[cx - usable/2 + step*(i+0.5), rodY-2.2-L/2, 0],
            s:[step*0.52, L, Math.min(d-10, 9+j*2)], m:'cloth'});
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
    'reach-in':[{m:'HANG',h:40,o:{}},{m:'HANG',h:null,o:{}}],
    'walk-in' :[{m:'HANG',h:40,o:{}},{m:'HANG',h:null,o:{}}],
    'pantry'  :[{m:'SHELVES',h:null,o:{n:6}}],
    'garage'  :[{m:'SHELVES',h:null,o:{n:4}}],
    'laundry' :[{m:'SHELVES',h:null,o:{n:3}}],
  }[type]) || [{m:'HANG',h:40,o:{}},{m:'HANG',h:null,o:{}}];
}

/* resolve module heights inside one bay: fixed ones keep their height,
   `fill` ones share whatever is left */
function resolveHeights(stack, total){
  const mods = stack.map(s=>({...s, def:MODULES[s.m]}));
  let used = 0; const fillers = [];
  for(const s of mods){
    /* A drawer bank is as tall as the boxes in it. Its height is not a number
       anyone types, it is the sum of the SKUs the customer picked, so it is
       read off those rather than off whatever `h` was stored years ago. */
    if(s.def.sizes){
      const sz = (Array.isArray(s.o?.sizes) && s.o.sizes.length)
        ? s.o.sizes : defaultDrawerSizes(s.o?.n);
      s.H = drawerBankHeight(sz); used += s.H;
    }
    else if(s.h != null){ s.H = clamp(s.h, s.def.minH, s.def.maxH); used += s.H; }
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

  /* The baseboard. If the run stands in front of it, it stands off every wall
     by the thickness of the base, and the side baseboards eat into the length
     of the run as well — which is exactly why it matters whether the number
     they measured was taken wall to wall or baseboard to baseboard. */
  if(cfg.backs) warnings.push(
    'Every section is built with a back panel, so the cabinetry is a closed box rather than open to the wall. That is extra board and extra hardware, and it is in the price.');

  const GAP = wallGap(cfg.base);
  if(GAP > 0) warnings.push(
    `The run sits in front of the baseboard, so it stands ${GAP.toFixed(2)}" off the wall`
    + (cfg.base?.measured === 'wall'
       ? ` and loses ${(GAP*2).toFixed(2)}" of length to the baseboards at each end, because the width given was measured wall to wall.`
       : `. The width given was measured baseboard to baseboard, so the length is already right.`));
  if(cfg.base?.handling === 'remove') warnings.push(
    'The baseboard behind the run is to be taken off so the cabinetry goes back to bare wall. It is not refitted afterwards.');
  if(cfg.base?.handling === 'scribe') warnings.push(
    `The panels are notched round the ${(+(+cfg.base.h||0).toFixed(2))}" baseboard on site so the run sits back to the wall.`);

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
    /* ---- islands ----------------------------------------------------------
       A run used to be one unbroken line of sections starting in the corner.
       Real walls are not like that: a radiator, a door swing or simply where
       the customer wants it means a run can start part way along and can have
       a genuine gap in the middle.

       So a run is now a list of ISLANDS separated by gap bays. Each island is
       a closed box in its own right: its own end panel, its own cleat and its
       own length of toe kick, all measured from where that island actually
       starts rather than from the corner. A gap costs nothing and builds
       nothing; it is simply wall we are not touching. */
    let islandStart = null;          // x where the open island began
    const closeIsland = () => {
      if(islandStart === null) return;
      const span = x - islandStart;
      if(span > 0.01){
        const endH = lastTop - floorY + SPEC.panel;
        parts.push(P(code,1,(endH*depth)/144,(endH+depth)/12,`End panel — ${run.wall}`));
        /* Drawn INSIDE the island, not centred on its edge. A panel centred on
           x spans x±0.375, so the end panel of a run that reached the corner
           had 0.375" of itself standing inside the wall. You could see it
           through the plaster. The island's outer face now lands exactly on
           the measurement, which is also what gets built. */
        local.push({k:'panel', p:[x - SPEC.panel/2, floorY+endH/2, 0],
                    s:[SPEC.panel,endH,depth], m:'carcass'});
        parts.push(P('CLEAT',1,(span*4)/144,span/12,`Hang cleat — ${run.wall}`));
        if(cfg.mounting!=='wall' && !liftedByHeat){
          parts.push(P('TK',1,(span*SPEC.toeKick)/144,span/12,`Toe kick — ${run.wall}`));
          local.push({k:'toe', p:[islandStart + span/2, SPEC.toeKick/2, -1.5],
                      s:[span, SPEC.toeKick, depth-3], m:'carcass'});
        }
      }
      islandStart = null;
    };
    /* The leaves of a bi-fold stack over the first and last few inches of the
       opening. A drawer or a door front behind that cannot be opened. */
    const block = DS.sideBlock || 0;
    const wallEnd = runLen(run.wall);
    let lastTop = bayTop;                 // the closing panel matches its neighbour

    let secN = 0;                     // sections are numbered, gaps are not
    run.bays.forEach((bay)=>{
      if(bay.gap){ closeIsland(); x += bay.w; return; }
      const bi = secN++;
      if(islandStart === null) islandStart = x;
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

      // left panel of this bay — pushed inboard when it is the island's first,
      // for the same reason as the end panel above
      parts.push(P(code,1,(panelH*depth)/144,(panelH+depth)/12,`Partition ${bi+1} — ${run.wall}`));
      const firstOfIsland = Math.abs(x - islandStart) < 0.01;
      local.push({k:'panel', p:[x + (firstOfIsland ? SPEC.panel/2 : 0), floorY+panelH/2, 0],
                  s:[SPEC.panel,panelH,depth], m:'carcass'});

      const inner = bay.w - SPEC.panel;
      const cx = x + bay.w/2;

      /* ── The back panel ──────────────────────────────────────────────
         A built-in closet's back is normally the wall, which is why this
         was never built and never charged for. Some rooms want one all
         the same: a bare block wall, a garage, somewhere the plaster is
         a mess, or simply a customer who wants a finished box.

         It is his own catalogue part with his own numbers — board by the
         square foot plus six cams, six half dowels and six screw covers —
         so turning it on prices it exactly the way his supplier bills it.
         Off by default, because off is what gets installed most of the
         time and a default nobody asked for is a default that overcharges. */
      if(cfg.backs){
        parts.push(P('BACK', 1, (bay.w * panelH) / 144, 0,
          `Back panel ${bi+1} — ${run.wall}`));
        local.push({ k:'back', p:[cx, floorY + panelH/2, -depth/2 + SPEC.panel/2],
                     s:[bay.w, panelH, SPEC.panel], m:'carcass' });
      }

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

      /* ---- the bottom deck ----------------------------------------------
         Every section was being priced with two sides, a top and a toe kick
         and NO bottom, which is not a box. The toe kick is set back under the
         deck; without the deck there is nothing for it to close in, the
         lowest drawer or basket sits over open floor, and the customer was
         short one full panel of melamine and edgeband per section. On a
         wall-hung run it matters even more: the deck is the underside you can
         see from across the room, so it is banded on the front edge either
         way. */
      parts.push(P('FIXED',1,(inner*depth)/144,(inner+depth*2)/12,
                   `Bottom deck at ${floorY.toFixed(1)}"`));
      local.push({k:'shelf', p:[cx, floorY - SPEC.panel/2, 0],
                  s:[inner, SPEC.panel, depth], m:'carcass'});

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
        /* The last module in the stack is the one the bay's top shelf sits
           on. A module that wants a shelf of its own has to know that, or a
           short hang under a capped section gets two shelves 3/4" apart. */
        const capped = (s === mods[mods.length-1]) && wantsTop;
        /* Everything this module pushes gets stamped with the module id, so the
           review panel can say "Drawer bank  $1,240" instead of listing forty
           panels. Parts pushed by the carcass code below carry no stamp and
           fall into the base system, which is how closet companies quote. */
        if(s.short > 0.5) warnings.push(
          `Section ${bi+1} on the ${run.wall} wall: ${MODULES[s.m].label.toLowerCase()} needs ${MODULES[s.m].minH}" and only ${s.H.toFixed(0)}" is left after everything else in that section. Take something out, make the section taller, or pick a part that fits.`);
        const mark = parts.length;
        MODULES[s.m].build({ w:inner, d:depth, y:0, h:s.H, G:sub, parts, o:s.o||{}, pull, capped,
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

    /* close whatever island the last section left open. Baseboard heat takes
       the toe kick away inside closeIsland: there is nothing on the floor to
       close in, and a kick over the element is a fire detail nobody wants. */
    closeIsland();
    /* A door leaf that folds back over the end of the opening needs a scribe
       filler so the cabinetry stops clear of it. Real panel, real square feet,
       real edge band. */
    if(block > 0.01 && run.wall === 'back'){
      const fh = lastTop - floorY + SPEC.panel;
      parts.push(P(code,2,(block*fh)/144,(block+fh)/12,`Scribe filler at the door jamb — ${run.wall}`));
    }
    run.width = x;
    for(const g of local) G.push(place(g, run, cfg.room, GAP));
  }

  const F  = cat.finishes.find(f=>f.n===cfg.finish)       || cat.finishes[0];
  const DF = cat.finishes.find(f=>f.n===cfg.frontFinish)  || F;
  const price = priceParts(parts, cat, F, DF, pull, pullFin);
  return { parts, geo:G, price, finish:F, frontFinish:DF, pull, pullFinish:pullFin,
           bays:bayIndex, wallGap:GAP, warnings:[...new Set(warnings)],
           quote:quoteSummary(price, bayIndex, cfg.runs),
           order:orderList(parts, cat, F, DF, pull, pullFin) };
}

/* A closet cannot sit flush against a wall that has a baseboard on it. Either
   the panels are notched round it, the base is taken off behind the run, or
   the whole run stands proud by the thickness of the base. The drawing used to
   show the run hard against the wall whatever the answer, which is the one
   thing it certainly is not. `gap` is how far off the wall the run really
   stands, and both the drawing and the position strip are built from it. */
function place(g, run, room, gap){
  const G = gap || 0;
  const [lx,y,lz]=g.p, [sx,sy,sz]=g.s, dep=run.builtDepth ?? run.depth;
  const along = (run.start||0) + (run.wall==='island' ? 0 : G);
  switch(run.wall){
    case 'left':   return {...g, p:[ G + dep/2 + lz, y, along + lx ], s:[sz,sy,sx]};
    case 'right':  return {...g, p:[ room.w - G - dep/2 - lz, y, along + lx ], s:[sz,sy,sx]};
    case 'island': return {...g, p:[ along + lx, y, room.d/2 + lz ], s:[sx,sy,sz]};
    default:       return {...g, p:[ along + lx, y, G + dep/2 + lz ], s:[sx,sy,sz]};
  }
}

/* How far off the wall the cabinetry actually stands, from what they told us
   about the baseboard. Notching or removing it buys the run the full wall. */
export function wallGap(base){
  if(!base) return 0;
  return base.handling === 'front' ? (+base.t || 0) : 0;
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
      /* A door is a FRONT. The customer is offered a separate finish for
         fronts and drawer boxes already used it; doors did not, so picking a
         Level 3 gloss for the fronts changed the drawer fronts' price and
         left the doors costed as if they were plain carcass board. */
      const FIN = (p.code === 'DOOR') ? DF : F;
      const base = (p.sqft||0) * (FIN.sq + def.sqft) + (p.edge||0) * FIN.eb + def.add;
      c = Math.max(base, def.min) * (1 + def.pct) + def.hw;
      c *= (p.qty && p.sqft ? 1 : (p.qty || 1));
    }
    /* A real part that costs nothing is a hole in the price list, not a
       freebie. A hang rod has no square footage and no hardware figure on the
       sheet, so every rod, every socket and every screw in every closet was
       being quoted at zero and nobody could see it. Mark it so the
       itemisation and the order sheet can say so out loud. */
    const free = c < 0.005 && p.code !== 'PULL';
    cost += c;
    lines.push({label, cost:+c.toFixed(2), grp:p.grp, code:p.code, ...(free ? {noPrice:true} : {})});
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

/* Hanging is part of the base system, not an extra: a rod and its sockets are
   what a closet IS. SHORT_HANG was left out when it was added, so a hamper or
   a drawer bank with a rod over it printed a line reading "SHORT_HANG  $8" on
   the customer's quote. */
const BASE_GRP = new Set(['HANG','LONG_HANG','DOUBLE_HANG','SHORT_HANG','OPEN']);
const OPT_NAME = {
  LONG_HANG:'Long hanging', DOUBLE_HANG:'Double hanging', SHORT_HANG:'Short hanging',
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
  const HANGING = new Set(['HANG','LONG_HANG','DOUBLE_HANG','SHORT_HANG']);
  const hasHang = stack.some(s => HANGING.has(s.m));

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
/* Rows on his sheet that carry no price of their own: the board and the edge
   band are costed, the thing itself is not. Until those numbers come from him
   they are shown as missing rather than quietly summed as nothing. */
export const NO_PRICE_IN_SHEET = new Set(['HANGROD', 'DOOR', 'GLASS']);

function orderList(parts, cat, F, DF, pull, pullFin){
  const group = new Map();
  for(const p of parts){
    const def = cat.parts[p.code];
    const name = p.code==='DRAWER' ? `Drawer box + glides (${p.boxW ?? p.w}"W × ${p.h}"H × ${p.boxD ?? p.d}"D)`
      : p.code==='PULL' ? `${pull.name}, ${pullFin.name}`
      : p.code==='BASKET' ? 'Pull-out wire basket'
      : p.code==='HAMPER_BASKET' ? 'Tilt-out hamper basket'
      : p.code==='HANGROD' ? 'Hang rod'
      : p.code==='GLASS_LITE' ? `Glass lite ${p.w?.toFixed(1)}" × ${p.h?.toFixed(1)}"`
      : (def?.n || p.code);
    const finish = (p.code==='DRAWER'||p.code==='DOOR') ? DF.n
      : (p.code==='PULL'||p.code==='BASKET'||p.code==='HAMPER_BASKET'||p.code==='HAMPER'||
         p.code==='HANGROD'||p.code==='GLASS_LITE') ? '—' : F.n;
    const key = name+'|'+finish;
    const g = group.get(key) || { item:name, finish, code:p.code, qty:0, sqft:0, edge_ft:0, notes:new Set() };
    g.qty += p.qty || 1;
    g.sqft += p.sqft || 0;
    g.edge_ft += p.edge || 0;
    if(p.note) g.notes.add(p.note);
    group.set(key,g);
  }
  return [...group.values()].map(g=>({
    item:g.item, finish:g.finish, qty:Math.round(g.qty),
    sq_ft:+g.sqft.toFixed(2), edgeband_ft:+g.edge_ft.toFixed(2),
    detail:[...g.notes].slice(0,3).join('; '),
    ...(NO_PRICE_IN_SHEET.has(g.code) ? { noPrice:true } : {})
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
