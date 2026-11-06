import { pack, regionFor, describe } from './enquiry.js';
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

/* ── build the whole package ─────────────────────────────────────────── */
function gather(){
  const v = n => (f.elements[n]?.value || '').trim();
  const contact = { name:v('name'), phone:v('phone'), email:v('email'),
                    region:v('region'), location:v('location'), address:v('address'),
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

function showCode(code, sent){
  if(!out) return;
  out.hidden = false;
  out.innerHTML =
    `<h3>${sent ? 'Sent. Here is your reference.' : 'Your reference code'}</h3>
     <p class="dim">${sent
        ? 'We have it. This code is the same enquiry in one line, so if anything goes astray you can read it back to us over the phone.'
        : 'Copy this and email it to us, or read it out when you call. It carries your whole design.'}</p>
     <textarea class="refcode" readonly rows="3"></textarea>
     <div class="btnrow"><button class="btn btn-sm" type="button" id="copyref">Copy the code</button>
       <a class="btn btn-sm btn-ghost" href="mailto:jsinstallationsclosets@gmail.com?subject=${
         encodeURIComponent('Closet enquiry reference')}&body=${encodeURIComponent(code)}">Email it instead</a></div>`;
  out.querySelector('.refcode').value = code;
  out.querySelector('#copyref').onclick = async () => {
    const b = out.querySelector('#copyref');
    try{ await navigator.clipboard.writeText(code); b.textContent = 'Copied'; }
    catch(e){ out.querySelector('.refcode').select(); b.textContent = 'Press ⌘C'; }
    setTimeout(()=>{ b.textContent = 'Copy the code'; }, 2200);
  };
  out.scrollIntoView({behavior:'smooth', block:'nearest'});
}

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
  if(!f.reportValidity()) return;

  const pkg  = gather();
  const code = pack(pkg);
  const filed = fileWithTheOffice(pkg);          // runs alongside, never blocks

  /* The code rides along with the email, and so does a readable summary, so
     whoever opens it can act on it without decoding anything. */
  if(f.elements.quote_payload) f.elements.quote_payload.value = code;
  if(f.elements.enquiry_summary) f.elements.enquiry_summary.value = describe(pkg);

  const key = f.elements.access_key.value;
  if(!key || key === 'WEB3FORMS_KEY_HERE'){
    /* Not connected yet. Nothing is silently dropped: the enquiry opens in
       their own mail client with everything in it, and the code is on screen
       to copy. */
    msg.innerHTML = '<b>The form is not connected yet.</b> Your enquiry has been put into an email instead, and your reference code is below. You can also call us on <a href="tel:+16466679572">(646) 667-9572</a>.';
    const body = [
      `Name: ${pkg.contact.name}`, `Phone: ${pkg.contact.phone}`, `Email: ${pkg.contact.email}`,
      `Area: ${pkg.contact.region}`, `Town or ZIP: ${pkg.contact.location}`,
      `Address: ${pkg.contact.address || 'not given'}`, `Project: ${pkg.contact.project}`,
      '', pkg.contact.message || '', '', describe(pkg), '', 'Reference code:', code
    ].join('\n');
    location.href = 'mailto:jsinstallationsclosets@gmail.com?subject='
      + encodeURIComponent('Closet enquiry from the website')
      + '&body=' + encodeURIComponent(body);
    showCode(code, false);
    return;
  }

  msg.textContent = 'Sending…';
  try{
    const r = await fetch(f.action, { method:'POST', body:new FormData(f) });
    if(r.ok){
      msg.innerHTML = '<b>Thank you, that is with us.</b> We reply the same working day.';
      try{ localStorage.removeItem('js_quote'); }catch(e){}
      filed.then(ok => { if(ok) console.info('[contact] enquiry is in the office system'); });
      showCode(code, true);
      f.reset();
    } else {
      msg.innerHTML = 'Something went wrong at their end. Your reference code is below, and you can email or call it through.';
      showCode(code, false);
    }
  }catch(e){
    msg.innerHTML = 'Something went wrong. Your reference code is below, and you can email or call it through.';
    showCode(code, false);
  }
});
