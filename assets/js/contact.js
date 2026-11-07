import { regionFor } from './enquiry.js';
import { SUPA_REST, SUPA_KEY } from './supa-config.js';

const f    = document.getElementById('leadform');
const msg  = document.getElementById('formmsg');
const note = document.getElementById('quoteNote');
const out  = document.getElementById('refbox');

const BASE = window.BASE || '';
const money = n => '$' + Math.round(n||0).toLocaleString();

/* ── the design carried across from the 3D builder ───────────────────── */
let design = null;
try{ design = JSON.parse(localStorage.getItem('js_quote') || 'null'); }catch(e){}

if(design && note){
  const sections = (design.bays||[]).length;
  const parts    = (design.order||[]).reduce((a,o)=>a+(+o.qty||0),0);
  const fittings = (design.fittings||[]).length;
  note.hidden = false;
  note.innerHTML =
    `<b>Your design is attached to this enquiry.</b>
     <span class="refline">${design.summary}</span>
     <span class="refline">${sections} section${sections===1?'':'s'} · ${parts} parts and pieces`
     + (fittings ? ` · ${fittings} thing${fittings===1?'':'s'} on the wall to work around` : '')
     + ` · estimated <b>${money(design.price)}</b> for the cabinetry</span>
     <span class="refline">We get the whole drawing, every panel, rod, drawer box, glide and pull, and your notes. Nothing is retyped.</span>
     <a class="lnk" href="${BASE}design/">Go back and change it</a>`;
  const sel = document.getElementById('t');
  if(design.typeLabel && sel) [...sel.options].forEach(o=>{ if(o.text === design.typeLabel) o.selected = true; });
}

/* ── what they pressed to get here ──────────────────────────────────────
   The wall-bed page's three builds are configurations the 3D builder cannot
   draw, so those cards come here instead of into the designer. The one they
   pressed arrives as ?project=, picks the room out of the list and opens the
   message with the configuration's name, so Joseph is not guessing which of
   the three they meant. */
const PROJECT_FROM_CARD = {
  'queen vertical'  : ['Wall Beds', 'a queen vertical wall bed, with a tower each side'],
  'queen horizontal': ['Wall Beds', 'a queen horizontal wall bed, for a wall with a window above it'],
  'bed and office'  : ['Wall Beds', 'a queen wall bed with a desk that stays up when the bed comes down'],
};
(function carryProject(){
  const want = new URLSearchParams(location.search).get('project');
  if(!want) return;
  const sel = document.getElementById('t'); if(!sel) return;
  const hit = PROJECT_FROM_CARD[want.trim().toLowerCase()];
  const room = hit ? hit[0] : want.trim();
  const opt = [...sel.options].find(o => o.text.toLowerCase() === room.toLowerCase());
  if(opt) opt.selected = true;
  const m = document.getElementById('m');
  if(m && !m.value){
    m.value = hit ? `I am looking at ${hit[1]}.`
                  : `I am looking at ${want.trim()}.`;
  }
})();

/* ── build the whole package ─────────────────────────────────────────── */
function gather(){
  const v = n => (f.elements[n]?.value || '').trim();
  /* The address is four fields now, so it is assembled here once, the way it
     would be written on an envelope, and the ZIP also travels on its own
     because it is what decides whose week the job lands in. */
  const street = [v('address'), v('address2')].filter(Boolean).join(', ');
  const town   = [v('location'), v('state')].filter(x => x && x !== 'other').join(', ');
  const contact = { name:v('name'), phone:v('phone'), email:v('email'),
                    region:v('region'),
                    address: street, address2: v('address2'),
                    city: v('location'), state: v('state'), zip: v('zip'),
                    location: [town, v('zip')].filter(Boolean).join(' '),
                    project:v('project'), message:v('message') };
  return {
    v: 1,
    sent: new Date().toISOString(),
    source: design ? '3D builder' : 'Website form',
    contact,
    regionId: regionFor(contact),
    design,
  };
}

/* ── what they see once it is sent ──────────────────────────────────────
   There used to be a reference code here: a long line of base64 the customer
   was asked to copy, keep safe and read back over the phone if anything went
   wrong. Nothing ever went wrong with it, because the enquiry writes itself
   into the office database the moment it is sent. Asking someone to be the
   backup for a system that does not need one is not reassurance, it is
   homework. It is gone. They get a confirmation email instead. */
function showSent(pkg){
  /* The old #refbox was removed with the reference code, which left this
     with nowhere to draw. It makes its own box now rather than silently
     doing nothing — the one thing a confirmation must never do. */
  let box = out || document.getElementById('sentbox');
  if(!box){
    box = document.createElement('div');
    box.id = 'sentbox';
    (f?.parentNode || document.body).appendChild(box);
  }
  box.hidden = false;
  box.className = 'sentbox';
  const outEl = box;
  const c = pkg.contact || {};
  outEl.innerHTML =
    `<h3>That is with us.</h3>
     <p>We reply the same working day${c.email ? `, and a confirmation is on its way to <b>${esc(c.email)}</b>` : ''}.</p>
     <dl class="sentlist">
       ${c.name     ? `<div><dt>Name</dt><dd>${esc(c.name)}</dd></div>` : ''}
       ${c.phone    ? `<div><dt>Phone</dt><dd>${esc(c.phone)}</dd></div>` : ''}
       ${c.address || c.location ? `<div><dt>Where</dt><dd>${esc([c.address, c.location].filter(Boolean).join(', '))}</dd></div>` : ''}
       ${c.project  ? `<div><dt>Room</dt><dd>${esc(c.project)}</dd></div>` : ''}
       ${pkg.design ? `<div><dt>Your design</dt><dd>${esc(pkg.design.summary || 'attached')}</dd></div>` : ''}
     </dl>
     <p class="dim">If anything above is wrong, call <a href="tel:+16466679572">(646) 667-9572</a> and we will fix it.</p>`;
  outEl.scrollIntoView({behavior:'smooth', block:'nearest'});
}
const esc = t => String(t ?? '').replace(/[&<>"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ── straight into the office ──
   The enquiry is written into the database the moment it is sent, so it is
   sitting in the Inbox before the email even arrives. The key used here can
   only insert into this one table, so nothing about a customer can be read
   back out of the website.

   This never blocks the customer. If it fails, the email and the reference
   code still carry the whole enquiry, and the office loses nothing. */
async function fileWithTheOffice(pkg){
  try{
    const r = await fetch(SUPA_REST + '/leads', {
      method:'POST',
      headers:{ apikey:SUPA_KEY, Authorization:'Bearer '+SUPA_KEY,
                'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({
        region_id: pkg.regionId, source: pkg.source,
        contact: pkg.contact, design: pkg.design })
    });
    return r.ok;
  }catch(e){ return false; }
}

f?.addEventListener('submit', async ev => {
  ev.preventDefault();
  /* novalidate is on the form so this is the only validation gate */
  if(!f.checkValidity()){ f.reportValidity(); return; }

  const pkg = gather();
  const btn = f.querySelector('button[type="submit"]');
  if(btn){ btn.disabled = true; btn.dataset.was = btn.textContent; btn.textContent = 'Sending…'; }
  msg.textContent = 'Sending…';

  /* Two things happen, and the enquiry is safe if either one of them does.
     The database write is what the office actually works from; the emails
     are the notification. Neither is a third-party form relay any more. */
  const filed  = fileWithTheOffice(pkg);
  const mailed = sendMail(pkg);

  const okFiled = await filed;
  const mail = await mailed;

  if(btn){ btn.disabled = false; btn.textContent = btn.dataset.was || 'Request my free measure'; }

  if(okFiled || mail?.office?.ok){
    msg.textContent = '';
    try{ localStorage.removeItem('js_quote'); }catch(e){}
    showSent(pkg);
    f.reset();
  } else {
    /* Nothing got through. Say so plainly and give them the phone number
       rather than pretending it is fine. */
    msg.innerHTML = '<b>That did not go through.</b> Please call us on '
      + '<a href="tel:+16466679572">(646) 667-9572</a> and we will take it down over the phone. '
      + 'Nothing you typed has been lost from this page.';
  }
});

/* ── both emails, sent by the office's own function ─────────────────────
   Web3Forms used to send Joseph his copy and could not send the customer
   one at all without paying. Both now come from the same function sitting
   next to the database, which holds the mail key where the public cannot
   read it — and because we write the email ourselves, what Joseph opens is
   laid out the way the job actually reads. */
async function sendMail(pkg){
  try{
    const base = SUPA_REST.replace(/\/rest\/v1\/?$/, '');
    const r = await fetch(base + '/functions/v1/confirm-enquiry', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', apikey:SUPA_KEY,
                Authorization:'Bearer ' + SUPA_KEY },
      body: JSON.stringify({ contact: pkg.contact, design: pkg.design || null })
    });
    return r.ok ? await r.json().catch(()=>({})) : null;
  }catch(e){ return null; }
}
