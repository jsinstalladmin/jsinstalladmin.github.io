/* ============================================================
   crewlink.js — the week a crew member can see on their phone.

   Joseph pins one link per person in their WhatsApp chat. Opening it
   shows that person their own week: which day, which address, what is
   going in, and nothing else. There is no login, no app, and nothing
   on that page can change a single record, because the page has no way
   to write anything back. It is a printed work sheet that happens to
   be a link.

   The whole week travels inside the link, after the # so it never
   reaches a server log, which is why this works on static hosting with
   no database behind it. Regenerate the link when the week changes.
   ============================================================ */

/* ---------- how long the link is, and why ----------------------------
   v1 put the whole week object in the address as pretty JSON: every key
   name spelled out, all seven days whether or not anyone was working, and
   a full ISO timestamp of the moment it was made. A week with one visit
   came to about 1,100 characters -- four lines of gibberish in a WhatsApp
   message, which is not something you send a person.

   v2 sends the same week in a tenth of that:
     - only the days that have something on them, as an offset 0-6 from
       the Monday, instead of seven ISO dates
     - items as plain arrays, so the eight field names are written once in
       this file instead of once per visit
     - trailing empty fields trimmed off each array
     - the business name left out when it is the usual one
     - the 'made' timestamp dropped; nothing ever read it
   and then, where the browser has it, the whole thing is deflated before
   it is encoded.

   Three markers are understood, so links already pinned in someone's chat
   keep working:  CREW1 plain JSON · CREW2 compact · CREW3 compact+deflate.
   -------------------------------------------------------------------- */
const MARK   = 'CREW1.';
const MARK2  = 'CREW2.';
const MARK3  = 'CREW3.';
const BIZ    = 'JS Installations & Closets';
const FIELDS = ['kind','title','stage','client','addr','phone','finish','notes'];

const b64 = str => {
  const bytes = new TextEncoder().encode(str);
  return b64bytes(bytes);
};
const b64bytes = bytes => {
  let s = ''; for(const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const unb64bytes = code => {
  const s = atob(code.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};
const unb64 = code => new TextDecoder().decode(unb64bytes(code));

/* drop trailing '' / null so a visit with no finish and no note costs
   nothing instead of two commas */
const trim = arr => { const a = arr.slice();
  while(a.length && (a[a.length-1] === '' || a[a.length-1] == null)) a.pop();
  return a; };

function compact(week){
  const days = [];
  week.days.forEach((d, i) => {
    const items = (d.items || []).map(it => trim(FIELDS.map(k => it[k] ?? '')));
    const note  = d.note || '';
    if(items.length || note) days.push(trim([i, note, items.length ? items : null]));
  });
  const o = { c:week.crew || '', s:week.start, d:days };
  if(week.role)                      o.r = week.role;
  if(week.biz && week.biz !== BIZ)   o.b = week.biz;
  if(week.bizPhone)                  o.p = week.bizPhone;
  return o;
}

function expand(o, startISO){
  const start = o.s || startISO;
  const byOffset = new Map();
  (o.d || []).forEach(row => {
    const [i, note, items] = row;
    byOffset.set(i, { note: note || '',
      items: (items || []).map(a => {
        const it = {}; FIELDS.forEach((k, n) => { it[k] = a[n] ?? ''; }); return it;
      }) });
  });
  const days = [];
  for(let i = 0; i < 7; i++){
    const hit = byOffset.get(i) || { note:'', items:[] };
    days.push({ date: addDays(start, i), items: hit.items, note: hit.note });
  }
  return { v:2, crew:o.c || 'Crew', role:o.r || '', biz:o.b || BIZ,
           bizPhone:o.p || '', start, days };
}

/* Deflate is on every current browser but it is asynchronous, and a link
   that cannot be built is worse than a long one. If the stream is missing
   or throws, we fall back to CREW2, which the reader also understands. */
async function deflate(str){
  if(typeof CompressionStream === 'undefined') return null;
  try{
    const cs = new CompressionStream('deflate-raw');
    const w  = cs.writable.getWriter();
    w.write(new TextEncoder().encode(str)); w.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(buf);
  }catch(e){ return null; }
}
async function inflate(bytes){
  const ds = new DecompressionStream('deflate-raw');
  const w  = ds.writable.getWriter();
  w.write(bytes); w.close();
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
}

/* A readable head on the link, so what lands in someone's chat opens with
   their own name and the week it covers instead of a wall of base64:

     .../crew/#tiago-nov2.CREW3.q1ZKzU3MyVFIzCtJLSpWslJQ...

   It is decoration -- the reader ignores everything before the marker --
   but it is the difference between a link a person recognises as theirs and
   a link that looks like something went wrong. */
export function weekSlug(week){
  const first = String(week.crew || '').trim().split(/\s+/)[0].toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const d = new Date((week.start || '') + 'T12:00');
  const when = isNaN(d) ? '' :
    d.toLocaleDateString('en-US',{month:'short'}).toLowerCase() + d.getDate();
  return [first, when].filter(Boolean).join('-');
}

/* Synchronous, always works, used as the fallback and by anything that
   cannot await. */
export function packWeek(week){
  return MARK2 + b64(JSON.stringify(compact(week)));
}

/* The short one. Falls back to packWeek's output if deflate is unavailable. */
export async function packWeekShort(week){
  const json = JSON.stringify(compact(week));
  const z = await deflate(json);
  const plain = MARK2 + b64(json);
  /* deflate can lose to base64 overhead on a very small week */
  const body = (z && (MARK3 + b64bytes(z)).length < plain.length)
    ? MARK3 + b64bytes(z) : plain;
  const slug = weekSlug(week);
  return slug ? slug + '.' + body : body;
}

export async function unpackWeek(code){
  let raw = String(code||'').trim().replace(/^#/,'').replace(/\s+/g,'');
  if(!raw) throw new Error('This link has nothing in it.');
  /* step over the readable head (see weekSlug) wherever it is present. The
     marker is searched for rather than required at position 0, so adding to
     the front of a link can never stop it opening. */
  for(const m of [MARK3, MARK2, MARK]){
    const i = raw.indexOf(m);
    if(i > 0){ raw = raw.slice(i); break; }
    if(i === 0) break;
  }
  let obj;
  if(raw.startsWith(MARK3)){
    if(typeof DecompressionStream === 'undefined')
      throw new Error('This browser is too old to read this link. Ask the office for a new one.');
    obj = expand(JSON.parse(await inflate(unb64bytes(raw.slice(MARK3.length)))));
  } else if(raw.startsWith(MARK2)){
    obj = expand(JSON.parse(unb64(raw.slice(MARK2.length))));
  } else {
    /* v1: the old long links, still pinned in people's chats */
    const body = raw.startsWith(MARK) ? raw.slice(MARK.length) : raw;
    obj = JSON.parse(unb64(body));
  }
  if(!obj || !Array.isArray(obj.days)) throw new Error('This link is not a JS Closets week.');
  return obj;
}

/* Monday of the week a date falls in. Weeks start Monday because that is
   when the crew's week starts, not Sunday. */
export function mondayOf(iso){
  const d = new Date(iso + 'T12:00');
  const off = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - off);
  return d.toISOString().slice(0,10);
}
export function addDays(iso, n){
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}

/* iPhones open Apple Maps, everything else opens Google Maps. Both take a
   plain address string, so no geocoding and no API key is needed. */
export function mapsHref(address){
  const q = encodeURIComponent(address || '');
  const apple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
  return apple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}
