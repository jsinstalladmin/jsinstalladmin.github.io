import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ══════════════════════════════════════════════════════════════════════
   DRAWN PICTURES FOR THE PARTS THAT HAVE NO PHOTOGRAPH

   Six accessories were added before Joseph had studio shots of them, so
   their cards fell back on the twenty-four pixel line icon that labels a
   row in a list, blown up on an empty tile. A hairline drawing floating
   in the middle of a blank square tells a customer nothing about what
   the thing is, and next to four real photographs it reads as broken.

   These are proper illustrations: the part drawn at the size it is, in
   the section it lives in, with the board behind it, the chrome shaded
   and something hung on it so the scale reads. Same four to three box
   as the photographs, so the grid does not jump. When the photographs
   arrive they take over and this file loses six functions.
   ══════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════
   ONE DRAWING ENGINE FOR EVERY PART AND EVERY READY-MADE TOWER

   There were three different pictures of the same closet on one screen.
   Stock photographs of somebody else's wardrobe for the components, a
   hairline schematic for the ready-made towers, and six hand-drawn tiles
   for the accessories. Three styles, three palettes, three ideas of what
   a tower looks like, and none of them was the closet this site builds.

   This draws all of them, from one palette, with one idea of a section:
   two side panels, a top, a toe kick, and bands stacked inside. A part
   card is a section with one band in it. A ready-made tower card is a
   section with that tower's bands in it. They cannot drift apart because
   they are the same function, and when a band is improved every card
   that uses it improves with it.

   Drawn rather than photographed, so it stays true: change the drawer
   heights he stocks and the drawer card changes with them.
   ══════════════════════════════════════════════════════════════════════ */
const SEC = {
  w:120, h:160,
  x0:9, x1:111,          // outside of the carcass
  pw:6,                  // panel thickness
  top:10, bot:150, tk:7  // top shelf, floor line, toe kick height
};
const SEC_DEFS = `
  <defs>
    <linearGradient id="sBoard" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E9D3B0"/><stop offset="1" stop-color="#CFB184"/></linearGradient>
    <linearGradient id="sPanel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#DEC29A"/><stop offset="1" stop-color="#BFA073"/></linearGradient>
    <linearGradient id="sBack" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E4DCCF"/><stop offset="1" stop-color="#D3C9B9"/></linearGradient>
    <linearGradient id="sMetal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F1F3F4"/><stop offset=".45" stop-color="#BFC5CA"/>
      <stop offset=".6" stop-color="#9CA3A9"/><stop offset="1" stop-color="#DADEE1"/></linearGradient>
    <linearGradient id="sGlass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F4F7F8" stop-opacity=".9"/>
      <stop offset=".5" stop-color="#C9D6DC" stop-opacity=".75"/>
      <stop offset="1" stop-color="#EEF3F4" stop-opacity=".9"/></linearGradient>
  </defs>`;
const SEC_C = { edge:'#B9986C', line:'#A98A62', cloth:['#4C5A6E','#8E8273','#5E6B55','#6F6560'] };

/* one board, seen square on: face, lit top edge, shadow under it */
const board = (x, y, w, t) =>
  `<rect x="${x}" y="${y.toFixed(1)}" width="${w}" height="${t}" fill="url(#sBoard)"/>
   <rect x="${x}" y="${y.toFixed(1)}" width="${w}" height=".8" fill="#F6EAD5"/>
   <rect x="${x}" y="${(y + t).toFixed(1)}" width="${w}" height="1.6" fill="#000" opacity=".11"/>`;

/* a hanging rod with clothes on it, filling `drop` of the band below it */
const hangBand = (x, w, y0, y1, seed = 0) => {
  const rod = y0 + 5, drop = Math.min((y1 - y0) - 9, (y1 - y0) * 0.78);
  let g = `<rect x="${x + 2}" y="${rod.toFixed(1)}" width="${w - 4}" height="2.4" rx="1.2" fill="url(#sMetal)"/>`;
  const n = Math.max(3, Math.round(w / 11));
  for(let i = 0; i < n; i++){
    const cx = x + 5 + ((w - 10) / (n - 1 || 1)) * i;
    const col = SEC_C.cloth[(i + seed) % SEC_C.cloth.length];
    const sh = drop * (0.82 + ((i + seed) % 3) * 0.06);
    g += `<path d="M${cx.toFixed(1)} ${(rod + 1).toFixed(1)}v3" stroke="#AAB0B5" stroke-width=".9"/>
      <path d="M${(cx - 4).toFixed(1)} ${(rod + 4).toFixed(1)}
               q4 -2.6 8 0 l1.6 ${sh.toFixed(1)} q-5.6 2 -11.2 0 Z" fill="${col}"/>`;
  }
  return g;
};

/* n evenly spaced shelves inside the band */
const shelfBand = (x, w, y0, y1, n) => {
  let g = ''; const step = (y1 - y0) / n;
  for(let i = 1; i <= n; i++) g += board(x, y0 + step * i - 2, w, 2.4);
  return g;
};

/* drawer fronts, in the proportions of the boxes he stocks */
const drawerBand = (x, w, y0, y1, sizes) => {
  const sum = sizes.reduce((a, b) => a + b, 0) || 1;
  let g = '', y = y0;
  for(const sz of sizes){
    const dh = ((y1 - y0) * sz) / sum;
    g += `<rect x="${x + 1}" y="${(y + 1).toFixed(1)}" width="${w - 2}" height="${Math.max(3, dh - 2).toFixed(1)}"
            rx="1" fill="url(#sBoard)" stroke="${SEC_C.edge}" stroke-width=".7"/>
          <rect x="${(x + w / 2 - 9).toFixed(1)}" y="${(y + dh / 2 - 1).toFixed(1)}" width="18" height="2"
            rx="1" fill="url(#sMetal)"/>`;
    y += dh;
  }
  return g;
};

/* a pair of shoes seen end on, which is how they sit on a shelf */
const shoe = (cx, yBase, tilt = 0) =>
  `<g transform="translate(${cx.toFixed(1)} ${yBase.toFixed(1)}) rotate(${tilt}) scale(1.35)">
     <path d="M-6 0h9l3 -1.4q1.6 -.7 1.6 -2.4v-1.6q0 -1.4 -1.6 -1.4h-4l-2.4 -2.4h-5.6Z"
       fill="#3B3F46"/><path d="M-6 0h13.6l-.6 1.4H-6Z" fill="#23262B"/>
     <path d="M-5 -5.4h4.4l1 1.6h-5.4Z" fill="#555B64"/></g>`;

/* flat shelves of shoes, or slanted ones */
const shoeBand = (x, w, y0, y1, slant) => {
  const n = Math.max(2, Math.min(6, Math.round((y1 - y0) / 20)));
  let g = ''; const step = (y1 - y0) / n;
  for(let i = 1; i <= n; i++){
    const yy = y0 + step * i - 2;
    if(slant){
      g += `<path d="M${x} ${yy.toFixed(1)}L${x + w} ${(yy - 5).toFixed(1)}l0 2.4L${x} ${(yy + 2.4).toFixed(1)}Z"
              fill="url(#sBoard)" stroke="${SEC_C.edge}" stroke-width=".6"/>`;
      for(let k = 0; k < 3; k++)
        g += shoe(x + 15 + k * (w - 30) / 2, yy - 3 - (15 + k * (w - 30) / 2) * 5 / w, -6);
    } else {
      g += board(x, yy, w, 2.4);
      for(let k = 0; k < 3; k++) g += shoe(x + 15 + k * (w - 30) / 2, yy - 1);
    }
  }
  return g;
};

/* wire baskets: the mesh is the whole point, so it is drawn as mesh */
const basketBand = (x, w, y0, y1, n) => {
  let g = ''; const step = (y1 - y0) / n;
  for(let i = 0; i < n; i++){
    const by = y0 + step * i + 2, bh = step - 4;
    g += `<rect x="${x + 2}" y="${by.toFixed(1)}" width="${w - 4}" height="${bh.toFixed(1)}"
            fill="#FFFFFF" fill-opacity=".28" stroke="#9EA5AB" stroke-width=".9"/>`;
    for(let k = 1; k < 6; k++)
      g += `<path d="M${(x + 2 + ((w - 4) / 6) * k).toFixed(1)} ${by.toFixed(1)}v${bh.toFixed(1)}"
              stroke="#AEB4BA" stroke-width=".5"/>`;
    for(let k = 1; k < 3; k++)
      g += `<path d="M${x + 2} ${(by + (bh / 3) * k).toFixed(1)}h${w - 4}" stroke="#AEB4BA" stroke-width=".5"/>`;
  }
  return g;
};

const PART_BAND = {
  /* ONE SHELF, AND AIR. The picture is the argument: a tower with a
     single shelf in it and four feet of nothing is a real thing a person
     wants, and until now it could not even be drawn. */
  SHELF_ONE:   (x, w, a, b) => board(x, a + (b - a) * 0.42, w, 3),
  ROD_ONE:     (x, w, a, b) => hangBand(x, w, a + (b - a) * 0.18, b),
  HANG:        (x, w, a, b) => hangBand(x, w, a, b),
  LONG_HANG:   (x, w, a, b) => hangBand(x, w, a, b),
  SHORT_HANG:  (x, w, a, b) => hangBand(x, w, a, b),
  DOUBLE_HANG: (x, w, a, b) => hangBand(x, w, a, (a + b) / 2) + hangBand(x, w, (a + b) / 2, b, 1),
  SHELVES:     (x, w, a, b, st) => shelfBand(x, w, a, b, Math.max(1, st?.o?.n ?? 4)),
  COUNTER:     (x, w, a, b) => {
    const t = Math.min(9, Math.max(6, (b - a) * .5)), y = b - t;
    return `<rect x="${(x - 3).toFixed(1)}" y="${y.toFixed(1)}" width="${w + 6}" height="${t.toFixed(1)}"
        rx="2" fill="url(#sBoard)" stroke="${SEC_C.edge}" stroke-width=".7"/>
      <rect x="${(x - 3).toFixed(1)}" y="${y.toFixed(1)}" width="${w + 6}" height="1.6" fill="#F8EEDC"/>
      <rect x="${(x - 3).toFixed(1)}" y="${(y + t).toFixed(1)}" width="${w + 6}" height="2.4"
        fill="#000" opacity=".13"/>`;
  },
  CUBBIES:     (x, w, a, b, st) => {
    const n = Math.max(2, st?.o?.n ?? 4); let g = shelfBand(x, w, a, b, n);
    g += `<rect x="${(x + w / 2 - 1.2).toFixed(1)}" y="${a.toFixed(1)}" width="2.4"
            height="${(b - a).toFixed(1)}" fill="url(#sPanel)"/>`;
    return g;
  },
  DRAWERS:     (x, w, a, b, st) => drawerBand(x, w, a, b,
                 (st?.o?.sizes?.length ? st.o.sizes : defaultDrawerSizes(st?.o?.n))),
  /* A PULL-OUT SHELF IS A SHELF THAT COMES OUT. The old picture was a
     stack of plain lines, which is a bookcase. One of them is drawn
     pulled forward on its runner with the runner showing, because that
     is the only thing that tells it from a fixed shelf. */
  /* ══════════════════════════════════════════════════════════════
     A PULL-OUT SHELF IS A SHELF THAT COMES OUT AT YOU

     Drawn as a stack of plain lines it is a bookcase, which is exactly
     what the old picture looked like and exactly what he said about it.
     The thing that makes it a pull-out is the pair of runners on the
     side panels and the fact that one of them is standing out in front
     of the cabinet. So: runners on every shelf, and the middle one
     drawn open, past the face of the tower, with its front edge, its
     top surface foreshortened and a shadow under it. It is pushed to
     the overlay so it is drawn after the carcass and really does sit in
     front of it. */
  PULLOUT:     (x, w, a, b, st, over) => {
    const n = Math.max(1, st?.o?.n ?? 3), step = (b - a) / n;
    let g = '';
    const openAt = n === 1 ? 1 : 2;
    for(let i = 1; i <= n; i++){
      const yy = a + step * i - 3;
      /* the runner each side: a pull-out shelf is the only shelf with one */
      g += `<rect x="${(x - 3).toFixed(1)}" y="${(yy - 2.6).toFixed(1)}" width="4" height="2.2" fill="url(#sMetal)"/>
            <rect x="${(x + w - 1).toFixed(1)}" y="${(yy - 2.6).toFixed(1)}" width="4" height="2.2" fill="url(#sMetal)"/>`;
      if(i !== openAt){ g += board(x + 1, yy, w - 2, 2.6); continue; }
      const ex = 9, dp = 8;                       // how far out, how deep it reads
      over.push(`<path d="M${(x + 1).toFixed(1)} ${yy.toFixed(1)}H${(x + w - 1).toFixed(1)}
          l${ex} ${dp}H${(x + 1 - ex).toFixed(1)}Z" fill="#F0DFC1" stroke="${SEC_C.edge}" stroke-width=".7"/>
        <path d="M${(x + 1 - ex).toFixed(1)} ${(yy + dp).toFixed(1)}H${(x + w - 1 + ex).toFixed(1)}v3.4
          H${(x + 1 - ex).toFixed(1)}Z" fill="url(#sBoard)" stroke="${SEC_C.edge}" stroke-width=".7"/>
        <rect x="${(x + 1 - ex).toFixed(1)}" y="${(yy + dp + 3.4).toFixed(1)}"
          width="${(w - 2 + ex * 2).toFixed(1)}" height="2.6" fill="#000" opacity=".16"/>
        <rect x="${(x + w / 2 - 10).toFixed(1)}" y="${(yy + dp + 1).toFixed(1)}" width="20" height="1.8"
          rx=".9" fill="url(#sMetal)"/>`);
    }
    return g;
  },
  BASKETS:     (x, w, a, b, st) => basketBand(x, w, a, b, Math.max(1, st?.o?.n ?? 3)),
  /* a tilt-out bin: the front swings out on a pivot, so it is drawn tilted */
  HAMPER:      (x, w, a, b) =>
    `<path d="M${x + 1} ${(a + 2).toFixed(1)}H${x + w - 1}l-4 ${(b - a - 4).toFixed(1)}H${x + 5}Z"
       fill="url(#sBoard)" stroke="${SEC_C.edge}" stroke-width=".8"/>
     <path d="M${x + 6} ${(a + 7).toFixed(1)}H${x + w - 6}l-3 ${(b - a - 13).toFixed(1)}H${x + 9}Z"
       fill="#CFC4B2" opacity=".85"/>
     <rect x="${(x + w / 2 - 9).toFixed(1)}" y="${(a + 4).toFixed(1)}" width="18" height="2" rx="1"
       fill="url(#sMetal)"/>`,
  SHOES:       (x, w, a, b) => shoeBand(x, w, a, b, false),
  SHOE_SLANT:  (x, w, a, b) => shoeBand(x, w, a, b, true),
  DOOR:        (x, w, a, b) =>
    `<rect x="${x}" y="${a.toFixed(1)}" width="${w}" height="${(b - a).toFixed(1)}" rx="1"
       fill="url(#sPanel)" stroke="${SEC_C.edge}" stroke-width=".8"/>
     <rect x="${x + 5}" y="${(a + 5).toFixed(1)}" width="${w - 10}" height="${(b - a - 10).toFixed(1)}"
       rx="1" fill="none" stroke="#C7A87C" stroke-width=".8"/>
     <rect x="${(x + w - 9).toFixed(1)}" y="${((a + b) / 2 - 7).toFixed(1)}" width="2.4" height="14"
       rx="1.2" fill="url(#sMetal)"/>`,
  GLASS_DOOR:  (x, w, a, b) =>
    `<rect x="${x}" y="${a.toFixed(1)}" width="${w}" height="${(b - a).toFixed(1)}" rx="1"
       fill="url(#sPanel)" stroke="${SEC_C.edge}" stroke-width=".8"/>
     <rect x="${x + 5}" y="${(a + 5).toFixed(1)}" width="${w - 10}" height="${(b - a - 10).toFixed(1)}"
       fill="url(#sGlass)" stroke="#B9C6CC" stroke-width=".7"/>
     <path d="M${x + 6} ${(b - 12).toFixed(1)}L${x + w - 7} ${(a + 14).toFixed(1)}"
       stroke="#FFFFFF" stroke-width="3" opacity=".4"/>
     <rect x="${(x + w - 9).toFixed(1)}" y="${((a + b) / 2 - 7).toFixed(1)}" width="2.4" height="14"
       rx="1.2" fill="url(#sMetal)"/>`,
  MIRROR:      (x, w, a, b) =>
    `<rect x="${x}" y="${a.toFixed(1)}" width="${w}" height="${(b - a).toFixed(1)}" rx="1"
       fill="url(#sPanel)" stroke="${SEC_C.edge}" stroke-width=".8"/>
     <rect x="${x + 4}" y="${(a + 4).toFixed(1)}" width="${w - 8}" height="${(b - a - 8).toFixed(1)}"
       fill="#C2D0D7"/>
     <path d="M${x + 4} ${(b - 14).toFixed(1)}L${x + w - 4} ${(a + 20).toFixed(1)}v12L${x + 4} ${(b - 4).toFixed(1)}Z"
       fill="#FFFFFF" opacity=".38"/>
     <path d="M${x + 4} ${(a + 24).toFixed(1)}L${x + w - 4} ${(a + 4).toFixed(1)}v7L${x + 4} ${(a + 32).toFixed(1)}Z"
       fill="#FFFFFF" opacity=".26"/>
     <rect x="${(x + w - 9).toFixed(1)}" y="${((a + b) / 2 - 7).toFixed(1)}" width="2.4" height="14"
       rx="1.2" fill="url(#sMetal)"/>`,
  OPEN:        () => '',
  FILLER:      (x, w, a, b) =>
    `<rect x="${(x + w / 2 - 4).toFixed(1)}" y="${a.toFixed(1)}" width="8" height="${(b - a).toFixed(1)}"
       fill="url(#sPanel)" stroke="${SEC_C.edge}" stroke-width=".7"/>`,
  /* ── the accessories ─────────────────────────────────────────────── */
  VALET:       (x, w, a, b) => {
    const y = a + Math.min(36, (b - a) * .3);
    return `<rect x="${x + 2}" y="${(y - 5).toFixed(1)}" width="7" height="10" rx="2" fill="url(#sMetal)"/>
      <rect x="${x + 8}" y="${(y - 1.4).toFixed(1)}" width="${w - 16}" height="2.8" rx="1.4" fill="url(#sMetal)"/>
      <circle cx="${(x + w - 8).toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#D9DDE0"/>
      <path d="M${(x + w / 2).toFixed(1)} ${(y + 1).toFixed(1)}v4" stroke="#A7AEB3" stroke-width="1"/>
      <path d="M${(x + w / 2 - 8).toFixed(1)} ${(y + 4).toFixed(1)}
               q8 -4.5 16 0 l7 5 -3.4 7 -3.6 -2.6 2.6 28 q-11 3 -22 0 l2.6 -28 -3.6 2.6 -3.4 -7Z"
        fill="#4C5A6E"/>
      <path d="M${(x + w / 2 - 8).toFixed(1)} ${(y + 6).toFixed(1)}q8 -3.4 16 0l.5 6q-8.5 2.6 -17 0Z"
        fill="#000" opacity=".1"/>
      <path d="M${(x + w / 2).toFixed(1)} ${(y + 8).toFixed(1)}v28" stroke="#3C4858" stroke-width=".9"/>`;
  },
  TIE_RACK:    (x, w, a, b) => pegArt(x, w, (a + b) / 2, 10, 9,
    [[0.22,'#3E4C60'],[0.5,'#8A7C6A'],[0.78,'#5E6B55']], 'tie'),
  BELT_RACK:   (x, w, a, b) => pegArt(x, w, (a + b) / 2, 6, 13,
    [[0.28,'#6A4B32'],[0.66,'#2E2A27']], 'belt'),
  SCARF_RACK:  (x, w, a, b) => {
    const y = (a + b) / 2;
    let g = `<rect x="${x + 2}" y="${(y - 2).toFixed(1)}" width="${w - 4}" height="3" rx="1.5" fill="url(#sMetal)"/>`;
    for(let i = 0; i < 4; i++){
      const cx = x + 10 + i * ((w - 20) / 3);
      g += `<path d="M${(cx - 5).toFixed(1)} ${(y + 1).toFixed(1)}v5a5 5.6 0 1 0 10 0v-5"
              fill="none" stroke="#C3C9CD" stroke-width="2"/>`;
    }
    g += `<path d="M${x + 12} ${(y + 8).toFixed(1)}q5 12 1 22 6 2 10 -3 3 7 9 6 -5 -7 -3 -24Z"
            fill="#A4514C" opacity=".93"/>`;
    return g;
  },
  PANTS_RACK:  (x, w, a, b) => {
    const n = 6; let g = '';
    for(let i = 0; i < n; i++){
      const y = a + 5 + i * ((b - a - 10) / (n - 1));
      g += `<rect x="${x + 2}" y="${y.toFixed(1)}" width="${w - 6}" height="2.2" rx="1.1" fill="url(#sMetal)"/>
            <circle cx="${(x + w - 5).toFixed(1)}" cy="${(y + 1.1).toFixed(1)}" r="1.8" fill="#D9DDE0"/>`;
    }
    const trouser = (tx, ty, len, col) =>
      `<path d="M${tx} ${ty.toFixed(1)}h17l-1.2 6h-14.6Z" fill="${col}"/>
       <path d="M${tx + 1.4} ${(ty + 6).toFixed(1)}h5.6l1 ${len.toFixed(1)}h-5.6Z" fill="${col}"/>
       <path d="M${tx + 9.6} ${(ty + 6).toFixed(1)}h5.6l-1 ${len.toFixed(1)}h-5.6Z" fill="${col}"/>
       <path d="M${tx} ${ty.toFixed(1)}h17l-.4 2h-16.2Z" fill="#000" opacity=".16"/>`;
    g += trouser(x + 7,  a + 6,  Math.max(16, b - a - 20), '#43505F');
    g += trouser(x + 32, a + 21, Math.max(14, b - a - 36), '#8E8273');
    g += trouser(x + 57, a + 36, Math.max(12, b - a - 52), '#5E6B55');
    return g;
  }
};
/* the frame a tie rack and a belt rack share */
function pegArt(x, w, y, n, pegLen, hang, kind){
  let g = `<rect x="${x + 2}" y="${(y - 2).toFixed(1)}" width="${w - 4}" height="3" rx="1.5" fill="url(#sMetal)"/>
    <rect x="${x + 1}" y="${(y - 5).toFixed(1)}" width="4" height="9" rx="1.5" fill="#AEB5BA"/>
    <rect x="${(x + w - 5).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="4" height="9" rx="1.5" fill="#AEB5BA"/>`;
  for(let i = 0; i < n; i++){
    const cx = x + 6 + ((w - 12) / (n - 1 || 1)) * i;
    g += `<rect x="${(cx - 1).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="2" height="${pegLen}" rx="1"
            fill="#D3D8DB"/>`;
  }
  /* they hang off the peg they are on, not in the air underneath it */
  const hook = y + pegLen - 1;
  for(const [t, col] of hang){
    const cx = x + 6 + (w - 12) * t;
    g += kind === 'tie'
      ? `<path d="M${(cx - 4).toFixed(1)} ${hook.toFixed(1)}q4 -3 8 0l-1.6 30 -2.4 6 -2.4 -6Z" fill="${col}"/>
         <path d="M${(cx - 4).toFixed(1)} ${hook.toFixed(1)}q4 -3 8 0l-.4 5q-3.6 -2 -7.2 0Z" fill="#000" opacity=".12"/>`
      : `<path d="M${(cx - 4.6).toFixed(1)} ${hook.toFixed(1)}q4.6 -3 9.2 0l-1.2 30h-6.8Z" fill="${col}"/>
         <rect x="${(cx - 4.4).toFixed(1)}" y="${(hook + 30).toFixed(1)}" width="8.8" height="6" rx="1" fill="#C9A96A"/>`;
  }
  return g;
}

/* ── the section itself ───────────────────────────────────────────────
   `bands` is [{ m, h, o }] bottom to top, the same shape as a tower's
   stack, with h in inches. Anything with no h shares what is left, which
   is exactly what the height solver does, so a card and the drawing it
   stands for always agree. */
function sectionArt(bands, usable = 80, cls = 'partart'){
  const { w:W, h:H, x0, x1, pw, top, bot, tk } = SEC;
  const ix = x0 + pw, iw = (x1 - pw) - ix;        // the inside of the carcass
  const iy0 = top + 5, iy1 = bot - tk;
  let fixed = 0, fill = 0;
  const rows = bands.map(st => {
    if(st.m === 'DRAWERS'){
      const sizes = st.o?.sizes?.length ? st.o.sizes : defaultDrawerSizes(st.o?.n);
      const h = drawerBankHeight(sizes); fixed += h; return { st, h };
    }
    if(st.h != null){ fixed += st.h; return { st, h:st.h }; }
    fill++; return { st, h:null };
  });
  const spare = Math.max(6, usable - fixed);
  for(const r of rows) if(r.h == null) r.h = spare / Math.max(1, fill);
  const total = rows.reduce((a, r) => a + r.h, 0) || 1;

  let y = iy1, inner = '', over = [];
  for(const r of rows){
    const bh = ((iy1 - iy0) * r.h) / total, a = y - bh;
    const draw = PART_BAND[r.st.m];
    if(draw) inner += draw(ix, iw, a, y, r.st, over);
    y = a;
  }
  return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"
    aria-hidden="true">${SEC_DEFS}
    <rect width="${W}" height="${H}" fill="#F1EADF"/>
    <rect x="${ix}" y="${top}" width="${iw}" height="${iy1 - top}" fill="url(#sBack)"/>
    ${inner}
    <rect x="${x0}" y="${top}" width="${pw}" height="${bot - top}" fill="url(#sPanel)"/>
    <rect x="${x1 - pw}" y="${top}" width="${pw}" height="${bot - top}" fill="url(#sPanel)"/>
    ${board(x0, top, x1 - x0, 5)}
    <rect x="${x0 + 1.5}" y="${bot - tk}" width="${x1 - x0 - 3}" height="${tk}" fill="#C5A87F"/>
    <rect x="${x0}" y="${bot}" width="${x1 - x0}" height="2" fill="#000" opacity=".12"/>
    ${/* a pull-out is in front of the carcass, which is the whole of what
         makes it a pull-out, so it is drawn after it */''}
    ${over.join('')}
  </svg>`;
}

/* what one part looks like on its own card: the part, at a height that
   shows it properly, in a section like the one it will be built into */
const CARD_STACK = {
  TIE_RACK:   [{ m:'TIE_RACK', h:null }],
  BELT_RACK:  [{ m:'BELT_RACK', h:null }],
  SCARF_RACK: [{ m:'SCARF_RACK', h:null }],
  PANTS_RACK: [{ m:'PANTS_RACK', h:null }],
  COUNTER:    [{ m:'DRAWERS', o:{ sizes:[7.5,7.5,7.5] } }, { m:'COUNTER', h:16 },
                { m:'SHELVES', h:null, o:{ n:2 } }],
  HAMPER:     [{ m:'HAMPER', h:30 }, { m:'HANG', h:null }],
  BASKETS:    [{ m:'BASKETS', h:34, o:{ n:3 } }, { m:'HANG', h:null }]
};
const partSection = id => sectionArt(
  CARD_STACK[id] || [{ m:id, h:null, o:{} }], 80);

import { SPEC, MODULES, MODULE_IDS, PULLS, PULL_FINISHES,
         buildDesign, makeBay, defaultStackFor, canAdd, PRESETS, PRESET_ALIAS, isAddon,
         presetDelta, presetFits, DOOR_SPEC, FIT_SPEC, wallLoss, depthLimit, wallGap,
         ROOM_PLANS, cornerBlocked, sideRunStart,
         slots, setSlot, clearSlot, setCounter, canSit,
         DRAWER_SIZES, defaultDrawerSizes, drawerBankHeight,
         baseHeight, canOffer, DOOR_INSIDE, DOOR_INSIDE_DEF, resolvePull, hardwareFor,
         cabTopRange, clampCabTop, TOWER_PRESETS, TOWER_GROUPS,
         modMinH, unitsThatFit } from './design.js?v=a3c1cf93';
import { makeRenderer, setupLighting, fitShadowCamera, loadSharedMaps,
         panelGeo, garmentGeo, makeComposer, pixelRatioFor } from './render.js?v=a3c1cf93';
import { initSheet, finishMaterial, scaledMaterial, hardwareMaterial,
         clothMaterials, clearCaches } from './materials.js?v=a3c1cf93';

/* The catalogue fetch is kicked off by an inline script in the page <head>,
   long before this module graph has finished downloading, so by the time we
   get here it is usually already in hand. This used to be a plain fetch on
   this line, which meant the request did not even leave the browser until
   three.js and every module below it had been parsed and evaluated. */
const cat = await (window.__CAT || Promise.resolve(null))
  .then(c => c || fetch((window.BASE||"")+'assets/data/catalog.json').then(r=>r.json()));
/* The loose hardware behind every part: cams, dowels, screws, shelf pins.
   Without it an enquiry lists forty panels and nothing that holds them
   together, which is exactly what goes missing on the van. It is small and
   it must not hold the builder up, so a failure here costs the hardware
   lines and nothing else. */
const HARDWARE_MAP = await fetch((window.BASE||"")+'assets/data/hardware.json')
  .then(r => r.ok ? r.json() : null).catch(() => null);
const $ = s => document.querySelector(s);

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
  { id:'pipe',    label:'Pipe / bulkhead', art:'M4 3h6v18H4z M10 7h10v5H10z' },
  { id:'machines',label:'Washer and dryer', art:'M2 4h9v16H2zM13 4h9v16h-9M6.5 9.5a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4M17.5 9.5a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4' },
  { id:'sink',    label:'Utility sink',     art:'M3 10h18v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM12 10V5a2 2 0 0 1 2-2h3M12 14v3' }
];

const S = {
  type:'reach-in', shape:'straight', room:{w:72,d:24,h:96}, mounting:'floor',
  /* How high the cabinetry goes, in inches off the floor. The ceiling is the
     room; this is the closet. They were the same number before, pinned at
     84", so a tall room built a short closet and said nothing about it. */
  cabTop: SPEC.topShelf,
  finish: cat.finishes.find(f=>f.x>=0)?.n || cat.finishes[0].n,
  frontFinish:null, pull:'bar4', pullFinish:'nickel',
  runs:{}, sel:null, spin:false, evening:false, grid:false,
  /* clothes, folded stacks and shoes in the drawing. On by default: an
     empty closet does not say what any of it is for. The toolbar turns
     it off, which is what a fitter checking a measurement wants. */
  styled:true,
  door:'none',
  /* How wide the opening is. Nothing is built from it, so it does not touch
     the engine; it travels with the enquiry because the crew needs to know
     what size doors are coming off and going back on, and the customer
     measured it anyway. Zero means they did not say. */
  doorW:0,
  /* The baseboard is not decoration, it is the reason a closet does not sit
     flush to the wall. `handling` says what happens where the run meets it,
     and `measured` says whether the width they gave was taken wall to wall or
     between the baseboards, which changes how much wall there actually is. */
  base:{ h:4.5, t:0.75, measured:'wall', handling:'scribe' },
  /* A back on every tower. Off, because a built-in closet's back is the
     wall and that is what gets installed. */
  backs:false,
  /* Where two runs meet. There is one answer now: the back wall runs the
     full width and the side wall stands SPEC.sideStandoff clear of it. Kept
     as a field because the engine and the enquiry both read it. */
  corner:'wall-to-wall',
  /* Which half of the selected section is being changed: 'top', 'bottom' or
     null for neither. */
  pick:null,
  /* which placed attachment inside the selected tower is open */
  add:null,
  /* 'kick' or 'top' when a carcass piece of the selected tower is open */
  carc:null,
  /* [{k, wall, at}] where at is inches along that wall from its left end */
  fittings:[],
  /* THE ROOM IS NOT THE CLOSET, AND IT IS NOT FIXED EITHER.
     A closet drawn against one grey wall on one oak floor reads as a
     picture of a showroom rather than a picture of their room. These
     three change the shell only: no part, no price, no cut list. */
  wallTone:'greige', floorTone:'oak', trimTone:'white'
};
const DEPTHS = [12, 14, 16, 18, 20, 22, 24];
const ROOM_TONES = {
  wall: [ { id:'greige', label:'Greige',   hex:0xC3BDB4 },
          { id:'white',  label:'Off white',hex:0xE8E4DD },
          { id:'grey',   label:'Grey',     hex:0x9DA2A4 },
          { id:'sage',   label:'Sage',     hex:0xA7B0A1 },
          { id:'navy',   label:'Navy',     hex:0x4A5666 } ],
  floor:[ { id:'oak',    label:'Oak',      hex:0xFFFFFF },
          { id:'walnut', label:'Walnut',   hex:0xB08455 },
          { id:'ash',    label:'Pale ash', hex:0xE6D8C3 },
          { id:'grey',   label:'Grey wash',hex:0xAFACA6 } ],
  trim: [ { id:'white',  label:'White',    hex:0xFFFFFF },
          { id:'soft',   label:'Soft white',hex:0xF0ECE4 },
          { id:'black',  label:'Black',    hex:0x2A2A2C } ]
};
const tone = (k, id) => (ROOM_TONES[k].find(x => x.id === id) || ROOM_TONES[k][0]);
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
/* And a side wall is the wall MINUS where its run is allowed to begin.
   This was taking off a flat 24", the default hanging depth, while cfg()
   actually starts a side run at the back run's own depth plus the twelve
   inch standoff. On an 84" deep room with a 24" back run that is 36", so the
   layout handed out 60" of towers starting at 36 and the last two feet of
   the run were built into the far wall. The drawing showed it; nobody had
   drawn it before. If there is no back run there is nothing to stand clear
   of and the whole wall is available. */
function sideStart(){
  if(!S.runs.back?.on || !(S.runs.back.bays || []).length) return 0;
  return sideRunStart(Math.min(S.runs.back.depth ?? SPEC.hangDepth, wallDepthCap('back')));
}
function wallLength(wall){
  const base = wall==='back' ? S.room.w : S.room.d - sideStart();
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
/* How deep this wall may be built: the product range, and never deeper than
   the wall itself leaves once the door hardware has had its share. */
function clampDepth(v, wall){
  const cap = Math.min(SPEC.runDepthMax, wallDepthCap(wall));
  const n = Math.round(Number(v) * 2) / 2;
  return Math.min(cap, Math.max(SPEC.runDepthMin, Number.isFinite(n) ? n : SPEC.hangDepth));
}
/* A FILLER IS MEASURED BY DIFFERENT RULES THAN A TOWER.
   A tower is 24" to 36" because of what has to fit inside it and how far
   a 3/4" shelf will span. A filler holds nothing and spans nothing: it is
   whatever is left over, from an inch to about ten, and past ten you
   should have built a tower. */
const FILLER_MIN = 1, FILLER_MAX = 10;
const isFiller = b => !!b && b.stack?.length === 1 && b.stack[0].m === 'FILLER';
function clampBay(v, filler){
  const n = Math.round(v * 2) / 2;
  return filler ? Math.min(FILLER_MAX, Math.max(FILLER_MIN, n))
                : Math.min(SPEC.bayMax, Math.max(SPEC.bayMin, n));
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

   So every tower now carries `at`: inches from the LEFT CORNER of its wall.
   Towers are kept sorted by `at`, so the index of a tower in this array is
   still the index the 3D drawing and the quote use. Gaps are not stored; they
   are worked out from the spaces between, which means a gap can never drift
   out of agreement with the towers either side of it. */

/* every tower's position, filling in anything that predates `at` */
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
/* ── the numbers printed along a wall ─────────────────────────────────────
   Every gap and every tower was rounded on its own, so a 20.4" gap, a 24"
   section, a 36" section and a 15.6" gap printed as 20 + 24 + 36 + 17 = 97
   under a ruler that said 96. Round them together instead: round each one,
   then give the whole rounding error to the item that was furthest from a
   whole inch. Every number is within half an inch of the truth and the row
   adds up to the wall it is drawn on, which is the thing anyone checks. */
function wholeTape(items, total){
  const T = Math.round(total);
  const out = items.map(it => ({ ...it, n: Math.round(it.w) }));
  let diff = T - out.reduce((a, x) => a + x.n, 0);
  while(diff !== 0 && out.length){
    const step = diff > 0 ? 1 : -1;
    /* hand the inch to whichever number lost the most in rounding, and never
       take one off something that is already at zero */
    let best = -1, bestErr = -Infinity;
    out.forEach((x, i) => {
      if(step < 0 && x.n <= 0) return;
      const err = step * (x.w - x.n);
      if(err > bestErr){ bestErr = err; best = i; }
    });
    if(best < 0) break;
    out[best].n += step; diff -= step;
  }
  return out;
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
/* the first stretch of bare wall a tower this wide would fit in */
function firstFit(wall, w){
  for(const g of gapsOn(wall)) if(g.w >= w - 0.01) return g.at;
  return null;
}
/* how far a tower can travel without crossing its neighbours or the corners */
function travelRange(wall, index){
  const len = wallLength(wall), L = layout(wall);
  const k = L.findIndex(s => s.i === index);
  if(k < 0) return { lo:0, hi:Math.max(0, len) };
  const me = L[k];
  return { lo: k > 0 ? L[k-1].end : 0,
           hi: (k < L.length-1 ? L[k+1].at : len) - me.w };
}
/* put a tower at a given distance from the corner, clamped to what is free */
function moveSection(wall, index, at){
  const { lo, hi } = travelRange(wall, index);
  const b = S.runs[wall].bays[index]; if(!b) return null;
  /* whole inches. Half an inch of position along a wall is not a thing anyone
     measures or asks for, and it was the only reason the numbers printed under
     the strip did not add up to the wall. */
  b.at = Math.max(lo, Math.min(hi, Math.round(at)));
  sortRun(wall);
  return b.at;
}
/* ══════════════════════════════════════════════════════════════════════
   THE CABINETRY GOES ROUND THE WASHING MACHINE

   A washer and dryer and a utility sink take their width off the wall, so
   the layout was always the right LENGTH. It was never in the right
   PLACE: the towers still started in the corner and the machines were
   drawn standing in front of them.

   Say where a machine is and the towers on that wall move clear of it.
   They keep their order and their widths where the free stretches allow,
   and they are squeezed in proportion only where they do not fit. A
   tower that cannot fit anywhere at all is dropped rather than drawn
   through an appliance.
   ══════════════════════════════════════════════════════════════════════ */
function blockedSpans(wall){
  return placedFittings()
    .filter(f => f.wall === wall && FIT_SPEC[f.k]?.prop)
    .map(f => { const at = Math.max(0, +(f.at || 0));
                return [at, at + (+(f.w ?? FIT_SPEC[f.k].w) || 0)]; })
    .sort((a, b) => a[0] - b[0]);
}

/* the stretches of this wall with nothing standing in them */
function freeSpans(wall){
  const len = wallLength(wall);
  let out = [[0, len]];
  for(const [a, b] of blockedSpans(wall)){
    const next = [];
    for(const [x, y] of out){
      if(b <= x || a >= y){ next.push([x, y]); continue; }
      if(a > x) next.push([x, a]);
      if(b < y) next.push([b, y]);
    }
    out = next;
  }
  return out.filter(([a, b]) => b - a > 0.5);
}

/* what the last clear-out cost, so the panel can say so out loud rather
   than quietly deleting somebody's towers */
let PROP_NOTE = '';

function clearProps(wall){
  const r = S.runs[wall];
  if(!r?.bays?.length) return false;
  const spans = freeSpans(wall);
  const blocked = blockedSpans(wall);
  if(!blocked.length) return false;

  const bays = [...r.bays].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  const room = spans.reduce((a, [x, y]) => a + (y - x), 0);
  const want = bays.reduce((a, b) => a + b.w, 0);
  /* everything has to come down in proportion before anything is placed,
     or the last tower is the only one that pays for the machine */
  const k = want > room ? room / want : 1;

  const kept = [];
  let si = 0, at = spans.length ? spans[0][0] : 0;
  for(const b of bays){
    let w = Math.max(SPEC.bayMin, Math.round(b.w * k));
    /* walk forward until this tower has a stretch it fits in */
    while(si < spans.length && at + w > spans[si][1] + 0.01){
      si++; if(si < spans.length) at = spans[si][0];
    }
    if(si >= spans.length) break;               // nothing left that it fits
    b.at = +at.toFixed(1); b.w = w;
    kept.push(b);
    at += w;
  }
  const lost = bays.length - kept.length;
  const standing = placedFittings()
    .filter(f => f.wall === wall && FIT_SPEC[f.k]?.prop)
    .map(f => 'the ' + FIT_SPEC[f.k].label.toLowerCase());
  const list = standing.length > 1
    ? standing.slice(0, -1).join(', ') + ' and ' + standing[standing.length - 1]
    : standing[0] || 'what is standing there';
  PROP_NOTE = lost
    ? `${lost} tower${lost === 1 ? '' : 's'} came off the ${WALL_LABEL[wall].toLowerCase()}. `
      + `With ${list} on it there is not ${SPEC.bayMin}" of clear wall left for `
      + `${lost === 1 ? 'it' : 'them'}. Make the machines narrower, slide them along `
      + `the wall, or build on another wall.`
    : '';
  r.bays = kept;
  sortRun(wall);
  return true;
}

/* what design.js needs: towers with the bare wall between them spelled out */
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
/* PULL A RUN BACK INSIDE ITS WALL.

   A room plan writes its tower widths straight in, and the side run's own
   starting point moves whenever the back run gets deeper or shallower. Both
   can leave a run longer than the wall it stands on, which the engine will
   happily build and the drawing will happily show going through the far
   wall. This squeezes the towers back down in proportion, keeps them at or
   above the minimum width, and re-lays them from the start of the run, so
   what is drawn is always something that fits in the room.

   It does nothing at all when the run already fits, so a design somebody
   laid out by hand is never quietly rearranged underneath them. */
function fitWall(wall){
  const r = S.runs[wall]; if(!r || !r.bays.length) return false;
  const len = wallLength(wall);
  const L = layout(wall);
  const end = L.reduce((a, s) => Math.max(a, s.end), 0);
  if(end <= len + 0.05) return false;
  /* Everything is scaled by the same factor, positions as well as widths, so
     the run keeps its proportions: the gap the customer left for a radiator
     stays where it was in relation to the towers either side of it. */
  const k = len / end;
  for(const s of L){
    s.bay.w  = +Math.max(SPEC.bayMin, s.w * k).toFixed(1);
    s.bay.at = +Math.max(0, s.at * k).toFixed(2);
  }
  /* Scaling is exact until the minimum width catches one of them. Re-lay
     from the start so nothing overlaps its neighbour after that. */
  let at = 0;
  for(const s of L){
    s.bay.at = +Math.max(s.bay.at, at).toFixed(2);
    at = s.bay.at + s.bay.w;
  }
  /* If the minimum width stopped the squeeze short, drop towers off the end
     until the rest fit rather than leave one standing in the wall. */
  while(r.bays.length > 1 && at > len + 0.05){
    const last = r.bays.pop();
    at -= last.w;
  }
  r.bays = layout(wall).map(s => s.bay);
  return true;
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
   customer lands on the tower they were just reading about, already drawn
   and already priced, instead of on an empty room with a blank panel. */
const qPre = qp.get('preset');
if(qPre){
  /* an id from one of the old combination pages resolves to the piece it was
     really about, so a bookmarked link still lands on something */
  const want = PRESET_ALIAS[qPre] || qPre;
  const pre = PRESETS.find(p => p.id === want);
  const wall = Object.keys(S.runs).find(w => S.runs[w]?.on);
  if(pre && wall){
    const nb = makeBay(clampBay(Math.min(32, wallLength(wall))),
                       structuredClone(pre.stack), true);
    nb.at = 0;
    S.runs[wall].bays.push(nb);
    S.sel = { wall, i:0 };
  }
}

/* Every "See the build" on a room page carries ?plan=, so the photograph the
   customer pressed opens as a drawn, priced room rather than as an empty box
   of the right type. A plan sets the room, the walls and every tower; from
   that point it is theirs and everything in it can be changed. */
const qPlan = qp.get('plan');
if(qPlan && ROOM_PLANS[qPlan]){
  const pl = ROOM_PLANS[qPlan];
  S.type = pl.type;
  S.room = { ...pl.room };
  S.mounting = pl.mounting || 'floor';
  applyShape(pl.shape);
  for(const wall of Object.keys(pl.runs || {})){
    const r = S.runs[wall];
    if(!r) continue;
    let at = 0;
    r.bays = pl.runs[wall].map(sec => {
      const b = makeBay(sec.w, structuredClone(sec.s), sec.top !== false);
      b.at = at; at += sec.w;
      return b;
    });
  }
  /* A plan's side runs are written from the corner; they still have to clear
     the back run and its standoff once they are in a real room. */
  for(const wall of Object.keys(pl.runs || {})) fitWall(wall);
  const first = Object.keys(pl.runs || {}).find(w => S.runs[w]?.bays.length);
  if(first) S.sel = { wall:first, i:0 };
}

function cfg(){
  const runs=[];
  for(const wall of ['back','left','right']){
    const r=S.runs[wall]; if(!r||!r.on) continue;
    /* The back run takes the corner unless they asked for it to stop short.
       The side runs always begin clear of the back run's depth, because two
       boxes cannot occupy the same cubic foot. */
    const backDepth = Math.min(S.runs.back?.depth ?? SPEC.hangDepth, wallDepthCap('back'));
    /* The back wall runs wall to wall. A side wall starts clear of it by the
       back run's depth plus the twelve inch standoff, because a side tower
       pushed up against the back run gives you a corner nobody can reach
       into. That gap is bridged with a top and a bottom piece, which are
       built and listed by the engine. */
    const start = wall==='back' ? 0 : sideRunStart(backDepth);
    /* clamp here, not only inside buildDesign, so the plan drawing, the click
       volumes and the quote are all reading the same depth */
    runs.push({wall, start, depth:Math.min(r.depth, wallDepthCap(wall)), bays:withGaps(wall)});
  }
  return { room:S.room, mounting:S.mounting, cabTop:S.cabTop, finish:S.finish,
           frontFinish:S.frontFinish||S.finish, pull:S.pull, pullFinish:S.pullFinish,
           door:S.door, doorW:S.doorW,
           doorLabel:(DOORS.find(d => d.id === S.door) || {}).label || '',
           base:S.base, backs:S.backs, corner:'wall-to-wall',
           fittings:S.fittings.filter(f=>f.placed), runs, styled:S.styled !== false };
}

/* ───────── scene ───────── */
const canvas=$('#c3d');
const renderer=makeRenderer(canvas);
const scene=new THREE.Scene();
/* THE ROOM HAS TO READ AS A ROOM.
   Walls at 0xE4E4E3 and a baseboard at pure white, on a cream page, over a
   cream canvas background: an empty room came back at a mean brightness of
   228 out of 255, and on a real screen that is nothing at all. It was
   reported as a broken renderer three times while rendering perfectly.
   Nudging it to 0xDCD8D2 took the mean to 210, which was still inside the
   page's own tone. The surround is now decisively darker than any surface
   in the room, the way every configurator that works does it, so the room
   is an object sitting on a backdrop and not a pale shape on pale paper. */
scene.background = new THREE.Color(0x9C968E);
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
/* A washing machine is painted steel, not brushed nickel and not oak. One
   material for every appliance body so the pair reads as a pair. */
const APPLIANCE = new THREE.MeshStandardMaterial({
  color:0xE6E7E6, roughness:0.38, metalness:0.12, envMapIntensity:0.9 });
/* Shoes on a shelf. Dark and slightly sheened, so a pair reads as a pair
   rather than as two more blocks of melamine. */
const SHOEMAT = [0x3A3630, 0x55504A, 0x2B2A2A, 0x7A6F60]
  .map(c => new THREE.MeshStandardMaterial({ color:c, roughness:0.52, metalness:0,
                                             envMapIntensity:0.8 }));
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

/* A lost context is the other way the stage goes grey and stays grey: the
   browser drops the GPU resources, every later draw is a no-op, and nothing
   on the page says so. Ask for it back, rebuild on the way in, and say what
   happened while it is gone. */
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  console.warn('[render] WebGL context lost');
  document.getElementById('bload')?.classList.remove('gone');
}, false);
canvas.addEventListener('webglcontextrestored', () => {
  console.warn('[render] WebGL context restored, rebuilding');
  postDead = false;
  try { renderer.shadowMap.needsUpdate = true; } catch(e){}
  needsFrame = true;
  document.getElementById('bload')?.classList.add('gone');
}, false);

/* One place that actually draws, so a post chain that throws can never leave
   the stage as nothing but the clear colour. If the composer fails once it is
   dropped for the rest of the session and every later frame goes straight to
   the renderer. A customer gets a closet without ambient occlusion instead of
   a grey rectangle, and the reason lands in the console. */
let postDead = false;
function paint(usePost){
  if(usePost && composer && !postDead){
    try { composer.render(); return; }
    catch(e){ postDead = true; composer = null;
      console.warn('[render] post-processing failed, drawing direct from here on', e); }
  }
  renderer.render(scene, cam);
}

function sizeNow(){ const r=canvas.parentElement.getBoundingClientRect();
  return {w:Math.max(320,r.width|0), h:Math.max(260,r.height|0)}; }
let lastW = 0, lastH = 0;
function resize(){ const {w,h}=sizeNow();
  if(w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  renderer.setPixelRatio(pixelRatioFor(w,h));
  renderer.setSize(w,h,false);
  cam.aspect=w/h; cam.updateProjectionMatrix(); if(composer) composer.setSize(w,h);
  needsFrame = true; }
addEventListener('resize',resize);

/* The canvas is sized from its parent, but the parent is sized by a flex
   layout that the RIGHT-HAND PANEL drives. Open "Ready-made layouts", add a
   drawer row, trip a warning, switch a step: the stage changes shape and the
   window never fires a resize event, so the renderer kept its old width and
   the camera kept its old aspect. The closet then drew off centre and ran off
   the left edge of the frame, which is the drifting the drawing kept doing.

   A ResizeObserver watches the element that actually changes instead of
   guessing from the window, so every one of those cases is covered and the
   280ms timeout that used to paper over the accordion case is gone. */
if(typeof ResizeObserver === 'function' && canvas.parentElement){
  let pending = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(resize);
  });
  ro.observe(canvas.parentElement);
}
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
/* ══════════════════════════════════════════════════════════════════════
   MOVING AND STILL

   The ambient occlusion pass is a 16-sample GTAO over the whole canvas. It
   is what makes the drawing look like cabinetry rather than flat boxes and
   it is worth every millisecond — WHEN THE PICTURE IS STILL. While the
   camera is moving it was running on every single frame, at a cost nobody
   could see, because the thing it is shading is sliding across the screen.
   That is the orbit lag: not the closet, the shading of it.

   So: plain render while anything is moving, one composed frame the moment
   it stops. The last frame of a drag is the one you look at. */
/* ?perf=1 exposes the renderer, the scene and a frame counter so the two
   render paths can be timed against each other rather than guessed at. */
const AUDIT = new URLSearchParams(location.search).has('audit');
const PERF = new URLSearchParams(location.search).has('perf')
  ? (window.__perf = { frames:0, get calls(){ return renderer.info.render.calls; },
      get tris(){ return renderer.info.render.triangles; },
      plain(){ renderer.render(scene, cam); },
      composed(){ paint(true); } })
  : null;
let MOVING = 0, shadowDirty = true;
/* the room's four walls, with the direction each one faces into the room */
const WALLS = [];
/* Which way each run faces into the room, and every mesh standing on it,
   so a run can be taken out of the way as one thing. */
const RUN_N = { back:new THREE.Vector3(0,0,1), left:new THREE.Vector3(1,0,0),
                right:new THREE.Vector3(-1,0,0) };
const RUNMESH = { back:[], left:[], right:[] };
/* each run's own bounds, rebuilt with the closet, so "how far is that
   run from here" is one clamp instead of a walk over every panel */
const RUNBOX = { back:null, left:null, right:null };
const DOORMESH = [];
const _look = new THREE.Vector3(), _near = new THREE.Vector3();
const _camV = new THREE.Vector3();
/* Up here with the others, not beside the drag code 750 lines down: the
   render loop below reads it on its very first frame, and a `let` further
   down the file is in its temporal dead zone at that moment. */
let DRAGGING = false;
let dimDirty = true;
const stir = () => { MOVING = performance.now(); needsFrame = true; dimDirty = true; };
ctl.addEventListener('change', stir);
canvas.addEventListener('pointerdown', stir);
addEventListener('wheel', e => { if(e.target === canvas) stir(); }, { passive:true });

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

  /* 130ms after the last nudge the picture is settled, and that is the
     frame that gets the full pass. */
  const moving = (MOVING && (performance.now() - MOVING < 130)) || DRAGGING;
  if(!moving && MOVING){ MOVING = 0; needsFrame = true; }
  /* the one frame where the expensive passes are worth paying for */
  /* ══════════════════════════════════════════════════════════════════
     NOTHING STANDS BETWEEN YOU AND THE RUN YOU ARE WORKING ON

     Five rules have been tried here. Each one was true and each one was
     only half the answer, which is why something has been left standing
     in the frame every single round.

     Half one: a run is bolted to a wall, so if you are looking THROUGH
     that wall you are looking through its cabinetry as well. Take the
     direction the camera points and drop anything whose inward normal
     agrees with it. That gets rid of the run you have walked behind.

     Half two, the one that was missing: a run can be side-on to the
     camera, not behind you at all, and still be planted squarely between
     you and the wall you are trying to read. Standing out past the front
     left corner and looking at the back wall, the left-hand run is
     side-on. Its normal says nothing. It is simply in the way.

     So both: a run is drawn when you are not looking through its wall
     AND it is not nearer to you than the run you have open. Nearer is
     measured to the closest corner of each run's own box, which is one
     clamp rather than a walk over sixty panels, and it does not care
     about angles at all, which is exactly why it works where five angle
     rules did not.

     With nothing selected there is no "the run you are working on", so
     only the first half applies and the whole room is drawn.

     The look vector is NOT flattened. Flattened, a steep overhead view
     normalises a near-zero vector into whatever rounding leaves behind.
     Used whole, a steep view brings every dot toward zero, which is the
     right answer: from overhead nothing is in front of anything. */
  _look.copy(ctl.target).sub(cam.position);
  if(_look.lengthSq() > 1e-6){
    _look.normalize();
    let frontVis = true;
    /* how far away the run being edited is, or null when none is open */
    const selWall = S.sel?.wall;
    let selDist = null;
    if(selWall && RUNBOX[selWall]){
      RUNBOX[selWall].clampPoint(cam.position, _near);
      selDist = cam.position.distanceTo(_near);
    }
    for(const w of WALLS){
      const vis = _look.dot(w.n) < 0.15;
      if(w.tag === 'front') frontVis = vis;
      if(w.m.visible !== vis){
        w.m.visible = vis;
        /* its baseboard is part of the wall, not part of the room */
        for(const b of w.base) b.visible = vis;
        needsFrame = true;
      }
      /* and the cabinetry standing on it */
      const list = RUNMESH[w.tag];
      if(!list || !list.length) continue;
      let rv = vis;
      if(rv && selDist != null && w.tag !== selWall && RUNBOX[w.tag]){
        RUNBOX[w.tag].clampPoint(cam.position, _near);
        /* 2" of slack so two runs level with each other, which is what
           the two ends of a corner are, do not flicker in and out */
        if(cam.position.distanceTo(_near) < selDist - 2) rv = false;
      }
      if(list[0].visible !== rv){
        for(const m of list) m.visible = rv;
        needsFrame = true;
        dimDirty = true;
      }
    }
    /* THE DOOR IS PART OF THE NEAR WALL.
       It hangs in that wall's opening, so the moment that wall is taken
       out of the way to let you look in, the door goes with it. From
       inside looking out, and from either side, the wall is there and so
       is the door, open on its hinge at the width that was chosen. */
    if(DOORMESH.length && DOORMESH[0].visible !== frontVis){
      for(const m of DOORMESH) m.visible = frontVis;
      needsFrame = true;
    }
  }
  /* ══════════════════════════════════════════════════════════════════
     THE SIZES, WRITTEN ON THE 3D

     The flat views have carried every dimension from the start and the
     3D carried none, so the view a customer actually spends their time
     in was the one view you could not read a measurement off. 17squares
     writes them straight on to the picture and that is plainly right.

     Each tower's width over the top of it, the whole wall above that,
     projected through the same camera so the labels travel with it. Only
     on a settled frame: doing it per frame while the camera is moving is
     a layout thrash for labels nobody can read mid-swing anyway. */
  if(!moving && dimDirty && built){ dimDirty = false; paintDims(); }
  if(!moving && shadowDirty){
    shadowDirty = false; renderer.shadowMap.needsUpdate = true; needsFrame = true;
  }

  /* THE LOADER COMES OFF HERE, ABOVE THE FRAME GATE.

     It used to come off after the render below, which is past `if(!needsFrame)
     return`. The closet finishes building, `built` goes true, and on the very
     next frame nothing has changed so the loop returns at the gate and never
     reaches the line that hides the loader. Nothing changes after that either,
     so needsFrame stays false and "Drawing your room" sits over a finished
     closet forever. It depended entirely on `built` happening to flip on a
     frame that was already going to draw. */
  if(!drawnOnce && built){
    drawnOnce = true;
    document.getElementById('bload')?.classList.add('gone');
    const idle = window.requestIdleCallback || (f => setTimeout(f, 90));
    idle(() => { upgradeRoom(); idle(startComposer, {timeout:1500}); }, {timeout:900});
  }

  if(!needsFrame) return;
  needsFrame = false;
  paint(composer && !moving);
  /* a hook for measuring, off unless ?perf=1 is on the URL */
  if(PERF) PERF.frames++;

  /* First frame with the closet actually in it. Everything that makes the
     picture nicer rather than present waits for this moment and then goes in
     order: the real floor and walls first, because that is what you can see,
     then the post-processing chain behind it. */
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
  /* 1024, not 2048. The albedo plus its derived normal and roughness were
     33MB of the scene's texture budget on their own, and a floor seen from
     eye height at eight feet cannot resolve 2048. */
  const S = 1024, ROWS = 6, ph = S / ROWS;
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
     Derived at half resolution: the Sobel pass is per pixel, so half is four
     times cheaper, and a normal map carrying grain this fine is
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
  /* PAINT, NOT PAPER.
     The walls were 0xE4E4E3 and the baseboard pure white, which on a cream
     page gave an empty room a mean brightness of 228 out of 255: a correct
     render of a room nobody could see. Darkening the surround alone did
     almost nothing, because the room fills the canvas and the surround is
     a sliver at the corners. It is the walls themselves that had to come
     down. At this tone the back wall, the returns, the baseboard and the
     floor all separate from each other and from the page. */
  const wallMat = () => new THREE.MeshStandardMaterial({
    map: T.wall, color: tone('wall', S.wallTone).hex, roughness: .95, metalness: 0,
    envMapIntensity: .45, side: THREE.FrontSide });

  const plane = (w, h, px, py, pz, rx, ry, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(px, py, pz); m.rotation.set(rx, ry, 0);
    m.receiveShadow = true; shell.add(m); return m;
  };

  // walls — the tooth texture repeats on a real-world scale, not per-wall
  /* Each wall remembers which way it faces into the room, so the render loop
     can drop the ones the camera has gone behind.

     FrontSide with inward normals was supposed to handle this on its own, and
     it does for the wall you are looking straight through. It does NOT handle
     a wall you are beside: orbit round and the left or right wall swings
     between the camera and the closet, edge-on, and fills the frame with a
     grey slab. That is the "wall in front of the closet". Culling per frame
     by which side the camera is actually on fixes every angle, not just the
     head-on one. */
  /* SOLID WALLS, AND A HAIR OF DAYLIGHT BEHIND THE CABINETRY.

     Two things were wrong and they looked like one thing.

     A wall was a zero-thickness plane, so from any angle that caught one
     edge-on it was a hairline and the room read as paper. They are 4"
     boxes now, which is a real stud wall, and the top edge of the room
     reads as something built.

     And the run's back face sat EXACTLY on the wall plane. Two coplanar
     surfaces is a depth-buffer tie: the panel and the wall swap places
     from frame to frame as the camera moves, which is the flicker along
     the back of every tower. The inner face of the wall is pulled back
     five hundredths of an inch, which nobody can see and which the depth
     buffer can always resolve. */
  const WT = 4;                            // real wall thickness
  const EPS = 0.05;                        // daylight behind the cabinetry
  WALLS.length = 0;
  const mkWall = (w, h, px, py, pz, nx, nz, tag) => {
    const mat = wallMat();
    mat.map = T.wall.clone(); mat.map.needsUpdate = true;
    mat.map.repeat.set(w / 40, h / 40);
    mat.side = THREE.DoubleSide;           // it is a box, it has an inside and an out
    /* the box grows AWAY from the room along its own inward normal */
    const sx = nx ? WT : w, sz = nz ? WT : w;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat);
    m.position.set(px - nx * (WT/2 + EPS), py, pz - nz * (WT/2 + EPS));
    m.receiveShadow = true;
    m.userData.roomwall = tag;
    shell.add(m);
    WALLS.push({ m, tag, base:[], p:new THREE.Vector3(px, py, pz),
                 n:new THREE.Vector3(nx, 0, nz) });
    return m;
  };
  const X0 = 0;                            // room's left wall IS closet x = 0
  mkWall(W, H, X0 + W/2, H/2, 0,    0,  1, 'back');
  mkWall(D, H, X0,       H/2, D/2,  1,  0, 'left');
  mkWall(D, H, X0 + W,   H/2, D/2, -1,  0, 'right');
  mkWall(W, H, X0 + W/2, H/2, D,    0, -1, 'front');

  /* No ceiling. It only ever existed to close the box, and it blocked the
     plan view, which is the one angle where you can read the whole layout at
     once. The room reads fine without it because the walls stop at H. */

  /* Plank floor. One tile covers 96" x 56", so six rows gives boards about
     9" wide, which is a real wide-plank size. Albedo, relief and sheen all
     repeat together or the grain slides off its own shadow. */
  const fmat = new THREE.MeshStandardMaterial({
    map: T.floor, normalMap: T.floorNor, roughnessMap: T.floorRgh,
    color: tone('floor', S.floorTone).hex,
    roughness: 1, metalness: 0, envMapIntensity: .55 });
  fmat.normalScale = new THREE.Vector2(0.55, 0.55);
  for(const k of ['map','normalMap','roughnessMap']){
    fmat[k] = fmat[k].clone(); fmat[k].needsUpdate = true;
    fmat[k].repeat.set(W / 52, D / 40);
  }
  /* A HAIR below zero, not at zero. A floor-mounted run puts the underside of
     its toe kick at exactly y=0, and the floor plane was at exactly y=0 too.
     Two coplanar surfaces is z-fighting: the depth buffer cannot say which is
     in front, so the band along the bottom of the closet flickered between
     floor and cabinetry as the camera moved. Dropping the floor two
     hundredths of an inch is invisible and settles it permanently. */
  const fl = plane(W, D, X0 + W/2, -0.02, D/2, -Math.PI/2, 0, fmat);
  fl.receiveShadow = true;

  // baseboard — the single detail that stops this reading as a grey box
  const bmat = new THREE.MeshStandardMaterial({ color: tone('trim', S.trimTone).hex,
    roughness: .62, metalness: 0, envMapIntensity: .45 });
  /* A BASEBOARD BELONGS TO ITS WALL.
     Culling a wall left its white baseboard behind, floating in mid air
     where the wall used to be, which from outside the room reads as the
     closet bleeding through the outside of the building. It goes when
     its wall goes. */
  const baseboard = (w, px, pz, ry, tag) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, BASE_H, BASE_T), bmat);
    b.position.set(px, BASE_H/2, pz); b.rotation.y = ry;
    b.castShadow = false; b.receiveShadow = true; shell.add(b);
    const wl = WALLS.find(x => x.tag === tag); if(wl) wl.base.push(b);
  };
  /* ── Where the cabinetry covers it, the baseboard is NOT drawn ──────────
     This is the whole "it is not up to the wall" problem, and it was the
     drawing's fault rather than the geometry's: the run's back face has
     always been exactly on the wall, but the baseboard was drawn straight
     through it, full length. Because the towers are open at the back and
     the base is 4.5" against a 3.75" toe kick, three quarters of an inch of
     white baseboard showed INSIDE every tower, right at floor level. A
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

  baseRun(W, covered('back'),  (a, b) => baseboard(b - a, X0 + (a + b) / 2, BASE_T / 2, 0, 'back'));
  baseRun(D, covered('left'),  (a, b) => baseboard(b - a, X0 + BASE_T / 2, (a + b) / 2, Math.PI / 2, 'left'));
  baseRun(D, covered('right'), (a, b) => baseboard(b - a, X0 + W - BASE_T / 2, (a + b) / 2, Math.PI / 2, 'right'));
  baseboard(W, X0 + W/2, D - BASE_T/2, 0, 'front'); // the near wall, never built on

  /* ══════════════════════════════════════════════════════════════════
     THE DOOR THEY CHOSE, IN THE ROOM, OPENING THE WAY IT OPENS

     The builder asked which door and then drew none of it. The choice
     decides how much of the front of the closet can actually be reached,
     which is the whole reason it is asked, so it has to be standing
     there. It is drawn on the near wall, because that is where you walk
     in, and each type is drawn as the thing it is: a swing leaf open on
     its hinge, a pair meeting in the middle, two bypass leaves on two
     tracks with one passing in front of the other, a bi-fold concertina'd
     back at each end, a barn door parked on its rail outside the opening,
     a pocket door half into the wall.

     The door is NOT culled with the near wall. A baseboard left behind by
     a culled wall is a white strip floating in mid air, which is wrong.
     A door is a real object standing in a real opening, and the only
     angle you would ever see it from is the one where the near wall has
     been taken away so you can look in. Cull it and it is never visible
     at all, which is where it started. */
  drawDoor(X0, W, D, H);
}

const DOOR_H = 80;
function drawDoor(X0, W, D, H){
  DOORMESH.length = 0;
  if(!S.door || S.door === 'none') return;
  const ow = Math.min(W - 2, Math.max(0, +S.doorW || defaultDoorW(S.door, 0)));
  if(ow < 12) return;
  const z = D - 0.9;
  const h = Math.min(DOOR_H, H - 2);
  const x0 = X0 + (W - ow) / 2;

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xF2EFEA, roughness: 0.52, metalness: 0, envMapIntensity: 0.6,
    side: THREE.DoubleSide });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x8A8D90, roughness: 0.4, metalness: 0.8, envMapIntensity: 1 });

  /* A LEAF IS NOT A WHITE SLAB.
     A plain box reads as a panel somebody left leaning in the room. A
     real door has a frame round the edge, a recessed panel inside it and
     something to pull. Three extra boxes per leaf and it reads as a
     door from across the room. */
  const knobMat = new THREE.MeshStandardMaterial({
    color: 0xB9BDC0, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.2 });
  const keep = m => { DOORMESH.push(m); m.userData.door = 1; return m; };
  const leaf = (w, cx, cy, cz, yaw, mat) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.4), mat || leafMat);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    /* the recessed panel, a shade darker so the frame round it reads */
    if(w > 7){
      const pw = Math.max(3, w - 5), ph = Math.max(6, h - 10);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xE6E1DA, roughness: 0.6, metalness: 0 }));
      panel.position.set(0, 0, 0.72);
      g.add(panel);
      const back = panel.clone(); back.position.z = -0.72; g.add(back);
    }
    /* something to pull it with, on the opening edge */
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 4.2, 10), knobMat);
    k.rotation.x = Math.PI / 2;
    k.position.set(w / 2 - 1.6, -2, 1.1);
    g.add(k);
    g.position.set(cx, cy, cz); if(yaw) g.rotation.y = yaw;
    shell.add(g);
    return keep(g);
  };

  /* THE OPENING ITSELF. Without a lining the leaves hang in a gap in a
     flat wall and nothing says there is a doorway there at all. */
  const jamb = (w, hh, cx, cy, cz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 5.5),
      new THREE.MeshStandardMaterial({ color: 0xF4F1EC, roughness: 0.7, metalness: 0 }));
    m.position.set(cx, cy, cz); m.receiveShadow = true; shell.add(m); return keep(m);
  };
  const rail = (w, cx, cy, cz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, 1.2), railMat);
    m.position.set(cx, cy, cz);
    shell.add(m);
    return keep(m);
  };

  const y = h / 2;
  /* two posts and a head, lining the hole in the wall */
  jamb(1.3, h + 1.3, x0 - 0.65,      y, D - 2.2);
  jamb(1.3, h + 1.3, x0 + ow + 0.65, y, D - 2.2);
  jamb(ow + 2.6, 1.3, x0 + ow / 2,   h + 0.65, D - 2.2);

  switch(S.door){
    case 'swing-r': case 'swing-l': {
      /* ALL THE WAY OPEN, NOT AJAR.
         Seventy degrees leaves most of a leaf facing the camera, so from
         outside the closet it reads as a door standing half shut and it
         covers a third of the opening. A door anybody has actually walked
         through is back against the wall. At 86 degrees it is edge on to
         a head-on view: it is plainly there, plainly open, and it is not
         in the way of the thing behind it. */
      const a = Math.PI * 0.48;
      const hingeX = S.door === 'swing-r' ? x0 + ow : x0;
      const dir = S.door === 'swing-r' ? -1 : 1;
      leaf(ow, hingeX + dir * Math.cos(a) * ow / 2, y, z + Math.sin(a) * ow / 2, dir * -a);
      break;
    }
    case 'double': {
      const a = Math.PI * 0.48, lw = ow / 2;
      leaf(lw, x0 + Math.cos(a) * lw / 2,        y, z + Math.sin(a) * lw / 2,  a);
      leaf(lw, x0 + ow - Math.cos(a) * lw / 2,   y, z + Math.sin(a) * lw / 2, -a);
      break;
    }
    case 'bypass': {
      /* Both leaves slid to the same end, one passing in front of the
         other, so half the opening is clear. Drawn closed it covers the
         closet, which is true and useless: the point of the drawing is
         what you can reach, and a bypass can only ever reach half. */
      const lw = ow / 2;
      rail(ow + 2, x0 + ow / 2, h + 1.4, z + 0.6);
      leaf(lw, x0 + lw / 2,       y, z - 0.9);
      leaf(lw, x0 + lw / 2 + 2.5, y, z + 1.1);
      break;
    }
    case 'bifold': {
      /* four panels, folded back on themselves at each end */
      /* folded hard back against each jamb, which is where a bi-fold
         actually sits once it is open */
      const pw = ow / 4, a = Math.PI * 0.46;
      rail(ow + 2, x0 + ow / 2, h + 1.4, z);
      for(const side of [0, 1]){
        const hinge = side ? x0 + ow : x0, dir = side ? -1 : 1;
        for(const k of [0, 1]){
          const ang = (k ? -1 : 1) * a * dir;
          const cx = hinge + dir * (Math.cos(a) * pw) * (k + 0.5);
          const cz = z + Math.sin(a) * pw * (k % 2 ? -0.5 : 0.5);
          leaf(pw, cx, y, cz, ang);
        }
      }
      break;
    }
    case 'barn': {
      /* parked on its rail, clear of the opening, outside the wall */
      rail(ow * 2.1, x0 + ow / 2, h + 2.4, z + 2);
      leaf(ow, x0 + ow * 1.45, y + 1, z + 2.2);
      break;
    }
    case 'pocket': {
      /* half of it is inside the wall, so half of it is what you see */
      leaf(ow / 2, x0 + ow * 0.25, y, z);
      break;
    }
  }
}

function drawCloset(res){
  root.clear(); picks.clear();
  RUNMESH.back.length = 0; RUNMESH.left.length = 0; RUNMESH.right.length = 0;
  RUNBOX.back = RUNBOX.left = RUNBOX.right = null;
  const baseC=finishMaterial(res.finish,shared,'carcass');
  const baseF=finishMaterial(res.frontFinish,shared,'front');
  res.geo.forEach((g,i)=>{
    /* The floor was 0.3", which is thicker than a basket wire. Wire is drawn
       at about 0.22" and was being fattened into a bar. */
    const [sx,sy,sz]=g.s.map(v=>Math.max(0.1,v));
    let mat;
    if(g.prop && g.m==='pullmat') mat=APPLIANCE;
    else if(g.m==='shoe') mat=SHOEMAT[(Math.abs(Math.round(g.p[0]*3+g.p[1]))|0)%SHOEMAT.length];
    else if(g.m==='metal') mat=HW;
    else if(g.m==='pullmat') mat=PULLMAT;
    else if(g.m==='glass') mat=GLASS;
    else if(g.m==='cloth') mat=CLOTH[(Math.abs(Math.round(g.p[0]+g.p[2]))|0)%CLOTH.length];
    else { const face=Math.max(sx,sy), other=Math.max(Math.min(sx,sy),sz);
      mat=scaledMaterial(g.m==='front'?baseF:baseC, face, other, shared, i); }
    const m = g.shape === 'garment'
      ? new THREE.Mesh(garmentGeo(sx,sy,sz), mat)
      : new THREE.Mesh(panelGeo(sx,sy,sz), mat);
    if(g.shape === 'garment') m.scale.set(sx, sy, sz);   // the shape is a unit tube
    m.position.set(...g.p);
    if(g.yaw) m.rotation.y = g.yaw;
    if(g.tilt) m.rotation.x = g.tilt;
    /* a run on a side wall tips about Z, because its front points along X */
    if(g.tiltZ) m.rotation.z = g.tiltZ;
    m.castShadow=m.receiveShadow=true;
    /* WHICH COMPONENT THIS PIECE IS PART OF.
       Stamped in the engine and carried through here, so pressing a shelf
       in the 3D view opens that shelf rather than the tower it lives in. */
    /* A prop is in the room, not in the closet. It is drawn, it is never
       selectable, and it is not part of anything the workshop cuts. */
    if(!g.prop && g.wall && g.bay != null)
      m.userData = { wall:g.wall, i:g.bay, si:g.si, add:g.add, carc:g.carc, mod:g.mod, part:true };
    /* ══════════════════════════════════════════════════════════════
       EVERYTHING ON A WALL LEAVES WITH THAT WALL. EVERYTHING.

       THIS is what has been standing in the way for twelve rounds, and
       it was never the culling rule. It was this line. It said `g.bay
       != null`, and a bay number is only stamped on the pieces INSIDE a
       tower: the shelves, the rods, the drawer boxes, the shoes. The
       carcass itself carries no bay. The partitions, the top shelf and
       the toe kick are cut from the run, not from a tower, so they were
       never put on this list and never culled.

       So every rule I wrote did exactly what it said, and what you saw
       was a run with its insides taken out and its box still standing
       there in front of you. He described it precisely two rounds ago:
       "you remove the stuff from inside the closet but you left the
       closet towers still there in the front." The towers WERE the
       carcass.

       A piece belongs to the run on its wall. That is the whole test.
       The washer and the dryer go too: a machine standing against a
       wall you are looking through is in the way exactly as much as a
       panel is, and leaving it behind floats it in an empty room, which
       is the same bug the baseboard had. */
    if(g.wall && RUNMESH[g.wall]) RUNMESH[g.wall].push(m);
    root.add(m);
  });
  // invisible pick volumes, one per bay, so you can click the closet to edit it
  const run = r => cfg().runs.find(x=>x.wall===r);
  res.bays.forEach(b=>{
    const r=run(b.wall); if(!r) return;
    /* A SIDE RUN IS TURNED NINETY DEGREES AND ITS PICK BOX WAS NOT.
       This was built as width-across-X and depth-through-Z for every
       wall, so on a left or right run the invisible box you click was
       lying across the room instead of along the wall: 27" deep into
       the room and 24" along it, for a tower that is the other way
       round. Clicking near the end of a side tower hit nothing, and the
       selection outline drawn from this same box was the wrong shape. */
    const px = b.wall === 'back' ? b.w - 1 : b.depth;
    const pz = b.wall === 'back' ? b.depth : b.w - 1;
    const g=new THREE.Mesh(new THREE.BoxGeometry(px, b.h, pz),
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
  /* Each run's bounds, once, so the cull can ask how far away a run is
     without walking every panel in it on every frame. */
  for(const wall of ['back','left','right']){
    const list = RUNMESH[wall];
    if(!list.length){ RUNBOX[wall] = null; continue; }
    const box = new THREE.Box3();
    for(const m of list) box.expandByObject(m);
    RUNBOX[wall] = box;
  }
  /* Highlight the selected section.

     This used to be a MeshBasicMaterial with wireframe:true, which draws every
     TRIANGLE edge — including the diagonal across each face. That diagonal was
     the stray line running across the closet in the viewport, and it is most of
     why the drawing read as a sketch. EdgesGeometry draws only the real box
     edges, so the selection reads as a crisp outline on cabinetry. */
  if(S.sel){
    const hit=picks.children.find(o=>o.userData.wall===S.sel.wall&&o.userData.i===S.sel.i);
    const b2 = res.bays.find(x => x.wall === S.sel.wall && x.bay === S.sel.i);
    if(hit && b2){
      /* depthTest:false drew this outline straight THROUGH the cabinetry, so
         every panel looked see-through and the whole drawing read as a wire
         sketch rather than solid boxes. The outline now respects depth and is
         pushed a hair toward the camera with polygonOffset, which keeps it
         crisp on the near faces without ghosting through the far ones. */
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(hit.geometry, 1),
        new THREE.LineBasicMaterial({ color:0xB4852F, transparent:false,
          depthTest:true, depthWrite:false,
          polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
      outline.position.copy(hit.position);
      outline.scale.set(1.008, 1.003, 1.008);
      root.add(outline);

      /* ══════════════════════════════════════════════════════════════
         AND A WASH OVER THE FRONT OF IT

         An outline alone is four hairlines on a wall of hairlines: on a
         closet of eight towers you cannot see at a glance which one the
         panel is talking about. A translucent box over the WHOLE tower
         was tried and is worse, because on an empty tower the three
         faces you see at once stack into a solid yellow block standing
         in the room.

         So it is one pane, on the front of the tower only, the way
         17squares washes the one you have picked. Thin, depth-tested,
         and it never writes depth, so the cabinetry behind it is read
         straight through it. */
      const fw = b2.wall === 'back' ? b2.w - 1 : 0.6;
      const fd = b2.wall === 'back' ? 0.6 : b2.w - 1;
      const wash = new THREE.Mesh(new THREE.BoxGeometry(fw, b2.h, fd),
        new THREE.MeshBasicMaterial({ color:0xC79A4B, transparent:true, opacity:.2,
          depthWrite:false }));
      wash.position.copy(hit.position);
      const halfD = (b2.depth || 24) / 2;
      if(b2.wall === 'back')  wash.position.z += halfD;
      if(b2.wall === 'left')  wash.position.x += halfD;
      if(b2.wall === 'right') wash.position.x -= halfD;
      root.add(wash);

      /* It belongs to the run it marks, so it leaves with it. Left out
         of this list, a gold outline stayed hanging in mid air after
         its own cabinetry had been culled out of the way. */
      const rl = RUNMESH[S.sel.wall];
      if(rl){ rl.push(outline); rl.push(wash); }
    }
  }
  /* The shadow map is 2560 square and every rebuild asked for a fresh one.
     Dragging a tower along a wall rebuilds the geometry on every frame, so
     that was six and a half million shadow texels per frame, for a shadow
     nobody can study while the thing casting it is sliding. It is marked
     dirty here and redrawn once the picture settles, with the AO. */
  fitShadowCamera(key, root); shadowDirty = true;
  if(ao?.setSceneClipBox){ const bb=new THREE.Box3().setFromObject(root); if(!bb.isEmpty()) ao.setSceneClipBox(bb); }
}
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
const ndcFrom=(e)=>{ const r=canvas.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); return ndc; };

/* nothing told you a tower could be clicked. Cursor changes over one. */
canvas.addEventListener('pointermove', e=>{
  if(e.buttons) return;                               // orbiting, not hovering
  ray.setFromCamera(ndcFrom(e), cam);
  const overPart = ray.intersectObjects(root.children,false)
                      .some(h => h.object.userData && h.object.userData.part);
  canvas.style.cursor = overPart ? 'pointer'
    : (ray.intersectObjects(picks.children,false).length ? 'ew-resize' : 'grab');
});
/* ══════════════════════════════════════════════════════════════════════
   DRAG A SECTION ALONG ITS WALL, IN THE DRAWING

   Up to now a tower could only be reordered from the little strip in the
   side panel, which nobody found. Press on a tower in the 3D view and pull
   it left or right and it walks along the run, swapping with its neighbours
   as it passes them. The orbit controls are switched off for the duration so
   the camera does not spin while you are placing cabinetry.

   The maths: project the run's own left-to-right axis into screen space once
   on pointerdown, then every move is a dot product of the pointer delta onto
   that axis. That way dragging right always moves the tower right no
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
   While a tower is being moved, the one number that matters is how far it
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
    + `<span>${me.w.toFixed(0)}" tower &middot; ${(right+G).toFixed(1).replace(/\.0$/,'')}" to the right corner`
    + (G ? ` &middot; ${G}" off the wall at the baseboard` : '') + `</span>`;
  tip.style.left = px + 'px';
  tip.style.top  = py + 'px';
  tip.dataset.on = '1';
}
const hideAtTip = () => { const t = $('#attip'); if(t) delete t.dataset.on; };

/* inches between where the tower started and where it sits now */
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
  /* WHAT DID THEY ACTUALLY PRESS?
     The real cabinetry first, because a shelf is a more specific answer
     than the tower it sits in, and the invisible per-tower volume only
     afterwards so pressing the empty air inside a tower still selects it.
     Press the same piece twice and it steps back out to the tower. */
  const pHit = ray.intersectObjects(root.children, false)
                  .find(h => h.object.userData && h.object.userData.part);
  if(pHit){
    const u = pHit.object.userData;
    const same = S.sel && S.sel.wall === u.wall && S.sel.i === u.i;
    S.sel = { wall:u.wall, i:u.i };
    /* an engine shelf carries si -1: it belongs to the tower, not to a
       component, so pressing one opens the tower */
    if(u.carc){
      /* the toe kick and the top shelf are pieces too */
      S.carc = (same && S.carc === u.carc) ? null : u.carc; S.part = null; S.add = null;
    } else if(u.add != null){
      /* a placed thing: press it in the 3D and its own panel opens */
      S.add = (same && S.add === u.add) ? null : u.add; S.part = null; S.carc = null;
    } else {
      S.part = (u.si != null && u.si >= 0 && !(same && S.part === u.si)) ? u.si : null;
      S.add = null; S.carc = null;
    }
    S.lib = false;
    PICK_FOR = u.wall + '|' + u.i;
    rebuild(false);
    if(typeof window.gotoStep === 'function') window.gotoStep('2');
    return;
  }
  const hit=ray.intersectObjects(picks.children,false)[0];
  if(hit){
    S.sel={wall:hit.object.userData.wall,i:hit.object.userData.i};
    S.part = null; S.add = null; S.carc = null; S.lib = false;
    rebuild(false);
    /* Dividing the wall and filling it are one panel now, so clicking a
       section on the drawing just selects it. It used to yank you onto
       another tab, which is what made adding two towers in a row feel
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
      /* Layout. With a tower selected, go in on it. With nothing selected
         yet, show the wall straight on so the widths read true. */
      if(!S.sel || !cur?.bays?.length){
        /* With nothing in the room this fitted the back wall almost
           exactly, so step two opened on a flat rectangle of paint: the
           same shot a broken renderer gives. An empty room gets the room
           shot, both returns and the floor in frame, and only once there
           is something on the wall is the wall worth filling. */
        if(!cur?.bays?.length){
          const r = fitDist(H * 1.5, (W + D * 0.5) * 1.02);
          return { t:[W/2, H*0.44, D*0.28], p:[W/2 + W*0.06, H*0.60, D*0.28 + r] };
        }
        const d = fitDist(H * 1.12, (W + 10) * 1.02);
        return { t:[W/2, H*0.46, 0], p:[W/2, H*0.48, d] };
      }
      const b = focusBay();
      const midY = baseHeight(S.mounting, placedFittings()) + b.h / 2;
      /* Frame the tower being edited WITH its neighbours. Fitting the bay
         alone cropped the rest of the run against the edge of the canvas,
         which read as a broken drawing rather than a close-up. Show the whole
         run when it is short, and the bay plus about one either side when it
         is long. */
      const sameWall = (cur?.bays || []).filter(x => x.wall === b.wall);
      const runW = sameWall.reduce((a, x) => a + x.w, 0) || b.w;
      const ctx = Math.min(Math.max(runW, b.w) * 1.12, Math.max(b.w, 24) * 3.4);
      const dist = fitDist(b.h * 1.42, ctx);

      /* Aim at the SECTION but keep the window over the RUN.

         This looked straight at the selected section's centre. Select the
         first of four 36" towers on a 144" wall and the framed window is
         122" centred on x=18, so it runs from -43" to 79": the first section
         sits against the left edge of the canvas, the other three are off the
         right of it entirely, and the drawing reads as having slid out of the
         frame. That is the drifting, and it got worse the nearer the selected
         section was to either end.

         So the look-at slides along the wall only as far as it can without
         the window leaving the run, and if the whole run already fits it just
         centres on the run. The selected section stays in view either way. */
      const lo = sameWall.length ? Math.min(...sameWall.map(x => x.x - x.w / 2)) : 0;
      const hi = sameWall.length ? Math.max(...sameWall.map(x => x.x + x.w / 2)) : 0;
      const sideWall = b.wall === 'left' || b.wall === 'right';
      let along = sideWall ? b.z : b.x;
      if(sameWall.length){
        along = (hi - lo) <= ctx
          ? (lo + hi) / 2
          : Math.max(lo + ctx / 2, Math.min(hi - ctx / 2, along));
      }
      const fb = sideWall ? { ...b, z: along } : { ...b, x: along };
      const [px, pz] = standOff(fb, dist);
      return { t:[fb.x, midY, fb.z], p:[px, midY + b.h * 0.06, pz] };
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
    case 'doc': {
      /* THE VIEW THAT GOES ON PAPER.

         Not a step the customer ever sees: the one framing used for the
         picture in the drawing. The step-1 view sits inside a deep walk-in,
         so the nearest side tower filled half the page and the back wall was
         a strip behind it. This stands well outside the opening, up at about
         a standing eye line and over to one side, and looks back at the
         middle of the room, so both runs and the bridge between them are in
         the one picture. */
      const c = [W/2, H*0.45, D*0.45];
      /* A little more air than the picture needs: a drawing cropped at the
         toe kick looks like a mistake, and a U-shape seen from too low shows
         you the back of the near run instead of into the closet. */
      const r = fitDist(H*1.62, Math.max(W, D) * 1.66);
      /* A three-quarter view shows an L-shape and hides a U-shape: swing
         round on a closet with runs down BOTH sides and the near one becomes
         a wall of end panel across the picture. A U is looked straight into
         and from a little higher, so you see down both sides and the back. */
      const bothSides = (cur?.bays || []).some(b => b.wall === 'left')
                     && (cur?.bays || []).some(b => b.wall === 'right');
      const az = (bothSides ? 5 : 24) * Math.PI/180;
      const el = (bothSides ? 30 : 26) * Math.PI/180;
      return { t:c,
               p:[c[0] + r*Math.cos(el)*Math.sin(az),
                  c[1] + r*Math.sin(el),
                  c[2] + r*Math.cos(el)*Math.cos(az)] };
    }
    default: {             // 1 and 6: the whole room
      /* THE OPENING SHOT HAS TO READ AS A ROOM.
         This fitted the back wall almost exactly, so an empty closet opened
         on a flat rectangle of paint with a sliver of floor: correct, and
         indistinguishable from a broken renderer. Fitting half again on the
         height and a share of the depth on the width brings both returns,
         the floor and the ceiling line into frame, so you can see at a
         glance that you are standing in a room with nothing in it. */
      const dist = fitDist(H * 1.5, (W + D * 0.5) * 1.02);
      return { t:[W/2, H*0.44, D*0.28], p:[W/2 + W*0.06, H*0.60, D*0.28 + dist] };
    }
  }
}

/* ══════════════════════════════════════════════════════════════════
   PICK A WALL AND THE CAMERA GOES AND LOOKS AT IT

   Free orbit is fine once you know where you are and useless while you
   do not. Every bad view in this build has been the camera parked at an
   oblique angle where one run stands edge-on across another. 17squares
   never lets that happen, because choosing a wall takes you to it, and
   choosing a wall here does the same now: square on, far enough out
   that the whole run is in frame, a little above the middle so the top
   shelf and the toe kick can both be read.

   It is a starting position and nothing more. Drag and you take over,
   the same as every other camera move on this page. */
function faceWall(wall, ms = 620){
  const W = S.room.w, D = S.room.d, H = S.room.h;
  const len = wall === 'back' ? W : D;
  const r = fitDist(H * 1.2, len * 1.12);
  const t = wall === 'back' ? [W/2, H*0.45, 0]
          : wall === 'left' ? [0,   H*0.45, D/2]
          :                   [W,   H*0.45, D/2];
  const p = wall === 'back' ? [W/2,   H*0.52, r]
          : wall === 'left' ? [r,     H*0.52, D/2]
          :                   [W - r, H*0.52, D/2];
  fly = { t0: performance.now(), ms,
          p0: cam.position.clone(), t0v: ctl.target.clone(),
          p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t) };
  needsFrame = true;
}
window.__face = faceWall;

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
   Sliding a tower along a wall used to run the whole machine on every
   single pointermove: the room's walls, floor, textures and baseboards were
   thrown away and rebuilt, the canvas was re-measured, all nine panels were
   re-rendered from scratch, and the camera was told to fly somewhere. At
   sixty of those a second the drag could not keep up with the pointer.

   None of that work is about the thing being dragged. While DRAGGING is on,
   the room stays where it is, the camera stays where it is, and only the
   cabinetry and the two things that actually change — the strip and the
   price — are redrawn. Everything else catches up once the pointer is let
   go, which is also when the price is worth reading. */

function rebuild(reframe){
  cur=buildDesign(cfg(),cat);
  /* ══════════════════════════════════════════════════════════════════
     WHAT IS STORED IS WHAT IS BUILT

     A tower that can only carry one shelf still had four written on it,
     so every other piece in that tower was asked to leave room for four
     shelves that were never going to be there. The rod beside it came
     out with a slider that ran from 22.75" to 23" on a piece whose own
     minimum is 38". The engine's answer is written back, once, and the
     panel, the sliders and the drawing all read the same number. */
  {
    let fixed = false;
    for(const b of cur?.bays || []){
      const stack = S.runs[b.wall]?.bays?.[b.bay]?.stack; if(!stack) continue;
      for(const bd of b.bands || []){
        if(bd.nFit == null) continue;
        const st = stack[bd.si]; if(!st) continue;
        const key = MODULES[st.m]?.opt?.key; if(!key) continue;
        if(+(st.o?.[key] ?? MODULES[st.m].opt.def) !== bd.nFit){
          st.o = { ...(st.o || {}), [key]:bd.nFit }; fixed = true;
        }
      }
    }
    if(fixed) cur = buildDesign(cfg(), cat);
  }
  dimDirty = true;
  /* ?audit=1 hands the built design to a test runner so a sweep can check
     that nothing was placed outside the room it was drawn for. It is off
     unless asked for, so nothing is exposed to an ordinary visitor. */
  if(AUDIT){
    window.__cur = cur;
    window.__scene = scene; window.__cam = cam; window.__renderer = renderer;
    /* ?audit=1 also exposes the documentation shot, so the pictures of a
       layout used on the site can be rendered from the engine itself rather
       than drawn by somebody who then has to remember the twelve inch
       standoff. A render that comes out of here cannot get it wrong. */
    window.__shot = keep => snapshot(keep);
    /* And a documentation mode: the room shell off and a plain white ground,
       so a layout can be rendered as a product picture rather than as a
       photograph of an empty room with a closet in it. */
    window.__bare = on => {
      shell.visible = !on;
      scene.background = new THREE.Color(on ? 0xFFFFFF : 0x9C968E);
      needsFrame = true;
    };
    /* And the two handles a frame grabber needs: put a whole design in, and
       put the camera exactly where you want it. The scroll sequence on the
       home page is rendered through these, so the closet in it is one this
       engine actually builds, standoff and bridge pieces included, rather
       than a picture somebody drew of a closet. */
    window.__apply = pl => {
      if(pl.type) S.type = pl.type;
      if(pl.room) S.room = { ...pl.room };
      S.mounting = pl.mounting || S.mounting;
      if(pl.shape) applyShape(pl.shape);
      for(const wall of Object.keys(S.runs)) if(S.runs[wall]) S.runs[wall].bays = [];
      for(const wall of Object.keys(pl.runs || {})){
        const r = S.runs[wall]; if(!r) continue;
        let at = 0;
        r.bays = pl.runs[wall].map(sec => {
          const b = makeBay(sec.w, structuredClone(sec.s || []), sec.top !== false);
          b.at = at; at += sec.w; return b;
        });
        if(pl.depth && pl.depth[wall] != null) r.depth = clampDepth(pl.depth[wall], wall);
      }
      for(const wall of Object.keys(pl.runs || {})) fitWall(wall);
      S.sel = null; fly = null;
      rebuild(true);
    };
    /* Camera in room inches: where you are standing and what you are looking
       at. A sequence that walks into a closet is choreographed in those
       terms, not in angles around a bounding box. */
    /* a test can select a tower without hunting for its chip, which no
       longer exists now the strip is gone */
    window.__pick = (i, wall) => {
      const w = wall || S.sel?.wall || Object.keys(S.runs).find(k => S.runs[k]?.on);
      if(!S.runs[w]?.bays[i]) return false;
      S.sel = { wall:w, i }; S.part = null; S.add = null; S.carc = null; S.lib = false;
      PICK_FOR = w + '|' + i; rebuild(false); return true;
    };
    window.__cam = (o = {}) => {
      const { w:W, d:D, h:H } = S.room;
      const at = o.at || [W/2, 62, D*0.9];
      const look = o.look || [W/2, H*0.45, 0];
      cam.position.set(at[0], at[1], at[2]);
      ctl.target.set(look[0], look[1], look[2]);
      if(o.fov){ cam.fov = o.fov; cam.updateProjectionMatrix(); }
      fly = null; ctl.update(); needsFrame = true;
    };
  }
  if(!DRAGGING) drawRoom();
  drawCloset(cur);
  if(!DRAGGING) resize();
  if(reframe){ resize(); frame(); }
  if(DRAGGING) paintWhileDragging(); else paintAll();
  built = true;
}
function paintAll(){ paintSteps(); paintPlan(); paintDoors(); paintBays(); paintStack(); paintLTools(); paintLPal(); paintPrice(); paintQuote(); paintOrder(); paintFinTabs(); markSteps(); paintFlat();
  /* steps 3 and 5 look at one tower, so changing which one is selected has
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
        <input type="number" data-dim="h" value="${S.room.h}" min="60" max="180" aria-label="Ceiling height in inches"><i>in</i></label>
    </div>
    ${(() => {
      /* HOW HIGH THE CLOSET ITSELF GOES.
         The ceiling above is the room. This is the cabinetry, and until now
         it was pinned at 84" however high the room was, so a 144" ceiling
         built the same closet as a 96" one and the extra five feet was
         neither drawn nor charged for. It still opens at 84", so nothing
         anybody drew before this moves. */
      const r = cabTopRange(S.room.h);
      const ft = Math.floor(S.cabTop / 12), inch = Math.round(S.cabTop % 12);
      return `<div class="cabtop">
        <label class="pfield pf-wide"><span>How high the closet goes</span>
          <input type="number" data-cabtop="1" value="${S.cabTop}"
                 min="${r.min}" max="${r.max}" step="1"
                 aria-label="How high the cabinetry goes, in inches off the floor"><i>in</i></label>
        <p class="note">${ft}ft ${inch ? inch + '" ' : ''}off the floor, in a ${S.room.h}" room.
          ${S.cabTop >= r.max ? 'That is as high as this ceiling allows.'
            : `Anything up to ${r.max}" fits. Taller towers are more board and more edge banding.`}</p>
      </div>`;
    })()}
    <div class="basebox">
      <b>The baseboard</b>
      <p class="note">A closet cannot sit flush to a wall that has a baseboard on it. What we do here changes the drawing, the width you have to play with and the price.</p>
      <div class="pfields">
        <label class="pfield"><span>How tall</span>
          <input type="number" data-base="h" value="${S.base.h}" min="0" max="12" step="0.25" aria-label="Baseboard height in inches"><i>in</i></label>
        <label class="pfield"><span>How thick</span>
          <input type="number" data-base="t" value="${S.base.t}" min="0" max="3" step="0.125" aria-label="Baseboard thickness in inches"><i>in</i></label>
      </div>
      <em class="baseq">The width and depth above, where did you measure from?</em>
      <div class="segrow">
        <button type="button" data-bmeas="wall" class="${S.base.measured==='wall'?'on':''}">Wall to wall</button>
        <button type="button" data-bmeas="baseboard" class="${S.base.measured==='baseboard'?'on':''}">Baseboard to baseboard</button>
      </div>
      ${Object.values(S.runs).filter(r=>r?.on).length > 1 ? `
      ${/* THE CORNER IS NOT A QUESTION ANY MORE.
            It used to be two buttons: run the back wall into the corner, or
            stop both runs short of it. One left a bare square nobody could
            use, the other made a tower a foot deep you cannot reach the
            back of, and he builds neither. He builds wall to wall with the
            side run standing twelve inches clear, bridged top and bottom.
            So it is stated, not asked. */''}
      <div class="cornernote">
        <b>Where the walls meet</b>
        <p class="note">The back wall runs the whole way. The side wall starts
          <b>${SPEC.sideStandoff}" clear</b> of it, so you can reach into the corner,
          and that gap is closed with a top piece and a bottom piece on its own toe
          kick. Both are drawn, measured and on your piece list.</p>
      </div>` : ''}
      <em class="baseq">Do the towers need a back?</em>
      <div class="segrow col">
        <button type="button" data-backs="0" class="${S.backs?'':'on'}">
          <b>No back, the wall is the back</b><span>How a built-in closet normally goes in.</span></button>
        <button type="button" data-backs="1" class="${S.backs?'on':''}">
          <b>Build a back on every tower</b><span>For a block wall, a garage, or plaster you would rather not look at. Adds board and hardware to every tower.</span></button>
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
    : `<p class="note">Nothing marked yet. Add whatever is on your walls, say where it is in your own words, and it goes on the drawing and onto the job sheet. A window caps the partitions under it at the sill, baseboard heat takes the run off the floor, a column takes its width off the wall.</p>`;
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

  /* ══════════════════════════════════════════════════════════════════
     ONE WALL, NOT THREE STACKED ACCORDIONS

     A three wall room printed three wall headers, three tower strips,
     three sets of track buttons and three "add a tower" grids, one above
     the other, with the panel for the thing you had actually clicked
     buried somewhere in the middle of them. You scrolled past two walls
     you were not working on to reach it.

     The walls are a row of chips at the top. One of them is open. The
     panel underneath it is whatever you pressed.
     ══════════════════════════════════════════════════════════════════ */
  const sel = (S.sel?.wall && S.runs[S.sel.wall]?.on) ? S.sel.wall : walls[0];
  if(walls.length > 1){
    const bar = document.createElement('div');
    bar.className = 'wallbar';
    bar.innerHTML = walls.map(w => {
      const n = S.runs[w].bays.length;
      return `<button type="button" class="${w === sel ? 'on' : ''}" data-fold="${w}">
        <b>${WALL_LABEL[w]}</b><i>${n} tower${n === 1 ? '' : 's'}</i></button>`;
    }).join('');
    host.appendChild(bar);
  }

  for(const wall of walls.filter(w => w === sel)){
    const r=S.runs[wall];
    const len  = wallLength(wall);
    const used = r.bays.reduce((a,b)=>a+b.w,0);
    const left = len - used;
    const d=document.createElement('div');
    d.className='runblk' + (walls.length > 1 ? ' chipped' : '');
    d.dataset.wall=wall;

    /* ══════════════════════════════════════════════════════════════
       THE MINI DRAWING AT THE TOP OF THE PANEL IS GONE

       A scale strip of the wall with a chip per tower, a progress bar,
       a ruler under it, a row of widths to add, "into the corner",
       "space them evenly" and a notice when the wall was full. All of
       it a second, smaller, worse copy of the drawing already filling
       two thirds of the screen, and all of it above the thing you had
       actually pressed. 17squares has none of it and is the clearer
       page for it: you pick a tower by pressing the tower.

       What is left is one line that says how much of the wall is used,
       because that is a fact you cannot read off the drawing, and the
       two tidy-up buttons, which have no equivalent anywhere else.
       Adding a tower is the button on the rail beside the drawing. */
    /* ══════════════════════════════════════════════════════════════
       THE WALL IS ONE LINE, BECAUSE THE PICTURES ARE THE PANEL

       A wall heading, a used-and-free line, two tidy-up buttons and a
       paragraph about shelf spans filled the top third of the column
       before a single component card got drawn, on a page whose whole
       job is to show you components. All of it is still here; it is one
       line and two small buttons. */
    /* THE TOP OF THE COLUMN IS THE CARDS.
       The wall's name, how much of it is used and the two tidy-up
       buttons sat above everything, with a rule under them, so pressing
       a tower showed you a header and the towers themselves started
       below it. None of it is about the thing you just pressed. It is
       the same line, at the foot of the wall's block, where the other
       whole-wall things are. */
    const full = left < SPEC.bayMin;
    d.innerHTML = `${r.bays.length ? '' : `<p class="note emptyrun">Nothing on this wall yet.
        Press <b>Add tower</b> on the rail beside the drawing.</p>`}
      <div class="stackslot"></div>
      <div class="wallline foot">
        <b>${WALL_LABEL[wall]}</b>
        <i class="${full ? 'full' : ''}">${Math.round(used)}/${Math.round(len)}"</i>
        ${r.bays.length > 1 ? `<span class="wacts">
          <button class="btn-mini" data-bay="tidy" data-wall="${wall}"
            title="Push every tower back into the left corner, shoulder to shoulder">Tidy</button>
          <button class="btn-mini" data-bay="even" data-wall="${wall}"
            title="Equal towers with equal air between them, across the whole wall">Even</button>
        </span>` : ''}
      </div>`;
    host.appendChild(d);
  }
  /* only when there is something to say. The shelf-span lecture was
     printed on every repaint, above the cards, forever. */
  $('#bayNote').textContent = PROP_NOTE || '';
  $('#bayNote').hidden = !PROP_NOTE;
  $('#bayNote').classList.toggle('warnnote', !!PROP_NOTE);
}

/* ───────── step 2b: what goes in the selected section ─────────
   This used to be its own tab, and it used to show two pickers: a row of
   "layouts" and a grid of "pieces". They were the same control. A layout is
   just a tower pre-filled with pieces, so both now live in one grid, with
   the ready-made ones first and badged.

   It also used to dead-end: no section selected meant an empty panel telling
   you to go and pick one. If towers exist, one of them is selected. */
/* The parts picker belongs directly under the tower being edited, on the
   wall being edited. Working on the back wall, section 3: the cards for
   section 3 render immediately beneath the back wall's section strip, so the
   image you click and the box it lands in are never more than a glance apart.
   The node itself is reused rather than rebuilt, so the single click handler
   bound to #stack survives the move. */
function dockStack(){
  const box = $('#stack'); if(!box) return;
  /* WITH NOTHING SELECTED IT STILL BELONGS ABOVE THE WALL LINE.
     The panel only docked into the open wall's block, so with nothing
     open it fell back to the bottom of the column and the wall's name
     and figure sat above the closet options for that one case. It docks
     into whichever wall block is on screen. */
  const wall = (S.sel?.wall && S.runs[S.sel.wall]?.on) ? S.sel.wall
             : Object.keys(S.runs).find(w => S.runs[w]?.on);
  const slot = wall ? $(`#bays .runblk[data-wall="${wall}"] .stackslot`) : null;
  (slot || $('#stackHome')).appendChild(box);
}

const ART_GONE = new Set();
window.__artGone = n => ART_GONE.add(n);

/* Which section the half-picker was opened for. Selecting a different
   section anywhere — the strip, the 3D, the arrows — must close it, and
   there are five places that move the selection, so the check lives here
   rather than being repeated in all of them. */
let PICK_FOR = null;
let LAST_MODE = null;

/* ══════════════════════════════════════════════════════════════════════
   BUILD IT FOR ME

   Nobody wants to place eight towers one at a time to find out what their
   room can hold. Say roughly how much hanging, how many shoes and how many
   drawers, press the button, and every wall being built on fills with whole
   towers in sensible widths.

   Nothing happens until the button is pressed. A closet that builds itself
   the moment somebody arrives is not their closet, and on a walk-in it
   packs the room so tightly the camera opens inside a panel.
   ══════════════════════════════════════════════════════════════════════ */
const MIX_LEVELS = ['None', 'A little', 'Some', 'Lots'];
const MIX = [
  { k:'hang',  label:'Hanging',  v:2, note:'Rods for shirts, coats and dresses' },
  { k:'shoe',  label:'Shoes',    v:1, note:'Flat or slanted shoe shelving' },
  { k:'draw',  label:'Drawers',  v:1, note:'Banks of soft close drawers' },
];
/* which ready-made tower answers each appetite, best first */
const MIX_PICK = {
  hang : ['double-hang','long-hang','hang-shelves','hang-shoes'],
  shoe : ['shoes-hang','shoes-slant','shoes'],
  draw : ['drawers-4','drawers-shelves','drawers-3-10','drawers-6'],
  rest : ['shelves-6','shelves-4','cubbies','shelves-8'],
};

/* The component library, grouped the way he asked for it: the things that
   make the closet, then the things that go in it. A group whose parts are
   not built yet simply has nothing in it and does not print. */
/* PUT ONE IN FIRST, because they are what a closet is mostly made of and
   they are the two that can go anywhere, at any height, as many as you
   like, without moving anything else. */
const LIB_GROUPS = [
  { t:'Put one in where you want it', ids:['SHELF_ONE','ROD_ONE'] },
  { t:'Hanging',  ids:['HANG','DOUBLE_HANG','LONG_HANG','SHORT_HANG'] },
  { t:'Shelving', ids:['SHELVES','CUBBIES','COUNTER'] },
  { t:'Drawers and pull-outs', ids:['DRAWERS','PULLOUT','BASKETS','HAMPER'] },
  { t:'Shoes',    ids:['SHOES','SHOE_SLANT'] },
  { t:'Fronts',   ids:['DOOR','GLASS_DOOR','MIRROR','OPEN'] },
  { t:'Accessories', ids:['VALET','TIE_RACK','BELT_RACK','SCARF_RACK','PANTS_RACK'] },
];

/* ══════════════════════════════════════════════════════════════════════
   A CLOSET IS ALREADY IN THE ROOM WHEN THEY ARRIVE

   The room used to open empty, on the argument that it is their closet and
   nobody should put towers in it for them. That is the wrong way round.
   An empty room is a blank page: there is nothing to react to, nothing to
   click, and the first thing anybody has to do is work out what a tower
   even is. Every configurator worth using drops you into a finished closet
   and lets you change it, because changing something is easy and starting
   something is hard.

   So the type they picked decides what is standing there the moment the
   gate closes. A pantry opens as shelves floor to ceiling. A garage opens
   as deep shelving with one bank of drawers. A reach-in opens as double
   hanging with drawers in the middle. Then they take it apart.
   ══════════════════════════════════════════════════════════════════════ */
const TYPE_START = {
  'reach-in': { mix:{ hang:3, shoe:1, draw:1 } },
  'walk-in' : { mix:{ hang:2, shoe:1, draw:2 } },
  /* no hanging, no shoes: a pantry is shelves, and tall ones */
  'pantry'  : { mix:{ hang:0, shoe:0, draw:0 }, rest:['shelves-8','shelves-6'] },
  'garage'  : { mix:{ hang:0, shoe:0, draw:1 }, rest:['shelves-6','shelves-4'] },
  'laundry' : { mix:{ hang:1, shoe:0, draw:1 }, rest:['shelves-4','shelves-6'] },
  custom    : { mix:{ hang:2, shoe:1, draw:1 } },
};

/* Set the sliders to what the type asks for and stand the closet up, so the
   three sliders under "Build it for me" always read as the thing on screen
   rather than as somebody else's defaults. */
function startingCloset(type){
  const want = TYPE_START[type] || TYPE_START['walk-in'];
  MIX.forEach(m => { if(want.mix[m.k] != null) m.v = want.mix[m.k]; });
  paintMix();
  buildForMe(want.rest);
}

/* THE APPETITES ARE STILL THERE, THEY ARE JUST NOT A CONTROL.
   MIX is what the closet type says the room usually wants, and that is
   what "Recreate closet" builds from. It was never a good question to
   put in front of somebody: they answer it by guessing, before they have
   seen a single tower. What this block holds now is the two things that
   are true of the whole run and that somebody really does reach for. */
function paintMix(){
  const host = $('#mix'); if(!host) return;
  const walls = Object.keys(S.runs).filter(w => S.runs[w]?.on);
  const cap = walls.length ? Math.min(...walls.map(w => wallDepthCap(w))) : SPEC.runDepthMax;
  const lo = SPEC.runDepthMin, hi = Math.max(lo, Math.min(SPEC.runDepthMax, Math.round(cap)));
  const now = Math.min(hi, walls.length ? (S.runs[walls[0]].depth ?? SPEC.hangDepth) : SPEC.hangDepth);
  const opts = DEPTHS.filter(v => v >= lo - 0.01 && v <= hi + 0.01);
  host.innerHTML = `
    <div class="orow"><span class="olab">Tower depth</span>
      <label class="dsel"><select id="mixdepth" aria-label="Tower depth in inches">
        ${opts.map(v => `<option value="${v}" ${Math.abs(now - v) < 0.26 ? 'selected' : ''}>${v}"</option>`).join('')}
        ${opts.some(v => Math.abs(now - v) < 0.26) ? ''
          : `<option value="${+now.toFixed(1)}" selected>${+now.toFixed(1)}"</option>`}
      </select></label></div>
    <label class="mixtgl"><input type="checkbox" id="mixprops" ${S.styled !== false ? 'checked' : ''}>
      <span>Props<i>The clothes, shoes and folded stacks in the closet</i></span></label>`;
}

/* Share the towers out in the ratio asked for, then lay them along the wall
   in an order that looks like a closet: hanging at the ends where long
   clothes want the height, drawers in the middle at waist height, shoes
   next to them. */
function buildForMe(restOverride){
  const want = Object.fromEntries(MIX.map(m => [m.k, m.v]));
  const REST = restOverride && restOverride.length ? restOverride : MIX_PICK.rest;
  const walls = Object.keys(S.runs).filter(w => S.runs[w]?.on);
  if(!walls.length) return;

  for(const wall of walls){
    const len = wallLength(wall);
    const r = S.runs[wall];
    r.bays = [];
    if(len < SPEC.bayMin) continue;
    /* the fewest towers that are all a width he builds */
    let n = Math.max(1, Math.round(len / 30));
    if(len / n > SPEC.bayMax) n = Math.ceil(len / SPEC.bayMax);
    if(len / n < SPEC.bayMin) n = Math.max(1, Math.floor(len / SPEC.bayMin));
    const w = +(len / n).toFixed(1);
    if(w < SPEC.bayMin) continue;

    /* how many of the n towers each appetite earns */
    const total = want.hang + want.shoe + want.draw;
    const share = k => total ? Math.round(n * want[k] / total) : 0;
    let counts = { hang:share('hang'), shoe:share('shoe'), draw:share('draw') };
    let used = counts.hang + counts.shoe + counts.draw;
    /* whatever is left over is shelving, and if the shares overshot, the
       biggest appetite gives one back */
    while(used > n){ const big = ['hang','draw','shoe'].sort((a,b)=>counts[b]-counts[a])[0];
      counts[big]--; used--; }
    counts.rest = n - used;

    /* ends first, then the middle, so a wall reads hanging | drawers | hanging */
    const slots = new Array(n).fill(null);
    const order = [];
    for(let i = 0; i < n; i++) order.push(i % 2 ? n - 1 - ((i - 1) / 2 | 0) : (i / 2 | 0));
    const queue = [];
    for(let i = 0; i < counts.hang; i++) queue.push('hang');
    for(let i = 0; i < counts.shoe; i++) queue.push('shoe');
    for(let i = 0; i < counts.draw; i++) queue.push('draw');
    for(let i = 0; i < counts.rest; i++) queue.push('rest');
    /* hanging claims the ends, drawers the centre, everything else fills in */
    const ends = order.slice(0, counts.hang);
    const mid  = [];
    for(let i = 0; i < n; i++) if(!ends.includes(i)) mid.push(i);
    mid.sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
    const place = (idxs, kind, howMany) => {
      let put = 0, seen = 0;
      const from = kind === 'rest' ? REST : MIX_PICK[kind];
      for(const i of idxs){ if(put >= howMany) break;
        if(slots[i] != null) continue;
        slots[i] = from[seen++ % from.length]; put++; }
    };
    place(ends, 'hang', counts.hang);
    place(mid,  'draw', counts.draw);
    place(mid,  'shoe', counts.shoe);
    place(mid,  'rest', counts.rest);
    for(let i = 0; i < n; i++) if(slots[i] == null) slots[i] = REST[0];

    let at = 0;
    for(let i = 0; i < n; i++){
      const p = TOWER_PRESETS.find(x => x.id === slots[i]) || TOWER_PRESETS[0];
      /* a front across a tower in the inside corner could never be opened */
      const safe = (wall !== 'back' && i === 0 && /door/.test(p.id))
        ? TOWER_PRESETS.find(x => x.id === 'shelves-6') : p;
      const b = makeBay(w, structuredClone(safe.stack), true);
      b.at = at; at += w;
      r.bays.push(b);
    }
  }
  for(const wall of walls) clearProps(wall);
  S.sel = { wall:walls.find(w => S.runs[w].bays.length) || walls[0], i:0 };
  rebuild(true);
  if(typeof window.gotoStep === 'function') window.gotoStep('2');
}

/* ══════════════════════════════════════════════════════════════════════
   READY-MADE TOWERS, AS LITTLE DRAWINGS

   Building a closet one piece at a time is how a joiner thinks, not how a
   customer does. A customer looks at a wall, points at a tower and says
   "that one, with drawers". So the first thing under a selected tower is
   a grid of whole towers drawn as thin line elevations: press one and
   that is what the tower becomes. Everything underneath still takes it
   apart piece by piece for anybody who wants to.

   The drawing is generated from the stack itself, not drawn by hand, so a
   tower added to the list cannot end up with the wrong picture. */
/* ══════════════════════════════════════════════════════════════════
   RAISING ONE PIECE TAKES THE INCHES OFF ITS NEIGHBOURS

   The slider wrote its number straight on to the piece and the height
   solver adds set heights up without asking whether they fit. In a
   tower with 40" free, asking for 80" drew the band from 43.75" up to
   124", forty inches out through the top of an 84" carcass. The carcass
   does not grow, so the tower on screen looked identical and only the
   figure in the panel moved. That is the whole of "the aside raised and
   the tower did not".

   A tower is a fixed height, so the inches have to come from somewhere.
   They come from the other pieces, the farthest one first, each down to
   the minimum it can honestly be built at. What cannot be found that
   way is refused, and the slider stops where the tower stops. */
/* the inches this tower actually has, the same number paintStack shows */
function bayUsable(){
  if(!S.sel) return 80;
  const floorY = baseHeight(S.mounting, placedFittings());
  return (cur?.bays?.find(x => x.wall === S.sel.wall && x.bay === S.sel.i)?.h)
    ?? (Math.max(SPEC.panel * 2 + 12, Math.min(S.cabTop, S.room.h - 2)) - floorY);
}
const bankH = st => {
  const sz = (Array.isArray(st.o?.sizes) && st.o.sizes.length) ? st.o.sizes : defaultDrawerSizes(st.o?.n);
  return drawerBankHeight(sz);
};
/* the least this piece can be built at */
const minNeed = st => MODULES[st.m].sizes ? bankH(st) : modMinH(st.m, st.o);
/* the inches it is asking for right now; a filler asks for nothing and
   takes whatever the others leave */
const setNeed = st => {
  const d = MODULES[st.m];
  if(d.sizes) return bankH(st);
  if(st.h != null) return Math.max(modMinH(st.m, st.o), Math.min(d.maxH ?? 96, st.h));
  return d.fill ? 0 : (d.defH ?? 24);
};
/* how tall the piece at `pin` can be made, once everything else in the
   tower has the minimum it needs */
function headroom(stack, pin, usable){
  const d = MODULES[stack[pin].m];
  let other = 0;
  stack.forEach((st, j) => { if(j !== pin) other += minNeed(st); });
  return Math.max(d.minH ?? 6, Math.min(d.maxH ?? usable, usable - other));
}
/* make the stack fit inside the tower, taking it off everything but `pin` */
/* ══════════════════════════════════════════════════════════════════
   SET THE HEIGHT AND THE COUNT FOLLOWS IT

   Dragging the shelves down to 14" used to leave four shelves on the
   piece. Four shelves need 32", so the solver then insisted on 32",
   took the difference off the rod beside it, and put the shelves back
   up at 16.75". You moved one slider and two other things moved, which
   is the whole of "picking the height changes location".

   A height set by hand is the answer. Fourteen inches is one shelf, so
   the piece is one shelf, and nothing else in the tower is touched. */
function setBandH(st, h){
  const d = MODULES[st.m]; if(!d) return;
  st.h = Math.round(h * 4) / 4;
  if(d.minPer && d.opt){
    const fit = unitsThatFit(st.m, st.o, st.h);
    if(fit != null) st.o = { ...(st.o || {}), [d.opt.key]:fit };
  }
}

function squeeze(stack, pin, usable){
  let over = stack.reduce((a, st) => a + setNeed(st), 0) - usable;
  if(over <= 0.01) return;
  const order = stack.map((_, j) => j).filter(j => j !== pin)
                     .sort((a, b) => Math.abs(b - pin) - Math.abs(a - pin));
  for(const j of order){
    if(over <= 0.01) break;
    const st = stack[j], d = MODULES[st.m];
    if(d.sizes) continue;                   // a bank is the sum of its boxes
    const give = setNeed(st) - minNeed(st);
    if(give <= 0.01) continue;
    const take = Math.min(give, over);
    setBandH(st, setNeed(st) - take);
    over -= take;
  }
  if(over > 0.01){
    const p = stack[pin], pd = MODULES[p.m];
    if(!pd.sizes) setBandH(p, Math.max(pd.minH ?? 6, setNeed(p) - over));
  }
}

/* A READY-MADE TOWER IS A SECTION WITH ITS BANDS IN IT.
   This used to be its own seventy-line schematic in hairlines, which
   agreed with nothing else on the page. It is the same drawing as the
   part cards now, so a tower card and the cards for the parts inside it
   cannot look like two different products. */
const towerThumb = (stack, usable = 80) => sectionArt(stack, usable, 'twthumb');
function towerGrid(bay, usable){
  const now = JSON.stringify((bay.stack || []).map(x => [x.m, x.h, x.o?.n, x.o?.sizes]));
  const same = p => JSON.stringify(p.stack.map(x => [x.m, x.h, x.o?.n, x.o?.sizes])) === now;
  const groups = TOWER_GROUPS.map(g => {
    const items = TOWER_PRESETS.filter(p => p.group === g);
    if(!items.length) return '';
    return `<div class="twgrp"><h6>${g}</h6><div class="twrow">${items.map(p => `
      <button type="button" class="twcard${same(p) ? ' on' : ''}" data-tower="${p.id}"
              title="${p.label}">${towerThumb(p.stack, usable)}<span>${p.label}</span></button>`).join('')}</div></div>`;
  }).join('');
  return `<div class="twpick">
    <div class="twhd"><b>Ready-made towers</b></div>
    ${groups}</div>`;
}

/* ══════════════════════════════════════════════════════════════════
   THE WHOLE-CLOSET OPTIONS, OUT WHERE EVERYTHING CAN REACH THEM

   They used to live inside paintStack, which meant they only existed
   once a tower was selected: land in the room, press nothing, and the
   right-hand column was an empty box with one grey sentence in it. They
   are properties of the closet and the room, not of a tower, so they sit
   out here and the panel prints them whether anything is open or not.
   ══════════════════════════════════════════════════════════════════ */
const dot = hex => `<span class="tdot" style="background:#${hex.toString(16).padStart(6,'0')}"></span>`;
const toneRow = (k, now, label) => `<div class="orow">
    <span class="olab">${label}</span>
    <span class="opick">${ROOM_TONES[k].map(t2 => `<button type="button"
      class="${t2.id === now ? 'on' : ''}" data-tone="${k}" data-v="${t2.id}"
      title="${t2.label}" aria-label="${t2.label}" aria-pressed="${t2.id === now}">
      ${dot(t2.hex)}</button>`).join('')}</span>
  </div>`;

const optionBlocks = () => {
  const fin  = cat.finishes.find(f => f.n === S.finish) || cat.finishes[0];
  const fNow = S.frontFinish || S.finish;
  const fr   = cat.finishes.find(f => f.n === fNow) || fin;
  const pull = PULLS.find(x => x.id === S.pull) || PULLS[1];
  const pf   = PULL_FINISHES.find(x => x.id === S.pullFinish) || PULL_FINISHES[0];
  const hasFronts = (cur?.parts || []).some(p2 => /DOOR|DRAWER|HAMPER/.test(p2.code || ''));
  return `<div class="optblk">
    <h4 class="subh">Closet options</h4>
    <div class="orow"><span class="olab">Finish</span>
      <button type="button" class="obtn" data-goto="3">
        <span class="swc" style="${swStyle(fin)}"></span><i>${fin.n}</i></button></div>
    <div class="orow"><span class="olab">Fronts</span>
      <button type="button" class="obtn" data-goto="3" ${hasFronts ? '' : 'disabled'}>
        <span class="swc" style="${swStyle(fr)}"></span>
        <i>${hasFronts ? (S.frontFinish || 'Same as the carcass') : 'Nothing with a front yet'}</i></button></div>
    <div class="orow"><span class="olab">Handle</span>
      <span class="opick wide">${PULLS.map(p2 => `<button type="button"
        class="${p2.id === pull.id ? 'on' : ''}" data-pullset="${p2.id}"
        title="${p2.note.replace(/"/g,'&quot;')}" aria-pressed="${p2.id === pull.id}">
        <span class="pz p-${p2.kind}"></span></button>`).join('')}</span></div>
    <div class="orow"><span class="olab">Handle finish</span>
      <span class="opick">${PULL_FINISHES.map(f2 => `<button type="button"
        class="${f2.id === pf.id ? 'on' : ''}" data-pfset="${f2.id}"
        title="${f2.name}" aria-label="${f2.name}" aria-pressed="${f2.id === pf.id}">
        ${dot(f2.hex)}</button>`).join('')}</span></div>

    <h4 class="subh">Room options</h4>
    <p class="note" style="margin:-2px 0 9px">The room around the closet, so you can
      see it against your own paint and floor. None of this is built or charged for.</p>
    ${toneRow('wall',  S.wallTone,  'Wall colour')}
    ${toneRow('floor', S.floorTone, 'Floor')}
    ${toneRow('trim',  S.trimTone,  'Trim')}

    <h4 class="subh">The door on this room</h4>
    <div class="dgrid">${DOORS.map(x => `<button type="button" class="dcard ${x.id === S.door ? 'on' : ''}"
      data-door="${x.id}" aria-pressed="${x.id === S.door}" title="${x.note}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${x.art}"/></svg>
      <i>${x.label}</i></button>`).join('')}</div>
    ${S.door && S.door !== 'none' ? `<div class="orow"><span class="olab">Opening</span>
      <span class="wadj"><button data-dw="-2" title="Narrower">&minus;</button>
        <i>${(+(S.doorW || 0)).toFixed(0)}" wide</i>
        <button data-dw="2" title="Wider">+</button></span></div>` : ''}
  </div>`;
};

function paintStack(){
  const box = $('#stack');
  /* The open component and the open library belong to ONE tower. Select a
     different tower and the panel goes back to being that tower, rather
     than showing the shelf you opened in the last one. */
  const selKey = S.sel ? S.sel.wall + '|' + S.sel.i : null;
  if(PICK_FOR !== selKey){ S.part = null; S.add = null; S.carc = null; S.lib = false; S.pick = null; PICK_FOR = selKey; }
  const run = S.sel && S.runs[S.sel.wall];
  if(!run?.bays[S.sel?.i]){
    /* If the chosen wall exists but has nothing on it yet, STAY on it. This
       used to jump the selection to whichever wall did have towers, which
       meant opening an empty wall immediately bounced you back to the full
       one and the empty wall could never be worked on. */
    if(run?.on){
      /* The wall's own strip already says "Nothing on this wall yet. Pick a
         width below" right above this, so printing it again here was the same
         sentence twice in the same box. The picker just stays empty. */
      box.innerHTML = optionBlocks();
      dockStack();
      return;
    }
    /* NOTHING SELECTED MEANS NOTHING SELECTED.
       This used to hunt for the first wall with towers on it and open
       that, so the panel could never be at rest: land in the room, press
       nothing, and it had already picked a tower for you. With no
       selection the column shows what is true of the whole closet, which
       is the only thing that can be true when nothing is open. The hunt
       is still here for the other case, a selection pointing at a tower
       that has since been removed. */
    if(S.sel){
      const wall = Object.keys(S.runs).find(k => S.runs[k]?.on && S.runs[k].bays.length);
      if(wall){ S.sel = { wall, i:0 }; return paintStack(); }
    }
    box.innerHTML = optionBlocks();
    dockStack();
    return;
  }
  const bay = S.runs[S.sel.wall].bays[S.sel.i];
  /* same arithmetic buildDesign uses, so the palette agrees with the drawing */
  const floorY = baseHeight(S.mounting, placedFittings());
  /* the height THIS section actually has, not the room's best case: a window
     or a slope over it means fewer inches to divide between the parts */
  const usable = (cur?.bays?.find(x => x.wall === S.sel.wall && x.bay === S.sel.i)?.h)
    ?? (Math.max(SPEC.panel * 2 + 12, Math.min(S.cabTop, S.room.h - 2)) - floorY);

  /* Is the tower being edited the one in the inside corner? If it is, the
     picker does not offer anything with a front on it, because the next run
     comes across that front and it could not be opened. */
  const inCorner = cornerBlocked(cfg(), S.sel.wall, S.sel.i, bay.at ?? 0, bay.w);

  /* The ready-made cards used to be built here: eleven presets, each one
     priced by building a whole throwaway design through presetDelta just to
     show a "+$85" badge, on every single repaint of this panel. They are gone
     from the panel, so the work is gone with them. */

  /* ══════════════════════════════════════════════════════════════════
     A section is two halves. Each half shows only what can actually go
     there, which is a build rule and not a preference.
     ══════════════════════════════════════════════════════════════════ */
  const sl = slots(bay.stack);
  const pick = S.pick;                                  // 'top' | 'bottom' | null

  /* what the drawer bank is, drawer by drawer, in sizes he actually stocks */
  const drawerRows = st => {
    const sizes = (st.o?.sizes?.length ? st.o.sizes : defaultDrawerSizes(st.o?.n));
    const bank  = drawerBankHeight(sizes);
    return `<div class="dsizes">
      <span class="dlbl">The way it is drawn &middot; ${(+bank.toFixed(2))}" of bank</span>
      <ol class="dlist">
        ${sizes.map((h, i) => ({ h, i })).reverse().map(({ h, i }) => `<li>
          <b>${i + 1}${i === sizes.length - 1 ? ' · top' : i === 0 ? ' · bottom' : ''}</b>
          <select data-dsize="${i}" aria-label="Box height for drawer ${i + 1}">
            ${/* Only the four a closet is actually built from. A size that is
                  stocked but no longer offered still appears if this bank is
                  already using it, so an older design never loses a drawer
                  it was quoted with. */''}
            ${DRAWER_SIZES.filter(z => z.offered || +h === z.h)
               .map(z => `<option value="${z.h}" ${+h === z.h ? 'selected' : ''}>${z.label} box</option>`).join('')}
          </select>
          <i>${(DRAWER_SIZES.find(z => z.h === +h) || {}).use || ''}</i>
        </li>`).join('')}
      </ol>
      <div class="dacts">
        <button type="button" data-dadd="1" ${sizes.length >= 8 ? 'disabled' : ''}>Add a drawer</button>
        <button type="button" data-drm="1" ${sizes.length <= 1 ? 'disabled' : ''}>Remove the top one</button>
      </div>
      <p class="dnote">These are the box sizes he stocks. The front is an inch
        taller than the box, so the bank is exactly what the drawers add up to.</p>
    </div>`;
  };

  /* ══ WHAT IS BEHIND THE DOOR ═══════════════════════════════════════
     A door used to be the end of the conversation: you picked it, a slab
     appeared, and the cupboard behind it was empty and unpriced. Nobody
     buys an empty cupboard, so the one question that was missing is asked
     here, in the card for the door itself, the same way the number of
     shelves is asked in the card for shelves. */
  const insideRow = (st, slot) => {
    const cur = st.o?.inside || DOOR_INSIDE_DEF;
    return `<div class="insider">
      <span class="inlab">Behind the door</span>
      <div class="inpick">
        ${DOOR_INSIDE.map(id => `<button type="button" class="${id===cur?'on':''}"
           data-inside="${id}" data-slot="${slot}">${MODULES[id].label}</button>`).join('')}
      </div>
    </div>`;
  };

  /* ══════════════════════════════════════════════════════════════════
     THE PANEL OPENS ON WHATEVER WAS CLICKED

     Three states, never two of them at once. Press a tower and the panel
     is that tower: the ready-made grid, its width, its depth, and the
     list of what is standing in it. Press a shelf, in the list or in the
     drawing itself, and the whole panel becomes that shelf: its height,
     how many, what goes behind it, what to swap it for. Press "Edit
     components" and it becomes the library.

     The old panel asked which HALF of the tower you were filling before
     you knew what you wanted in it. Nobody thinks about a closet in
     halves, and he said so about five times.
     ══════════════════════════════════════════════════════════════════ */

  /* the resolved bands for THIS tower: every row can print its real
     height because the engine has already worked it out */
  const bands = (cur?.bays?.find(x => x.wall === S.sel.wall && x.bay === S.sel.i)?.bands) || [];
  const adds  = (cur?.bays?.find(x => x.wall === S.sel.wall && x.bay === S.sel.i)?.adds)  || [];
  const live = si => bands[si];
  /* Number.toString already drops trailing zeros, so 40 prints as 40 and
     40.25 prints as 40.25. Stripping zeros with a regex on top of that
     turned 40 into 4, which is the kind of wrong a customer notices. */
  const inches = v => (+v.toFixed(2)).toString() + '"';

  const selRun = S.runs[S.sel.wall];
  const dCap = wallDepthCap(S.sel.wall);
  const dLo = SPEC.runDepthMin, dHi = Math.min(SPEC.runDepthMax, Math.round(dCap));
  const dNow = Math.min(selRun?.depth ?? SPEC.hangDepth, dCap);

  const head = `<div class="selhd tight"><b>Tower ${S.sel.i+1} of ${S.runs[S.sel.wall].bays.length}</b>
      <span class="selacts">
        <span class="wadj"><button data-bw="-2" title="Narrower">−</button><i>${bay.w.toFixed(0)}" wide</i><button data-bw="2" title="Wider">+</button></span>
        <span class="movw">
          <button data-move="-1" ${S.sel.i===0?'disabled':''} title="Move left along the wall">&#9664;</button>
          <button data-move="1" ${S.sel.i>=S.runs[S.sel.wall].bays.length-1?'disabled':''} title="Move right along the wall">&#9654;</button>
        </span>
        <button class="rmsec" data-rmsec="1" title="Remove this tower">Remove</button>
      </span>
      <label class="dsel"><span>Depth</span>
        <select data-rundepth="${S.sel.wall}" aria-label="Run depth in inches">
          ${DEPTHS.filter(v => v >= dLo - 0.01 && v <= dHi + 0.01).map(v =>
            `<option value="${v}" ${Math.abs(dNow - v) < 0.26 ? 'selected' : ''}>${v}"</option>`).join('')}
          ${DEPTHS.some(v => Math.abs(dNow - v) < 0.26) ? ''
            : `<option value="${+dNow.toFixed(1)}" selected>${+dNow.toFixed(1)}"</option>`}
        </select></label></div>`;

  /* DEPTH IS A DROPDOWN IN THE HEADER, NOT A ROW OF CHIPS.
     Five buttons and a number box for one answer took four lines of the
     panel and read as a decision to agonise over. It is wall to the front
     of the panel, it is a property of the run because a run of cabinetry
     is one depth, and it belongs beside the tower's name where you can
     see it without looking for it. */
  /* ── what is standing in this tower, top to bottom ── */
  const compList = () => {
    const rows = bay.stack.map((st, si) => ({ st, si }))
      .filter(e => e.st.m !== 'COUNTER')
      .reverse()
      .map(({ st, si }) => {
        const d = MODULES[st.m]; if(!d) return '';
        const b = live(si);
        const h = b ? (b.y1 - b.y0) : null;
        const sub = d.sizes
          ? `${(st.o?.sizes?.length || defaultDrawerSizes(st.o?.n).length)} drawers · ${h != null ? inches(h) : ''}`
          : (h != null ? inches(h) + ' tall' : (st.h == null ? 'fills the space' : inches(st.h) + ' tall'));
        /* UP AND DOWN, BECAUSE WHERE A PIECE SITS IS MOST OF THE DESIGN.
           A valet rod belongs under a shelf at eye height and a trouser
           rack belongs in the middle. Something added from the library
           lands at the top of the tower, and without these the only way
           to move it was to take it out and build the tower again. */
        const last = bay.stack.length - 1;
        return `<li class="comprowwrap">
          <button type="button" class="comprow" data-part="${si}">
            <span class="sico"><svg viewBox="0 0 24 32"><path d="${d.icon}"/></svg></span>
            <span class="compname"><b>${d.label}</b><i>${sub}</i></span>
            <span class="compgo" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg>
            </span></button>
          <span class="compmove">
            <button type="button" data-partmove="1" data-si="${si}" ${si>=last?'disabled':''}
              title="Move it up the tower" aria-label="Move ${d.label} up">&#9650;</button>
            <button type="button" data-partmove="-1" data-si="${si}" ${si<=0?'disabled':''}
              title="Move it down the tower" aria-label="Move ${d.label} down">&#9660;</button>
          </span></li>`;
      }).join('');
    /* the things placed at a height, listed under the slices with the
       height they are actually at, because that is the only thing about
       them anybody wants to know */
    const addRows = (adds || []).map(a => `<li class="comprowwrap">
        <button type="button" class="comprow add" data-add="${a.i}">
          <span class="sico"><svg viewBox="0 0 24 32"><path d="${MODULES[a.m].icon}"/></svg></span>
          <span class="compname"><b>${a.label}</b><i>${inches(a.y)} off the floor</i></span>
          <span class="compgo" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg>
          </span></button>
        <span class="compmove">
          <button type="button" data-addmove="1" data-ai="${a.i}" title="Raise it">&#9650;</button>
          <button type="button" data-addmove="-1" data-ai="${a.i}" title="Lower it">&#9660;</button>
        </span></li>`).reverse().join('');
    return `<h4 class="subh">What is in this tower</h4>
      <ol class="complist">${rows}${addRows}
        ${(rows || addRows) ? '' : '<li class="compnone">Nothing in this tower yet. Press Edit components.</li>'}</ol>
      <div class="compacts">
        <button type="button" class="btn btn-fill btn-sm" data-lib="1">Edit components</button>
      </div>
      <label class="ctop"><input type="checkbox" data-counter="1" ${sl.counter?'checked':''}>
        <span>A worktop over it</span></label>`;
  };

  /* ── one component, opened ── */
  const heightRow = (st, si, d) => {
    if(d.sizes) return '';                    // a bank is as tall as its boxes
    const b = live(si);
    const now = b ? (b.y1 - b.y0) : (st.h ?? d.defH ?? 24);
    /* ══════════════════════════════════════════════════════════════
       "FILL" ONLY MEANS SOMETHING ON A PART THAT FILLS

       The checkbox was on every component. On a hamper, which is 26"
       to 32" and nothing else, ticking it wrote `h = null`, the height
       solver fell through to `defH`, and the control then said the
       hamper was "taking what the rest of the tower leaves" while
       quietly drawing it at 28" like always. A control that claims to
       do something it cannot is worse than no control. It is drawn
       only for the parts flagged `fill`, and on the rest the slider is
       the whole answer. */
    const canFill = !!d.fill;
    const fills = canFill && st.h == null;
    /* THE FLOOR CANNOT BE OVER THE CEILING. On a piece whose count
       follows its height the floor is the module's own minimum, because
       dragging down takes shelves out rather than asking for inches the
       tower has not got. On everything else it is what the piece needs
       as it stands. Either way it is capped by the headroom, so the
       slider can never offer a height that does not exist. */
    const hr = Math.max(4, headroom(bay.stack, si, usable));
    const lo = Math.min(hr, Math.max(4, d.minPer ? (d.minH ?? 6) : modMinH(st.m, st.o)));
    /* not the whole tower: the whole tower LESS what everything else in
       it needs, so the slider can never ask for inches that are not
       there and then quietly not get them */
    const hi = Math.max(lo + 0.25, hr);
    /* the slider can never be asked for a height the tower has not got,
       so a range that has collapsed means there is nothing to set */
    if(hi <= lo + 0.24 && !canFill) return `<div class="prow">
      <span class="prowl"><b>Height</b><i>Fixed at this size</i></span>
      <span class="prowc end"><b class="hval">${inches(now)}</b></span></div>`;
    return `<div class="prow">
      <span class="prowl"><b>Height</b><i>${fills ? 'Takes what the rest of the tower leaves'
        : `Set by you &middot; ${inches(lo)} to ${inches(hi)}`}</i></span>
      <span class="prowc">
        ${canFill ? `<label class="hfill"><input type="checkbox" data-hfill="${si}" ${fills?'checked':''}>
          <span>Fill</span></label>` : ''}
        <input type="range" data-hset="${si}" min="${lo}" max="${hi.toFixed(2)}" step="0.25"
               value="${Math.min(hi, Math.max(lo, now)).toFixed(2)}" ${fills?'disabled':''}
               aria-label="${d.label} height in inches">
        <b class="hval" data-hval="${si}">${inches(now)}</b>
      </span>
    </div>`;
  };

  /* THE NUMBER ON THE BUTTON IS THE NUMBER THAT IS BUILT.
     The stepper counted up to ten whatever the tower had room for, so
     the panel said four shelves while the drawing built two and nobody
     could tell which was lying. It counts to what fits, it shows what is
     built, and when the tower has no more inches the plus is dead and
     says why. */
  const countRow = (st, si, d, which = 'opt') => {
    const o = d[which]; if(!o) return '';
    const b2 = live(si);
    const per = (which === 'opt') ? d.minPer : 0;
    const have = b2 ? (b2.y1 - b2.y0) : (d.defH ?? 24);
    /* HOW MANY COULD FIT WITHOUT MOVING ANYTHING ELSE.
       A piece with a height of its own can grow into whatever the rest
       of the tower is not using. A piece that takes the leftovers
       cannot: its inches are decided by everything around it, so what
       it has is all it is ever going to have. */
    const canBe = d.fill && st.h == null ? have : headroom(bay.stack, si, usable);
    const capN = per ? Math.min(o.max ?? 99, Math.max(o.min ?? 1, Math.floor(canBe / per)))
                     : (o.max ?? 99);
    const now = per ? (b2?.nFit ?? unitsThatFit(st.m, st.o, have) ?? (st.o?.[o.key] ?? o.def))
                    : (st.o?.[o.key] ?? o.def);
    const noMore = per && now >= capN;
    return `<div class="prow">
      <span class="prowl"><b>${o.label || 'How many'}</b>${
        noMore ? `<i>${now} is all this tower has the height for</i>`
               : (o.note ? `<i>${o.note}</i>` : '')}</span>
      <span class="prowc end"><span class="sopt">
        <button data-optpart="-1" data-si="${si}" data-key="${which}" title="Fewer"
          ${now <= (o.min ?? 1) ? 'disabled' : ''}>−</button>
        <i>${now}</i>
        <button data-optpart="1" data-si="${si}" data-key="${which}" title="More"
          ${noMore ? 'disabled' : ''}>+</button></span></span>
    </div>`;
  };

  /* A CHOICE IS NOT A COUNT.
     Fixed or adjustable, one door or two: two or three named answers, so
     a plus and a minus button is the wrong control for it. */
  const choiceRow = (st, si, d) => {
    const ch = d.choice; if(!ch) return '';
    const now = +(st.o?.[ch.key] ?? ch.def);
    return `<div class="prow wrap">
      <span class="prowl"><b>${ch.label}</b></span>
      <span class="chpick">${ch.options.map(op => {
        /* an answer that cannot be built on this tower is refused here and
           says why, rather than being accepted and quietly overruled */
        const no = (op.maxW != null && bay.w > op.maxW) ? (op.no || 'Not at this width.') : '';
        return `<button type="button" class="${op.v === now ? 'on' : ''}" data-choice="${ch.key}"
                data-si="${si}" data-v="${op.v}" ${no ? 'disabled' : ''}
                title="${(no || op.note || '').replace(/"/g,'&quot;')}">
          <b>${op.label}</b><i>${no || op.note || ''}</i></button>`;
      }).join('')}</span>
    </div>`;
  };

  /* A PART WITH NO PHOTO IS STILL A CARD.
     The accessories do not have studio photos yet. A missing <img> is a
     broken card, so a part without one is drawn from its own icon on a
     tinted tile instead. Drop the photo in later and it takes over with
     no other change. */
  /* EVERY CARD IS DRAWN BY THE SAME ENGINE AS THE TOWER CARDS.
     Stock photographs of somebody else's wardrobe next to a hairline
     schematic next to six hand-drawn tiles was three design systems on
     one screen, and none of them was the closet this site builds. */
  const partArt = (d, id) => PART_BAND[id] ? partSection(id)
    : `<span class="pdraw" aria-hidden="true">
         <svg viewBox="0 0 24 32" fill="none" stroke="currentColor"><path d="${d.icon}"/></svg></span>`;

  /* what this one could be instead, with the reason shown when it cannot */
  const swapCards = si => {
    const st = bay.stack[si];
    const slot = si === 0 ? 'bottom' : 'top';
    const others = bay.stack.filter((_, j) => j !== si);
    return MODULE_IDS.filter(id => canOffer(id, slot, others.length > 0) || st.m === id).map(id => {
      const d = MODULES[id];
      const on = st.m === id;
      const chk = on ? { ok:true } : canAdd(others, id, usable, inCorner, slot);
      const tip = (chk.ok ? d.hint : chk.why).replace(/"/g,'&quot;');
      return `<button class="pcard" data-setpart="${si}" data-m="${id}" aria-pressed="${on}"
                      ${chk.ok?'':'disabled'} title="${tip}">
        ${partArt(d, id)}
        <i>${d.label}</i>
        <span class="phov"><em>${(d.hint||'').replace(/"/g,'&quot;')}</em>
          <b>${(d.spec||'').replace(/"/g,'&quot;')}</b></span>
        ${on ? '<span class="pbadge">Current</span>' : ''}
        ${chk.ok ? '' : `<u class="full">${/corner/.test(chk.why) ? 'Not in a corner' : 'No room'}</u>`}</button>`;
    }).join('');
  };

  const partPanel = si => {
    const st = bay.stack[si], d = MODULES[st.m];
    const b = live(si);
    return `<div class="pbar"><button type="button" class="pback" data-partback="1">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>
        Tower ${S.sel.i+1}</button></div>
      <div class="phd">
        <span class="sico"><svg viewBox="0 0 24 32"><path d="${d.icon}"/></svg></span>
        <span class="phdtx"><b>${d.label} options</b>
          <i>${b ? inches(b.y1 - b.y0) + ' tall, ' + inches(b.y0) + ' off the floor' : ''}</i></span>
      </div>
      ${heightRow(st, si, d)}
      ${d.opt ? countRow(st, si, d, 'opt') : ''}
      ${d.choice ? choiceRow(st, si, d) : ''}
      ${d.opt2 ? countRow(st, si, d, 'opt2') : ''}
      ${d.sizes ? drawerRows(st) : ''}
      ${d.inside ? insideRow(st, si === 0 ? 'bottom' : 'top') : ''}
      <h4 class="subh">Change it for something else</h4>
      <div class="pgrid">${swapCards(si)}</div>
      <div class="compacts">
        <button type="button" class="btn btn-ghost btn-sm" data-rmpart="${si}">Take this one out</button>
      </div>`;
  };

  /* ── the library ── */
  const libPanel = () => {
    const others = bay.stack;
    /* A front is judged against an EMPTY tower, because it takes the tower
       over rather than squeezing in beside what is there. Measured against
       the contents it always came back "no room" and could never be
       chosen, which is not what a door does. */
    const groups = LIB_GROUPS.map(g => {
      const items = g.ids.filter(id => MODULES[id] && !MODULES[id].legacy);
      if(!items.length) return '';
      return `<div class="libgrp"><h6>${g.t}</h6><div class="pgrid">${items.map(id => {
        const d = MODULES[id];
        const against = WHOLE_FRONT.has(id) ? [] : others;
        /* ══════════════════════════════════════════════════════════
           ASK ABOUT THE HALF THE PIECE IS ACTUALLY GOING INTO

           Every card in the library was tested against the TOP of the
           tower. A drawer bank, a hamper and a basket bank only ever
           sit on the floor: `addPart` puts them underneath, and the
           slot table says top:false for all three. So the library
           asked "can this go on top", got no, and greyed out the only
           three pull-outs he sells, on an empty tower, with nothing in
           the way. They could not be added from the library at all.

           The slot asked for is now the slot the piece will land in. */
        const slot = (d.sizes || id === 'HAMPER' || id === 'BASKETS') ? 'bottom' : 'top';
        /* An attachment takes nothing from anything, so there is never a
           reason to refuse one. "No room" on a shelf, in a tower with
           four feet of air in it, is the thing he kept pointing at. */
        const chk = isAddon(id) ? { ok:true } : canAdd(against, id, usable, inCorner, slot);
        const hint = WHOLE_FRONT.has(id) && others.length
          ? d.hint + ' It takes the whole tower, and what is in it becomes what is behind it.'
          : d.hint;
        const tip = (chk.ok ? hint : chk.why).replace(/"/g,'&quot;');
        return `<button class="pcard" data-addmod="${id}" ${chk.ok?'':'disabled'} title="${tip}">
          ${partArt(d, id)}
          <i>${d.label}</i>
          <span class="phov"><em>${(d.hint||'').replace(/"/g,'&quot;')}</em>
            <b>${(d.spec||'').replace(/"/g,'&quot;')}</b></span>
          ${chk.ok ? '' : `<u class="full">${/corner/.test(chk.why) ? 'Not in a corner' : 'No room'}</u>`}</button>`;
      }).join('')}</div></div>`;
    }).join('');
    return `<div class="pbar"><button type="button" class="pback" data-libclose="1">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>
        Tower ${S.sel.i+1}</button></div>
      <h4 class="subh">Components</h4>
      ${groups}`;
  };

  /* ══════════════════════════════════════════════════════════════════
     THE TWO THINGS THAT ARE TRUE OF THE WHOLE CLOSET

     Colour, handle and the room around it were on a step of their own
     three clicks away, so a customer filled a tower, walked off, and
     never saw them. They are properties of the whole job rather than of
     one tower, so they sit at the foot of the panel where they are
     always reachable and never in the way of the thing being edited.

     Nothing here is a new control. The carcass colour written from this
     block is the same S.finish the finishes step writes, so the two can
     never disagree. */

  /* A FILLER HAS ONE QUESTION AND IT IS HOW WIDE. */
  const fillerPanel = () => `<div class="phd">
      <span class="sico"><svg viewBox="0 0 24 32"><path d="${MODULES.FILLER.icon}"/></svg></span>
      <span class="phdtx"><b>Filler panel</b><i>${bay.w.toFixed(1)}" wide, floor to top shelf</i></span>
    </div>
    <p class="note">A blank panel that closes a gap too narrow for a tower. It is cut on
      site and finished to match, so it can be any width from ${FILLER_MIN}" to ${FILLER_MAX}".</p>
    <div class="prow"><span class="prowl"><b>Width</b><i>Half an inch at a time</i></span>
      <span class="prowc"><input type="range" data-fillw="1" min="${FILLER_MIN}" max="${FILLER_MAX}"
        step="0.5" value="${bay.w}" aria-label="Filler width in inches">
        <b class="hval">${bay.w.toFixed(1)}"</b></span></div>`;

  /* ══════════════════════════════════════════════════════════════════
     ONE PLACED THING, OPENED

     Its height off the floor, whatever choice it has of its own, and the
     way out. No "fill", no neighbours, no arithmetic: it is one object
     in a box and the only question is how high up it is. */
  const addPanel = ai => {
    const a = adds.find(x => x.i === ai); if(!a) return '';
    const d = MODULES[a.m];
    const b0 = cur?.bays?.find(x => x.wall === S.sel.wall && x.bay === S.sel.i);
    const lo = (b0?.floorY ?? 3.75) + 1;
    const hi = lo + (b0?.h ?? 80) - (d.defH ?? 2) - 1.5;
    const st = { m:a.m, o:a.o };
    return `<div class="pbar"><button type="button" class="pback" data-partback="1">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>
        Tower ${S.sel.i+1}</button></div>
      <div class="phd">
        <span class="sico"><svg viewBox="0 0 24 32"><path d="${d.icon}"/></svg></span>
        <span class="phdtx"><b>${d.label}</b><i>${inches(a.y)} off the floor</i></span>
      </div>
      <div class="prow">
        <span class="prowl"><b>Height</b><i>Off the floor &middot; or drag it in the Wall view</i></span>
        <span class="prowc">
          <input type="range" data-addset="${ai}" min="${lo.toFixed(2)}" max="${hi.toFixed(2)}"
                 step="0.25" value="${Math.min(hi, Math.max(lo, a.y)).toFixed(2)}"
                 aria-label="${d.label} height off the floor">
          <b class="hval" data-addval="${ai}">${inches(a.y)}</b>
        </span>
      </div>
      ${d.choice ? `<div class="prow wrap">
        <span class="prowl"><b>${d.choice.label}</b></span>
        <span class="chpick">${d.choice.options.map(op => `<button type="button"
          class="${op.v === +(a.o?.[d.choice.key] ?? d.choice.def) ? 'on' : ''}"
          data-addchoice="${d.choice.key}" data-ai="${ai}" data-v="${op.v}">
          <b>${op.label}</b><i>${op.note || ''}</i></button>`).join('')}</span>
      </div>` : ''}
      <p class="note">${d.hint}</p>
      <div class="compacts">
        <button type="button" class="btn btn-ghost btn-sm" data-rmadd="${ai}">Take this one out</button>
      </div>`;
  };

  /* ══════════════════════════════════════════════════════════════════
     THE TOE KICK AND THE TOP OF THE TOWER

     Two real pieces with two real heights, and the only parts of a tower
     nobody could press. The kick decides how far off the floor the whole
     box starts and the top decides how tall it is, so between them they
     are most of what makes one tower different from the one beside it.
     Both are per tower now. Neither can beat the room: the kick cannot
     go under baseboard heat the run is already hanging clear of, and the
     top cannot go through a slope or a bulkhead. */
  const carcPanel = which => {
    const b0 = cur?.bays?.find(x => x.wall === S.sel.wall && x.bay === S.sel.i);
    if(!b0) return '';
    const isKick = which === 'kick';
    const now = isKick ? (b0.floorY ?? SPEC.toeKick) : (b0.top ?? 84);
    const lo  = isKick ? 0    : (b0.floorY ?? 0) + 24;
    const hi  = isKick ? 12   : Math.max(lo + 1, Math.min(S.cabTop, S.room.h - 2));
    return `<div class="pbar"><button type="button" class="pback" data-partback="1">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>
        Tower ${S.sel.i+1}</button></div>
      <div class="phd">
        <span class="sico"><svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="${isKick ? 'M3 26h18M3 26v4h18v-4' : 'M3 6h18M5 6v22M19 6v22'}"/></svg></span>
        <span class="phdtx"><b>${isKick ? 'Toe kick' : 'Top of the tower'}</b>
          <i>${inches(now)}${isKick ? ' off the floor' : ' off the floor'}</i></span>
      </div>
      <div class="prow">
        <span class="prowl"><b>${isKick ? 'Kick height' : 'Tower height'}</b>
          <i>${isKick ? 'How far off the floor this tower starts'
                      : 'Where the top shelf lands'}</i></span>
        <span class="prowc">
          <input type="range" data-carcset="${which}" min="${lo.toFixed(2)}" max="${hi.toFixed(2)}"
                 step="0.25" value="${Math.min(hi, Math.max(lo, now)).toFixed(2)}"
                 aria-label="${isKick ? 'Toe kick height' : 'Tower height'} in inches">
          <b class="hval" data-carcval="${which}">${inches(now)}</b>
        </span>
      </div>
      ${isKick ? '' : `<label class="ctop"><input type="checkbox" data-wanttop="1"
        ${bay.top !== false ? 'checked' : ''}><span>Put a top shelf on it</span></label>`}
      <p class="note">${isKick
        ? 'A standard kick is 3¾". Raise it to clear a thick baseboard or to lift the bottom drawer off a wet floor.'
        : 'Every tower can stop at its own height. A slope or a bulkhead over it still has the last word.'}</p>
      <div class="compacts">
        <button type="button" class="btn btn-ghost btn-sm" data-carcreset="${which}">Back to standard</button>
      </div>`;
  };

  const mode = S.lib ? 'lib' : S.carc ? 'carc:' + S.carc : S.add != null ? 'add:' + S.add
    : (S.part != null && bay.stack[S.part]) ? 'part:' + S.part : 'tower';
  /* ══════════════════════════════════════════════════════════════════
     PRESS A TOWER AND THE TOWER LIST IS WHAT YOU GET

     The ready-made towers were behind a button called "Replace the whole
     tower", which is a sentence rather than a control, and nobody found
     them. 17squares does the obvious thing: you press a tower and the
     towers appear, as pictures, and you press the one you want. So that
     is the tower panel now: the grid first, what is in it underneath,
     and the whole-closet options at the foot of the column where they
     are always reachable. */
  if(isFiller(bay))                            box.innerHTML = head + fillerPanel() + optionBlocks();
  else if(S.lib)                               box.innerHTML = head + libPanel();
  else if(S.carc)                              box.innerHTML = head + carcPanel(S.carc);
  else if(S.add != null && adds.some(a => a.i === S.add))
                                               box.innerHTML = head + addPanel(S.add);
  else if(S.part != null && bay.stack[S.part]) box.innerHTML = head + partPanel(S.part);
  /* THE CARDS ARE THE FIRST THING IN THE COLUMN.
     "Tower 2 of 4", a width stepper, two arrows, a Remove and a depth
     dropdown sat across the top of the panel, so pressing a tower showed
     you a block of controls and the towers themselves started below the
     fold. Press a tower, see the towers. Its own controls are still
     there, directly under the row you came to look at. */
  else                                         box.innerHTML = towerGrid(bay, usable) + head
                                                              + compList() + optionBlocks();

  /* OPENING A COMPONENT PUTS YOU AT THE TOP OF IT.
     The panel scrolls, and it keeps its scroll position across a repaint,
     so pressing a shelf two thirds of the way down the list replaced the
     content underneath you and left you looking at the middle of the new
     panel with its heading somewhere above. */
  if(mode !== LAST_MODE){
    LAST_MODE = mode;
    const sc = box.closest('.pscroll');
    if(sc) sc.scrollTo({ top:0, behavior:'smooth' });
  }
  /* The ready-made block used to sit under the two halves, offering eleven
     pre-assembled towers next to the very pickers that build them. Two ways
     to do one job, and the pre-made one quietly wrote BOTH halves, so picking
     a top could wipe a bottom the customer had already chosen. They pick the
     top and the bottom; the named layouts stay on /layouts/ where they belong
     as a showroom, not as a second control. */
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
  {lv:5,n:'High gloss',     why:'Mirror gloss and heavy texture. Longest lead.'}];
/* Which of the two is open. Carcass by default, but if the design has fronts
   in it and the customer has not chosen a front finish yet, that is the one
   worth putting in front of them. */
let FINTAB = 'carcass';
const HAS_FRONTS = new Set(['DRAWERS','DOOR','GLASS_DOOR','MIRROR','HAMPER']);
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
      title="${fronts?'The color on your drawer and door fronts':'Add a drawer, a door or a hamper and this turns on'}">
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
    : 'Nothing in this design has a front on it yet, so one color covers the whole closet.';
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
  /* a design saved before the range was cut back may name a handle that is
     no longer offered; it resolves to the bar rather than showing nothing */
  const p=PULLS.find(x=>x.id===S.pull) || PULLS.find(x=>x.id===resolvePull(S.pull)) || PULLS[1];
  $('#pullNote').innerHTML=`<b>${p.name}</b><br>${p.note}`;
}

/* ───────── price + order ───────── */
function paintPrice(){
  /* NO PRICE GOES IN FRONT OF A CUSTOMER.
     Joseph prices every closet himself on ClosetPro, against the real room
     and the real access, and a number on this page that he then has to
     correct is worse than no number at all. The engine still costs the
     design -- the office, the order sheet and the enquiry all need it --
     it is simply never shown here. What the customer gets instead is the
     one promise we can keep: send it, and the figure comes back inside a
     day. */
  const built = cur.bays.length > 0;
  $('#price').textContent = built ? 'Price back within 24 hours' : 'Start with a tower';
  const nb=cur.bays.length;
  /* "0 bay · 0 parts" — one is the plural of none. And they are towers
     everywhere else on the page, so they are towers here too. */
  $('#priceSub').textContent = built
    ? `${nb} tower${nb===1?'':'s'} · ${cur.parts.length} part${cur.parts.length===1?'':'s'} · ${cur.finish.lead} week lead`
    : 'Add a tower to the wall and it starts building here';
  /* The flags are behind the button at the top of the card, not stacked over
     the price. The button counts them so you can see there is something to
     read without the card growing a paragraph every time. */
  const w = cur.warnings;
  const box = $('#warn');
  box.hidden = !w.length;
  box.innerHTML = w.length
    ? `<b class="warnhd">${w.length} thing${w.length===1?'':'s'} worth knowing</b>`
      + w.map(x=>`<span>${x}</span>`).join('')
    : '';
  const btn = $('#pinfo'), n = $('#pinfoN');
  if(btn){
    btn.classList.toggle('haswarn', !!w.length);
    btn.setAttribute('aria-label', w.length
      ? `${w.length} thing${w.length===1?'':'s'} worth knowing about this design, and what the price covers`
      : 'What this price covers');
  }
  if(n) n.textContent = w.length ? w.length : '';
}
/* The review step shows the same number three ways: the base system, the
   extras, the total. Supplier cost never appears here: that is Joseph's
   margin and it does not belong on a public page. */
function paintQuote(){
  const q = cur.quote, el = $('#quotebox');
  if(!el) return;
  if(!q || q.empty){
    el.innerHTML = `<p class="qnone">Nothing in the design yet. Add a tower on step 2 and the itemisation builds itself.</p>`;
    return;
  }
  const shape = S.type==='walk-in' ? ` (${SHAPES[S.shape].label})` : '';
  el.innerHTML = `<div class="qcard">
    <div class="qtop">
      <span><span class="ql">Your design</span><b>${TYPES[S.type].label} closet${shape}</b></span>
      <span class="qref">${designRef()}<br>${cur.finish.n}</span>
    </div>
    ${/* The same card, with the money taken out of it. It was a quote; it is
          a specification now, which is the thing a customer should be
          checking anyway: that what is drawn is what they asked for. */''}
    <div class="qsec">
      <span class="ql">The carcass</span>
      <div class="qrow"><i>${q.baseLabel}<small>${q.baseNote}</small></i><b>&nbsp;</b></div>
    </div>
    <div class="qsec">
      <span class="ql">What is in it</span>
      ${q.options.length
        ? q.options.map(o=>`<div class="qrow"><i>${o.label}${o.note?`<small>${o.note}</small>`:''}</i><b>&nbsp;</b></div>`).join('')
        : `<p class="qnone">Nothing added yet. Shelves, drawers, baskets and doors list here as you put them in.</p>`}
    </div>
    <div class="qtot">
      <span><span class="ql">Your price</span><em>Joseph prices this design himself and comes back inside 24 hours</em></span>
      <b>24 hrs</b>
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
  $('#order').innerHTML=`<table><thead><tr><th>Item</th><th>Qty</th><th>Sq ft</th><th>Color</th></tr></thead><tbody>`+
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
  if(k === 'h') S.cabTop = clampCabTop(S.cabTop, S.room.h);
  if(k === 'w') fitWall('back');
  if(k === 'd'){ fitWall('left'); fitWall('right'); }
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
  S.door = b.dataset.door;
  S.doorW = defaultDoorW(S.door, S.doorW);
  rebuild(); };

/* HOW WIDE THE OPENING IS, WHEN NOBODY HAS SAID.

   Picking a door and then seeing no door is the obvious failure here,
   and that is exactly what happened: the drawing needs an opening width
   and the field starts at nought, so every door anybody chose was drawn
   as nothing at all. A width they never typed is still a guess, so it is
   a guess that is right for the type and that they can change: a bypass,
   a bi-fold or a pair spans the closet, because that is the whole point
   of them, and a single leaf is a doorway you walk through. */
function defaultDoorW(id, now){
  if(id === 'none') return 0;
  if(now > 0) return now;                       // they said, so leave it
  const W = S.room?.w || 72;
  const spans = id === 'bypass' || id === 'bifold' || id === 'double';
  return spans ? Math.max(24, Math.min(W - 4, 72))
               : Math.max(24, Math.min(W - 8, 32));
}
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
  if(rm){ const gone = S.fittings[+rm.dataset.fitrm];
    S.fittings.splice(+rm.dataset.fitrm,1); S.pinSel=null;
    if(gone?.wall) clearProps(gone.wall);
    rebuild(); return; }

  /* Picking the wall is what places it. Dragging a pin around a 400px plan to
     say "the outlet is on the back wall" was a puzzle, not a control. */
  const wb=e.target.closest('[data-fwall]');
  if(wb && !wb.disabled){
    const f=S.fittings[+wb.dataset.i], w=wb.dataset.fwall;
    const len = w==='back' ? S.room.w : S.room.d;
    if(!f.placed || f.wall!==w){
      const fw = +(f.w ?? FIT_SPEC[f.k]?.w ?? 4);
      /* A machine dropped in the middle of a wall that already has one
         lands on top of it. Put it in the first stretch of that wall with
         nothing standing in it, and only fall back to the centre when
         there is no such stretch. */
      f.wall = w; f.placed = true;
      const spot = freeSpans(w).find(([a, b]) => b - a >= fw - 0.01);
      f.at = spot ? Math.round(spot[0])
                  : Math.round(Math.max(0, Math.min(len - fw, len/2 - fw/2)));
    }
    f.wall=w; f.placed=true; S.pinSel=+wb.dataset.i;
    clearProps(w); rebuild(true); return;
  }
  const at=e.target.closest('[data-fat]');
  if(at){
    const f=S.fittings[+at.dataset.i];
    const len = f.wall==='back' ? S.room.w : S.room.d;
    f.at = Math.max(0, Math.min(len - (f.w||4), Math.round(f.at + 2*(+at.dataset.fat))));
    if(f.wall) clearProps(f.wall);
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
    if(f.wall) clearProps(f.wall);
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
    /* Lowering the ceiling under the cabinetry would otherwise leave a closet
       standing through it. */
    if(k === 'h') S.cabTop = clampCabTop(S.cabTop, S.room.h);
    /* Shrinking the room cannot leave towers standing outside it. */
    if(k === 'w') fitWall('back');
    if(k === 'd'){ fitWall('left'); fitWall('right'); }
    rebuild(true);
  });
  host.addEventListener('change', e=>{
    const i=e.target.closest('input[data-cabtop]'); if(!i) return;
    S.cabTop = clampCabTop(i.value, S.room.h);
    rebuild(true);
  });
  host.addEventListener('keydown', e=>{
    if(e.key==='Enter' && e.target.matches('input[data-cabtop]')){ e.preventDefault(); e.target.blur(); }
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

  });
})();

$('#walls').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.wallT){ toggleWall(b.dataset.wallT); rebuild(true); return; }
  if(!b.dataset.shape || b.dataset.shape===S.shape) return;
  /* keep the walls already chosen when stepping into Custom */
  applyShape(b.dataset.shape, SHAPES[b.dataset.shape]?.custom); rebuild(true)};
$('#bays').onclick=e=>{
  /* Open a wall by clicking its header. Selecting a tower on it is what
     normally opens it, so this is for looking at a wall you are not editing. */
  /* The walls are a row of chips and exactly one of them is open, so
     pressing one is "work on that wall" rather than "fold this one away".
     There is no folded state left to toggle. */
  const fold=e.target.closest('[data-fold]');
  if(fold){
    const w=fold.dataset.fold;
    if(!S.runs[w]?.on) return;
    /* pressing the wall you are already on is "take me back to it", which
       is the quickest way out of a view that has got away from you */
    if(S.sel?.wall === w){ faceWall(w); return; }
    S.sel = { wall:w, i:0 };
    S.part = null; S.add = null; S.carc = null; S.lib = false; S.grid = false;
    PICK_FOR = w + '|0';
    rebuild(true);
    faceWall(w);
    return;
  }
  /* one of the quick depths beside the box */
  const dq = e.target.closest('[data-rundepth-set]');
  if(dq){
    const wall = dq.dataset.rundepthSet, r = S.runs[wall];
    if(r){ r.depth = clampDepth(+dq.dataset.v, wall); rebuild(true); }
    return;
  }
  const bay=e.target.closest('[data-bay]');
  if(bay){
    const wall = bay.dataset.wall, r = S.runs[wall], act = bay.dataset.bay;
    if(act==='nofit') return;
    if(act==='addw' || act==='addfill' || act==='addgap'){
      /* "addgap" is the empty stretch of wall drawn beside the towers that
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
         the corner: equal towers, equal air between them. */
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
      /* push every tower back into the corner, shoulder to shoulder */
      let run = 0;
      for(const b of layout(wall).map(s=>s.bay)){ b.at = run; run += b.w; }
      sortRun(wall);
    }
    rebuild(true); return; }
  const b=e.target.closest('.bay');
  if(b){ S.sel={wall:b.dataset.wall,i:+b.dataset.i}; S.pick=null; rebuild(false); }
};
/* ---- reorder towers along the wall -------------------------------------
   A run is an ordered list, so moving a tower is a splice. Dropping onto a
   bay puts the dragged one in front of it; dropping past the end appends. */
let DRAG = null;
/* ---- dragging a tower along the wall, on the strip --------------------
   Pointer events rather than HTML5 drag and drop: HTML5 drag can only tell
   you what you dropped ON, which is enough to swap two things over and no
   use at all for saying "put it 37 inches from the corner". This reads the
   pointer against the track, which is drawn to scale, so the strip and the
   wall are the same measurement. */
let TDRAG = null;

/* the depth box sits inside each wall's block, so it listens on #bays */
$('#bays').addEventListener('change', e => {
  const i = e.target.closest('input[data-rundepth]'); if(!i) return;
  const wall = i.dataset.rundepth, r = S.runs[wall];
  if(r){
    r.depth = clampDepth(i.value, wall);
    /* The back run getting deeper pushes both side runs further down the
       room, so they have to be brought back inside it before anything is
       drawn or priced. */
    if(wall === 'back'){ fitWall('left'); fitWall('right'); }
    rebuild(true);
  }
});
$('#bays').addEventListener('keydown', e => {
  if(e.key === 'Enter' && e.target.matches('input[data-rundepth]')){ e.preventDefault(); e.target.blur(); }
});

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

/* The drawer size pickers are <select>s and the worktop is a checkbox, so
   they report through change, not click. */
/* The piece the panel is currently open on. Everything inside the part
   panel edits this one and nothing else, which is the whole difference
   between this panel and the two halves it replaced. */
function openPart(bay){
  return (S.part != null) ? bay.stack[S.part] : null;
}

/* A brand new piece of the right shape: a drawer bank arrives with four
   boxes, anything with a count arrives with its default, and everything
   else fills whatever the tower has left. */
/* WHERE A NEW ATTACHMENT LANDS.

   In the middle of the tallest clear run of air it can find, because
   that is where a person would have put it, and never on top of
   something already placed there. Drag it afterwards and the inches
   count while you drag. */
function addSpot(bay, id){
  const b = cur?.bays?.find(x => x.wall === S.sel?.wall && x.bay === S.sel?.i);
  const floorY = b?.floorY ?? baseHeight(S.mounting, placedFittings());
  const top = floorY + (b?.h ?? 80);
  const taken = (b?.adds || []).map(a => a.y).sort((m, n) => m - n);
  let bestAt = floorY + (top - floorY) * 0.55, bestGap = -1, from = floorY + 6;
  for(const t of [...taken, top - 6]){
    if(t - from > bestGap){ bestGap = t - from; bestAt = (t + from) / 2; }
    from = t + 8;
  }
  return Math.round(bestAt * 4) / 4;
}

function freshPart(id){
  const d = MODULES[id];
  const made = { m:id, h:null, o:{} };
  if(d.sizes)    made.o = { sizes: defaultDrawerSizes(4) };
  else if(d.opt) made.o = { [d.opt.key]: d.opt.def };
  if(d.fixed || d.sizes) made.h = null;
  return made;
}

/* A FRONT IS THE WHOLE TOWER, NOT A BAND OF IT.
   A door, a glass door and a mirror cover the section from the kick to
   the top shelf. Adding one as another band would draw a door across the
   upper third with the shelves below it still showing, which no shop
   builds. It takes the tower over, and what was in it becomes what is
   behind it. */
const WHOLE_FRONT = new Set(['DOOR','GLASS_DOOR','MIRROR']);

/* Put a piece into a tower.

   If something is already taking up the slack, the newcomer arrives at
   its own natural height and that piece gives up the inches. If nothing
   is, the newcomer takes the slack itself. Fixing every existing height
   AND letting the newcomer fill is how you end up with a 92" stack in an
   80" tower. */
function addPart(bay, id){
  const d = MODULES[id];
  if(id === 'COUNTER'){ setCounter(bay, true); return; }
  /* ══════════════════════════════════════════════════════════════════
     AN ATTACHMENT GOES IN AT A HEIGHT AND CHANGES NOTHING ELSE

     Adding a scarf rack used to insert a slice into the column, so the
     whole tower had to give up three inches to make room for it, and
     because an accessory has no height of its own the solver emptied the
     piece above it out to nothing. You added one small thing and the
     tower fell apart. It does not go in the column at all now: it goes
     in at a height, like a shelf on pins, and nothing else moves. */
  if(isAddon(id)){
    bay.adds = bay.adds || [];
    bay.adds.push({ m:id, y:addSpot(bay, id), o:freshPart(id).o });
    return;
  }
  const made = freshPart(id);

  if(WHOLE_FRONT.has(id)){
    const was = bay.stack.find(st => DOOR_INSIDE.includes(st.m));
    made.h = null;
    made.o = { ...(made.o || {}), inside: was ? was.m : DOOR_INSIDE_DEF };
    bay.stack = [made];
    return;
  }

  const filler = bay.stack.find(st => st.h == null && !MODULES[st.m].sizes);
  if(filler && !d.sizes) made.h = Math.max(d.minH ?? 4, d.defH ?? d.minH ?? 12);
  else made.h = d.sizes ? null : null;

  /* a drawer bank and a hamper only sit on the floor, so they go underneath */
  if(d.sizes || id === 'HAMPER' || id === 'BASKETS') bay.stack.unshift(made);
  else bay.stack.push(made);
}

$('#stack').addEventListener('change', e => {
  const t = e.target.closest('[data-dsize],[data-counter],[data-hfill],[data-rundepth],[data-wanttop]');
  if(!t) return;
  const bay = S.runs[S.sel?.wall]?.bays[S.sel?.i]; if(!bay) return;
  if(t.dataset.rundepth !== undefined){
    const wall = t.dataset.rundepth, r = S.runs[wall];
    if(r){ r.depth = clampDepth(t.value, wall);
      if(wall === 'back'){ fitWall('left'); fitWall('right'); }
      rebuild(true); }
    return;
  }
  if(t.dataset.wanttop !== undefined){ bay.top = t.checked; rebuild(true); paintStack(); return; }
  if(t.dataset.counter !== undefined){ setCounter(bay, t.checked); rebuild(false); return; }
  if(t.dataset.hfill !== undefined){
    const si = +t.dataset.hfill, st = bay.stack[si]; if(!st) return;
    if(t.checked) st.h = null;
    else {
      const b = cur?.bays?.find(x => x.wall === S.sel.wall && x.bay === S.sel.i)?.bands?.[si];
      const d = MODULES[st.m];
      setBandH(st, Math.max(d.minH ?? 6, b ? b.y1 - b.y0 : (d.defH ?? 24)));
    }
    rebuild(false); paintStack(); return;
  }
  const st = openPart(bay);
  if(!st || !MODULES[st.m].sizes) return;
  const sz = (st.o?.sizes?.length ? [...st.o.sizes] : defaultDrawerSizes(st.o?.n));
  sz[+t.dataset.dsize] = +t.value;
  st.o = { ...st.o, sizes: sz };
  rebuild(false);
});

/* THE HEIGHT SLIDER REDRAWS WHILE IT MOVES.
   A slider you have to let go of before anything happens is a form field.
   This one writes the height on every move, so the shelf in the 3D view
   and in the elevation travels with your thumb and the number beside it
   counts. The panel itself is not repainted, or the slider would lose
   the pointer halfway through the drag. */
$('#stack').addEventListener('input', e => {
  const cs = e.target.closest('[data-carcset]');
  if(cs){
    const bay = S.runs[S.sel?.wall]?.bays[S.sel?.i]; if(!bay) return;
    const v = Math.round(+cs.value * 4) / 4;
    if(cs.dataset.carcset === 'kick') bay.kick = v; else bay.cabTop = v;
    const out = $(`[data-carcval="${cs.dataset.carcset}"]`);
    if(out) out.textContent = (+v.toFixed(2)).toString() + '"';
    DRAGGING = true; rebuild(false);
    return;
  }
  const as = e.target.closest('[data-addset]');
  if(as){
    const bay = S.runs[S.sel?.wall]?.bays[S.sel?.i]; if(!bay) return;
    const ai = +as.dataset.addset, a = bay.adds?.[ai]; if(!a) return;
    a.y = Math.round(+as.value * 4) / 4;
    const out = $(`[data-addval="${ai}"]`);
    if(out) out.textContent = (+a.y.toFixed(2)).toString() + '"';
    DRAGGING = true; rebuild(false);
    return;
  }
  const fw = e.target.closest('[data-fillw]');
  if(fw){
    const bay = S.runs[S.sel?.wall]?.bays[S.sel?.i]; if(!bay) return;
    const was = bay.w;
    bay.w = clampBay(+fw.value, true);
    /* it grows into the bare wall beside it, never through a neighbour */
    const free = freeSpace(S.sel.wall) + was;
    if(bay.w > free) bay.w = clampBay(free, true);
    const out = fw.parentElement?.querySelector('.hval');
    if(out) out.textContent = bay.w.toFixed(1) + '"';
    DRAGGING = true; rebuild(false);
    return;
  }
  const i = e.target.closest('[data-hset]'); if(!i) return;
  const bay = S.runs[S.sel?.wall]?.bays[S.sel?.i]; if(!bay) return;
  const si = +i.dataset.hset, st = bay.stack[si]; if(!st) return;
  setBandH(st, +i.value);
  squeeze(bay.stack, si, bayUsable());
  const out = $(`[data-hval="${si}"]`);
  if(out) out.textContent = (+st.h.toFixed(2)).toString() + '"';
  DRAGGING = true;                 // keeps paintAll off the panel mid-drag
  rebuild(false);
});
$('#stack').addEventListener('change', e => {
  if(!e.target.closest('[data-hset],[data-fillw],[data-addset],[data-carcset]')) return;
  DRAGGING = false; rebuild(true); paintStack();
});

paintMix();
$('#mix')?.addEventListener('change', e => {
  if(e.target.id === 'mixdepth'){
    const v = +e.target.value;
    /* one run of cabinetry is one depth, and this is the whole closet */
    for(const w of Object.keys(S.runs)) if(S.runs[w]?.on) S.runs[w].depth = clampDepth(v, w);
    rebuild(true); paintMix(); return;
  }
  if(e.target.id === 'mixprops'){
    S.styled = e.target.checked;
    /* the same switch as the Empty button over the drawing, so the two
       can never say different things about the same room */
    const sb = document.querySelector('#scene [data-a="styled"]');
    if(sb) sb.setAttribute('aria-pressed', String(!S.styled));
    rebuild(true);
  }
});
$('#mixgo')?.addEventListener('click', buildForMe);
$('#mixclear')?.addEventListener('click', () => {
  for(const w of Object.keys(S.runs)) if(S.runs[w]) S.runs[w].bays = [];
  S.sel = null; S.pick = null; rebuild(true);
});

$('#stack').onclick=e=>{
  const t0=e.target.closest('button');
  /* ── the whole-closet options at the foot of the panel ──────────────
     They are not about the tower you have open, so they are answered
     before the tower is looked up: changing the wall colour with nothing
     selected used to fall at the first line and do nothing at all. */
  if(t0){
    if(t0.dataset.tone){
      const k = t0.dataset.tone;
      if(k === 'wall')  S.wallTone  = t0.dataset.v;
      if(k === 'floor') S.floorTone = t0.dataset.v;
      if(k === 'trim')  S.trimTone  = t0.dataset.v;
      rebuild(false); paintStack(); return;
    }
    if(t0.dataset.pullset){ S.pull = t0.dataset.pullset; paintPulls(); rebuild(false); paintStack(); return; }
    if(t0.dataset.pfset){
      S.pullFinish = t0.dataset.pfset;
      const f = PULL_FINISHES.find(x => x.id === S.pullFinish);
      if(f){ PULLMAT = hardwareMaterial(); PULLMAT.color.setHex(f.hex); PULLMAT.roughness = f.rough; }
      paintPulls(); rebuild(false); paintStack(); return;
    }
    if(t0.dataset.door){
      S.door = t0.dataset.door; S.doorW = defaultDoorW(S.door, S.doorW);
      paintDoors(); rebuild(true); return;
    }
    if(t0.dataset.dw){
      const W = S.room.w;
      S.doorW = Math.max(12, Math.min(W - 2, (+S.doorW || 0) + (+t0.dataset.dw)));
      rebuild(false); paintStack(); return;
    }
    if(t0.dataset.goto){ window.gotoStep?.(t0.dataset.goto); return; }
  }
  const bay=S.runs[S.sel?.wall]?.bays[S.sel?.i]; if(!bay) return;
  const t=t0; if(!t) return;
  /* the quick depths, which moved here with the depth control */
  if(t.dataset.rundepthSet){
    const wall = t.dataset.rundepthSet, r = S.runs[wall];
    if(r){ r.depth = clampDepth(+t.dataset.v, wall);
      if(wall === 'back'){ fitWall('left'); fitWall('right'); }
      rebuild(true); }
    return;
  }
  /* a ready-made tower replaces the whole stack in one press */
  if(t.dataset.tower){
    const p = TOWER_PRESETS.find(x => x.id === t.dataset.tower);
    if(p){ bay.stack = structuredClone(p.stack); S.pick = null; S.grid = false; rebuild(true); }
    return;
  }
  /* "Remove last" was the only way to delete a tower, so getting rid of the
     second of four meant deleting three. This removes the selected one. */
  if(t.dataset.rmsec){
    const bays = S.runs[S.sel.wall].bays;
    bays.splice(S.sel.i, 1);
    S.sel = bays.length ? { wall:S.sel.wall, i:Math.min(S.sel.i, bays.length-1) } : null;
    rebuild(true); return;
  }
  if(t.dataset.preset){
    const pre = PRESETS.find(p=>p.id===t.dataset.preset);
    if(pre){ bay.stack = structuredClone(pre.stack); rebuild(true); }   // their top-shelf choice stands
    return;
  }
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
    /* the ±6" slack let a tower be pushed to 18" or 42" — neither of which
       he can build. 18" is under the narrowest drawer box he stocks, and a
       3/4" shelf bows past 36". Clamp to what the shop can actually cut. */
    const next = clampBay(bay.w + (isFiller(bay) ? d / 2 : d), isFiller(bay));
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
        } else {
          /* THE WALL IS FULL, SO TAKE IT OFF A NEIGHBOUR.
             Pressing + on a wall with no bare wall left did nothing at all,
             silently, which reads as a broken button. On a full wall the
             inches have to come from somewhere, so they come from the tower
             next door, the right one first and then the left, and only as
             far as each can give without going under the narrowest tower he
             builds. Everything after it slides along to close the gap. */
          const bays = r.bays;
          let need = delta - rightRoom - leftRoom;
          const give = j => {
            if(need <= 0.01 || !bays[j]) return;
            const can = Math.min(need, bays[j].w - SPEC.bayMin);
            if(can <= 0.01) return;
            bays[j].w = +(bays[j].w - can).toFixed(1);
            need = +(need - can).toFixed(2);
          };
          give(i + 1); give(i - 1);
          for(let k = i + 2; need > 0.01 && k < bays.length; k++) give(k);
          for(let k = i - 2; need > 0.01 && k >= 0; k--) give(k);
          if(need <= 0.01){
            bay.at = +Math.max(lo, at - Math.max(0, delta - rightRoom)).toFixed(1);
            bay.w = next;
            /* re-lay the run from the start so no tower overlaps another */
            let run = 0;
            for(const bb of [...bays].sort((x, y) => (x.at ?? 0) - (y.at ?? 0))){
              bb.at = +run.toFixed(1); run += bb.w;
            }
          }
        }
      }
    }
    sortRun(wall); S.sel.i = S.runs[wall].bays.findIndex(b => b === bay);
  }
  /* ── one component, opened ───────────────────────────────────────────
     Press a row in the list, or a shelf in the drawing, and the whole
     panel becomes that component. */
  else if(t.dataset.part !== undefined){
    S.part = +t.dataset.part; S.add = null; S.lib = false;
    paintStack(); return;
  }
  /* ── one PLACED thing, opened ─────────────────────────────────────── */
  else if(t.dataset.add !== undefined){
    S.add = +t.dataset.add; S.part = null; S.lib = false;
    paintStack(); return;
  }
  else if(t.dataset.addmove !== undefined){
    const ai = +t.dataset.ai, a = bay.adds?.[ai]; if(!a) return;
    a.y = Math.round((a.y + (+t.dataset.addmove) * 2) * 4) / 4;
    rebuild(false); paintStack(); return;
  }
  else if(t.dataset.rmadd !== undefined){
    const ai = +t.dataset.rmadd;
    if(bay.adds?.[ai]) bay.adds.splice(ai, 1);
    S.add = null; rebuild(false); paintStack(); return;
  }
  else if(t.dataset.carcreset !== undefined){
    if(t.dataset.carcreset === 'kick') delete bay.kick; else delete bay.cabTop;
    rebuild(true); paintStack(); return;
  }
  else if(t.dataset.addchoice !== undefined){
    const ai = +t.dataset.ai, a = bay.adds?.[ai]; if(!a) return;
    a.o = { ...(a.o || {}), [t.dataset.addchoice]: +t.dataset.v };
    rebuild(false); paintStack(); return;
  }
  else if(t.dataset.partback !== undefined){ S.part = null; S.add = null; S.carc = null; paintStack(); return; }
  else if(t.dataset.lib !== undefined){ S.lib = true; S.grid = false; S.part = null; S.add = null; S.carc = null; paintStack(); return; }
  else if(t.dataset.libclose !== undefined){ S.lib = false; paintStack(); return; }
  else if(t.dataset.grid !== undefined){ S.grid = true; S.lib = false; S.part = null; S.add = null; S.carc = null; paintStack(); return; }
  else if(t.dataset.gridclose !== undefined){ S.grid = false; paintStack(); return; }

  /* swap this component for another one */
  else if(t.dataset.setpart !== undefined){
    const si = +t.dataset.setpart, id = t.dataset.m;
    if(!bay.stack[si] || !MODULES[id]) return;
    bay.stack[si] = freshPart(id);
  }
  /* put a new component into the tower */
  else if(t.dataset.addmod){
    const id = t.dataset.addmod;
    if(!MODULES[id]) return;
    addPart(bay, id);
    S.lib = false;
    /* an attachment is not in the stack, so it is opened by its own index */
    if(isAddon(id)){ S.add = (bay.adds?.length || 1) - 1; S.part = null; }
    else { S.part = bay.stack.findIndex(x => x.m === id); S.add = null; }
  }
  else if(t.dataset.partmove !== undefined){
    const si = +t.dataset.si, to = si + +t.dataset.partmove;
    if(to < 0 || to >= bay.stack.length) return;
    const a = bay.stack[si]; bay.stack[si] = bay.stack[to]; bay.stack[to] = a;
    if(S.part === si) S.part = to; else if(S.part === to) S.part = si;
  }
  else if(t.dataset.rmpart !== undefined){
    const si = +t.dataset.rmpart;
    if(bay.stack[si]) bay.stack.splice(si, 1);
    /* whatever is left has to fill the tower again, or it stands in a void */
    if(bay.stack.length && !bay.stack.some(x => x.h == null && !MODULES[x.m].sizes)){
      const last = bay.stack[bay.stack.length - 1];
      if(!MODULES[last.m].sizes) last.h = null;
    }
    S.part = null; S.add = null; S.carc = null;
  }
  else if(t.dataset.optpart !== undefined){
    const si = +t.dataset.si;
    const st = bay.stack[si]; if(!st) return;
    const d0 = MODULES[st.m];
    const o = d0?.[t.dataset.key || 'opt']; if(!o) return;
    st.o = st.o || {};
    /* COUNT FROM WHAT IS STANDING THERE, NOT FROM WHAT WAS ASKED FOR.
       A tower that could only carry two of the four shelves stored on it
       showed two and then stepped down to three, so the first press of
       the minus button did nothing you could see. It steps from the
       number on the button, and it cannot step past what fits. */
    const band = cur?.bays?.find(x => x.wall === S.sel.wall && x.bay === S.sel.i)?.bands?.[si];
    const per = (t.dataset.key || 'opt') === 'opt' ? d0.minPer : 0;
    const have = band ? (band.y1 - band.y0) : null;
    const now = per && have != null
      ? (band.nFit ?? unitsThatFit(st.m, st.o, have) ?? (st.o[o.key] ?? o.def))
      : (st.o[o.key] ?? o.def);
    const canBe = (d0.fill && st.h == null) ? have
                : headroom(bay.stack, si, bayUsable());
    const cap = (per && canBe != null)
      ? Math.min(o.max, Math.max(o.min, Math.floor(canBe / per)))
      : o.max;
    st.o[o.key] = Math.max(o.min, Math.min(cap, now + +t.dataset.optpart));
  }
  else if(t.dataset.choice){
    const st = bay.stack[+t.dataset.si]; if(!st) return;
    st.o = { ...(st.o || {}), [t.dataset.choice]: +t.dataset.v };
  }
  else if(t.dataset.counter !== undefined){
    setCounter(bay, t.checked);
  }
  /* ── the drawer bank, box by box ─────────────────────────────────────
     A bank is the boxes it is made of, so adding one makes the tower
     taller rather than squeezing the fronts down to a size nothing fits. */
  else if(t.dataset.dadd !== undefined || t.dataset.drm !== undefined){
    const st = openPart(bay);
    if(!st || !MODULES[st.m].sizes) return;
    const sz = (st.o.sizes?.length ? [...st.o.sizes] : defaultDrawerSizes(st.o.n));
    if(t.dataset.dadd !== undefined){ if(sz.length < 8) sz.push(sz[sz.length-1] ?? 7.5); }
    else if(sz.length > 1) sz.pop();
    st.o = { ...st.o, sizes: sz };
  }
  else if(t.dataset.inside){
    const st = openPart(bay);
    if(!st || !MODULES[st.m].inside) return;
    st.o = { ...st.o, inside: t.dataset.inside };
  }
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
/* The toolbar beside the drawing. Each button opens the right-hand panel
   on itself, so pressing "Components" here and pressing "Edit components"
   in the panel are the same act. */
$('#ltools')?.addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  const a = b.dataset.l;
  if(a === 'auto'){ window.gotoStep?.('1'); return; }
  const wall = (S.sel?.wall && S.runs[S.sel.wall]?.on) ? S.sel.wall
             : Object.keys(S.runs).find(w => S.runs[w]?.on);
  if(!wall) return;
  if(a === 'add' || a === 'filler'){
    /* the widest tower the bare wall on this run will take */
    const len = wallLength(wall), r = S.runs[wall];
    const free = len - r.bays.reduce((x, y) => x + y.w, 0);
    const fill = a === 'filler';
    if(free < (fill ? FILLER_MIN : SPEC.bayMin)) return;
    const w = clampBay(Math.min(free, fill ? FILLER_MAX : SPEC.bayMax), fill);
    const at = firstFit(wall, w);
    if(at == null) return;
    const b2 = makeBay(w, fill ? [{ m:'FILLER', h:null, o:{} }] : [], true); b2.at = at;
    r.bays.push(b2); sortRun(wall);
    S.sel = { wall, i:r.bays.findIndex(x => x === b2) };
    S.part = null; S.add = null; S.carc = null; S.lib = !fill; S.grid = false;
    PICK_FOR = wall + '|' + S.sel.i;
    rebuild(true);
    if(typeof window.gotoStep === 'function') window.gotoStep('2');
    return;
  }
  /* Towers is the one tool that works on an EMPTY wall, because an empty
     wall is exactly when you want it. It faces the wall and opens the
     choice beside it; it does not need anything selected first. */
  if(a === 'grid'){
    S.grid = !S.grid;
    if(S.grid){
      setView('wall');
      /* On a wall with no gap left a card changes the tower that is
         open, so opening the palette with nothing open would show
         twenty-two cards that cannot be pressed. It opens on the first
         tower, which is also the one the drawing then highlights. */
      const r0 = S.runs[wall];
      if(r0?.bays.length && !(S.sel?.wall === wall && r0.bays[S.sel.i])){
        S.sel = { wall, i:0 };
        S.part = null; S.add = null; S.carc = null; S.lib = false;
        PICK_FOR = wall + '|0';
        paintBays(); paintStack(); paintFlat();
      }
    }
    paintLPal(); paintLTools();
    if(typeof window.gotoStep === 'function') window.gotoStep('2');
    return;
  }
  if(!S.runs[wall].bays.length) return;
  if(S.sel?.i == null || !S.runs[wall].bays[S.sel.i]) S.sel = { wall, i:0 };
  S.part = null; S.add = null; S.carc = null;
  S.lib  = a === 'lib';
  PICK_FOR = S.sel.wall + '|' + S.sel.i;
  paintBays(); paintStack();
  if(typeof window.gotoStep === 'function') window.gotoStep('2');
  /* the door lives at the foot of the panel with the other things that
     are true of the whole room, so the button takes you to it */
  if(a === 'door') requestAnimationFrame(() =>
    document.querySelector('#stack .dgrid')?.scrollIntoView({ block:'center', behavior:'smooth' }));
});

/* nothing to put components into until there is a tower */
function paintDims(){
  /* ══════════════════════════════════════════════════════════════════
     A DIMENSION STRING, NOT A ROW OF FLOATING NUMBERS

     Four figures parked on one screen line above the closet told you
     four towers were 27" and nothing about which was which. A figure
     that is not attached to the thing it measures is decoration.

     So it is drawn the way it is drawn on paper: witness lines coming
     up off the real corners of the real towers, a dimension line
     across, a tick at every boundary, and the figure sitting in the
     middle of the segment it belongs to. The corners are projected
     through the same camera, so the string leans and stretches with the
     wall and every figure stays over its own tower.

     Four gates before any of it: the run has to be drawn, the camera
     outside it rather than against a panel, the whole wall inside the
     frame, and the boundaries still in order left to right (they are
     not, once the camera swings behind the wall). Looked up fresh each
     call because this runs from the render loop, which starts its first
     frame before the bottom of this file has evaluated. */
  const DIMLAY = document.getElementById('dimlay');
  if(!DIMLAY) return;
  const off = () => { if(DIMLAY.firstChild) DIMLAY.textContent = ''; };
  const flat = document.getElementById('v2d');
  /* IT USED TO NEED A TOWER SELECTED. The room opens with nothing open
     in it, which is the one moment somebody most wants to see how wide
     the wall is, and that was the one moment the figures were missing.
     With nothing selected it measures the first wall being built on. */
  if((flat && !flat.hidden) || !cur) return off();
  const wall = (S.sel?.wall && S.runs[S.sel.wall]?.on) ? S.sel.wall
             : Object.keys(S.runs).find(w => S.runs[w]?.on && S.runs[w].bays.length);
  if(!wall) return off();
  const run = RUNMESH[wall];
  if(!run || !run.length || !run[0].visible) return off();
  const list = (cur.bays || []).filter(b => b.wall === wall);
  if(!list.length) return off();
  const box = RUNBOX[wall];
  if(box){
    box.clampPoint(cam.position, _near);
    if(cam.position.distanceTo(_near) < 14) return off();
  }
  const cv = renderer.domElement.getBoundingClientRect();
  const W = cv.width, H = cv.height;
  if(!W || !H) return;
  const RW = S.room.w;
  const _pv = new THREE.Vector3();
  const dep  = (list[0].depth || 24) / 2;
  let top = 0; for(const b of list) top = Math.max(top, b.top);
  const at = along => wall === 'back'  ? [along, top, dep]
                    : wall === 'left'  ? [dep, top, along]
                    :                    [RW - dep, top, along];
  const screen = along => {
    const w3 = at(along);
    _pv.set(w3[0], w3[1], w3[2]).project(cam);
    if(_pv.z > 1) return null;
    return { x:(_pv.x * 0.5 + 0.5) * W, y:(-_pv.y * 0.5 + 0.5) * H };
  };
  const pos = b => wall === 'back' ? b.x : (b.alongRoom != null ? b.alongRoom : (b.start || 0) + b.x);
  const towers = list.map(b => ({ a:pos(b) - b.w / 2, z:pos(b) + b.w / 2, w:b.w, i:b.bay }))
                     .sort((m, n) => m.a - n.a);
  const span = wall === 'back' ? S.room.w : S.room.d;

  /* every point the string needs, projected once */
  const marks = [0, ...towers.flatMap(t => [t.a, t.z]), span]
    .filter((v, i, arr) => i === 0 || Math.abs(v - arr[i - 1]) > 0.05)
    .map(v => ({ v, p:screen(v) }));
  if(marks.some(m => !m.p)) return off();
  const xs = marks.map(m => m.p.x);
  /* gate: still reading left to right, and the wall fits the frame */
  const asc = xs.every((x, i) => i === 0 || x > xs[i - 1]);
  const dsc = xs.every((x, i) => i === 0 || x < xs[i - 1]);
  if(!asc && !dsc) return off();
  const runPx = Math.abs(xs[xs.length - 1] - xs[0]);
  if(runPx > W * 1.5 || runPx < 60) return off();
  if(Math.min(...xs) < -40 || Math.max(...xs) > W + 40) return off();

  const topY = Math.min(...marks.map(m => m.p.y));
  const line = Math.max(118, topY - 30);           // clear of the page title
  const over = line - 20;                          // the overall figure above it
  const X = v => (marks.find(m => Math.abs(m.v - v) < 0.06) || { p:{ x:0 } }).p.x;
  const Yc = v => (marks.find(m => Math.abs(m.v - v) < 0.06) || { p:{ y:0 } }).p.y;

  const tick = x => `<path d="M${(x - 4).toFixed(1)} ${(line + 4).toFixed(1)}l8 -8"/>`;
  const wit  = (x, y) => `<path class="wit" d="M${x.toFixed(1)} ${(y - 3).toFixed(1)}V${(line - 2).toFixed(1)}"/>`;

  let g = '', labels = '';
  /* the witness lines, off the real top corners */
  for(const m of marks) g += wit(m.p.x, m.p.y);
  /* the dimension line and a tick at every boundary */
  g += `<path d="M${X(0).toFixed(1)} ${line.toFixed(1)}H${X(span).toFixed(1)}"/>`;
  for(const m of marks) g += tick(m.p.x);
  /* a figure per tower, and per gap wide enough to bother with */
  const segs = [];
  let cursor = 0;
  for(const t of towers){
    if(t.a - cursor > 0.6) segs.push({ a:cursor, z:t.a, n:t.a - cursor, gap:true });
    segs.push({ a:t.a, z:t.z, n:t.w, i:t.i });
    cursor = t.z;
  }
  if(span - cursor > 0.6) segs.push({ a:cursor, z:span, n:span - cursor, gap:true });
  for(const sg of segs){
    const x1 = X(sg.a), x2 = X(sg.z);
    if(Math.abs(x2 - x1) < 26) continue;           // no room for the figure
    labels += `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${(line - 5).toFixed(1)}"
      class="${sg.gap ? 'gap' : (S.sel && sg.i === S.sel.i ? 'on' : '')}">${(+sg.n.toFixed(1))}"</text>`;
  }
  /* the whole wall, on its own line above */
  g += `<path d="M${X(0).toFixed(1)} ${over.toFixed(1)}H${X(span).toFixed(1)}"/>
        <path d="M${X(0).toFixed(1)} ${(over - 4).toFixed(1)}v8M${X(span).toFixed(1)} ${(over - 4).toFixed(1)}v8"/>`;
  labels += `<text x="${((X(0) + X(span)) / 2).toFixed(1)}" y="${(over - 5).toFixed(1)}"
    class="all">${(+span.toFixed(1))}"</text>`;

  DIMLAY.innerHTML = `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}"
    height="${H.toFixed(0)}" aria-hidden="true"><g class="dim">${g}</g>${labels}</svg>`;
}

/* ══════════════════════════════════════════════════════════════════════
   THE TOWERS OPEN ON THE LEFT

   Two different questions were sharing one panel. "Which tower do I put
   up next" is a thing you ask with nothing selected and an empty stretch
   of wall in front of you; "what should THIS tower be instead" is a thing
   you ask with a tower open. They are not the same question and they do
   not belong in the same column.

   So the rail's Towers button turns the wall to face you and opens the
   choice right there beside it, filler on the end, and every card stands
   a NEW tower up on the wall. Pressing a tower that is already there
   still opens the swap cards on the right, where that tower lives.
   ══════════════════════════════════════════════════════════════════════ */
function lpalWall(){
  return (S.sel?.wall && S.runs[S.sel.wall]?.on) ? S.sel.wall
       : Object.keys(S.runs).find(w => S.runs[w]?.on);
}

/* Put the panel back to nothing open: the closet and the room, drawn
   from in front, with the wall measured. */
function clearSel(){
  S.sel = null; S.part = null; S.add = null; S.carc = null; S.lib = false; S.pick = null;
  PICK_FOR = null;
  rebuild(true);
  /* rebuild leaves the camera where the last selection put it, which on
     the way in from the gate is nose up against tower one. The room gets
     the room shot. */
  frame(); dimDirty = true; needsFrame = true;
}

function paintLPal(){
  const host = $('#lpal'); if(!host) return;
  const wall = lpalWall();
  if(!S.grid || !wall){
    host.hidden = true; host.innerHTML = '';
    document.querySelector('.bstage')?.classList.remove('palopen');
    return;
  }
  const r = S.runs[wall];
  const free = freeOn(wall);
  const roomFor = canMakeRoom(wall, SPEC.bayMin), roomFill = canMakeRoom(wall, FILLER_MIN);
  const tight = roomFor && free < SPEC.bayMin;
  /* WITH NO ROOM LEFT, A CARD CHANGES A TOWER INSTEAD OF ADDING ONE.
     A 108" wall holds four towers and he does not build one under 24",
     so on the room as it opens there is no gap to put a fifth in and
     every card in here was dead. A palette that cannot be pressed
     should not open. When the wall is full the card is applied to the
     tower that is open, which is the other thing somebody reaching for
     this list wants, and the line at the top says which one. */
  const selHere = S.sel?.wall === wall && r.bays[S.sel.i] && !isFiller(r.bays[S.sel.i])
                ? S.sel.i : null;
  const mode = roomFor ? 'add' : 'swap';
  const floorY = baseHeight(S.mounting, placedFittings());
  const usable = Math.max(SPEC.panel * 2 + 12, Math.min(S.cabTop, S.room.h - 2)) - floorY;

  const groups = TOWER_GROUPS.map(g => {
    const items = TOWER_PRESETS.filter(p => p.group === g);
    if(!items.length) return '';
    return `<div class="twgrp"><h6>${g}</h6><div class="twrow">${items.map(p => `
      <button type="button" class="twcard" data-ltower="${p.id}"
        ${mode === 'swap' && selHere == null ? 'disabled' : ''}
        title="${p.label}">${towerThumb(p.stack, usable)}<span>${p.label}</span></button>`).join('')}</div></div>`;
  }).join('');

  /* A FILLER IS NOT A TOWER, so it is not drawn as one. It is a blank
     panel, and its card is a blank panel. */
  const fillerCard = `<div class="twgrp"><h6>Filler</h6><div class="twrow">
    <button type="button" class="twcard" data-lfiller="1" ${roomFill ? '' : 'disabled'}
      title="A blank panel that closes a gap too narrow for a tower">
      <svg class="twthumb" viewBox="0 0 24 32" fill="none" stroke="currentColor"
        stroke-width="1.2" aria-hidden="true"><path d="${MODULES.FILLER.icon}"/></svg>
      <span>Filler</span></button></div></div>`;

  document.querySelector('.bstage')?.classList.add('palopen');
  host.innerHTML = `<div class="lpalhd"><b>Towers</b>
      <button type="button" class="lpalx" data-lpalclose="1" aria-label="Close the towers">&times;</button></div>
    <div class="lpalbody">
      <p class="note">${roomFor
        ? (tight ? 'This wall is full, so standing one up here narrows the widest tower to make the room.'
                 : 'Press one to stand it up on this wall.')
        : (selHere != null
            ? `This wall is full, so a card changes <b>tower ${selHere + 1}</b> into it. Press a different tower on the drawing to change that one instead.`
            : 'This wall is full. Press a tower on the drawing, then press one of these to change it.')}</p>
      ${groups}${fillerCard}
    </div>`;
  host.hidden = false;
}

/* ══════════════════════════════════════════════════════════════════════
   A FULL WALL IS NOT A REASON TO SAY NO

   Every card in this palette was greyed out, because the room opens with
   the walls built corner to corner and there is never a gap to drop a
   tower into. A palette you cannot press is a palette that should not
   open. Pressing a card makes the room for it: the widest tower on the
   wall gives up what is needed, down to the narrowest he builds, and
   everything is pushed back shoulder to shoulder.
   ══════════════════════════════════════════════════════════════════════ */
function freeOn(wall){
  const r = S.runs[wall]; if(!r) return 0;
  return wallLength(wall) - r.bays.reduce((a, b) => a + b.w, 0);
}
function canMakeRoom(wall, want){
  const r = S.runs[wall]; if(!r) return false;
  const slack = r.bays.reduce((a, b) =>
    a + Math.max(0, b.w - (isFiller(b) ? FILLER_MIN : SPEC.bayMin)), 0);
  return freeOn(wall) + slack >= want - 0.01;
}
function makeRoom(wall, want){
  const r = S.runs[wall]; if(!r) return false;
  let free = freeOn(wall);
  for(let guard = 0; guard < 60 && free < want - 0.01; guard++){
    const cands = r.bays.filter(b => b.w - (isFiller(b) ? FILLER_MIN : SPEC.bayMin) > 0.01);
    if(!cands.length) break;
    const big = cands.reduce((a, b) => b.w > a.w ? b : a);
    const floor = isFiller(big) ? FILLER_MIN : SPEC.bayMin;
    const take = Math.min(big.w - floor, want - free);
    big.w = Math.round((big.w - take) * 4) / 4;
    free = freeOn(wall);
  }
  if(free < want - 0.01) return false;
  /* narrowing leaves holes in the middle of the run, so everything goes
     back into the corner shoulder to shoulder and the new one lands on
     the end of it */
  let run = 0;
  for(const b of layout(wall).map(x => x.bay)){ b.at = run; run += b.w; }
  sortRun(wall);
  return true;
}

$('#lpal')?.addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b || b.disabled) return;
  if(b.dataset.lpalclose !== undefined){ S.grid = false; paintLPal(); paintLTools(); return; }
  const wall = lpalWall(); if(!wall) return;
  const r = S.runs[wall];
  const fill = b.dataset.lfiller !== undefined;
  const need = fill ? FILLER_MIN : SPEC.bayMin;
  /* no gap anywhere on this wall: the card changes the open tower */
  if(!fill && !canMakeRoom(wall, need)){
    const i = S.sel?.wall === wall && r.bays[S.sel.i] ? S.sel.i : null;
    const p0 = TOWER_PRESETS.find(x => x.id === b.dataset.ltower);
    if(i == null || !p0) return;
    r.bays[i].stack = structuredClone(p0.stack);
    S.part = null; S.add = null; S.carc = null; S.lib = false;
    rebuild(true);
    return;
  }
  if(!makeRoom(wall, need)) return;
  const free = freeOn(wall);
  const w = clampBay(Math.min(free, fill ? FILLER_MAX : SPEC.bayMax), fill);
  const at = firstFit(wall, w); if(at == null) return;
  const p = fill ? null : TOWER_PRESETS.find(x => x.id === b.dataset.ltower);
  if(!fill && !p) return;
  const b2 = makeBay(w, fill ? [{ m:'FILLER', h:null, o:{} }] : structuredClone(p.stack), true);
  b2.at = at;
  r.bays.push(b2); sortRun(wall);
  S.sel = { wall, i:r.bays.findIndex(x => x === b2) };
  S.part = null; S.add = null; S.carc = null; S.lib = false;
  PICK_FOR = wall + '|' + S.sel.i;
  rebuild(true);
});

function paintLTools(){
  const host = $('#ltools'); if(!host) return;
  const wall = (S.sel?.wall && S.runs[S.sel.wall]?.on) ? S.sel.wall
             : Object.keys(S.runs).find(w => S.runs[w]?.on);
  const r = wall ? S.runs[wall] : null;
  const has = !!r?.bays.length;
  const free = r ? wallLength(wall) - r.bays.reduce((x, y) => x + y.w, 0) : 0;
  host.querySelectorAll('button').forEach(b => {
    b.disabled = b.dataset.l === 'auto'   ? false
               : b.dataset.l === 'add'    ? free < SPEC.bayMin
               : b.dataset.l === 'filler' ? free < FILLER_MIN
               : b.dataset.l === 'door'   ? false
               : !has;
    b.setAttribute('aria-pressed', String(
      (b.dataset.l === 'lib' && !!S.lib) || (b.dataset.l === 'grid' && !!S.grid)));
  });
}

$('#scene').onclick=e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.a;
  if(a==='spin'){S.spin=!S.spin;b.setAttribute('aria-pressed',S.spin)}
  if(a==='reset') frame();
  if(a==='evening'){S.evening=!S.evening;b.setAttribute('aria-pressed',S.evening);
    scene.environmentIntensity=S.evening?.34:1; key.intensity=S.evening?.55:1.25;
    key.color.setHex(S.evening?0xffd9a8:0xfffdfa)}
  /* Clothes, folded stacks and shoes off, so the cabinetry can be read
     and a measurement checked against nothing but panels. */
  if(a==='styled'){S.styled=!S.styled;b.setAttribute('aria-pressed',String(!S.styled));
    rebuild(false);}};
/* the ResizeObserver above covers this now */
/* ══════════════════════════════════════════════════════════════════════
   THE OPENING QUESTION

   There are four numbers and two choices that have to exist before a closet
   can be drawn at all, and until they do, every other control on the page
   is asking about a room nobody has described. So they are asked first, on
   their own, over the stage: how wide the back wall is, how far the room
   goes back, how high the ceiling is, which walls are being built on, and
   how the closet opens.

   It is a gate, not a wizard. Anything typed here can be changed inside,
   "Skip" goes straight in on the defaults, and anybody arriving from a
   layout page on a ?plan= or ?preset= link never sees it, because they have
   already said what they want.
   ══════════════════════════════════════════════════════════════════════ */
function openGate(){
  const gate = $('#gate'), form = $('#gateform');
  if(!gate || !form) return;

  const s1 = $('#gstep1'), s2 = $('#gstep2'), host = $('#gatetypes');
  /* S.type always holds something, because the builder boots with a
     default so it has a room to draw. That is not a choice anybody made,
     so the gate always opens on the question. */
  let picked = null;

  /* ── step one: which closet ───────────────────────────────────────── */
  if(host) host.innerHTML = Object.entries(TYPES).map(([k, t]) => `
    <button type="button" class="gatetype" data-t="${k}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${t.art}"/></svg>
      <b>${t.label}</b>
      <span>${t.note}</span>
      <em>${t.w}" wide \u00b7 ${t.d}" deep</em>
    </button>`).join('')
    /* SOMETHING THAT IS NOT ONE OF THE FIVE.
       A run down a landing, a cupboard under a stair, two walls of a
       box room. It is the same builder, it just does not assume a room
       size or which walls, so step two opens on nothing filled in. */
    + `<button type="button" class="gatetype gatetype-custom" data-t="custom">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12"/><path d="M4 20h16"/><path d="M12 11v5M9.5 13.5h5"/></svg>
      <b>Custom</b>
      <span>Something that is not one of these. Your own walls and your own numbers.</span>
      <em>You set everything</em>
    </button>`;

  const show = n => {
    if(s1) s1.hidden = n !== 1;
    if(s2) s2.hidden = n !== 2;
    gate.scrollTop = 0;
  };

  host?.addEventListener('click', e => {
    const b = e.target.closest('button[data-t]'); if(!b) return;
    picked = b.dataset.t;
    if(picked === 'custom'){
      /* Custom assumes nothing. It keeps whatever is in the boxes as a
         starting point and lets them change every one, including which
         walls, which is the whole reason somebody picks it. */
      S.type = 'walk-in';
      applyShape('custom');
    } else {
      /* The type carries the room it usually comes in and the walls it is
         usually built on, so step two opens already filled in with
         something sensible rather than somebody else's 96 inch box. Same
         call the picker inside the builder makes, so the two cannot
         drift apart. */
      S.shape = TYPES[picked].walls.length > 1 ? 'u' : 'straight';
      applyType(picked);
    }
    S.cabTop = clampCabTop(S.cabTop, S.room.h);
    fill();
    show(2);
    if(!matchMedia('(max-width:700px)').matches) setTimeout(() => form.w.focus(), 60);
  });

  $('#gateback')?.addEventListener('click', () => show(1));

  /* ── step two: the numbers, with the room drawn beside them ───────── */
  /* HOW IT OPENS, AS PICTURES, ON THE FRONT WALL OF THE ROOM.
     A dropdown of eight words asks somebody to imagine eight doors. The
     tiles sit along the bottom of the drawn room, which is where the
     door is, and the plan above them redraws as each one is pressed. */
  const dsel = $('#gatedoor'), dhost = $('#gatedoors');
  if(dhost) dhost.innerHTML = DOORS.map(d =>
    `<button type="button" class="rdoor${d.id === S.door ? ' on' : ''}" data-gd="${d.id}"
       role="radio" aria-checked="${d.id === S.door}" title="${d.note}">
       <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d.art}"/></svg>
       <i>${d.label}</i></button>`).join('');
  if(dsel) dsel.value = S.door || 'none';
  dhost?.addEventListener('click', e => {
    const b = e.target.closest('[data-gd]'); if(!b) return;
    if(dsel) dsel.value = b.dataset.gd;
    dhost.querySelectorAll('.rdoor').forEach(x => {
      const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on);
    });
    /* a door with no width is no door, so picking one proposes a width
       for it the way the builder does when nobody has typed one */
    if(b.dataset.gd !== 'none' && !(+form.door.value > 0))
      form.door.value = defaultDoorW(b.dataset.gd, 0);
    drawGatePlan();
  });

  /* the two side walls are one measurement, so they stay the same number */
  const mirror = (from, to) => { if(form[to]) form[to].value = form[from].value; };
  form.d?.addEventListener('input',  () => mirror('d', 'd2'));
  form.d2?.addEventListener('input', () => mirror('d2', 'd'));

  function fill(){
    form.w.value = S.room.w; form.d.value = S.room.d; form.h.value = S.room.h;
    if(form.d2) form.d2.value = S.room.d;
    const shape = form.querySelector(`input[name="shape"][value="${S.shape}"]`);
    if(shape) shape.checked = true;
    const h2 = $('#gate2h');
    if(h2) h2.textContent = picked && TYPES[picked]
      ? `Your ${TYPES[picked].label.toLowerCase()}, in inches` : 'Your room, in inches';
    /* Custom is the one that gets a fourth choice of walls, because it is
       the only one where "pick them yourself" is the point. */
    const cw = $('#gatecustomwall');
    if(cw) cw.hidden = picked !== 'custom';
    drawGatePlan();
  }

  /* The room as described, from above, redrawn on every keystroke. It is
     not the closet, there is no closet yet: it is the box, the walls being
     built on shaded, the door opening cut out of the front, and the three
     figures so a typo is obvious before anybody presses the button. */
  function drawGatePlan(){
    const fig = $('#gateplan'); if(!fig) return;
    const n = (v, lo, hi, d) => { const x = Math.round(Number(v));
      return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
    const W = n(form.w.value, 36, 288, 96), D = n(form.d.value, 12, 360, 24);
    const H = n(form.h.value, 60, 180, 96);
    const sh = form.querySelector('input[name="shape"]:checked')?.value || 'straight';
    const walls = (SHAPES[sh] || SHAPES.straight).walls;
    const dw = Math.min(W, Math.max(0, n(form.door.value, 0, 240, 0)));

    /* a swing or a french door sweeps a quarter circle into the room, and
       it was being drawn off the bottom of the box. The space under the
       plan is reserved for the widest thing the chosen door does. */
    const dt0 = form.doortype?.value || 'none';
    const sweeps = dt0 === 'swing-l' || dt0 === 'swing-r' || dt0 === 'double';
    const PAD = { l:30, r:32, t:26, b:(sweeps && dw > 0) ? 86 : 44 }, BOX = 420;
    const k = Math.min((BOX - PAD.l - PAD.r) / W, (BOX - PAD.t - PAD.b) / Math.max(D, 1));
    const w = W * k, d = D * k, x0 = PAD.l, y0 = PAD.t;
    const VW = Math.round(w + PAD.l + PAD.r), VH = Math.round(d + PAD.t + PAD.b);
    const run = Math.min(24, Math.max(10, D * 0.28)) * k;   // a run, drawn to depth
    const INK = '#16120D', DIM = '#2E6B83', FILL = '#D9D4CC';

    const band = [];
    if(walls.includes('back'))
      band.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${run}" fill="${FILL}" opacity=".85" stroke="${INK}" stroke-width="1.1"/>`);
    /* the side runs stand clear of the back run, the way he builds them */
    const off = walls.includes('back') ? run + 12 * k : 0;
    if(walls.includes('left'))
      band.push(`<rect x="${x0}" y="${y0 + off}" width="${run}" height="${Math.max(6, d - off)}" fill="${FILL}" opacity=".85" stroke="${INK}" stroke-width="1.1"/>`);
    if(walls.includes('right'))
      band.push(`<rect x="${x0 + w - run}" y="${y0 + off}" width="${run}" height="${Math.max(6, d - off)}" fill="${FILL}" opacity=".85" stroke="${INK}" stroke-width="1.1"/>`);

    /* THE DOOR THEY PICKED, DRAWN THE WAY IT OPENS.
       An opening with a dashed line across it told them nothing about
       whether they had chosen a bi-fold or a barn door, which is the
       thing that decides how much of the front they can actually use.
       Each type is drawn the way it moves, in the room, to scale. */
    const door = (() => {
      const dt = dt0;
      if(!(dw > 0) || dt === 'none') return '';
      const ow = dw * k, ox = x0 + (w - ow) / 2, oy = y0 + d;
      const lab = (DOORS.find(x => x.id === dt) || {}).label || '';
      const leaf = `fill="none" stroke="${DIM}" stroke-width="1.3"`;
      let art = '';
      if(dt === 'swing-r' || dt === 'swing-l'){
        /* one leaf, and the quarter circle it sweeps through */
        const hinge = dt === 'swing-r' ? ox + ow : ox, dir = dt === 'swing-r' ? -1 : 1;
        art = `<path d="M${hinge} ${oy}L${hinge + dir * ow} ${oy}" ${leaf}/>
               <path d="M${hinge + dir * ow} ${oy}A${ow} ${ow} 0 0 ${dir > 0 ? 0 : 1} ${hinge} ${oy + ow}"
                     fill="none" stroke="${DIM}" stroke-width=".9" stroke-dasharray="4 3" opacity=".7"/>`;
      } else if(dt === 'double'){
        const half = ow / 2;
        art = `<path d="M${ox} ${oy}L${ox + half} ${oy}" ${leaf}/>
               <path d="M${ox + ow} ${oy}L${ox + half} ${oy}" ${leaf}/>
               <path d="M${ox + half} ${oy}A${half} ${half} 0 0 1 ${ox} ${oy + half}" fill="none"
                     stroke="${DIM}" stroke-width=".9" stroke-dasharray="4 3" opacity=".7"/>
               <path d="M${ox + half} ${oy}A${half} ${half} 0 0 0 ${ox + ow} ${oy + half}" fill="none"
                     stroke="${DIM}" stroke-width=".9" stroke-dasharray="4 3" opacity=".7"/>`;
      } else if(dt === 'bypass'){
        /* two leaves on two tracks, one passing in front of the other */
        const half = ow / 2;
        art = `<rect x="${ox}" y="${oy - 3}" width="${half}" height="3" fill="${DIM}" opacity=".55"/>
               <rect x="${ox + half}" y="${oy}" width="${half}" height="3" fill="${DIM}" opacity=".85"/>`;
      } else if(dt === 'bifold'){
        /* panels folded back on themselves at each end */
        const p = ow / 4, zig = [0,1,2,3].map(i =>
          `M${ox + i * p} ${oy + (i % 2 ? 0 : 5)}L${ox + (i + 1) * p} ${oy + (i % 2 ? 5 : 0)}`).join('');
        art = `<path d="${zig}" ${leaf}/>`;
      } else if(dt === 'barn'){
        /* rides on a rail outside the opening, so it parks on the wall */
        art = `<path d="M${ox - ow * .1} ${oy + 7}h${ow * 1.2}" stroke="${DIM}" stroke-width="1" opacity=".6"/>
               <rect x="${ox + ow * .5}" y="${oy + 2}" width="${ow}" height="4" fill="${DIM}" opacity=".7"/>`;
      } else {
        art = `<path d="M${ox} ${oy}h${ow}" stroke="${DIM}" stroke-width="1.4" stroke-dasharray="5 3"/>`;
      }
      return `<path d="M${ox} ${oy}h${ow}" stroke="#FFFFFF" stroke-width="3.6"/>${art}
        <text x="${x0 + w / 2}" y="${y0 + d + 40}" fill="${DIM}" font-size="11" text-anchor="middle">${dw}" ${lab.toLowerCase()}</text>`;
    })();

    /* the returns are not asked for, they are what is left of the front
       wall once the opening is taken out of the middle of it */
    const ret = Math.max(0, (W - dw) / 2);
    const rl = document.getElementById('retL'), rr = document.getElementById('retR');
    if(rl) rl.textContent = (+ret.toFixed(1)).toString();
    if(rr) rr.textContent = (+ret.toFixed(1)).toString();

    fig.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}"
      role="img" aria-label="${W} inches wide by ${D} inches deep, ${H} inch ceiling"
      font-family="Archivo, system-ui, sans-serif">
      
      <rect x="${x0}" y="${y0}" width="${w}" height="${d}" fill="#FFFFFF" stroke="${INK}" stroke-width="1.6"/>
      ${band.join('')}
      ${door}
      ${/* THE FIGURES ARE ON THE FIELDS, NOT ON THE PLAN.
             Each measurement now sits against its own wall outside the
             box, so printing it on the drawing as well said the same
             number twice and left the plan looking like a worksheet. The
             dimension lines stay, because they are what tells you which
             wall each field is talking about. */''}
      <path d="M${x0} ${y0 - 14}h${w}M${x0} ${y0 - 19}v10M${x0 + w} ${y0 - 19}v10" stroke="${DIM}" stroke-width="1.1" opacity=".7"/>
      <path d="M${x0 - 14} ${y0}v${d}M${x0 - 19} ${y0}h10M${x0 - 19} ${y0 + d}h10" stroke="${DIM}" stroke-width="1.1" opacity=".7"/>
      <path d="M${x0 + w + 14} ${y0}v${d}M${x0 + w + 9} ${y0}h10M${x0 + w + 9} ${y0 + d}h10" stroke="${DIM}" stroke-width="1.1" opacity=".7"/>
    </svg>`;
  }

  form.addEventListener('input', drawGatePlan);
  form.addEventListener('change', drawGatePlan);

  gate.hidden = false;
  show(1);

  const shut = () => {
    gate.hidden = true;
    /* the tour waits behind the gate: it used to pop over step one and
       talk about five steps nobody could see yet */
    window.dispatchEvent(new Event('js:gate-closed'));
    resize(); frame();
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    const num = (name, lo, hi, fallback) => {
      const v = Math.round(Number(form[name].value));
      return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
    };
    S.room = { w:num('w', 36, 288, S.room.w),
               d:num('d', 12, 360, S.room.d),
               h:num('h', 60, 180, S.room.h) };
    S.cabTop = clampCabTop(S.cabTop, S.room.h);
    const sh = form.querySelector('input[name="shape"]:checked')?.value;
    if(sh && SHAPES[sh]) applyShape(sh);
    const dt = form.doortype?.value;
    if(dt && DOORS.some(d => d.id === dt)) S.door = dt;
    /* chosen in the gate, same rule */
    S.doorW = defaultDoorW(S.door, S.doorW);
    const dw = Math.round(Number(form.door.value));
    /* A door opening only means something when there is a door in it. */
    if(Number.isFinite(dw) && dw > 0 && S.door !== 'none') S.doorW = dw;
    /* THE CLOSET IS ALREADY STANDING THERE. See TYPE_START. */
    shut();
    startingCloset(picked || S.type);
    /* The closet is standing there, and nothing in it is open, so the
       panel opens on the closet and the room rather than on tower one. */
    clearSel(); setView('3d');
    if(typeof window.gotoStep === 'function') window.gotoStep('2');
  });

  $('#gateskip')?.addEventListener('click', () => { shut(); startingCloset(picked || S.type);
    clearSel(); setView('3d'); });
  /* Escape steps back rather than dumping somebody into a builder they
     never chose a closet for. From step one it skips, as it always did.
     On document, not on the gate: stepping back hides the button that had
     focus, focus falls to the body, and a listener on the gate then never
     hears the next key. */
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape' || gate.hidden) return;
    if(s2 && !s2.hidden){ show(1); return; }
    shut(); startingCloset(picked || S.type); clearSel(); setView('3d');
  });
}

/* ══════════════════════════════════════════════════════════════════════
   THE FLAT VIEWS

   Everybody who sells closets online shows the same three: looking down on
   the room, looking straight at a wall, and the 3D. The first two are the
   ones a customer checks a measurement on and the ones a fitter reads, and
   this builder only had the third.

   They are drawn by the same module that draws the PDF, from the same
   geometry the 3D view renders, so there is exactly one description of a
   closet on this site. The drawing is also the control: every tower in it
   carries which wall and which tower it is, so clicking one selects it and
   the panel on the right jumps to it, the same as clicking it in 3D.
   ══════════════════════════════════════════════════════════════════════ */
let VIEW = '3d';          // '3d' | 'wall' | 'plan' | 'tower'
let FLATWALL = null;      // which wall the elevation is showing
let DRAW = null;          // the drawing module, fetched the first time it is wanted

async function flatModule(){
  if(!DRAW) DRAW = await import('./drawing.js?v=a3c1cf93');
  return DRAW;
}

function wallsWithTowers(){
  return ['back','left','right'].filter(w => (cur?.bays || []).some(b => b.wall === w));
}

function paintFlat(){
  const host = $('#v2d');
  if(!host || VIEW === '3d' || !host.isConnected) return;
  const walls = wallsWithTowers();
  if(VIEW === 'wall' && (!FLATWALL || !walls.includes(FLATWALL))) FLATWALL = S.sel?.wall && walls.includes(S.sel.wall) ? S.sel.wall : walls[0];

  /* The row under the switcher: which wall is being shown, and the way in
     and out of a single tower. The tower this opens is whichever one is
     selected, which is the one the panel on the right is already editing,
     so the two never disagree about what you are looking at. */
  const picker = $('#v2dwalls');
  const selOk = S.sel && (cur?.bays || []).some(b => b.wall === S.sel.wall && b.bay === S.sel.i);
  if(picker){
    if(VIEW === 'tower'){
      picker.innerHTML = `<button type="button" data-flatback="1">&larr; The whole wall</button>
        <span class="v2dname">Tower ${selOk ? S.sel.i + 1 : ''}</span>`;
    } else if(VIEW === 'plan'){
      picker.innerHTML = '<span class="v2dname">Looking down on the room</span>'
        + (selOk ? `<button type="button" data-flattower="1">Open tower ${S.sel.i + 1}</button>` : '');
    } else {
      picker.innerHTML = (walls.length > 1
          ? walls.map(w => `<button type="button" data-flatwall="${w}" aria-pressed="${w === FLATWALL}">${WALL_LABEL[w] || w}</button>`).join('')
          : `<span class="v2dname">${WALL_LABEL[FLATWALL] || ''}</span>`)
        + (selOk ? `<button type="button" data-flattower="1">Open tower ${S.sel.i + 1}</button>` : '');
    }
  }

  const box = $('#v2dcanvas');
  if(!box) return;
  if(!walls.length){
    box.innerHTML = `<p class="v2dempty">Nothing is drawn yet. Add a tower and it appears here,
      measured, from above and straight on.</p>`;
    return;
  }
  /* The drawing is built at the size of the space it is going into, so the
     figures stay the same size on screen however big the window is, instead
     of a wide screen printing tiny numbers on a huge drawing.

     Width alone is not enough. A single tower is two feet wide and seven
     feet tall: drawn to the full width of the stage it came out four times
     taller than the stage, and the browser then shrank the whole thing to
     fit, figures and all, which is exactly what building it at display size
     was meant to avoid. So the drawing is fitted to the BOX: built once at
     full width, and if it comes back taller than the space, built again
     narrower until it fits. The padding round a drawing is fixed while its
     body scales, so two passes settle it. */
  /* The drawing is built at the size of the space it is going into, so the
     figures stay the same size on screen however big the window is, instead
     of a wide screen printing tiny numbers on a huge drawing. Both the width
     and the height are handed over: a single tower is two feet wide and
     seven feet tall, so width alone would make it four times taller than
     the stage and the browser would shrink the whole thing, figures and all,
     which is the thing building it at display size was meant to avoid. */
  const boxW = Math.max(320, Math.min(1180, Math.round(box.clientWidth || 900)));
  const boxH = Math.max(260, Math.round(box.clientHeight || 600));
  flatModule().then(({ elevation, plan, tower }) => {
    if(VIEW === '3d') return;
    /* The drawing's own caption is left off here: the switcher and the wall
       buttons above it already say which wall this is, and a second title
       inside the drawing collided with the overall dimension across the top
       of it. On paper and on its own the caption stays. */
    const opt = { width:boxW, height:boxH, pick:true, selected:S.sel, part:S.part, add:S.add, carc:S.carc, title:false };
    let svg;
    if(VIEW === 'tower'){
      if(!selOk){ VIEW = 'wall'; paintFlat(); return; }
      svg = tower(cur, S.sel.wall, S.sel.i, { width:boxW, height:boxH, title:false });
      if(!svg){ VIEW = 'wall'; paintFlat(); return; }
    } else {
      svg = VIEW === 'plan' ? plan(cur, opt) : elevation(cur, FLATWALL, opt);
    }
    box.innerHTML = svg || `<p class="v2dempty">There is nothing on that wall yet.</p>`;
  }).catch(err => {
    console.warn('[flat view]', err);
    box.innerHTML = `<p class="v2dempty">The drawing could not be made. The 3D view still works.</p>`;
  });
}

function setView(v){
  VIEW = v;
  const host = $('#v2d');
  if(host) host.hidden = (v === '3d');
  $('#vswitch')?.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-selected', String(b.dataset.view === v)));
  /* the scene controls belong to the 3D view and mean nothing over a plan */
  const sc = $('#scene'); if(sc) sc.hidden = (v !== '3d');
  /* The hint says what this view lets you do, because none of it is
     discoverable: nothing about a drawing suggests you can pull a shelf. */
  const hint = document.querySelector('.bhint');
  if(hint){
    hint.hidden = false;
    hint.textContent = v === '3d'
      ? 'Drag to orbit · scroll to zoom · press a shelf or a drawer to open it'
      : v === 'wall'
        ? 'Press a tower to open it · press a shelf inside it · drag the line between two parts to move it'
        : 'Press a tower to open it · drag it along its wall';
  }
  if(v === '3d'){ needsFrame = true; } else paintFlat();
}

$('#vswitch')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-view]'); if(!b) return;
  setView(b.dataset.view);
  dimDirty = true; needsFrame = true;
});
$('#v2dwalls')?.addEventListener('click', e => {
  const w = e.target.closest('button[data-flatwall]');
  if(w){ FLATWALL = w.dataset.flatwall; paintFlat(); return; }
  if(e.target.closest('button[data-flattower]')){
    VIEW = 'tower';
    $('#vswitch')?.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected','false'));
    paintFlat(); return;
  }
  if(e.target.closest('button[data-flatback]')){
    VIEW = 'wall';
    if(S.sel?.wall) FLATWALL = S.sel.wall;
    $('#vswitch')?.querySelectorAll('button').forEach(x =>
      x.setAttribute('aria-selected', String(x.dataset.view === 'wall')));
    paintFlat(); return;
  }
});
/* ── CLICKING AND DRAGGING A TOWER IN A FLAT VIEW ────────────────────────

   The same gesture the 3D view and the layout strip already have, on the
   drawing: press a tower and it is selected, drag it and it slides along
   its own wall, stopping where its neighbours are. The pointer is captured
   on the container rather than on the tower, because the drawing is
   redrawn on every frame of the drag and the tower under the finger is a
   different element each time.

   data-k on the drawing says how many SVG units an inch is, and the ratio
   between the drawing's own width and the width it is displayed at turns
   that into screen pixels, so this works at any size. */
let FDRAG = null;

function flatScale(svg){
  if(!svg) return 0;
  const k = +svg.dataset.k || 0;
  const box = svg.getBoundingClientRect();
  const own = +svg.getAttribute('width') || box.width;
  if(!k || !own || !box.width) return 0;
  return k * (box.width / own);              // screen pixels per inch
}

/* ══ DRAGGING A DIVISION IN THE ELEVATION ═══════════════════════════════
   The bar between two components is the one thing in a closet a customer
   points at and says "move that up a bit". Pull it and the piece below
   takes the inches while the piece above gives them up, which is what
   moving a shelf physically is. Both ends stop at the minimum height the
   two pieces are allowed to be, so a drag can never build something he
   does not build.

   Anything above that was filling the space keeps filling it, so the
   tower still adds up to its own height at the end of the drag. */
let HDRAG = null;
/* dragging a thing that is placed at a height rather than stacked */
let ADRAG = null;
/* pulling a tower's own edge in the elevation */
let WDRAG = null;

$('#v2dcanvas')?.addEventListener('pointerdown', e => {
  /* ── press the toe kick or the top of the tower ──────────────────── */
  const cp = e.target.closest('[data-carc]');
  if(cp){
    S.sel = { wall:cp.dataset.wall, i:+cp.dataset.bay };
    S.carc = (S.carc === cp.dataset.carc) ? null : cp.dataset.carc;
    S.part = null; S.add = null; S.lib = false;
    PICK_FOR = cp.dataset.wall + '|' + cp.dataset.bay;
    rebuild(false); paintAll();
    return;
  }
  /* ── pull a tower's own edge to make it wider or narrower ────────── */
  const wg = e.target.closest('[data-wdrag]');
  if(wg){
    const wall = wg.dataset.wall, i = +wg.dataset.bay;
    const bay = S.runs[wall]?.bays?.[i]; if(!bay) return;
    const host = $('#v2dcanvas');
    const pxPerIn = flatScale(host.querySelector('svg'));
    S.sel = { wall, i }; S.part = null; S.add = null; S.carc = null; S.lib = false;
    if(!pxPerIn){ rebuild(false); paintAll(); return; }
    WDRAG = { wall, i, side:wg.dataset.wdrag, pxPerIn, x0:e.clientX, w0:bay.w, at0:bay.at ?? 0 };
    DRAGGING = true;
    host.setPointerCapture?.(e.pointerId);
    host.classList.add('dragging');
    rebuild(false); paintStack();
    return;
  }
  /* ── the X on a placed thing ─────────────────────────────────────── */
  const akill = e.target.closest('[data-rmadd]');
  if(akill){
    const bay = S.runs[akill.dataset.wall]?.bays?.[+akill.dataset.bay]; if(!bay) return;
    bay.adds?.splice(+akill.dataset.rmadd, 1);
    S.add = null; rebuild(true); paintAll();
    return;
  }
  /* ── drag a placed thing up and down ─────────────────────────────── */
  const ag = e.target.closest('[data-add]');
  if(ag){
    const wall = ag.dataset.wall, i = +ag.dataset.bay, ai = +ag.dataset.add;
    const bay = S.runs[wall]?.bays?.[i]; const a = bay?.adds?.[ai]; if(!a) return;
    const host = $('#v2dcanvas');
    const pxPerIn = flatScale(host.querySelector('svg'));
    S.sel = { wall, i }; S.add = ai; S.part = null; S.lib = false;
    if(!pxPerIn){ rebuild(false); paintAll(); return; }
    ADRAG = { wall, i, ai, pxPerIn, y0:e.clientY, at0:a.y, moved:false };
    DRAGGING = true;
    host.setPointerCapture?.(e.pointerId);
    host.classList.add('dragging');
    rebuild(false); paintStack();
    return;
  }
  const g = e.target.closest('[data-hdrag]');
  if(g){
    const wall = g.dataset.wall, i = +g.dataset.bay, n = +g.dataset.hdrag;
    const bay = S.runs[wall]?.bays?.[i]; if(!bay) return;
    const bands = cur?.bays?.find(x => x.wall === wall && x.bay === i)?.bands || [];
    const below = bay.stack[n], above = bay.stack[n + 1];
    if(!below || !above) return;
    if(MODULES[below.m]?.sizes) return;          // a bank is its boxes, not a height
    const host = $('#v2dcanvas');
    const pxPerIn = flatScale(host.querySelector('svg'));
    if(!pxPerIn) return;
    /* fix every height that was floating, so only the two either side of
       this bar move while the bar moves */
    bay.stack.forEach((st, j) => {
      if(st.h == null && !MODULES[st.m].sizes && bands[j])
        setBandH(st, bands[j].y1 - bands[j].y0);
    });
    HDRAG = { wall, i, n, pxPerIn, y0:e.clientY,
              hBelow: below.h, hAbove: above.h,
              minB: MODULES[below.m].minH ?? 4, minA: MODULES[above.m].minH ?? 4 };
    DRAGGING = true;
    host.setPointerCapture?.(e.pointerId);
    host.classList.add('dragging');
    return;
  }
  /* the X on the tower itself */
  const kill = e.target.closest('.towerkill');
  if(kill){
    const wall = kill.dataset.wall, i = +kill.dataset.bay;
    const bays = S.runs[wall]?.bays; if(!bays?.[i]) return;
    bays.splice(i, 1);
    S.sel = bays.length ? { wall, i:Math.min(i, bays.length - 1) } : null;
    S.part = null; S.add = null; S.carc = null; S.lib = false;
    rebuild(true);
    return;
  }
  /* one component inside the open tower */
  const pp = e.target.closest('.pickpart');
  if(pp){
    S.sel = { wall:pp.dataset.wall, i:+pp.dataset.bay };
    const si = +pp.dataset.si;
    S.part = (S.part === si) ? null : si;
    S.lib = false;
    PICK_FOR = pp.dataset.wall + '|' + pp.dataset.bay;
    rebuild(false);
    if(typeof window.gotoStep === 'function') window.gotoStep('2');
    return;
  }
  const r = e.target.closest('.pick'); if(!r) return;
  const wall = r.dataset.wall, i = +r.dataset.bay;
  const run = S.runs[wall]; const bay = run?.bays?.[i];
  if(!bay) return;
  /* selecting is instant; the panel should follow the press, not the release */
  S.sel = { wall, i };
  if(document.body.dataset.step === '1' && typeof window.gotoStep === 'function')
    window.gotoStep('2');
  const host = $('#v2dcanvas');
  const pxPerIn = flatScale(host.querySelector('svg'));
  /* The plan is drawn to one scale in both directions, so only which axis
     counts as "along this wall" changes: across for the back wall, up and
     down for a side wall. The tower itself is held by reference, because
     moving it re-sorts the run and its index changes under us. */
  FDRAG = pxPerIn ? { wall, i, ref:bay, axis:r.dataset.axis || 'x', pxPerIn, delta:0,
                      p0: r.dataset.axis === 'y' ? e.clientY : e.clientX,
                      at0: bay.at ?? 0, moved:false } : null;
  if(FDRAG){
    DRAGGING = true;
    host.setPointerCapture?.(e.pointerId);
    host.classList.add('dragging');
  }
  paintAll();
});

const dragFlat = onFrame(() => {
  if(!FDRAG) return;
  const inches = FDRAG.delta / FDRAG.pxPerIn;
  if(Math.abs(inches) > 0.4) FDRAG.moved = true;
  if(!FDRAG.moved) return;
  moveSection(FDRAG.wall, FDRAG.i, FDRAG.at0 + inches);
  /* moveSection re-sorts the run, so the index this tower had is no longer
     the index it has. The object itself has not changed, so ask the array
     where it put it rather than guessing from its position. */
  const at = S.runs[FDRAG.wall].bays.indexOf(FDRAG.ref);
  FDRAG.i = at < 0 ? 0 : at;
  S.sel = { wall:FDRAG.wall, i:FDRAG.i };
  rebuild(false);
  paintFlat();
});

const dragHeight = onFrame(() => {
  if(!HDRAG) return;
  const bay = S.runs[HDRAG.wall]?.bays?.[HDRAG.i]; if(!bay) return;
  const below = bay.stack[HDRAG.n], above = bay.stack[HDRAG.n + 1];
  if(!below || !above) return;
  /* down the screen is less height below, so the sign flips */
  let d = -HDRAG.dy / HDRAG.pxPerIn;
  const pair = HDRAG.hBelow + HDRAG.hAbove;
  let nb = Math.round((HDRAG.hBelow + d) * 4) / 4;
  nb = Math.max(HDRAG.minB, Math.min(pair - HDRAG.minA, nb));
  below.h = nb;
  above.h = +(pair - nb).toFixed(2);
  rebuild(false);
  paintFlat();
});

/* ══════════════════════════════════════════════════════════════════════
   A TOWER IS MADE WIDER BY PULLING ITS EDGE

   The width was two small buttons at the far end of the panel, which is
   not how anybody thinks about how wide a cupboard is. Pull the edge and
   it grows, in half inches, into the bare wall beside it first and out of
   its neighbour only once the wall is full, which is the same rule the
   buttons always used. Pull the left edge and the tower also slides, so
   the edge you are holding is the one that moves. */
const dragWidth = onFrame(() => {
  if(!WDRAG) return;
  const r = S.runs[WDRAG.wall], bay = r?.bays?.[WDRAG.i]; if(!bay) return;
  const d = WDRAG.dx / WDRAG.pxPerIn;
  const want = clampBay(WDRAG.w0 + (WDRAG.side === 'r' ? d : -d), isFiller(bay));
  if(Math.abs(want - bay.w) < 0.24) return;
  const grew = want - bay.w;
  const free = wallLength(WDRAG.wall) - r.bays.reduce((a, b2) => a + b2.w, 0);
  const take = Math.min(grew, Math.max(0, free));
  bay.w = +(bay.w + (grew <= 0 ? grew : take)).toFixed(2);
  if(WDRAG.side === 'l') bay.at = Math.max(0, +(WDRAG.at0 + (WDRAG.w0 - bay.w)).toFixed(2));
  sortRun(WDRAG.wall);
  S.sel.i = r.bays.indexOf(bay);
  WDRAG.i = S.sel.i;
  rebuild(false);
  paintFlat();
});

const dragAdd = onFrame(() => {
  if(!ADRAG) return;
  const bay = S.runs[ADRAG.wall]?.bays?.[ADRAG.i]; const a = bay?.adds?.[ADRAG.ai];
  if(!a) return;
  const b = cur?.bays?.find(x => x.wall === ADRAG.wall && x.bay === ADRAG.i);
  const lo = (b?.floorY ?? 3.75) + 1;
  const hi = lo + (b?.h ?? 80) - (MODULES[a.m]?.defH ?? 2) - 1.5;
  const want = ADRAG.at0 - ADRAG.dy / ADRAG.pxPerIn;
  a.y = Math.max(lo, Math.min(hi, Math.round(want * 4) / 4));
  rebuild(false);
  paintFlat();
});

$('#v2dcanvas')?.addEventListener('pointermove', e => {
  if(WDRAG){ WDRAG.dx = e.clientX - WDRAG.x0; dragWidth(); return; }
  if(ADRAG){ ADRAG.dy = e.clientY - ADRAG.y0; ADRAG.moved = true; dragAdd(); return; }
  if(HDRAG){ HDRAG.dy = e.clientY - HDRAG.y0; dragHeight(); return; }
  if(!FDRAG) return;
  FDRAG.delta = (FDRAG.axis === 'y' ? e.clientY : e.clientX) - FDRAG.p0;
  dragFlat();
});

const endFlatDrag = () => {
  if(WDRAG){
    WDRAG = null; DRAGGING = false;
    $('#v2dcanvas')?.classList.remove('dragging');
    rebuild(true); paintAll();
    return;
  }
  if(ADRAG){
    ADRAG = null; DRAGGING = false;
    $('#v2dcanvas')?.classList.remove('dragging');
    rebuild(true); paintAll();
    return;
  }
  if(HDRAG){
    HDRAG = null; DRAGGING = false;
    $('#v2dcanvas')?.classList.remove('dragging');
    rebuild(true); paintAll();
    return;
  }
  if(!FDRAG) return;
  const { moved, wall } = FDRAG;
  FDRAG = null; DRAGGING = false;
  $('#v2dcanvas')?.classList.remove('dragging');
  if(moved){ sortRun(wall); rebuild(true); }   // reprice once, at the end
  paintAll();
};
$('#v2dcanvas')?.addEventListener('pointerup', endFlatDrag);
$('#v2dcanvas')?.addEventListener('pointercancel', endFlatDrag);
/* a flat view is laid out for the width it was drawn at */
let flatPending = null;
addEventListener('resize', () => {
  if(VIEW === '3d') return;
  clearTimeout(flatPending);
  flatPending = setTimeout(paintFlat, 160);
});

/* ───────── sending the design to the office ─────────
   Clicking this used to drop the design into storage and jump straight to the
   contact page, which left the customer wondering what, if anything, had just
   been sent. Now it says exactly what travels with the enquiry, and only then
   goes on to ask who they are and where the room is. */
/* THE 3D VIEW, AS A PICTURE.

   The PDF carries the view the customer was actually looking at, so Joseph
   opens the drawing and sees the same closet they did. Two things make that
   less simple than reading the canvas: the renderer draws only when asked,
   so the buffer holds whatever frame was last composed, and by the time
   anyone presses send the canvas is usually on a hidden tab. If it still has
   a size we compose one fresh frame first; if it does not we take the last
   one that was drawn, which preserveDrawingBuffer has kept for us. Either
   way a failure here returns null and the drawing goes without the shot. */
function snapshot(keepCamera){
  const pos = cam.position.clone(), tgt = ctl.target.clone();
  try{
    /* keepCamera is for a frame grabber that has already placed the camera
       itself. Without it this would helpfully move the camera back to the
       documentation view and photograph that instead, which is exactly what
       it is for everywhere else. */
    if(!keepCamera && canvas.clientWidth > 0 && canvas.clientHeight > 0){
      /* The shot is taken from the whole-room view, not from wherever the
         customer happened to leave the camera. Pressing send with the camera
         two inches from a drawer front was putting a photograph of a drawer
         front in the drawing, which tells Joseph nothing. The camera is put
         back the moment the picture is taken, so nothing moves on screen. */
      const v = view('doc');
      cam.position.set(...v.p); ctl.target.set(...v.t); ctl.update();
    }
    if(canvas.clientWidth > 0 && canvas.clientHeight > 0){
      paint(true);
    }
    return renderer.domElement.toDataURL('image/png');
  }catch(e){
    console.warn('[drawing] no 3D shot:', e); return null;
  }finally{
    if(!keepCamera){
      cam.position.copy(pos); ctl.target.copy(tgt); ctl.update();
    }
    needsFrame = true;
  }
}

function quotePackage(){
  return {
    summary:`${TYPES[S.type].label} · ${S.room.w}"×${S.room.d}"×${S.room.h}" · ${cur.bays.length} tower${cur.bays.length===1?'':'s'} · ${cur.finish.n}`,
    price:Math.round(cur.price.price), type:S.type,   // office only, never shown
    typeLabel: S.type==='reach-in'?'Reach-In Closets':S.type==='walk-in'?'Walk-In Closets':S.type==='pantry'?'Pantries':S.type==='garage'?'Garage Storage':'Laundry Rooms',
    room:S.room, mounting:S.mounting,
    backs: S.backs ? 'A back panel on every tower' : 'No backs, the wall is the back',
    corner: Object.values(S.runs).filter(r=>r?.on).length > 1
      ? `The back wall runs the full width. The side wall stands ${SPEC.sideStandoff}" clear of it, `
        + 'bridged with a top piece and a bottom piece on their own toe kick'
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
    order:cur.order,
    /* EVERY SINGLE PIECE. The cut list above is what gets cut; this is what
       holds it together, rolled up across the whole design from his own
       ClosetPro hardware column. Between the two there is nothing in this
       closet that is not written down. */
    hardware: hardwareFor(cur.parts, HARDWARE_MAP),
    pieceCount: cur.order.reduce((a,o)=>a+(+o.qty||0),0)
              + hardwareFor(cur.parts, HARDWARE_MAP).reduce((a,h)=>a+(+h.qty||0),0),
    warnings:cur.warnings,
    door: DOORS.find(d=>d.id===S.door)?.label || 'Open / no doors',
    ...(S.doorW > 0 ? { doorOpening: S.doorW } : {}),
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
    /* THE DESIGN ITSELF, NOT A DESCRIPTION OF IT.

       Everything above is the design written out in words, which is what the
       office reads. This is the design: the same small object the builder
       hands the engine. With it the admin can rebuild the closet exactly —
       every piece and every dimension — and print the drawing again months
       later without the customer still having the tab open. It is a few
       hundred bytes and it is the difference between a record and a copy. */
    state: cfg(),
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
    + line('The drawing', `${q.bays.length} tower${q.bays.length===1?'':'s'}, wall by wall, with every measurement`)
    + line('Every piece', `${q.pieceCount} in all: ${parts} panels, shelves, rods, boxes, glides and pulls, `
        + `plus ${(q.hardware||[]).reduce((a,h)=>a+(+h.qty||0),0)} cams, dowels, screws and shelf pins`)
    + ((q.hardware||[]).length ? line('The hardware',
        q.hardware.map(h=>`${h.qty} × ${h.item}`).join(' · ')) : '')
    + line('Color', q.finish === q.frontFinish ? q.finish : `${q.finish} carcass · ${q.frontFinish} fronts`)
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
    + line('Price', 'to be confirmed by Joseph within 24 hours')
    + (q.warnings?.length ? `<div class="sl warn"><span>Worth saying</span><b>${q.warnings.join(' ')}</b></div>` : '');
  dl.showModal();
};
$('#sendCancel')?.addEventListener('click', ()=> $('#sendDlg').close());
/* THE DRAWING TRAVELS WITH THE ENQUIRY.

   Joseph re-draws every closet in ClosetPro before he prices it, so what
   he needs from here is not a picture of a closet, it is a measured
   drawing: every wall in elevation with every tower dimensioned, the plan
   with the standoff on it, the 3D view the customer was looking at, and
   every piece behind them. He was getting a list of part names and had to
   guess the rest.

   The PDF is built in the browser from the same geometry the 3D view
   draws, downloaded so the customer keeps a copy, and the reference is
   put on the enquiry so the office knows a drawing exists for it. If the
   PDF library cannot be fetched the enquiry still goes, because an
   enquiry that fails to send is worse than one without a drawing. */
$('#sendGo')?.addEventListener('click', async ()=>{
  const btn = $('#sendGo');
  const was = btn.textContent;
  btn.disabled = true; btn.textContent = 'Drawing it up…';
  const q = quotePackage();
  try{
    const { downloadPdf } = await import('./drawing.js?v=a3c1cf93');
    const shot = snapshot();
    await downloadPdf(cur, {
      ref: `${designRef()} · ${new Date().toLocaleDateString()}`,
      order: q.order, hardware: q.hardware, notes: q.warnings,
      finish: q.finish, frontFinish: q.frontFinish, pull: q.pull,
      pullFinish: q.pullFinish, door: q.door, doorOpening: q.doorOpening,
      shot, filename: `JS-Closets-${designRef()}.pdf`
    });
    q.drawing = { madeAt:new Date().toISOString(), ref:designRef(),
                  walls:[...new Set((cur.bays||[]).map(b=>b.wall))] };
  }catch(err){
    console.warn('[drawing] the PDF could not be built, the enquiry still goes:', err);
  }
  btn.disabled = false; btn.textContent = was;
  try{ localStorage.setItem('js_quote', JSON.stringify(q)); }catch(e){}
  location.href=(window.BASE||'')+'contact.html';
});
/* the same drawing, on demand, without sending anything */
$('#dlDrawing')?.addEventListener('click', async ()=>{
  const b = $('#dlDrawing'), was = b.textContent;
  b.disabled = true; b.textContent = 'Drawing it up…';
  try{
    const { downloadPdf } = await import('./drawing.js?v=a3c1cf93');
    const q = quotePackage();
    const shot = snapshot();
    await downloadPdf(cur, { ref:`${designRef()} · ${new Date().toLocaleDateString()}`,
      order:q.order, hardware:q.hardware, notes:q.warnings, shot,
      finish:q.finish, frontFinish:q.frontFinish, pull:q.pull,
      pullFinish:q.pullFinish, door:q.door, doorOpening:q.doorOpening,
      filename:`JS-Closets-${designRef()}.pdf` });
    b.textContent = was;
  }catch(err){
    console.warn('[drawing]', err);
    /* There is no toast on this page, and an alert() would block the tab,
       so the button says so itself and puts its own label back. */
    b.textContent = 'Could not draw it';
    setTimeout(()=>{ b.textContent = was; }, 2600);
  }
  b.disabled = false;
});

$('#dlOrder').onclick=()=>{
  const rows=[['Item','Qty','Sq ft','Edgeband ft','Color','Detail'],
    ...cur.order.map(o=>[o.item,o.qty,o.sq_ft,o.edgeband_ft,o.finish,o.detail])];
  const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const u=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  const a=document.createElement('a'); a.href=u; a.download='closet-order.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
};
$('#breakdown').onclick=()=>{
  if(window.gotoStep) window.gotoStep('order');
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

/* The opening question, for somebody who arrived with nothing chosen. A
   ?plan= or ?preset= link has already answered it, and so has a room that
   somebody has already put towers in, so neither sees it. */
if(!qPre && !qPlan && !Object.values(S.runs).some(r => r?.bays?.length)) openGate();
/* and when there is no gate, say so, so the tour does not sit waiting for
   a door that is never going to open */
else window.dispatchEvent(new Event('js:gate-closed'));

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
