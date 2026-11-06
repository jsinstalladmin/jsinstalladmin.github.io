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
export function regionFor({ region='', location='', address='' } = {}){
  const zip = String(location+' '+address).match(/\b(\d{5})\b/);
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
