/* ============================================================
   crew.js — renders one person's week from the link they tapped.

   There is no network call, no login and no database. The week is
   inside the link, so this page cannot write anything anywhere, which
   is exactly the point: a crew member can read their work and change
   nothing.
   ============================================================ */
import { unpackWeek, mapsHref, addDays } from '../assets/js/crewlink.js';

const app = document.getElementById('app');
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today = () => new Date().toISOString().slice(0,10);
const dayName = iso => new Date(iso+'T12:00').toLocaleDateString('en-US',{weekday:'long'});
const dayShort= iso => new Date(iso+'T12:00').toLocaleDateString('en-US',{weekday:'short'});
const dayNum  = iso => new Date(iso+'T12:00').getDate();
const fmtRange = (a,b) => {
  const o = {month:'short', day:'numeric'};
  return new Date(a+'T12:00').toLocaleDateString('en-US',o) + ' to ' +
         new Date(b+'T12:00').toLocaleDateString('en-US',{...o, year:'numeric'});
};

const ICON_PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/></svg>';
const ICON_TEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>';
const ICON_EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

function visit(v){
  const addr = (v.addr||'').trim();
  return `<article class="vis">
    <div class="vtop"><span class="kind ${esc(v.kind||'')}"><i></i>${esc(v.kind||'visit')}</span></div>
    <h3>${esc(v.title||'Visit')}</h3>
    <p class="who">${esc(v.client||'')}</p>
    ${addr ? `<span class="addr"><span class="lbl">Address</span>${esc(addr)}</span>` : ''}
    <div class="vrow">
      ${addr ? `<a class="vbtn go" href="${esc(mapsHref(addr))}" target="_blank" rel="noopener">${ICON_PIN}Navigate</a>` : ''}
      ${v.phone ? `<a class="vbtn" href="tel:${esc(String(v.phone).replace(/[^+\d]/g,''))}">${ICON_TEL}Call them</a>` : ''}
    </div>
    ${v.finish ? `<p class="vfin">Finish: <b>${esc(v.finish)}</b></p>` : ''}
    ${v.notes ? `<div class="vnote"><span class="lbl">Notes</span>${esc(v.notes)}</div>` : ''}
  </article>`;
}

function day(d, open){
  const n = d.items.length;
  /* The same household twice in one day is one name in the summary line. */
  const names = [...new Set(d.items.map(i=>i.client || i.title).filter(Boolean))];
  const sum = n ? names.join(', ') + (n>names.length ? ` · ${n} visits` : '') : 'Nothing booked';
  /* An empty day is one quiet line, not a card with a paragraph in it saying
     the same thing twice. Seven full-height empty cards buried the one day
     that mattered under a scroll. */
  return `<section class="day${d.date===today()?' today':''}${n?'':' none'}"${open&&n?' data-open=""':''}>
    <button class="dhd" type="button" data-day="${esc(d.date)}"${n?` aria-expanded="${open?'true':'false'}"`:' disabled'}>
      <span class="dnum"><b>${dayNum(d.date)}</b><i>${esc(dayShort(d.date))}</i></span>
      <span class="dmeta"><b>${esc(dayName(d.date))}${d.date===today()?' · today':''}</b><span>${esc(sum)}</span></span>
      ${n?'<span class="chev"></span>':''}
    </button>
    ${n ? `<div class="dbody">${d.items.map(visit).join('')}</div>` : ''}
  </section>`;
}

function render(wk){
  const total = wk.days.reduce((a,d)=>a+d.items.length,0);
  const busy  = wk.days.filter(d=>d.items.length).length;
  const todayHas = wk.days.find(d=>d.date===today() && d.items.length);
  const firstBusy = wk.days.find(d=>d.items.length);
  const openDate = (todayHas || firstBusy || {}).date;

  app.innerHTML = `
    <header class="hdr">
      <span class="eyebrow">${esc(wk.biz||'JS Installations & Closets')}</span>
      <h1>${esc(wk.crew||'Your week')}</h1>
      <p class="range">${esc(fmtRange(wk.start, addDays(wk.start,6)))}${wk.role?' · '+esc(wk.role):''}</p>
      <div class="tot">
        <span>Visits<b>${total}</b></span>
        <span>Days out<b>${busy}</b></span>
      </div>
      <span class="readonly">${ICON_EYE}View only. Nothing here can be changed.</span>
    </header>
    <div class="days">${wk.days.map(d=>day(d, d.date===openDate)).join('')}</div>
    <footer class="ftr">
      This is the week as it stood when the link was sent. If something has moved,
      ${wk.bizPhone ? `call the office on <a href="tel:${esc(String(wk.bizPhone).replace(/[^+\d]/g,''))}">${esc(wk.bizPhone)}</a>` : 'call the office'}.
      <br><br><b>Tap an address to navigate.</b> It opens Apple Maps on an iPhone and Google Maps on anything else.
    </footer>`;

  app.addEventListener('click', e => {
    const b = e.target.closest('.dhd'); if(!b) return;
    const sec = b.closest('.day');
    if(!sec.querySelector('.dbody')) return;          // nothing booked, nothing to open
    const open = sec.hasAttribute('data-open');
    if(open) sec.removeAttribute('data-open'); else sec.setAttribute('data-open','');
    b.setAttribute('aria-expanded', open ? 'false' : 'true');
  });
}

function fail(msg){
  app.innerHTML = `<div class="err"><h1>This link will not open</h1><p>${esc(msg)}</p>
    <p style="margin-top:.9em">Ask the office to send you a fresh one. The week travels inside the
    link, so an old or half-copied link cannot show anything.</p></div>`;
}

try{
  const code = location.hash.slice(1);
  if(!code) fail('There is nothing after the # in this address, so there is no week in it.');
  else render(unpackWeek(code));
}catch(e){ fail(e.message || 'The link is damaged.'); }

/* Pasting a new link into the same tab should repaint rather than need a reload. */
addEventListener('hashchange', () => {
  try{ render(unpackWeek(location.hash.slice(1))); }
  catch(e){ fail(e.message || 'The link is damaged.'); }
});
