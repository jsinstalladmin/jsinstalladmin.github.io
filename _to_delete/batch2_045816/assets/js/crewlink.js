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

const MARK = 'CREW1.';

const b64 = str => {
  const bytes = new TextEncoder().encode(str);
  let s = ''; for(const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const unb64 = code => {
  const s = atob(code.replace(/-/g,'+').replace(/_/g,'/'));
  return new TextDecoder().decode(Uint8Array.from(s, c => c.charCodeAt(0)));
};

export function packWeek(week){ return MARK + b64(JSON.stringify(week)); }

export function unpackWeek(code){
  const raw = String(code||'').trim().replace(/^#/,'').replace(/\s+/g,'');
  if(!raw) throw new Error('This link has nothing in it.');
  const body = raw.startsWith(MARK) ? raw.slice(MARK.length) : raw;
  const obj = JSON.parse(unb64(body));
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
