/* ============================================================
   enquiry.js — the hand-off from the website to the office.

   The site is static. There is no server to post a lead to, so the
   design a customer draws in the builder has to travel to the admin
   page some other way. It travels as a REFERENCE CODE: the whole
   enquiry, contact details, room, every section, every part and the
   price, packed into one line of text.

   The code goes out in the enquiry email. Whoever opens that email
   pastes the code into Admin → Inbox and the client, the job and the
   quote are created in the right region, with the parts list attached.
   Nothing is retyped and nothing is lost in a thread.

   When a real database goes in later, this file is the only thing
   that has to change: pack() becomes a POST and read() becomes a GET.
   ============================================================ */

const MARK = 'JSC1.';

/* UTF-8 safe base64. btoa alone throws on any accented character, and a
   customer's name is exactly where one turns up. */
const b64 = str => {
  const bytes = new TextEncoder().encode(str);
  let s = ''; for(const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const unb64 = code => {
  const s = atob(code.replace(/-/g,'+').replace(/_/g,'/'));
  const bytes = Uint8Array.from(s, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export function pack(enquiry){
  return MARK + b64(JSON.stringify(enquiry));
}

export function unpack(code){
  const raw = String(code||'').trim().replace(/\s+/g,'');
  if(!raw) throw new Error('Nothing pasted.');
  const body = raw.startsWith(MARK) ? raw.slice(MARK.length) : raw;
  let obj;
  try{ obj = JSON.parse(unb64(body)); }
  catch(e){
    /* someone pasted the raw JSON out of the email instead of the code */
    try{ obj = JSON.parse(raw); }
    catch(e2){ throw new Error('That is not a JS Closets reference code.'); }
  }
  if(!obj || typeof obj !== 'object' || !obj.contact) throw new Error('That code is missing the customer details.');
  return obj;
}

/* Which of his five regions the job belongs to. The customer picks a
   region on the form, but people pick the wrong one, so the ZIP and the
   town are checked too and the ZIP wins when they disagree. */
export const REGION_IDS = ['fl','nj','ny','ct','pa'];
const ZIP_BANDS = [
  ['fl', 32000, 34999],
  ['ny', 10000, 14999],
  ['nj',  7000,  8999],
  ['ct',  6000,  6999],
  ['pa', 15000, 19699],
];
const WORDS = {
  fl:['florida','miami','lauderdale','boca','delray','boynton','palm beach','parkland','coral springs','jupiter','hollywood','pompano','aventura'],
  ny:['new york','queens','brooklyn','astoria','westchester','long island','rockland','putnam','bronx','manhattan','larchmont'],
  nj:['new jersey','bergen','essex','morris','hudson','monmouth','paramus','teterboro','newark','hoboken'],
  ct:['connecticut','fairfield','new haven','hartford','stamford','greenwich','norwalk'],
  pa:['pennsylvania','philadelphia','bucks','montgomery','chester','delaware county','lehigh','newtown'],
};
export function regionFor({ region='', location='', address='', zip:zipField='' } = {}){
  /* The form asks for the ZIP in a box of its own now, so use it rather than
     hunting for five digits in a sentence. The hunt stays as the fallback for
     enquiries pasted in from an email. */
  const zip = String(zipField).match(/\b(\d{5})\b/)
           || String(location+' '+address).match(/\b(\d{5})\b/);
  if(zip){
    const n = +zip[1];
    for(const [id, lo, hi] of ZIP_BANDS) if(n >= lo && n <= hi) return id;
  }
  const hay = (region+' '+location+' '+address).toLowerCase();
  for(const id of REGION_IDS) if(WORDS[id].some(w => hay.includes(w))) return id;
  return null;
}

/* A one-screen summary a human can read without decoding anything. */
export function describe(e){
  const d = e.design;
  if(!d) return 'No design attached. Enquiry only.';
  const sections = (d.bays||[]).length;
  const parts = (d.order||[]).reduce((a,o)=>a+(+o.qty||0),0);
  /* the summary already names the section count, so repeating it here reads
     as a stutter in the inbox list */
  const head = d.summary || `${sections} section${sections===1?'':'s'}`;
  return `${head} · ${parts} parts · $${Number(d.price||0).toLocaleString()}`;
}

/* ── The whole enquiry in plain words ─────────────────────────────────────
   The packed code carries everything but can only be read by the machine,
   and the one-line summary is for the inbox list. This is what a person
   actually reads: the room, the design wall by wall, and crucially every
   single thing on the walls with its wall, its distance along that wall,
   its height off the floor, its size and whatever the customer said about
   it. Before this, the email said "Outlet" and the crew found out the rest
   on the day. */
export function fullText(e){
  const d = e.design, c = e.contact || {}, L = [];
  const row = (k, v) => { if(v != null && v !== '') L.push(k + ': ' + v); };

  L.push('WHO');
  row('Name', c.name); row('Phone', c.phone); row('Email', c.email);
  row('Area', c.region); row('Town or ZIP', c.location);
  row('Address', c.address || 'not given');
  row('Project', c.project);
  if(c.message){ L.push(''); L.push('WHAT THEY SAID'); L.push(c.message); }

  if(!d){ L.push(''); L.push('No design attached. Enquiry only.'); return L.join('\n'); }

  L.push(''); L.push('THE ROOM');
  row('Type', d.typeLabel);
  row('Size', `${d.room.w}" wide · ${d.room.d}" deep · ${d.room.h}" high`);
  row('Mounting', d.mounting === 'wall' ? 'Wall hung' : 'On the floor');
  if(d.baseboard){
    row('Baseboard', `${d.baseboard.height}" tall · ${d.baseboard.thickness}" thick`);
    row('They measured', d.baseboard.measuredFrom === 'baseboard'
        ? 'baseboard to baseboard' : 'wall to wall');
    row('At the baseboard', d.baseboard.handling);
  }
  row('Backs', d.backs);
  row('The corner', d.corner);
  row('Doors', d.door);
  row('Finish', d.finish === d.frontFinish ? d.finish
      : `${d.finish} carcass · ${d.frontFinish} fronts`);
  row('Hardware', `${d.pull} in ${d.pullFinish}`);

  L.push(''); L.push('THE DESIGN');
  (d.bays || []).forEach((b, i) => {
    L.push(`  ${i+1}. ${b.wall} wall · ${b.width}" wide${b.topShelf ? '' : ' · no top shelf'}`);
    (b.stack || []).forEach(s => L.push(`       ${s.module}`
      + (s.height ? ` · ${s.height}"` : '')
      + (s.options && Object.keys(s.options).length
         ? ' · ' + Object.entries(s.options).map(([k,v]) => `${k} ${v}`).join(', ') : '')));
  });

  L.push(''); L.push('ON THE WALLS');
  if(!(d.fittings || []).length) L.push('  Nothing marked.');
  (d.fittings || []).forEach(f => {
    L.push(`  ${f.item} — ${f.wall}`);
    row('       Along the wall', f.inchesAlong + '" from the left corner');
    if(f.heightOffFloor  != null) row('       Height off the floor', f.heightOffFloor + '"');
    if(f.widthInches     != null) row('       Width', f.widthInches + '"');
    if(f.sillOrLowPoint  != null) row('       Sill / low point', f.sillOrLowPoint + '"');
    if(f.tallInches      != null) row('       Tall', f.tallInches + '"');
    if(f.sticksOutInches != null) row('       Sticks out', f.sticksOutInches + '"');
    if(f.where)                   row('       Where', f.where);
    if(f.note)                    row('       They said', f.note);
  });

  if((d.warnings || []).length){
    L.push(''); L.push('WORTH SAYING');
    d.warnings.forEach(w => L.push('  ' + w));
  }

  L.push(''); L.push('ESTIMATE');
  L.push(`  $${Number(d.price || 0).toLocaleString()} for the cabinetry`);
  L.push(`  ${(d.order || []).reduce((a,o) => a + (+o.qty || 0), 0)} parts and pieces`);
  return L.join('\n');
}
