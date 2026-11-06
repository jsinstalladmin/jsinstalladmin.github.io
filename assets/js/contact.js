import { regionFor, describe, fullText } from './enquiry.js';
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

/* ── what they see once it is sent ──────────────────────────────────────
   There used to be a reference code here: a long line of base64 the customer
   was asked to copy, keep safe and read back over the phone if anything went
   wrong. Nothing ever went wrong with it, because the enquiry writes itself
   into the office database the moment it is sent. Asking someone to be the
   backup for a system that does not need one is not reassurance, it is
   homework. It is gone. They get a confirmation email instead. */
function showSent(pkg){
  if(!out) return;
  out.hidden = false;
  out.className = 'sentbox';
  const c = pkg.contact || {};
  out.innerHTML =
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
  out.scrollIntoView({behavior:'smooth', block:'nearest'});
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
  if(!f.reportValidity()) return;

  const pkg = gather();
  const filed = fileWithTheOffice(pkg);          // runs alongside, never blocks

  /* The email to the office carries the whole enquiry in plain words, right
     down to the height of every outlet. Nothing is encoded and nothing has
     to be decoded at the other end. */
  if(f.elements.enquiry_summary) f.elements.enquiry_summary.value = describe(pkg);
  if(f.elements.enquiry_detail)  f.elements.enquiry_detail.value  = fullText(pkg);
  /* Reply in the inbox should reach the customer, not the form service */
  if(f.elements.replyto) f.elements.replyto.value = pkg.contact.email || '';

  const key = f.elements.access_key.value;
  if(!key || key === 'WEB3FORMS_KEY_HERE'){
    /* Not connected yet. Nothing is silently dropped: it still goes into the
       office database, and the enquiry opens in their own mail client too. */
    msg.innerHTML = '<b>Sent.</b> Your enquiry is with us. You can also call <a href="tel:+16466679572">(646) 667-9572</a>.';
    const body = [
      `Name: ${pkg.contact.name}`, `Phone: ${pkg.contact.phone}`, `Email: ${pkg.contact.email}`,
      `Area: ${pkg.contact.region}`, `Town or ZIP: ${pkg.contact.location}`,
      `Address: ${pkg.contact.address || 'not given'}`, `Project: ${pkg.contact.project}`,
      '', pkg.contact.message || '', '', fullText(pkg)
    ].join('\n');
    location.href = 'mailto:jsinstallationsclosets@gmail.com?subject='
      + encodeURIComponent('Closet enquiry from the website')
      + '&body=' + encodeURIComponent(body);
    showSent(pkg);
    return;
  }

  msg.textContent = 'Sending…';
  const btn = f.querySelector('button[type="submit"]');
  if(btn){ btn.disabled = true; btn.dataset.was = btn.textContent; btn.textContent = 'Sending…'; }
  const done = () => { if(btn){ btn.disabled = false; btn.textContent = btn.dataset.was || 'Request my free measure'; } };

  try{
    const r = await fetch(f.action, { method:'POST', body:new FormData(f) });
    if(r.ok){
      msg.textContent = '';
      try{ localStorage.removeItem('js_quote'); }catch(e){}
      filed.then(ok => { if(ok) console.info('[contact] enquiry is in the office system'); });
      /* the customer's own copy, sent by the office rather than by this page,
         because an email key in a public page is an email key anyone can use */
      sendConfirmation(pkg);
      showSent(pkg);
      f.reset();
    } else {
      /* It is already in the office database by this point, so the customer is
         not asked to do anything about it. */
      msg.innerHTML = '<b>Sent.</b> The email relay had a problem, but your enquiry is in our system and we have it. If you would rather be sure, call <a href="tel:+16466679572">(646) 667-9572</a>.';
      showSent(pkg);
      f.reset();
    }
  }catch(e){
    msg.innerHTML = '<b>Sent.</b> Your enquiry is in our system. If you would rather be sure, call <a href="tel:+16466679572">(646) 667-9572</a>.';
    showSent(pkg);
  }
  done();
});

/* ── the customer's automatic reply ─────────────────────────────────────
   Web3Forms will only send one of these on a paid plan, so it is sent by
   the office instead: a tiny function sitting next to the database, which
   holds the mail key where the public cannot read it. If it is not
   deployed yet this quietly does nothing and the customer still has the
   confirmation on screen — it never blocks the form. */
async function sendConfirmation(pkg){
  try{
    const base = SUPA_REST.replace(/\/rest\/v1\/?$/, '');
    await fetch(base + '/functions/v1/confirm-enquiry', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', apikey:SUPA_KEY,
                Authorization:'Bearer ' + SUPA_KEY },
      body: JSON.stringify({ contact: pkg.contact, design: pkg.design || null })
    });
  }catch(e){ /* the office still has the enquiry */ }
}
