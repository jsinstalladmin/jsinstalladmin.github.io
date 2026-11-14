/* ============================================================
   drawing.js — the measured drawing.

   Joseph re-draws every closet in ClosetPro before he prices it. What he
   needs from this site is not a picture, it is a DRAWING: every tower on
   every wall, every piece inside it, and a dimension against all of it,
   so he can reproduce exactly what the customer built without ringing
   them up to ask how wide the third tower was.

   Everything here is built from the engine's own output — the same
   geometry the 3D view draws and the same parts the list prices — so a
   drawing can never disagree with the closet.

   Two drawings, both to scale and both dimensioned:

     elevation(design, wall)  looking straight at one wall
     plan(design)             looking down on the room

   Both return SVG text. SVG because it is the only format that is exact,
   prints at any size, and can be read as text if anything ever has to be
   checked by hand.
   ============================================================ */

const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* inches, printed the way a tape reads: 22.5 not 22.50, 24 not 24.0 */
export const inch = v => {
  const n = Math.round(v * 100) / 100;
  return (Number.isInteger(n) ? String(n) : String(n).replace(/0$/,'')) + '"';
};

const INK = '#2B2118', LINE = '#8C7F70', DIM = '#1F6F8B', FAINT = '#D8D2C8';
const FONT = 'ui-sans-serif,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';

/* FITTING A DRAWING TO THE SPACE IT HAS.

   Every drawing here is a body that scales with the scale factor plus a
   margin that does not: the dimension figures, the labels and the ladders
   are laid out in points and have to stay the size they are or nobody can
   read them. That makes the height a drawing comes out at NOT proportional
   to the width it was asked for, so "draw it wide and let the browser
   shrink it" and "guess a width, measure, guess again" both go wrong — the
   first shrinks the figures, the second overshoots.

   So the scale is solved for instead. Given the margins and how many
   inches have to fit across and down, this returns the one scale that fits
   both, and the exact size the drawing will be at that scale.
   ──────────────────────────────────────────────────────────────────────── */
function fitScale(pad, acrossIn, downIn, opt = {}){
  const w = opt.width || 900;
  const kW = (w - pad.l - pad.r) / Math.max(0.01, acrossIn);
  const kH = opt.height
    ? (opt.height - pad.t - pad.b) / Math.max(0.01, downIn)
    : Infinity;
  const k = Math.max(0.6, Math.min(kW, kH));
  return { k,
           W: Math.round(acrossIn * k + pad.l + pad.r),
           H: Math.round(downIn   * k + pad.t + pad.b) };
}

/* ── a dimension: witness lines, an arrowed rule and the figure ──────── */
function dimH(x0, x1, y, label, opt = {}){
  if(Math.abs(x1 - x0) < 0.01) return '';
  const tick = opt.tick ?? 5, up = opt.up ?? 0;
  const mid = (x0 + x1) / 2;
  return `<g class="dim">
    <line x1="${x0}" y1="${y - tick}" x2="${x0}" y2="${y + tick}" stroke="${DIM}" stroke-width="0.7"/>
    <line x1="${x1}" y1="${y - tick}" x2="${x1}" y2="${y + tick}" stroke="${DIM}" stroke-width="0.7"/>
    <line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${DIM}" stroke-width="0.7"/>
    <text x="${mid}" y="${y - 3 - up}" fill="${DIM}" font-size="9" font-family="${FONT}"
          text-anchor="middle">${esc(label)}</text>
  </g>`;
}
function dimV(y0, y1, x, label, opt = {}){
  if(Math.abs(y1 - y0) < 0.01) return '';
  const mid = (y0 + y1) / 2;
  /* opt.col moves a figure that will not fit between its own witness lines
     into a column of its own to the side, with a leader back to the rule,
     rather than letting it sit on top of its neighbour. */
  const col = opt.col || 0;
  const tx = x - 4 + col, ty = mid;
  const leader = col
    ? `<line x1="${x - 5}" y1="${mid}" x2="${tx + 4}" y2="${mid}" stroke="${DIM}" stroke-width="0.4"/>`
    : '';
  return `<g class="dim">
    <line x1="${x - 5}" y1="${y0}" x2="${x + 5}" y2="${y0}" stroke="${DIM}" stroke-width="0.7"/>
    <line x1="${x - 5}" y1="${y1}" x2="${x + 5}" y2="${y1}" stroke="${DIM}" stroke-width="0.7"/>
    <line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${DIM}" stroke-width="0.7"/>
    ${leader}<text x="${tx}" y="${ty}" fill="${DIM}" font-size="9" font-family="${FONT}"
          text-anchor="middle" transform="rotate(-90 ${tx} ${ty})">${esc(label)}</text>
  </g>`;
}

/* Which axis of a piece runs ALONG a given wall, and which way is "out".
   The engine places everything in room coordinates: x across the room, y
   up, z out from the back wall. A left or right wall is therefore drawn
   from z, not from x. */
const alongOf = (g, wall) => wall === 'back'  ? { a:g.p[0], s:g.s[0], d:g.p[2], ds:g.s[2] }
                           : wall === 'left'  ? { a:g.p[2], s:g.s[2], d:g.p[0], ds:g.s[0] }
                           : /* right */        { a:g.p[2], s:g.s[2], d:g.p[0], ds:g.s[0] };

/* ══ ELEVATION ═════════════════════════════════════════════════════════
   One wall, looking straight at it. Every piece that belongs to that wall
   is drawn to scale, each tower is dimensioned along the top, the wall is
   dimensioned overall above that, and every fixed shelf and rod in the
   selected tower is dimensioned up the side. */
export function elevation(design, wall, opt = {}){
  const bays = (design.bays || []).filter(b => b.wall === wall);
  if(!bays.length) return null;

  const room   = design.room || { w:96, d:24, h:96 };
  const spanIn = wall === 'back' ? room.w : room.d;
  const hIn    = room.h;

  /* The left margin carries the height ladder: the rule itself, two spill
     columns for figures too short to hold their own number, and out beyond
     all of them the overall ceiling height. They each need their own lane
     or they print on top of one another. */
  const PAD = { l:86, r:34, t:54, b:62 };
  const { k, W, H } = fitScale(PAD, spanIn, hIn, opt);
  const X = v => PAD.l + v * k;
  const Y = v => PAD.t + (hIn - v) * k;                // y is up in the room

  /* Every piece carries the wall it was built against, so an elevation
     draws that wall and nothing else. It used to be inferred from where
     the piece sat, which put the side tower into the back elevation the
     moment a room was deep enough. */
  const geo = (design.geo || []).filter(g =>
    g.wall === wall && g.k !== 'cloth' && g.k !== 'garment');

  const fill = g => g.m === 'front' ? '#E6D9C6'
                  : g.m === 'metal' ? '#C9CED4'
                  : g.m === 'glass' ? '#DCE8EC'
                  : '#F3EDE3';
  let body = '';
  for(const g of geo){
    const q = alongOf(g, wall);
    const x = X(q.a - q.s / 2), y = Y(g.p[1] + g.s[1] / 2);
    const w = Math.max(0.6, q.s * k), h = Math.max(0.6, g.s[1] * k);
    body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
      fill="${fill(g)}" stroke="${LINE}" stroke-width="0.6"/>`;
  }

  /* the dimension string along the top: every tower, and the gaps between */
  const posOf = b => (wall === 'back') ? b.x
                   : ((b.alongRoom != null) ? b.alongRoom : ((b.start || 0) + b.x));
  const sorted = [...bays].sort((a,b) => posOf(a) - posOf(b));
  let dims = '', cursor = 0;
  const dy = PAD.t - 14;
  for(const b of sorted){
    const left = posOf(b) - b.w / 2;
    if(left - cursor > 0.3) dims += dimH(X(cursor), X(left), dy, inch(left - cursor));
    dims += dimH(X(left), X(left + b.w), dy, inch(b.w));
    cursor = left + b.w;
  }
  if(spanIn - cursor > 0.3) dims += dimH(X(cursor), X(spanIn), dy, inch(spanIn - cursor));
  /* the whole wall, above it */
  dims += dimH(X(0), X(spanIn), PAD.t - 34, inch(spanIn));

  /* heights up the left: the deck, every fixed shelf, every rod, the top */
  const levels = new Map();
  const add = (v, what) => { const kk = Math.round(v * 4) / 4; if(!levels.has(kk)) levels.set(kk, what); };
  for(const g of geo){
    if(g.k === 'shelf' && g.m === 'carcass') add(g.p[1] + g.s[1] / 2, 'shelf');
    if(g.k === 'rod') add(g.p[1], 'rod');
    if(g.k === 'toe') add(g.p[1] + g.s[1] / 2, 'kick');
    /* Drawer and door fronts are dimensioned by their own edges, so the
       ladder reads out the height of each individual drawer rather than one
       figure for the whole stack. A drawer height is the number Joseph needs
       most and it was the one thing the drawing did not say. */
    if(g.k === 'front' || g.k === 'glass'){
      add(g.p[1] - g.s[1] / 2, 'front'); add(g.p[1] + g.s[1] / 2, 'front');
    }
  }
  /* THE HEIGHT LADDER, WITHOUT THE FIGURES LANDING ON EACH OTHER.

     Every figure is set rotated, so it runs up the drawing and the room it
     needs is measured up the drawing too: a short segment simply cannot
     hold its own number. Rather than let two of them overlap and be read as
     a third number that was never there, a figure that will not fit between
     its own witness lines steps out into a column of its own, with a leader
     back to the rule it belongs to. Three columns is enough for any stack
     we build. */
  let heights = '';
  const ys = [...levels.keys()].sort((a,b) => a - b);
  const COLS = [0, -17, -34];
  /* what each lane is already carrying: [centre, half the figure's length] */
  const held = COLS.map(() => null);
  const segs = [];
  let prev = 0;
  for(const v of ys){
    if(v - prev > 1) segs.push([prev, v]);
    prev = v;
  }
  for(const [a, b] of segs){
    const label = inch(b - a);
    const need = label.length * 5.1 + 5;         // 9pt type, running vertically
    const y0 = Y(a), y1 = Y(b), mid = (y0 + y1) / 2;
    const half = need / 2;
    /* The ladder is walked from the floor up, so these midpoints DESCEND
       the page. Distance is taken as a distance, not as a subtraction in
       one direction, which was quietly letting every second figure through
       on top of the one before it. */
    const clear = i => !held[i] || Math.abs(mid - held[i][0]) >= half + held[i][1];
    let col = 0;
    if(Math.abs(y1 - y0) < need){
      col = COLS.findIndex((_, i) => i > 0 && clear(i));
      if(col < 0) col = COLS.length - 1;
    }
    held[col] = [mid, half];
    heights += dimV(y0, y1, PAD.l - 16, label, col ? { col: COLS[col] } : {});
  }
  heights += dimV(Y(0), Y(hIn), PAD.l - 68, inch(hIn) + ' ceiling');

  /* the floor and the ceiling, so the drawing reads as a room */
  const frame = `
    <line x1="${X(0)}" y1="${Y(0)}" x2="${X(spanIn)}" y2="${Y(0)}" stroke="${INK}" stroke-width="1.4"/>
    <line x1="${X(0)}" y1="${Y(hIn)}" x2="${X(spanIn)}" y2="${Y(hIn)}" stroke="${FAINT}" stroke-width="1"/>
    <line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(hIn)}" stroke="${FAINT}" stroke-width="1"/>
    <line x1="${X(spanIn)}" y1="${Y(0)}" x2="${X(spanIn)}" y2="${Y(hIn)}" stroke="${FAINT}" stroke-width="1"/>`;

  /* The PDF prints the wall's name as the page heading, so it asks for the
     drawing without one; on screen and on its own the drawing still says
     which wall it is. */
  const title = `${wall[0].toUpperCase()}${wall.slice(1)} wall · ${bays.length} tower${bays.length === 1 ? '' : 's'}`;
  const caption = opt.title === false ? '' :
    `<text x="${PAD.l}" y="20" font-family="${FONT}" font-size="12" font-weight="600"
           fill="${INK}">${esc(title)}</text>`;

  /* THE DOORS, STANDING IN FRONT OF IT.

     A reach-in is seen through its own doorway, and a drawing that leaves
     the doorway out makes a closet look wider than the hole it has to go
     through. If the customer measured the opening it is drawn in front of
     the cabinetry, dashed because it is the room and not something we
     build, and dimensioned, so the width of the opening and the width of
     the run are side by side where they can be compared. */
  let doorway = '';
  const dw = design.doorOpening || 0;
  if(wall === 'back' && dw > 0 && dw <= spanIn + 0.5){
    const x0 = (spanIn - dw) / 2, x1 = x0 + dw;
    doorway = `<g>
      <rect x="${X(x0).toFixed(1)}" y="${Y(hIn).toFixed(1)}"
        width="${(dw*k).toFixed(1)}" height="${(hIn*k).toFixed(1)}"
        fill="none" stroke="${DIM}" stroke-width="0.9" stroke-dasharray="6 4"/>
      ${dimH(X(x0), X(x1), Y(0) + 26, inch(dw) + ' opening')}
    </g>`;
  }

  /* ON THE PAGE THIS DRAWING IS ALSO THE CONTROL.

     opt.pick lays an invisible rectangle over each tower carrying which wall
     and which tower it is, so clicking a tower in the flat view selects it
     exactly as clicking it in the 3D view does. In the PDF it is left off,
     because paper does not take clicks. */
  let picks = '';
  if(opt.pick){
    for(const b of sorted){
      const left = posOf(b) - b.w / 2;
      picks += `<rect class="pick" data-wall="${esc(wall)}" data-bay="${b.bay}" data-axis="x"
        ${opt.selected && opt.selected.wall === wall && opt.selected.i === b.bay ? 'data-on="1"' : ''}
        x="${X(left).toFixed(1)}" y="${Y(b.top).toFixed(1)}"
        width="${(b.w * k).toFixed(1)}" height="${Math.max(8, b.h * k).toFixed(1)}"><title>Tower ${b.bay + 1}, ${inch(b.w)} wide. Drag it along the wall.</title></rect>`;
    }
  }
  /* data-k is how many SVG units one inch is, so a drag in screen pixels can
     be turned back into inches without the page having to know anything
     about how the drawing was laid out. */
  return `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"
    data-k="${k.toFixed(5)}" aria-label="${esc(title)}"><rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${caption}${frame}${body}${doorway}${dims}${heights}${picks}</svg>`;
}

/* ══ PLAN ══════════════════════════════════════════════════════════════
   Looking down. Shows where every run sits, how deep it is, and the
   standoff between a side wall and the back wall, which is the number a
   fitter checks first. */
export function plan(design, opt = {}){
  const room = design.room || { w:96, d:24, h:96 };
  const PAD = { l:62, r:40, t:52, b:62 };
  const { k, W, H } = fitScale(PAD, room.w, room.d, opt);
  const X = v => PAD.l + v * k;
  const Z = v => PAD.t + v * k;

  let body = `<rect x="${X(0)}" y="${Z(0)}" width="${(room.w*k).toFixed(1)}" height="${(room.d*k).toFixed(1)}"
    fill="#FBF9F6" stroke="${INK}" stroke-width="1.4"/>`;

  const byWall = {};
  for(const b of (design.bays || [])) (byWall[b.wall] = byWall[b.wall] || []).push(b);

  let dims = '', picks = '';
  for(const [wall, bays] of Object.entries(byWall)){
    for(const b of bays){
      const dep = b.depth || 24;
      let x, z, w, d;
      /* a side tower's own x is measured along its run, which starts clear
         of the back wall, so the room position is start + x */
      const along = (b.alongRoom != null) ? b.alongRoom : ((b.start || 0) + b.x);
      if(wall === 'back'){ x = b.x - b.w/2;  z = 0;               w = b.w; d = dep; }
      else if(wall === 'left'){  x = 0;             z = along - b.w/2; w = dep; d = b.w; }
      else {                     x = room.w - dep;  z = along - b.w/2; w = dep; d = b.w; }
      body += `<rect x="${X(x).toFixed(1)}" y="${Z(z).toFixed(1)}"
        width="${(w*k).toFixed(1)}" height="${(d*k).toFixed(1)}"
        fill="#EFE6D8" stroke="${LINE}" stroke-width="0.8"/>`;
      /* Looking down, a back-wall tower slides across the drawing and a side
         tower slides up and down it, so each one says which screen axis is
         "along its own wall". */
      if(opt.pick) picks += `<rect class="pick" data-wall="${esc(wall)}" data-bay="${b.bay}"
        data-axis="${wall === 'back' ? 'x' : 'y'}"
        ${opt.selected && opt.selected.wall === wall && opt.selected.i === b.bay ? 'data-on="1"' : ''}
        x="${X(x).toFixed(1)}" y="${Z(z).toFixed(1)}"
        width="${(w*k).toFixed(1)}" height="${(d*k).toFixed(1)}"><title>${esc(wall)} wall, tower ${b.bay + 1}. Drag it along the wall.</title></rect>`;
    }
  }

  /* the room, and each run's depth */
  dims += dimH(X(0), X(room.w), PAD.t - 16, inch(room.w) + ' wall');
  dims += dimV(Z(0), Z(room.d), PAD.l - 18, inch(room.d) + ' deep');
  const back = (byWall.back || [])[0];
  if(back) dims += dimV(Z(0), Z(back.depth || 24), X(room.w) + 18, inch(back.depth || 24));

  /* THE STANDOFF, AND WHAT BRIDGES IT.

     The side run stands twelve inches clear of the back run. That gap is not
     left open: a top piece and a bottom piece on their own toe kick carry
     across it, and the engine builds and lists them. They are drawn here,
     hatched, because a plan that showed only the gap read as a mistake. */
  let bridges = '';
  for(const wall of ['left','right']){
    const side = (byWall[wall] || [])[0];
    if(!side) continue;
    const sd = side.depth || 24;
    /* how deep this side run is, measured off the wall it stands on */
    const dx0 = wall === 'left' ? 0 : room.w - sd;
    const firstAlong = Math.min(...byWall[wall].map(b =>
      ((b.alongRoom != null) ? b.alongRoom : ((b.start || 0) + b.x)) - b.w / 2));
    const lastAlong = Math.max(...byWall[wall].map(b =>
      ((b.alongRoom != null) ? b.alongRoom : ((b.start || 0) + b.x)) + b.w / 2));
    dims += dimH(X(dx0), X(dx0 + sd), Z(lastAlong) + 20, inch(sd) + ' deep');

    if(!back) continue;
    const bd = back.depth || 24;
    if(firstAlong - bd > 0.3){
      bridges += `<rect x="${X(dx0).toFixed(1)}" y="${Z(bd).toFixed(1)}"
        width="${(sd*k).toFixed(1)}" height="${((firstAlong-bd)*k).toFixed(1)}"
        fill="none" stroke="${LINE}" stroke-width="0.7" stroke-dasharray="3 2"/>`;
      const atX = X(dx0 + sd / 2);
      /* On the right-hand wall this label used to run outward off the edge of
         the drawing, with its own leader line struck through the middle of
         it. Each side reads back into the room now. */
      const outward = wall === 'right';
      dims += `<g><line x1="${atX}" y1="${Z(bd)}" x2="${atX}" y2="${Z(firstAlong)}"
          stroke="${DIM}" stroke-width="0.8"/>
        <text x="${(outward ? atX - 5 : atX + 5).toFixed(1)}" y="${Z((bd + firstAlong) / 2)}"
              fill="${DIM}" font-size="9" font-family="${FONT}"
              text-anchor="${outward ? 'end' : 'start'}">${esc(inch(firstAlong - bd))} clear · bridged</text></g>`;
    }
  }
  body += bridges;

  const caption = opt.title === false ? '' :
    `<text x="${PAD.l}" y="20" font-family="${FONT}" font-size="12" font-weight="600"
           fill="${INK}">Looking down on the room</text>`;
  return `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"
    data-k="${k.toFixed(5)}" aria-label="Plan view"><rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${caption}${body}${dims}${picks}</svg>`;
}

/* ══ ONE TOWER, ON ITS OWN ══════════════════════════════════════════════
   A wall elevation answers "where does each tower go". This answers "what
   is inside this one": the clear opening above every shelf, the height of
   every drawer front, where the rod sits, and what each part of the stack
   actually is. It is the drawing a fitter works from with the tower in
   front of him, and the one a customer looks at to check a shoe shelf is
   tall enough for a boot.

   It is built from the same geometry as everything else, cropped to the
   tower's own span along its wall, so it cannot describe a tower the
   engine did not build.
   ══════════════════════════════════════════════════════════════════════ */
export function towerOf(design, wall, bay){
  return (design.bays || []).find(b => b.wall === wall && b.bay === bay) || null;
}

export function tower(design, wall, bay, opt = {}){
  const b = towerOf(design, wall, bay);
  if(!b) return null;

  const along  = (wall === 'back') ? b.x
               : ((b.alongRoom != null) ? b.alongRoom : ((b.start || 0) + b.x));
  const left   = along - b.w / 2, right = along + b.w / 2;
  const floorY = b.top - b.h;                 // the deck this tower stands on
  const hIn    = b.top + 4;                   // a little air above the top shelf

  const PAD = { l:92, r:150, t:50, b:46 };
  const { k, W, H } = fitScale(PAD, b.w, hIn, opt);
  const X   = v => PAD.l + (v - left) * k;
  const Y   = v => PAD.t + (hIn - v) * k;

  /* EVERY PIECE OF THIS TOWER, CLIPPED TO IT.

     Deciding by a piece's centre was not enough. A toe kick and a hang
     cleat are built island-long, not tower-long, so one of them centred
     anywhere inside this tower dragged its whole eight foot length into the
     drawing and the kick ran out past both sides of a two foot tower. A
     piece is in if it OVERLAPS the tower, and it is drawn only across the
     part of it that does. */
  const overlaps = g => {
    const q = alongOf(g, wall);
    return (q.a + q.s / 2) > left + 0.05 && (q.a - q.s / 2) < right - 0.05;
  };
  const geo = (design.geo || []).filter(g =>
    g.wall === wall && g.k !== 'cloth' && g.k !== 'garment' && !g.bridge && overlaps(g));

  const fill = g => g.m === 'front' ? '#E6D9C6'
                  : g.m === 'metal' ? '#C9CED4'
                  : g.m === 'glass' ? '#DCE8EC'
                  : '#F3EDE3';
  let body = '';
  for(const g of geo){
    const q = alongOf(g, wall);
    const a0 = Math.max(left, q.a - q.s / 2), a1 = Math.min(right, q.a + q.s / 2);
    const y = Y(g.p[1] + g.s[1] / 2);
    body += `<rect x="${X(a0).toFixed(1)}" y="${y.toFixed(1)}"
      width="${Math.max(0.6, (a1 - a0) * k).toFixed(1)}" height="${Math.max(0.6, g.s[1] * k).toFixed(1)}"
      fill="${fill(g)}" stroke="${LINE}" stroke-width="0.6"/>`;
  }

  /* THE OPENINGS.

     Every horizontal surface inside the tower, bottom to top, taken as a
     pair of faces: the top of one and the bottom of the next. The figure
     between them is the CLEAR opening, which is the number anybody actually
     wants, rather than the distance between two shelf centres. */
  const faces = [];
  const push = (lo, hi, what) => faces.push({ lo, hi, what });
  for(const g of geo){
    const lo = g.p[1] - g.s[1] / 2, hi = g.p[1] + g.s[1] / 2;
    if(g.k === 'shelf')  push(lo, hi, 'shelf');
    if(g.k === 'toe')    push(lo, hi, 'kick');
    if(g.k === 'counter')push(lo, hi, 'top');
    if(g.k === 'front' || g.k === 'glass') push(lo, hi, 'front');
  }
  faces.sort((a, c) => a.lo - c.lo);

  let dims = '';
  /* drawer and door fronts measured as themselves, openings measured clear */
  let cursor = floorY;
  for(const f of faces){
    if(f.what === 'front'){
      dims += dimV(Y(f.lo), Y(f.hi), PAD.l - 16, inch(f.hi - f.lo));
      cursor = Math.max(cursor, f.hi);
      continue;
    }
    if(f.lo - cursor > 1.2) dims += dimV(Y(cursor), Y(f.lo), PAD.l - 16, inch(f.lo - cursor));
    cursor = Math.max(cursor, f.hi);
  }
  if(b.top - cursor > 1.2) dims += dimV(Y(cursor), Y(b.top), PAD.l - 16, inch(b.top - cursor));
  /* the tower itself, outside all of that */
  dims += dimV(Y(floorY), Y(b.top), PAD.l - 58, inch(b.h) + ' tall');
  dims += dimH(X(left), X(right), PAD.t - 16, inch(b.w) + ' wide');

  /* rods get their own figure off the floor, because a rail height is
     measured from the floor on site and from nothing else */
  for(const g of geo){
    if(g.k !== 'rod') continue;
    dims += `<g><line x1="${X(right).toFixed(1)}" y1="${Y(g.p[1]).toFixed(1)}"
        x2="${(X(right) + 26).toFixed(1)}" y2="${Y(g.p[1]).toFixed(1)}"
        stroke="${DIM}" stroke-width="0.7" stroke-dasharray="3 2"/>
      <text x="${(X(right) + 30).toFixed(1)}" y="${(Y(g.p[1]) + 3).toFixed(1)}"
        fill="${DIM}" font-size="9" font-family="${FONT}">rod at ${esc(inch(g.p[1]))}</text></g>`;
  }

  /* WHAT EACH PART OF IT IS, in the customer's own words, written against
     the band of the tower it occupies. A drawing of empty boxes does not
     tell anybody that the middle one is the shoe shelves. */
  let labels = '';
  for(const band of (b.bands || [])){
    if(!band.label || band.y1 - band.y0 < 2) continue;
    const mid = (band.y0 + band.y1) / 2;
    labels += `<text x="${(X(right) + 30).toFixed(1)}" y="${(Y(mid) + 3).toFixed(1)}"
      fill="${INK}" font-size="10" font-family="${FONT}">${esc(band.label)}</text>`;
  }

  const frame = `
    <line x1="${X(left)}" y1="${Y(0)}" x2="${X(right)}" y2="${Y(0)}" stroke="${INK}" stroke-width="1.4"/>
    <line x1="${X(left)}" y1="${Y(0)}" x2="${X(left)}" y2="${Y(b.top)}" stroke="${FAINT}" stroke-width="1"/>
    <line x1="${X(right)}" y1="${Y(0)}" x2="${X(right)}" y2="${Y(b.top)}" stroke="${FAINT}" stroke-width="1"/>`;

  const title = `${wall[0].toUpperCase()}${wall.slice(1)} wall · tower ${bay + 1}`;
  const caption = opt.title === false ? '' :
    `<text x="${PAD.l}" y="20" font-family="${FONT}" font-size="12" font-weight="600"
           fill="${INK}">${esc(title)}</text>`;
  const note = `<text x="${PAD.l}" y="${H - 16}" font-family="${FONT}" font-size="9"
      fill="${LINE}">${esc(inch(b.depth))} deep · starts ${esc(inch(left))} from the corner</text>`;

  return `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="${esc(title)}"><rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${caption}${frame}${body}${dims}${labels}${note}</svg>`;
}

/* ── every wall that has something on it ─────────────────────────────── */
export function wallsIn(design){
  return [...new Set((design.bays || []).map(b => b.wall))];
}

/* ── SVG to a PNG data URL, for anything that cannot take SVG ───────── */
export function svgToPng(svg, scale = 2){
  return new Promise((res, rej) => {
    const img = new Image();
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width * scale; c.height = img.height * scale;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/png'));
    };
    img.onerror = rej;
    img.src = url;
  });
}

/* ══ THE PDF ═══════════════════════════════════════════════════════════
   Every wall, the plan, and the 3D view, on paper, with the piece list
   behind them. This is what Joseph opens: he re-draws the closet in
   ClosetPro from it and prices it there, so it has to carry every number
   the customer set and nothing he has to ring them up about.

   jsPDF is loaded only when somebody actually asks for a drawing, so it
   costs nothing on the way in. It is served from this site rather than from
   a CDN: a customer on a network that blocks jsdelivr would otherwise press
   the button and get nothing, and the drawing is the part Joseph needs. The
   CDN is kept behind it only as a fallback if our own copy fails to load.
   ============================================================ */
let _jspdf = null;
async function jsPDF(){
  if(_jspdf) return _jspdf;
  /* A relative specifier in a dynamic import resolves against THIS module's
     URL, not the page's, so 'assets/…' from a file that lives in assets/js/
     asks for assets/assets/…. window.BASE is written relative to the page,
     so it has to be resolved against the page before it is handed over. */
  const base = (typeof window !== 'undefined' && window.BASE) || '';
  const local = new URL(base + 'assets/vendor/jspdf/jspdf.esm.js',
                        (typeof location !== 'undefined' && location.href) || import.meta.url).href;
  let mod;
  try{
    mod = await import(/* @vite-ignore */ local);
  }catch(e){
    console.warn('[drawing] local jsPDF did not load, trying the CDN:', e);
    mod = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm');
  }
  _jspdf = mod.jsPDF || mod.default?.jsPDF || mod.default;
  if(typeof _jspdf !== 'function') throw new Error('jsPDF did not load');
  return _jspdf;
}

const PAGE = { w: 842, h: 595 };          // A4 landscape, points

export async function buildPdf(design, meta = {}){
  const JsPDF = await jsPDF();
  const doc = new JsPDF({ unit:'pt', format:'a4', orientation:'landscape' });
  const M = 34;
  let first = true;

  const head = (title, sub) => {
    if(!first) doc.addPage();
    first = false;
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(30,25,20);
    doc.text(title, M, M + 4);
    if(sub){ doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120,110,100);
             doc.text(sub, M, M + 19); }
    doc.setTextColor(30,25,20);
  };

  const sizeOf = svg => {
    const m = svg.match(/width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/);
    return m ? { w:+m[1], h:+m[2] } : { w:900, h:600 };
  };

  /* A drawing is asked for the exact box it is going into and comes back at
     the one scale that fits both ways, so it is placed at 1:1 and the
     dimension figures print at the size they were laid out at. They used to
     be drawn big and scaled down, which put a nine point label on paper at
     about six and made the whole drawing unreadable. The PNG is rasterised
     at 3x so the line work is still sharp even though the type is already
     at its final size. */
  const place = async (make, top) => {
    const box = { width: PAGE.w - M * 2, height: PAGE.h - top - M };
    const svg = make(box);
    const sz = sizeOf(svg);
    const png = await svgToPng(svg, 3);
    doc.addImage(png, 'PNG', M + (box.width - sz.w) / 2, top, sz.w, sz.h, undefined, 'FAST');
  };

  /* one page per wall */
  for(const wall of wallsIn(design)){
    if(!elevation(design, wall)) continue;
    head(`${wall[0].toUpperCase()}${wall.slice(1)} wall`, meta.ref || '');
    await place(box => elevation(design, wall, { ...box, title:false }), M + 30);
  }

  /* the plan */
  if(plan(design)){
    head('Looking down on the room', meta.ref || '');
    await place(box => plan(design, { ...box, title:false }), M + 30);
  }

  /* A PAGE PER TOWER.

     The elevation says where each tower goes and how wide it is. This says
     what is inside it: the clear opening over every shelf, the height of
     every drawer front, where the rod sits and what each band of it is.
     That is the page somebody works from with the tower in front of them,
     and it is the last thing that was still only in the customer's head. */
  for(const b of (design.bays || [])){
    if(!tower(design, b.wall, b.bay)) continue;
    head(`${b.wall[0].toUpperCase()}${b.wall.slice(1)} wall · tower ${b.bay + 1}`,
         meta.ref || '');
    await place(box => tower(design, b.wall, b.bay, { ...box, title:false }), M + 30);
  }

  /* the 3D view as the customer saw it */
  if(meta.shot){
    head('The closet as it was drawn', meta.ref || '');
    const img = new Image();
    await new Promise(r => { img.onload = r; img.onerror = r; img.src = meta.shot; });
    if(img.width){
      const avail = { w: PAGE.w - M*2, h: PAGE.h - (M+30) - M };
      const k = Math.min(avail.w / img.width, avail.h / img.height);
      doc.addImage(meta.shot, 'PNG', M, M + 30, img.width * k, img.height * k, undefined, 'FAST');
    }
  }

  /* every piece, continued over as many pages as it takes */
  const rows = [
    ...(meta.order || []).map(o => [String(o.qty), o.item, o.finish || '',
          (o.details && o.details.length ? o.details.join('; ') : (o.detail || ''))]),
    ...(meta.hardware || []).map(h => [String(h.qty), h.item, h.sku || '', '']),
  ];
  if(rows.length){
    head('Every piece in this closet', `${rows.reduce((a,r)=>a+(+r[0]||0),0)} pieces in all`);
    const col = [M, M + 34, M + 274, M + 468];
    const wid = [30, 236, 190, PAGE.w - M - (M + 468)];
    /* The list runs over pages on a big closet, and a page of bare figures
       with the column names left behind on the page before is a page you
       have to flip back to read. The header comes with it. */
    const colhead = y => {
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(30,25,20);
      ['Qty','Item','Color / SKU','Detail'].forEach((h,i) => doc.text(h, col[i], y));
      doc.setDrawColor(200,193,182);
      doc.line(M, y + 3, PAGE.w - M, y + 3);
      doc.setFont('helvetica','normal');
      return y + 13;
    };
    doc.setFontSize(8);
    let y = colhead(M + 44);
    for(const r of rows){
      /* A cell that did not fit used to be cut off mid-word, which on the
         detail column meant the drawing said "Partitio" where it should have
         listed the partitions. Every cell wraps inside its own column now and
         the row is as tall as its longest cell. */
      const cells = r.map((v, i) => doc.splitTextToSize(String(v), wid[i] - 6));
      const lines = Math.max(...cells.map(c => c.length));
      const tall = lines * 9.4 + 2;
      if(y + tall > PAGE.h - M){ doc.addPage(); y = colhead(M + 14); }
      cells.forEach((c, i) => doc.text(c, col[i], y));
      y += tall;
    }
  }

  /* the measurements, in words, on the last page */
  const r = design.room || {};
  head('The measurements', meta.ref || '');
  doc.setFontSize(10); let y = M + 44;
  const say = (k, v) => { if(v == null || v === '') return;
    const lines = doc.splitTextToSize(String(v), PAGE.w - M - (M + 160));
    const tall = Math.max(16, lines.length * 12 + 4);
    if(y + tall > PAGE.h - M){ doc.addPage(); y = M + 14; }
    doc.setFont('helvetica','bold'); doc.text(k, M, y);
    doc.setFont('helvetica','normal'); doc.text(lines, M + 160, y);
    y += tall; };
  say('Room', `${inch(r.w)} wide · ${inch(r.d)} deep · ${inch(r.h)} to the ceiling`);
  say('Cabinetry height', inch(design.cabTop || 84) + ' off the floor');
  say('Mounted', design.mounting === 'wall' ? 'Wall hung, off the floor' : 'Standing on the floor');
  say('Carcass', design.finish?.n || meta.finish);
  if((design.frontFinish?.n || meta.frontFinish) &&
     (design.frontFinish?.n || meta.frontFinish) !== (design.finish?.n || meta.finish))
    say('Fronts', design.frontFinish?.n || meta.frontFinish);
  say('Handles', [design.pull?.name || meta.pull,
                  design.pullFinish?.name || meta.pullFinish].filter(Boolean).join(' · '));
  /* meta.door is missing on a design saved before doors were a field, and
     `undefined + ' · ...'` printed the word "undefined" on the sheet that
     goes to the customer. Each half stands on its own now. */
  say('Doors', [meta.door, meta.doorOpening ? `${inch(meta.doorOpening)} opening` : '']
    .filter(Boolean).join(' · '));
  /* WHERE each tower is, not only how big. A list of widths tells you what
     to cut; it does not tell you which order they go in or how far along the
     wall the first one starts, and that is what gets set out on site. */
  for(const b of (design.bays || [])){
    const along = (b.alongRoom != null) ? b.alongRoom : ((b.start || 0) + b.x);
    say(`${b.wall[0].toUpperCase()+b.wall.slice(1)} wall, tower ${b.bay + 1}`,
        `${inch(b.w)} wide · ${inch(b.depth)} deep · ${inch(b.h)} of usable height`
        + ` · starts ${inch(along - b.w / 2)} from the corner`);
  }
  for(const w of (meta.notes || [])) say('Note', w);
  return doc;
}

export async function downloadPdf(design, meta = {}){
  const doc = await buildPdf(design, meta);
  doc.save(meta.filename || 'closet-drawing.pdf');
}
