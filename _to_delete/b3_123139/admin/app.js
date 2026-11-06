/* ============================================================
   app.js — the office.

   One screen per thing he actually does: what is on today, the leads
   that came in off the website, the calendar, the client list, the
   jobs, the quotes and the crew. Every one of them is filtered by the
   region button at the top, so clicking New Jersey changes the whole
   application to New Jersey and nothing else bleeds through.

   Everything is editable from here. Nothing needs a developer and
   nothing needs the assistant: every record has an add, an edit and a
   delete, and every change is written to storage the moment it is made.
   ============================================================ */
import { DB, REGIONS, STAGES, STAGE_LABEL, KINDS, ROLES } from './store.js';
import { quickPrice, MODULES, MODULE_IDS } from '../assets/js/design.js';
import { unpack, describe } from '../assets/js/enquiry.js';
import { packWeek, mondayOf, addDays } from '../assets/js/crewlink.js';

const cat = await (await fetch((window.BASE||"")+'assets/data/catalog.json')).json();
const $  = s => document.querySelector(s);
const money = n => '$'+Math.round(n||0).toLocaleString();
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today  = () => new Date().toISOString().slice(0,10);
const fmtD   = iso => new Date(iso+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
const fmtFull= iso => new Date(iso+'T12:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const initials = n => String(n||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();

export const refresh = () => render();

/* A page header is a box like everything else, so the top of every screen
   lines up with the panels under it instead of floating above them. */
const head = (title, sub, acts='') =>
  `<header class="panel head"><div><h1>${title}</h1><p>${sub}</p></div>
     ${acts?`<div class="hdacts">${acts}</div>`:''}</header>`;

const panel = (title, right, body, cls='') =>
  `<section class="panel ${cls}">
     ${title?`<header><h3>${title}</h3>${right?`<span>${right}</span>`:''}</header>`:''}
     ${body}</section>`;

const empty = msg => `<div class="empty">${msg}</div>`;
const scroll = t => `<div class="tscroll">${t}</div>`;

/* ═══════════════ REGION SWITCHER ═══════════════ */
function paintRegions(){
  const cur = DB.region();
  $('#regions').innerHTML = REGIONS.map(r=>{
    const n = DB.jobs(r.id).filter(j=>j.stage!=='done'&&j.stage!=='lost').length;
    return `<button data-r="${r.id}" aria-pressed="${r.id===cur}">
      <b>${r.short}</b><span>${r.name}</span>${n?`<i>${n}</i>`:''}</button>`;
  }).join('') + `<button data-r="all" aria-pressed="${cur==='all'}" class="allbtn">
      <b>ALL</b><span>Every region</span></button>`;
}
$('#regions').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  DB.setRegion(b.dataset.r); paintRegions(); render();
});

/* ═══════════════ SHARED ROW RENDERERS ═══════════════ */
const regionCell = x => DB.region()==='all'
  ? `<td><span class="rtag">${DB.regionMeta(x.region).short}</span></td>` : '';
const crewCell = j => {
  const names = (j.crewIds||[]).map(id=>DB.employee(id)).filter(Boolean);
  if(names.length) return `<span class="avs">${names.map(e=>
    `<i class="av" title="${esc(e.name)}">${esc(initials(e.name))}</i>`).join('')}</span>`;
  return j.crew ? `<span class="sub">${esc(j.crew)}</span>` : '<span class="sub">Unassigned</span>';
};
function jobRow(j, withDate){
  return `<tr data-job="${j.id}">
    ${withDate?`<td class="mono">${fmtD(j.date)}</td>`:''}
    <td>${esc(DB.clientName(j.client))}</td>
    <td><b>${esc(j.title)}</b></td>
    <td><span class="kdot k-${j.kind}"></span><span class="cap">${esc(j.kind)}</span></td>
    ${regionCell(j)}
    <td>${crewCell(j)}</td>
    <td><span class="pill p-${j.stage}">${STAGE_LABEL[j.stage]}</span></td>
    <td class="mono">${j.value?money(j.value):'&ndash;'}</td></tr>`;
}

/* ═══════════════ VIEWS ═══════════════ */
const V = {};

V.today = () => {
  const jobs = DB.jobs(), rm = DB.regionMeta();
  const live  = jobs.filter(j=>!['done','lost'].includes(j.stage));
  const td    = jobs.filter(j=>j.date===today());
  const next  = [...live].filter(j=>j.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,7);
  const month = jobs.filter(j=>j.stage==='done' && j.date.slice(0,7)===today().slice(0,7));
  const pipe  = jobs.filter(j=>['quoted','won','ordered','scheduled'].includes(j.stage));
  const leads = jobs.filter(j=>j.stage==='lead');
  const crew  = DB.employees().filter(e=>e.active!==false);
  const where = DB.region()==='all' ? 'across every region' : 'in '+rm.short;

  return head(
      DB.region()==='all' ? 'All regions' : rm.name,
      new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})
        + (DB.region()==='all' ? '' : ' · '+rm.base),
      `<button class="btn" data-act="newclient">+ Client</button>
       <button class="btn btn-p" data-act="newjob">+ Book a visit</button>`)

  + (td.length ? panel('On today', `${td.length} visit${td.length>1?'s':''}`,
      scroll(`<table><thead><tr><th>Client</th><th>Job</th><th>Visit</th>${DB.region()==='all'?'<th>Region</th>':''}<th>Crew</th><th>Stage</th><th class="mono">Value</th></tr></thead>
        <tbody>${td.map(j=>jobRow(j,false)).join('')}</tbody></table>`), 'accent') : '')

  + `<div class="cards">
      <div class="card"><span class="k">Pipeline</span><div class="v">${money(pipe.reduce((a,x)=>a+x.value,0))}</div><span class="d">${pipe.length} live jobs</span></div>
      <div class="card"><span class="k">Installed this month</span><div class="v">${money(month.reduce((a,x)=>a+x.value,0))}</div><span class="d">${month.length} completed</span></div>
      <div class="card"><span class="k">Waiting on a quote</span><div class="v">${leads.length}</div><span class="d">${leads.length?'Oldest '+fmtD([...leads].sort((a,b)=>a.date.localeCompare(b.date))[0].date):'All clear'}</span></div>
      <div class="card"><span class="k">Clients</span><div class="v">${DB.clients().length}</div><span class="d">${where}</span></div>
      <div class="card"><span class="k">Crew on the books</span><div class="v">${crew.length}</div><span class="d">${where}</span></div>
     </div>`

  + panel('Next up', '', next.length
      ? scroll(`<table><thead><tr><th>Date</th><th>Client</th><th>Job</th><th>Visit</th>${DB.region()==='all'?'<th>Region</th>':''}<th>Crew</th><th>Stage</th><th class="mono">Value</th></tr></thead>
          <tbody>${next.map(j=>jobRow(j,true)).join('')}</tbody></table>`)
      : empty('Nothing booked. Enjoy it.'))

  + panel('Pipeline by value', '', `<div class="bd">${(() => {
      const rows = STAGES.filter(s=>s!=='lost').map(s => {
        const it = jobs.filter(j=>j.stage===s);
        return { s, n:it.length, v:it.reduce((a,x)=>a+x.value,0) };
      });
      const peak = Math.max(1, ...rows.map(r=>r.v));
      return rows.map(r => `<div class="pipe"><span class="pill p-${r.s}">${STAGE_LABEL[r.s]}</span>
        <div class="bar"${r.v?'':' data-empty="1"'}><div style="width:${(r.v?Math.max(4,(r.v/peak)*100):0).toFixed(1)}%"></div></div>
        <span class="pn">${r.n} job${r.n===1?'':'s'} · ${money(r.v)}</span></div>`).join('');
    })()}</div>`);
};

/* ───────── schedule ───────── */
let calMonth = null;                       // null means "this month"
V.schedule = () => {
  const base = calMonth ? new Date(calMonth+'-01T12:00') : new Date();
  const y = base.getFullYear(), m = base.getMonth();
  const first = new Date(y,m,1), start = new Date(first); start.setDate(1-first.getDay());
  const jobs = DB.jobs();
  let cells = '';
  for(let i=0;i<42;i++){
    const dt = new Date(start); dt.setDate(start.getDate()+i);
    const iso = new Date(dt.getTime()-dt.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const ev = jobs.filter(j=>j.date===iso);
    cells += `<div class="day ${dt.getMonth()!==m?'out':''} ${iso===today()?'today':''}" data-date="${iso}">
      <span class="dnum">${dt.getDate()}</span>
      ${ev.map(e=>`<span class="ev ${e.kind}" data-job="${e.id}" title="${esc(DB.clientName(e.client))} · ${esc(e.title)}">${esc(DB.clientName(e.client).split(' ')[0])} · ${esc(e.title)}</span>`).join('')}
    </div>`;
  }
  const mo = jobs.filter(j=>j.date.slice(0,7) === `${y}-${String(m+1).padStart(2,'0')}`);
  return head(base.toLocaleDateString('en-US',{month:'long',year:'numeric'}),
      `${mo.length} booked${DB.region()==='all'?' across every region':' in '+DB.regionMeta().name} · ${money(mo.reduce((a,x)=>a+x.value,0))}`,
      `<button class="btn btn-sm" data-act="cal-prev">&larr;</button>
       <button class="btn btn-sm" data-act="cal-now">This month</button>
       <button class="btn btn-sm" data-act="cal-next">&rarr;</button>
       <button class="btn btn-p" data-act="newjob">+ Book a visit</button>`)
  + panel('', '', `<div class="bd">
      <div class="legend">${KINDS.map(k=>`<span><i class="k-${k}"></i>${k[0].toUpperCase()+k.slice(1)}</span>`).join('')}
        <span class="legend-hint">Click any day to book &middot; click a visit to edit</span></div>
      <div class="tscroll calscroll"><div class="cal">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="dow">${x}</div>`).join('')}${cells}</div></div>
    </div>`)
  + panel('Send the week to the crew', 'One link per person, read only',
      `<div class="bd"><div class="note">Pin a crew member's link in their WhatsApp chat. They tap it and see their own week: the day, the address, what is going in and your notes. They cannot change anything, and nobody else's work is in it.</div>
       <div class="btnrow">${DB.employees().filter(e=>e.active!==false).map(e=>
         `<button class="btn btn-sm" data-weeklink="${e.id}">${esc(e.name)}&rsquo;s week &rarr;</button>`).join('') || '<span class="sub">Add someone under Crew first.</span>'}</div></div>`);
};

/* ───────── clients ───────── */
V.clients = () => {
  const c = [...DB.clients()].sort((a,b)=>a.name.localeCompare(b.name));
  const rm = DB.regionMeta();
  return head('Clients',
      `${c.length}${DB.region()==='all'?' across every region':' in '+rm.name} · click any row to edit`,
      `<button class="btn btn-p" data-act="newclient">+ Add client</button>`)
  + panel('', '', c.length
    ? scroll(`<table><thead><tr><th>Name</th><th>Phone</th><th>Address</th>${DB.region()==='all'?'<th>Region</th>':''}<th>Source</th><th>Jobs</th><th>Last job done</th><th class="mono">Lifetime</th></tr></thead><tbody>
      ${c.map(x=>{
        const js = DB.jobs('all').filter(j=>j.client===x.id);
        const done = js.filter(j=>j.stage==='done').sort((a,b)=>b.date.localeCompare(a.date));
        return `<tr data-client="${x.id}">
          <td><b>${esc(x.name)}</b>${x.email?`<br><span class="sub">${esc(x.email)}</span>`:''}</td>
          <td class="mono">${esc(x.phone)||'&ndash;'}</td>
          <td class="addr">${x.addr?`<a href="#" data-map="${esc(x.addr)}">${esc(x.addr)}</a>`:'<span class="sub">No address yet</span>'}</td>
          ${regionCell(x)}
          <td><span class="pill muted">${esc(x.source||'—')}</span></td>
          <td>${js.length}</td>
          <td class="mono">${done.length?fmtFull(done[0].date):'<span class="sub">&ndash;</span>'}</td>
          <td class="mono">${money(js.filter(j=>j.stage==='done').reduce((a,j)=>a+j.value,0))}</td></tr>`;
      }).join('')}</tbody></table>`)
    : empty('No clients in this region yet. Add the first one with the button above.'));
};

/* ───────── jobs ───────── */
V.jobs = () => {
  const all = [...DB.jobs()].sort((a,b)=>b.date.localeCompare(a.date));
  const upcoming = all.filter(j=>j.date>=today() && !['done','lost'].includes(j.stage))
                      .sort((a,b)=>a.date.localeCompare(b.date));
  const pastIds = new Set(upcoming.map(j=>j.id));
  const rest = all.filter(j=>!pastIds.has(j.id));
  const tbl = list => scroll(`<table><thead><tr><th>Date</th><th>Client</th><th>Job</th><th>Visit</th>${DB.region()==='all'?'<th>Region</th>':''}<th>Crew</th><th>Stage</th><th class="mono">Value</th></tr></thead>
    <tbody>${list.map(j=>jobRow(j,true)).join('')}</tbody></table>`);
  return head('Jobs',
      `${all.length} on file · ${money(all.filter(x=>x.stage!=='lost').reduce((a,x)=>a+x.value,0))} booked · click any row to edit`,
      `<button class="btn btn-p" data-act="newjob">+ New job</button>`)
  + panel('Coming up', `${upcoming.length} scheduled`, upcoming.length ? tbl(upcoming) : empty('Nothing booked ahead.'), upcoming.length?'accent':'')
  + panel('Everything else', `${rest.length}`, rest.length ? tbl(rest) : empty('Nothing here yet.'));
};

/* ───────── quotes ───────── */
V.quotes = () => {
  const q = [...DB.quotes()].sort((a,b)=>b.created.localeCompare(a.created));
  return head('Quotes',
      `${q.length} on file · ${money(q.filter(x=>x.status==='sent').reduce((a,x)=>a+x.total,0))} awaiting a reply · click any row to open it`,
      `<button class="btn btn-p" data-act="newquote">+ New quote</button>`)
  + panel('', '', q.length
    ? scroll(`<table><thead><tr><th>Date</th><th>Client</th><th>Quote</th>${DB.region()==='all'?'<th>Region</th>':''}<th>Status</th><th class="mono">Total</th></tr></thead><tbody>
      ${q.map(x=>`<tr data-quote="${x.id}"><td class="mono">${fmtD(x.created)}</td>
        <td>${esc(DB.clientName(x.client))}</td>
        <td><b>${esc(x.title)}</b>${x.summary?`<br><span class="sub">${esc(x.summary)}</span>`:''}
            ${x.design?'<span class="tagdot">from the 3D builder</span>':''}</td>
        ${regionCell(x)}
        <td><span class="pill ${x.status==='accepted'?'p-won':x.status==='sent'?'p-quoted':'p-lead'} cap">${esc(x.status)}</span></td>
        <td class="mono">${money(x.total)}</td></tr>`).join('')}
    </tbody></table>`)
    : empty('No quotes in this region yet.'))

  + panel('Price a closet', 'Same engine as the website builder', `<div class="bd">
      <div class="f3">
        <div class="f"><label>Wall width (in)</label><input id="pw" type="number" value="120"></div>
        <div class="f"><label>Depth (in)</label><input id="pd" type="number" value="24"></div>
        <div class="f"><label>What&rsquo;s in it</label><select id="pl">${MODULE_IDS.map(k=>`<option value="${k}">${MODULES[k].label}</option>`).join('')}</select></div>
      </div>
      <div class="f"><label>Finish</label><select id="pf">${cat.finishes.map(f=>`<option value="${esc(f.n)}">${esc(f.n)} · Level ${f.lv} · $${f.sq.toFixed(2)}/sq ft</option>`).join('')}</select></div>
      <div class="btnrow"><button class="btn btn-p" id="pgo">Calculate</button></div>
      <div id="pout"></div></div>`);
};

/* ───────── crew ───────── */
V.crew = () => {
  const es = DB.employees();
  const rm = DB.regionMeta();
  const card = e => {
    const jobs = DB.jobs('all').filter(j=>(j.crewIds||[]).includes(e.id));
    const ahead = jobs.filter(j=>j.date>=today() && !['done','lost'].includes(j.stage)).length;
    const doneM = jobs.filter(j=>j.stage==='done' && j.date.slice(0,7)===today().slice(0,7)).length;
    return `<article class="crewcard${e.active===false?' off':''}" data-emp="${e.id}">
      <span class="av lg">${esc(initials(e.name))}</span>
      <div class="ct">
        <b>${esc(e.name)}</b>
        <span class="sub">${esc(e.role||'Installer')}${DB.region()==='all'?' · '+DB.regionMeta(e.region).short:''}</span>
        ${e.phone?`<a class="sub lnk" href="tel:${esc(e.phone.replace(/[^+\d]/g,''))}" data-stop="1">${esc(e.phone)}</a>`:''}
      </div>
      <div class="cstat"><span><b>${ahead}</b>booked</span><span><b>${doneM}</b>this month</span></div>
      ${e.active===false?'<span class="pill p-lost offtag">Not active</span>':''}
      <div class="cacts">
        <button class="btn btn-sm" data-weeklink="${e.id}" data-stop="1">Week link</button>
        <button class="btn btn-sm" data-emp-edit="${e.id}" data-stop="1">Edit</button>
      </div>
    </article>`;
  };
  return head('Crew',
      `${es.length} on the books${DB.region()==='all'?' across every region':' in '+rm.name}`,
      `<button class="btn btn-p" data-act="newemp">+ Add someone</button>`)
  + panel('', '', es.length
      ? `<div class="bd"><div class="crewgrid">${es.map(card).join('')}</div></div>`
      : empty('Nobody on the books in this region yet.'))
  + panel('What the week link does', '', `<div class="bd"><div class="note">
      Every person gets their own link. Pin it once in their WhatsApp chat and it opens their week:
      which day, whose house, the address as a tap-to-navigate button, what is going in and your notes.
      It is read only. They cannot move a visit, change a price or see anyone else's work.
      <br><br><b>Regenerate the link when the week changes</b>, because the week travels inside the link itself.
      That is what lets it work with no login and no app.</div></div>`);
};

/* ═══════════════ INBOX ═══════════════
   The website is static, so a lead cannot be written straight into this
   browser from a customer's one. It arrives as an email carrying a reference
   code. Paste the code here and the client, the job and the quote are created
   in the right region with the whole parts list attached. */
let INBOX_DRAFT = null;

V.inbox = () => {
  const asEnq = l => ({ ...l, regionId: l.region_id });
  const fresh = DB.newLeads().map(asEnq)
    .filter(l => DB.region()==='all' || !l.regionId || l.regionId===DB.region());
  const filed = DB.enquiries().map(asEnq)
    .filter(l => DB.region()==='all' || l.regionId===DB.region());
  const when = l => fmtD((l.created||today()).slice(0,10));

  return head('Incoming leads',
      `${fresh.length} waiting${fresh.length?'':' — all clear'} · ${filed.length} filed${DB.region()==='all'?' across every region':' in '+DB.regionMeta().name}`,
      `<button class="btn btn-sm" data-act="inbox-sync">Check for new ones</button>`)

  + panel('Waiting on you', fresh.length ? `${fresh.length} new` : '', fresh.length
      ? scroll(`<table><thead><tr><th>Came in</th><th>Customer</th><th>What they drew</th><th class="mono">Estimate</th><th></th></tr></thead><tbody>
        ${fresh.map(l=>`<tr>
          <td class="mono">${when(l)}</td>
          <td><b>${esc(l.contact?.name||'Unknown')}</b><br><span class="sub">${esc(l.contact?.phone||'')} ${esc(l.contact?.email||'')}</span></td>
          <td class="sub">${esc(describe(l))}<br><span class="sub">${esc([l.contact?.address,l.contact?.location].filter(Boolean).join(', '))}</span></td>
          <td class="mono">${money(l.design?.price||0)}</td>
          <td class="rowact"><button class="btn btn-p btn-sm" data-leadopen="${esc(l.id)}" data-stop="1">Open it</button></td></tr>`).join('')}
      </tbody></table>`)
      : empty('Nothing waiting. New enquiries from the website land here by themselves.'),
      fresh.length ? 'accent' : '')

  + panel('Filed', `${filed.length}`, filed.length
      ? scroll(`<table><thead><tr><th>Came in</th><th>Customer</th><th>What they drew</th>${DB.region()==='all'?'<th>Region</th>':''}<th class="mono">Estimate</th><th></th></tr></thead><tbody>
        ${filed.map(l=>`<tr>
          <td class="mono">${when(l)}</td>
          <td><b>${esc(l.contact?.name||'Unknown')}</b><br><span class="sub">${esc(l.contact?.phone||'')}</span></td>
          <td class="sub">${esc(describe(l))}</td>
          ${DB.region()==='all'?`<td><span class="rtag">${esc((l.regionId||'').toUpperCase()||'—')}</span></td>`:''}
          <td class="mono">${money(l.design?.price||0)}</td>
          <td class="rowact">${l.client_id?`<button class="btn btn-sm" data-lead-open="${esc(l.client_id)}" data-stop="1">Open client</button>`:''}</td></tr>`).join('')}
      </tbody></table>`)
      : empty('Nothing filed yet.'))

  + panel('Paste a reference code', 'Only needed if an enquiry arrived by email alone', `<div class="bd">
      <div class="f"><label>Reference code</label>
        <textarea id="inbox-code" rows="3" placeholder="JSC1...."></textarea></div>
      <div class="btnrow">
        <button class="btn btn-p" data-act="inbox-read">Read it</button>
        <button class="btn" data-act="inbox-clear">Clear</button>
      </div>
      <div id="inbox-out"></div></div>`)

  + panel('How a lead gets here', '', `<div class="bd"><div class="note">
      <b>1.</b> The customer draws their closet at <b>/design/</b>, presses &ldquo;Send this to us&rdquo;, then fills in their name, phone, email, town and address.<br><br>
      <b>2.</b> It is written straight into this Inbox the moment they press send, and you also get an email. Nothing to copy, nothing to paste.<br><br>
      <b>3.</b> You press <b>Open it</b>, check it, and file it. The client, a measure visit and a draft quote are created in the region the ZIP belongs to, with the whole parts list on the quote.</div></div>`);
};

function inboxPreview(e){
  const d = e.design;
  const rm = REGIONS.find(r=>r.id===e.regionId);
  const parts = (d?.order||[]).reduce((a,o)=>a+(+o.qty||0),0);
  const existing = DB.findClient(e.contact.name);
  return `<div class="note ok"><b>Read it.</b> ${esc(describe(e))}</div>
    <table class="kv"><tbody>
      <tr><th>Name</th><td>${esc(e.contact.name||'—')}</td></tr>
      <tr><th>Phone</th><td>${esc(e.contact.phone||'—')}</td></tr>
      <tr><th>Email</th><td>${esc(e.contact.email||'—')}</td></tr>
      <tr><th>Where</th><td>${esc([e.contact.address,e.contact.location].filter(Boolean).join(', ')||'—')}</td></tr>
      <tr><th>Region</th><td>${rm ? esc(rm.name) : '<b>Could not work it out from the ZIP. Pick one below.</b>'}</td></tr>
      <tr><th>Project</th><td>${esc(e.contact.project||'—')}</td></tr>
      ${d?`<tr><th>Room</th><td>${d.room.w}" × ${d.room.d}" × ${d.room.h}" · ${esc(d.mounting||'')}</td></tr>
      <tr><th>Sections</th><td>${(d.bays||[]).length}, ${parts} parts and pieces</td></tr>
      <tr><th>Finish</th><td>${esc(d.finish)}${d.frontFinish&&d.frontFinish!==d.finish?' carcass · '+esc(d.frontFinish)+' fronts':''}</td></tr>
      <tr><th>Hardware</th><td>${esc(d.pull||'—')} in ${esc(d.pullFinish||'—')}</td></tr>
      <tr><th>Doors</th><td>${esc(d.door||'—')}</td></tr>
      ${(d.fittings||[]).length?`<tr><th>On the walls</th><td>${d.fittings.map(f=>esc(f.item)+(f.note?' ('+esc(f.note)+')':'')).join(', ')}</td></tr>`:''}
      <tr><th>Estimate</th><td class="mono">${money(d.price)}</td></tr>
      ${(d.warnings||[]).length?`<tr><th>Flags</th><td>${d.warnings.map(esc).join(' ')}</td></tr>`:''}`:''}
      ${e.contact.message?`<tr><th>They said</th><td>${esc(e.contact.message)}</td></tr>`:''}
    </tbody></table>
    ${existing?`<div class="note warn">There is already a client called <b>${esc(existing.name)}</b> in ${esc(DB.regionMeta(existing.region).name)}. Filing this adds the job to them rather than making a second record.</div>`:''}
    <div class="f"><label>File it in</label><select id="inbox-region">
      ${REGIONS.map(r=>`<option value="${r.id}"${r.id===(e.regionId||DB.region())?' selected':''}>${esc(r.name)}</option>`).join('')}
    </select></div>
    <div class="btnrow"><button class="btn btn-p" data-act="inbox-file">File it: client, measure visit and a draft quote</button></div>`;
}

function inboxFile(){
  const e = INBOX_DRAFT; if(!e) return;
  const region = $('#inbox-region')?.value || DB.region();
  const d = e.design;
  let client = DB.findClient(e.contact.name);
  if(!client){
    client = DB.addClient({ region, name:e.contact.name || 'Website enquiry',
      phone:e.contact.phone||'', email:e.contact.email||'',
      addr:[e.contact.address, e.contact.location].filter(Boolean).join(', '),
      source: e.source || 'Website', notes: e.contact.message || '' });
  } else {
    DB.updateClient(client.id, {
      phone: client.phone || e.contact.phone || '',
      email: client.email || e.contact.email || '',
      addr:  client.addr  || [e.contact.address, e.contact.location].filter(Boolean).join(', ') });
  }
  const title = d ? `${d.typeLabel || e.contact.project || 'Closet'} from the 3D builder`
                  : (e.contact.project || 'Website enquiry');
  const job = DB.addJob({ region, client:client.id, title,
    type: d?.typeLabel || e.contact.project || 'Walk-In Closets',
    stage:'lead', value:0, date:today(), kind:'measure',
    finish: d?.finish || 'n/a', crew:'', crewIds:[],
    notes:[describe(e), e.contact.message].filter(Boolean).join(' — ') });
  let quote = null;
  if(d) quote = DB.addQuote({ region, client:client.id, title, total:Math.round(d.price||0),
      status:'draft', summary:d.summary, design:d });
  /* A lead that came from the website is already a row; it just gets marked
     handled. One that was pasted in from an email has to be created. */
  if(e.id && DB.lead(e.id)) DB.markLeadHandled(e.id, client.id, region);
  else DB.addEnquiry({ ...e, regionId:region, clientId:client.id });
  INBOX_DRAFT = null;
  render();
  toast(`Filed. ${client.name} is in ${REGIONS.find(r=>r.id===region).name}, with a measure visit today${quote?' and a draft quote of '+money(quote.total):''}.`);
}

/* ───────── settings ───────── */
V.settings = () => {
  const s = DB.settings();
  return head('Settings', 'Keys and business details. Everything here stays in this browser.', '')
  + panel('Claude assistant', '', `<div class="bd">
      <div class="note warn"><b>Your own Anthropic key goes here.</b> The assistant calls Anthropic directly from this browser and is billed to your account. The key never leaves this machine and never touches anyone's server. Get one at <b>console.anthropic.com → API Keys</b>. There is nothing to set up anywhere else: this site is static hosting, so there are no environment variables to fill in.</div>
      <div class="f"><label>Anthropic API key</label><input id="s-key" type="password" placeholder="sk-ant-..." value="${esc(s.anthropicKey)}"></div>
      <div class="f"><label>Model</label><select id="s-model">
        ${['claude-sonnet-4-6','claude-opus-4-1','claude-haiku-4-5'].map(m=>`<option${m===s.model?' selected':''}>${m}</option>`).join('')}</select></div>
      <div class="btnrow"><button class="btn btn-p" data-act="savekey">Save key</button>
        <span id="keymsg" class="inline-msg"></span></div></div>`)

  + panel('Business', '', `<div class="bd">
      <div class="f2"><div class="f"><label>Business name</label><input id="s-biz" value="${esc(s.business)}"></div>
        <div class="f"><label>Phone</label><input id="s-phone" value="${esc(s.phone)}"></div></div>
      <div class="f2"><div class="f"><label>Email</label><input id="s-email" value="${esc(s.email)}"></div>
        <div class="f"><label>Markup multiplier</label><input id="s-markup" type="number" step="0.1" value="${s.markup}"></div></div>
      <div class="btnrow"><button class="btn btn-p" data-act="savebiz">Save</button></div></div>`)

  + panel('Still to connect', 'Three accounts, all free to start', `<div class="bd">
      <div class="f"><label>Web3Forms key, for the website contact form</label><input id="s-w3f" placeholder="Free at web3forms.com" value="${esc(s.web3forms)}"></div>
      <div class="f"><label>Resend API key, for sending quotes from your own address</label><input id="s-resend" type="password" placeholder="re_..." value="${esc(s.resendKey)}"></div>
      <div class="f"><label>Google Maps embed URL, for the contact page</label><input id="s-map" placeholder="Maps → Share → Embed a map → copy the src" value="${esc(s.mapsEmbed)}"></div>
      <div class="btnrow"><button class="btn btn-p" data-act="savebiz">Save</button></div></div>`)

  + panel('Your data', 'Stored in your own Postgres database', `<div class="bd">
      <div class="note ok">Everything you add is written to the database the moment you save it. It is the same on every computer and phone you sign in from, it survives clearing your browsing data, and <b>there is nothing you need to remember to back up</b>. It is removed only when you delete it.</div>
      <div class="f2">
        <div class="f"><label>Where it lives</label><input value="dbcumsbssqjuowioaqqj.supabase.co" readonly></div>
        <div class="f"><label>Signed in as</label><input id="s-who" value="" readonly></div>
      </div>
      <div class="btnrow">
        <button class="btn" data-act="export">Download a copy anyway</button>
        <button class="btn" data-act="refresh">Reload from the database</button>
      </div>
    </div>`)

  + migratePanel();
};

/* Anything still sitting in this browser from before the database existed is
   offered as a one-time move, with the real counts so he can check it after. */
function migratePanel(){
  const old = DB.localBackup();
  if(!old) return '';
  const c=(old.clients||[]).length, j=(old.jobs||[]).length,
        q=(old.quotes||[]).length, e=(old.employees||[]).length;
  const n = c+j+q+e;
  if(!n) return '';
  return panel('Move your old records up', 'One time only', `<div class="bd">
    <div class="note warn">This browser still has <b>${n} record${n===1?'':'s'}</b> saved from before the database existed: ${c} client${c===1?'':'s'}, ${j} job${j===1?'':'s'}, ${q} quote${q===1?'':'s'}, ${e} crew. Press the button and they are copied into the database, with every job and quote reconnected to the right client. Nothing in this browser is deleted, so it is safe to run and safe to check afterwards.</div>
    <div class="btnrow"><button class="btn btn-p" data-act="migrate">Copy them into the database</button></div>
    <div id="migmsg"></div></div>`);
}

/* ═══════════════ ROUTER ═══════════════ */
let view = 'today';
function render(){
  $('#main').innerHTML = V[view]();
  document.querySelectorAll('.nvi').forEach(b=>b.toggleAttribute('aria-current', b.dataset.v===view));
  $('#main').scrollTop = 0;
  paintRegions();
  if(view==='quotes') wireCalc();
  const who = $('#s-who'); if(who) who.value = document.getElementById('whoami')?.textContent || '';
}

document.addEventListener('click', e => {
  const stop = e.target.closest('[data-stop]');
  const nav = e.target.closest('[data-v],[data-nav]');
  if(nav){ view = nav.dataset.v || nav.dataset.nav; render(); return; }

  const map = e.target.closest('[data-map]');
  if(map){ e.preventDefault(); e.stopPropagation(); openMaps(map.dataset.map); return; }

  const wl = e.target.closest('[data-weeklink]');
  if(wl){ e.stopPropagation(); return openWeekLink(wl.dataset.weeklink); }

  const ee = e.target.closest('[data-emp-edit]');
  if(ee){ e.stopPropagation(); return openEmployee(ee.dataset.empEdit); }

  const lop = e.target.closest('[data-leadopen]');
  if(lop){ e.stopPropagation();
    const l = DB.lead(lop.dataset.leadopen);
    if(l){ INBOX_DRAFT = { ...l, regionId:l.region_id }; view='inbox'; render();
           const out=$('#inbox-out'); if(out){ out.innerHTML = inboxPreview(INBOX_DRAFT);
             out.scrollIntoView({behavior:'smooth',block:'nearest'}); } }
    return; }

  const lo = e.target.closest('[data-lead-open]');
  if(lo){ e.stopPropagation(); return lo.dataset.leadOpen ? openClient(lo.dataset.leadOpen) : null; }

  const act = e.target.closest('[data-act]'); if(act) return doAct(act.dataset.act);

  if(stop) return;                                   // a control inside a row

  const emp = e.target.closest('[data-emp]');  if(emp) return openEmployee(emp.dataset.emp);
  const job = e.target.closest('[data-job]');  if(job){ e.stopPropagation(); return openJob(job.dataset.job); }
  const qr  = e.target.closest('[data-quote]');if(qr)  return openQuote(qr.dataset.quote);
  const cl  = e.target.closest('[data-client]');if(cl) return openClient(cl.dataset.client);
  const day = e.target.closest('.day');        if(day) return openDay(day.dataset.date);
});

function doAct(a){
  if(a==='inbox-read'){
    const out = $('#inbox-out');
    try{ INBOX_DRAFT = unpack($('#inbox-code').value); out.innerHTML = inboxPreview(INBOX_DRAFT); }
    catch(err){ INBOX_DRAFT = null;
      out.innerHTML = `<div class="note warn"><b>${esc(err.message)}</b> Paste the whole line, starting with JSC1. It is at the bottom of the enquiry email.</div>`; }
    return;
  }
  if(a==='inbox-clear'){ INBOX_DRAFT=null; $('#inbox-code').value=''; $('#inbox-out').innerHTML=''; return; }
  if(a==='inbox-sync'){
    toast('Checking…');
    DB.refresh().then(()=>{ render(); toast('Up to date.'); })
      .catch(err=>toast('Could not reach the database: '+err.message, true));
    return;
  }
  if(a==='inbox-file')  return inboxFile();
  if(a==='newclient')   return openClient(null);
  if(a==='newjob')      return openJob(null);
  if(a==='newemp')      return openEmployee(null);
  if(a==='newquote')    return openQuote(null);
  if(a==='cal-prev' || a==='cal-next'){
    const base = calMonth ? new Date(calMonth+'-01T12:00') : new Date();
    base.setDate(1); base.setMonth(base.getMonth() + (a==='cal-next'?1:-1));
    calMonth = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`;
    render(); return;
  }
  if(a==='cal-now'){ calMonth = null; render(); return; }
  if(a==='savekey'){
    DB.setSettings({anthropicKey:$('#s-key').value.trim(), model:$('#s-model').value});
    $('#keymsg').textContent = 'Saved. The assistant is live.';
    document.querySelector('.agent .dot')?.classList.toggle('on', !!$('#s-key').value.trim());
    return;
  }
  if(a==='savebiz'){
    DB.setSettings({business:$('#s-biz')?.value, phone:$('#s-phone')?.value, email:$('#s-email')?.value,
      markup:+($('#s-markup')?.value||2.8), web3forms:$('#s-w3f')?.value,
      resendKey:$('#s-resend')?.value, mapsEmbed:$('#s-map')?.value});
    render(); toast('Saved.'); return;
  }
  if(a==='refresh'){
    toast('Reloading…');
    DB.refresh().then(()=>{ render(); toast('Up to date.'); })
      .catch(err=>toast('Could not reach the database: '+err.message, true));
    return;
  }
  if(a==='migrate'){
    const old = DB.localBackup();
    if(!old) return toast('Nothing to move.', true);
    const box = $('#migmsg');
    if(box) box.innerHTML = '<div class="note">Copying…</div>';
    DB.importLocal(old).then(c => {
      render();
      toast(`Moved up: ${c.clients} clients, ${c.employees} crew, ${c.jobs} jobs, ${c.quotes} quotes.`);
    }).catch(err => {
      if(box) box.innerHTML = `<div class="note warn"><b>It stopped part way.</b> ${esc(err.message||err)} Anything already copied is in the database; press it again and the rest will follow, but check for duplicates first.</div>`;
    });
    return;
  }
  if(a==='export'){
    const b=new Blob([DB.export()],{type:'application/json'});
    const u=URL.createObjectURL(b), l=document.createElement('a');
    l.href=u; l.download=`js-closets-backup-${today()}.json`; l.click();
    setTimeout(()=>URL.revokeObjectURL(u),2000); return;
  }
}

/* ═══════════════ SMALL UI ═══════════════ */
let toastT = null;
function toast(msg, bad){
  let el = $('#toast');
  if(!el){ el = document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.className = bad ? 'bad show' : 'show';
  el.textContent = msg;
  clearTimeout(toastT);
  toastT = setTimeout(()=>el.classList.remove('show'), 4200);
}
/* iPhone opens Apple Maps, everything else Google Maps. */
function openMaps(addr){
  const q = encodeURIComponent(addr||'');
  const apple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
  window.open(apple?`https://maps.apple.com/?q=${q}`:`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank','noopener');
}

/* ═══════════════ MODALS ═══════════════ */
const dlg = $('#dlg');
const close = () => dlg.close();
const wireCancel = () => dlg.querySelector('[value=cancel]')?.addEventListener('click', close);

function openClient(id){
  const c = id ? DB.client(id) : null;
  const load = c ? DB.clientLoad(c.id) : {jobs:0,quotes:0};
  const jobs = c ? DB.jobs('all').filter(j=>j.client===c.id).sort((a,b)=>b.date.localeCompare(a.date)) : [];
  dlg.innerHTML = `<h2>${c?esc(c.name):'New client'}</h2>
   ${c?`<p class="sub dlgsub">${load.jobs} job${load.jobs===1?'':'s'} · ${load.quotes} quote${load.quotes===1?'':'s'} · in ${esc(DB.regionMeta(c.region).name)}</p>`:''}
   <div class="f"><label>Name</label><input id="m-n" value="${esc(c?.name||'')}" placeholder="Who the invoice goes to"></div>
   <div class="f2"><div class="f"><label>Phone</label><input id="m-p" value="${esc(c?.phone||'')}"></div>
     <div class="f"><label>Email</label><input id="m-e" type="email" value="${esc(c?.email||'')}"></div></div>
   <div class="f"><label>Address</label><input id="m-a" value="${esc(c?.addr||'')}" placeholder="Street, town, state, ZIP"></div>
   <div class="f2"><div class="f"><label>Region</label><select id="m-r">${REGIONS.map(r=>`<option value="${r.id}"${(c?.region||DB.region())===r.id?' selected':''}>${esc(r.name)}</option>`).join('')}</select></div>
     <div class="f"><label>Source</label><select id="m-s">${['Website','Referral','Google','Houzz','Trade','Walk-in','Assistant'].map(x=>`<option${c?.source===x?' selected':''}>${x}</option>`).join('')}</select></div></div>
   <div class="f"><label>Notes</label><textarea id="m-no" rows="2">${esc(c?.notes||'')}</textarea></div>
   ${jobs.length?`<div class="dlglist"><label>Their jobs</label>${jobs.slice(0,6).map(j=>
      `<div class="dlrow"><span class="mono">${fmtD(j.date)}</span><b>${esc(j.title)}</b>
        <span class="pill p-${j.stage}">${STAGE_LABEL[j.stage]}</span><span class="mono">${j.value?money(j.value):'—'}</span></div>`).join('')}</div>`:''}
   <div class="dlgacts">${c?'<button class="btn danger" id="m-del">Delete</button>':''}
     <button class="btn" value="cancel">Cancel</button>
     <button class="btn btn-p" id="m-ok">${c?'Save changes':'Add client'}</button></div>`;
  dlg.showModal(); wireCancel();
  $('#m-del')?.addEventListener('click',()=>{
    const msg = load.jobs||load.quotes
      ? `Delete ${c.name}? This also deletes ${load.jobs} job${load.jobs===1?'':'s'} and ${load.quotes} quote${load.quotes===1?'':'s'}. It cannot be undone.`
      : `Delete ${c.name}? It cannot be undone.`;
    if(confirm(msg)){ DB.removeClient(c.id); close(); render(); toast('Client deleted.'); }
  });
  $('#m-ok').onclick = () => {
    const name = $('#m-n').value.trim();
    if(!name){ $('#m-n').focus(); toast('A client needs a name.', true); return; }
    const p = {name, phone:$('#m-p').value, email:$('#m-e').value, addr:$('#m-a').value,
               region:$('#m-r').value, source:$('#m-s').value, notes:$('#m-no').value};
    c ? DB.updateClient(c.id,p) : DB.addClient(p);
    close(); render(); toast(c?'Saved.':'Client added.');
  };
}

function openJob(id, presetDate){
  const j  = id ? DB.job(id) : null;
  const cs = DB.clients('all').sort((a,b)=>a.name.localeCompare(b.name));
  if(!cs.length){ toast('Add a client first, then book them a visit.', true); return openClient(null); }
  const crewPool = DB.employees('all').filter(e=>e.active!==false);
  const picked = new Set(j?.crewIds||[]);
  dlg.innerHTML = `<h2>${j?'Visit':'New visit'}</h2>
   <div class="f"><label>Client</label><select id="m-c">${cs.map(c=>`<option value="${c.id}"${j&&j.client===c.id?' selected':''}>${esc(c.name)} · ${DB.regionMeta(c.region).short}</option>`).join('')}</select></div>
   <div class="f"><label>Job title</label><input id="m-t" value="${esc(j?.title||'')}" placeholder="e.g. Primary walk-in"></div>
   <div class="f2"><div class="f"><label>Date</label><input id="m-d" type="date" value="${j?.date||presetDate||today()}"></div>
     <div class="f"><label>Visit type</label><select id="m-k">${KINDS.map(k=>`<option${j&&j.kind===k?' selected':''}>${k}</option>`).join('')}</select></div></div>
   <div class="f2"><div class="f"><label>Stage</label><select id="m-st">${STAGES.map(s=>`<option value="${s}"${j&&j.stage===s?' selected':''}>${STAGE_LABEL[s]}</option>`).join('')}</select></div>
     <div class="f"><label>Value ($)</label><input id="m-v" type="number" value="${j?.value||0}"></div></div>
   <div class="f"><label>Who is going</label>
     <div class="chk">${crewPool.length?crewPool.map(e=>
       `<label class="ck"><input type="checkbox" data-crew="${e.id}"${picked.has(e.id)?' checked':''}>
          <span>${esc(e.name)} <i>${esc(DB.regionMeta(e.region).short)}</i></span></label>`).join('')
       :'<span class="sub">Nobody on the books yet. Add the crew under Crew.</span>'}</div></div>
   <div class="f"><label>Finish</label><input id="m-fi" value="${esc(j?.finish||'')}" placeholder="Decor name, or n/a"></div>
   <div class="f"><label>Notes for the crew</label><textarea id="m-no" rows="3" placeholder="Access, parking, what to bring, what is in the way">${esc(j?.notes||'')}</textarea></div>
   <div class="dlgacts">${j?'<button class="btn danger" id="m-del">Delete</button>':''}
     <button class="btn" value="cancel">Cancel</button>
     <button class="btn btn-p" id="m-ok">${j?'Save changes':'Book it'}</button></div>`;
  dlg.showModal(); wireCancel();
  $('#m-del')?.addEventListener('click',()=>{
    if(confirm('Delete this visit? It cannot be undone.')){ DB.removeJob(j.id); close(); render(); toast('Visit deleted.'); }});
  $('#m-ok').onclick = () => {
    const cl = DB.client($('#m-c').value);
    const crewIds = [...dlg.querySelectorAll('[data-crew]:checked')].map(b=>b.dataset.crew);
    const p = { client:$('#m-c').value, region: cl?cl.region:DB.region(),
      title:$('#m-t').value.trim()||'Untitled', date:$('#m-d').value, kind:$('#m-k').value,
      stage:$('#m-st').value, value:+$('#m-v').value, crewIds,
      crew: crewIds.map(id=>DB.employeeName(id)).filter(Boolean).join(' + '),
      finish:$('#m-fi').value||'n/a', notes:$('#m-no').value };
    j ? DB.updateJob(j.id,p) : DB.addJob({...p, type:p.title});
    close(); render(); toast(j?'Saved.':'Booked.');
  };
}

function openEmployee(id){
  const e = id ? DB.employee(id) : null;
  const jobs = e ? DB.jobs('all').filter(j=>(j.crewIds||[]).includes(e.id))
                     .sort((a,b)=>b.date.localeCompare(a.date)) : [];
  dlg.innerHTML = `<h2>${e?esc(e.name):'Add someone to the crew'}</h2>
   <div class="f"><label>Name</label><input id="m-n" value="${esc(e?.name||'')}"></div>
   <div class="f2"><div class="f"><label>Role</label><select id="m-ro">${ROLES.map(r=>`<option${e?.role===r?' selected':''}>${r}</option>`).join('')}</select></div>
     <div class="f"><label>Region</label><select id="m-r">${REGIONS.map(r=>`<option value="${r.id}"${(e?.region||DB.region())===r.id?' selected':''}>${esc(r.name)}</option>`).join('')}</select></div></div>
   <div class="f2"><div class="f"><label>Phone</label><input id="m-p" value="${esc(e?.phone||'')}"></div>
     <div class="f"><label>Email</label><input id="m-e" type="email" value="${esc(e?.email||'')}"></div></div>
   <div class="f2"><div class="f"><label>Started</label><input id="m-sd" type="date" value="${e?.started||today()}"></div>
     <div class="f"><label>On the books</label><select id="m-ac">
       <option value="1"${e?.active!==false?' selected':''}>Active</option>
       <option value="0"${e?.active===false?' selected':''}>Not active</option></select></div></div>
   <div class="f"><label>Notes</label><textarea id="m-no" rows="2">${esc(e?.notes||'')}</textarea></div>
   ${jobs.length?`<div class="dlglist"><label>Assigned to</label>${jobs.slice(0,6).map(j=>
      `<div class="dlrow"><span class="mono">${fmtD(j.date)}</span><b>${esc(j.title)}</b>
        <span class="pill p-${j.stage}">${STAGE_LABEL[j.stage]}</span><span class="sub">${esc(DB.clientName(j.client))}</span></div>`).join('')}</div>`:''}
   <div class="dlgacts">${e?'<button class="btn danger" id="m-del">Remove</button>':''}
     <button class="btn" value="cancel">Cancel</button>
     <button class="btn btn-p" id="m-ok">${e?'Save changes':'Add to the crew'}</button></div>`;
  dlg.showModal(); wireCancel();
  $('#m-del')?.addEventListener('click',()=>{
    if(confirm(`Remove ${e.name} from the crew? They come off every visit they are on. It cannot be undone.`)){
      DB.removeEmployee(e.id); close(); render(); toast('Removed from the crew.'); }});
  $('#m-ok').onclick = () => {
    const name = $('#m-n').value.trim();
    if(!name){ $('#m-n').focus(); toast('They need a name.', true); return; }
    const p = { name, role:$('#m-ro').value, region:$('#m-r').value, phone:$('#m-p').value,
      email:$('#m-e').value, started:$('#m-sd').value, active:$('#m-ac').value==='1',
      notes:$('#m-no').value };
    e ? DB.updateEmployee(e.id,p) : DB.addEmployee(p);
    close(); render(); toast(e?'Saved.':'Added to the crew.');
  };
}

/* A quote that came in from the 3D builder carries the whole drawing, so the
   parts list is a click away rather than back in the email it arrived in. */
function openQuote(id){
  const q = id ? DB.quotes('all').find(x=>x.id===id) : null;
  const d = q?.design;
  const cs = DB.clients('all').sort((a,b)=>a.name.localeCompare(b.name));
  if(!q && !cs.length){ toast('Add a client first.', true); return openClient(null); }
  dlg.innerHTML = `<h2>${q?esc(q.title):'New quote'}</h2>
    ${q?`<p class="sub dlgsub">${esc(DB.clientName(q.client))} · ${esc(q.summary||'')}</p>`:''}
    <div class="f"><label>Client</label><select id="m-c">${cs.map(c=>`<option value="${c.id}"${q&&q.client===c.id?' selected':''}>${esc(c.name)} · ${DB.regionMeta(c.region).short}</option>`).join('')}</select></div>
    <div class="f"><label>Title</label><input id="m-t" value="${esc(q?.title||'')}" placeholder="e.g. Primary walk-in, Level 2"></div>
    <div class="f2"><div class="f"><label>Total ($)</label><input id="m-v" type="number" value="${q?.total||0}"></div>
      <div class="f"><label>Status</label><select id="m-st">${['draft','sent','accepted','declined'].map(x=>`<option${q?.status===x?' selected':''}>${x}</option>`).join('')}</select></div></div>
    <div class="f"><label>Summary</label><input id="m-su" value="${esc(q?.summary||'')}" placeholder="Shape, room size, sections, finish"></div>
    ${d?`
    <div class="dlglist"><label>What was drawn</label>
      <table class="kv"><tbody>
        <tr><th>Room</th><td>${d.room.w}" × ${d.room.d}" × ${d.room.h}"</td></tr>
        <tr><th>Finish</th><td>${esc(d.finish)}${d.frontFinish&&d.frontFinish!==d.finish?' carcass · '+esc(d.frontFinish)+' fronts':''}</td></tr>
        <tr><th>Hardware</th><td>${esc(d.pull||'')} in ${esc(d.pullFinish||'')}</td></tr>
        <tr><th>Doors</th><td>${esc(d.door||'')}</td></tr>
        ${(d.fittings||[]).length?`<tr><th>On the walls</th><td>${d.fittings.map(f=>esc(f.item)+(f.note?' ('+esc(f.note)+')':'')).join(', ')}</td></tr>`:''}
      </tbody></table></div>
    <div class="dlglist"><label>Every section</label>
      <table class="kv"><tbody>${(d.bays||[]).map((b,i)=>`<tr><th>${i+1}. ${esc(b.wall||'')} ${b.width}"</th>
        <td>${b.stack.map(s=>esc(s.module)+(s.height?' at '+s.height+'"':'')).join(' over ')}${b.topShelf===false?' · open top':''}</td></tr>`).join('')}</tbody></table></div>
    <div class="dlglist"><label>Parts list</label><div class="tscroll">
      <table><thead><tr><th>Item</th><th class="mono">Qty</th><th class="mono">Sq ft</th><th class="mono">Band ft</th><th>Detail</th></tr></thead>
      <tbody>${(d.order||[]).map(o=>`<tr><td>${esc(o.item)}</td><td class="mono">${o.qty}</td>
        <td class="mono">${o.sq_ft??''}</td><td class="mono">${o.edgeband_ft??''}</td><td class="sub">${esc(o.detail||'')}</td></tr>`).join('')}</tbody></table></div>
      <div class="btnrow"><button class="btn btn-sm" id="q-csv">Download the parts list</button></div></div>`:''}
    <div class="dlgacts">${q?'<button class="btn danger" id="m-del">Delete</button>':''}
      <button class="btn" value="cancel">Close</button>
      <button class="btn btn-p" id="m-ok">${q?'Save changes':'Add quote'}</button></div>`;
  dlg.showModal(); wireCancel();
  $('#m-del')?.addEventListener('click',()=>{
    if(confirm('Delete this quote? It cannot be undone.')){ DB.removeQuote(q.id); close(); render(); toast('Quote deleted.'); }});
  $('#m-ok').onclick = () => {
    const cl = DB.client($('#m-c').value);
    const p = { client:$('#m-c').value, region: cl?cl.region:DB.region(),
      title:$('#m-t').value.trim()||'Untitled quote', total:+$('#m-v').value,
      status:$('#m-st').value, summary:$('#m-su').value };
    q ? DB.updateQuote(q.id,p) : DB.addQuote(p);
    close(); render(); toast(q?'Saved.':'Quote added.');
  };
  const csv = dlg.querySelector('#q-csv');
  if(csv) csv.onclick = () => {
    const rows = [['Item','Qty','Sq ft','Edgeband ft','Finish','Detail'],
      ...(d.order||[]).map(o=>[o.item,o.qty,o.sq_ft,o.edgeband_ft,o.finish,o.detail])];
    const text = rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const u = URL.createObjectURL(new Blob([text],{type:'text/csv'}));
    const a = document.createElement('a');
    a.href=u; a.download=`${q.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-parts.csv`; a.click();
    setTimeout(()=>URL.revokeObjectURL(u),1500);
  };
}

/* ───────── a day, read before it is touched ─────────
   Clicking a square used to open an empty booking form, which meant you could
   not look at a day without being asked to add to it. Now a day opens as a
   sheet of what is on it: who, where, which crew, what it is worth and the
   notes. Editing happens only when you click the actual visit. */
function openDay(iso){
  const items = DB.jobs().filter(j => j.date === iso)
    .sort((a,b) => a.kind.localeCompare(b.kind));
  const total = items.reduce((a,j) => a + (j.value||0), 0);
  const card = j => {
    const c = DB.client(j.client) || {};
    const crew = (j.crewIds||[]).map(id => DB.employeeName(id)).filter(Boolean);
    return `<article class="dayjob" data-job="${j.id}">
      <div class="djtop">
        <span class="kind ${esc(j.kind)}"><i></i>${esc(j.kind)}</span>
        <span class="pill p-${j.stage}">${STAGE_LABEL[j.stage]}</span>
        ${j.value ? `<span class="djval mono">${money(j.value)}</span>` : ''}
      </div>
      <h3>${esc(j.title)}</h3>
      <p class="djwho">${esc(c.name || 'No client on this visit')}${c.phone ? ` · <a href="tel:${esc(String(c.phone).replace(/[^+\d]/g,''))}" data-stop="1">${esc(c.phone)}</a>` : ''}</p>
      ${c.addr ? `<p class="djaddr"><a href="#" data-map="${esc(c.addr)}" data-stop="1">${esc(c.addr)}</a></p>` : ''}
      <div class="djmeta">
        <span><em>Crew</em>${crew.length ? esc(crew.join(' + ')) : 'Unassigned'}</span>
        ${j.finish && j.finish !== 'n/a' ? `<span><em>Finish</em>${esc(j.finish)}</span>` : ''}
        ${DB.region()==='all' ? `<span><em>Region</em>${DB.regionMeta(j.region).short}</span>` : ''}
      </div>
      ${j.notes ? `<p class="djnote">${esc(j.notes)}</p>` : ''}
      <span class="djedit">Click to edit this visit &rarr;</span>
    </article>`;
  };
  dlg.innerHTML = `<h2>${esc(fmtFull(iso))}</h2>
    <p class="sub dlgsub">${items.length ? `${items.length} visit${items.length===1?'':'s'}${total?` · ${money(total)}`:''}` : 'Nothing booked'}${DB.region()==='all'?'':' in '+esc(DB.regionMeta().name)}</p>
    ${items.length ? `<div class="daylist">${items.map(card).join('')}</div>`
      : '<div class="note">This day is clear. Use the button below to put something on it.</div>'}
    <div class="dlgacts">
      <button class="btn" value="cancel">Close</button>
      <button class="btn btn-p" id="d-add">+ Book something on this day</button>
    </div>`;
  dlg.showModal(); wireCancel();
  $('#d-add').onclick = () => { close(); openJob(null, iso); };
}

/* ───────── the crew's week link ───────── */
let WEEK_OFFSET = 0;
function buildWeek(empId, offset){
  const e = DB.employee(empId);
  const start = addDays(mondayOf(today()), offset*7);
  const s = DB.settings();
  const days = [];
  for(let i=0;i<7;i++){
    const iso = addDays(start, i);
    const items = DB.jobs('all')
      .filter(j => j.date === iso && (j.crewIds||[]).includes(empId) && j.stage !== 'lost')
      .map(j => {
        const c = DB.client(j.client) || {};
        return { kind:j.kind, title:j.title, stage:j.stage,
                 client:c.name || '', addr:c.addr || '', phone:c.phone || '',
                 finish:j.finish && j.finish !== 'n/a' ? j.finish : '',
                 notes:j.notes || '' };
      });
    days.push({ date:iso, items });
  }
  return { v:1, crew:e?.name || 'Crew', role:e?.role || '',
           biz:s.business || 'JS Installations & Closets', bizPhone:s.phone || '',
           start, made:new Date().toISOString(), days };
}
function openWeekLink(empId){
  WEEK_OFFSET = 0;
  const paint = () => {
    const wk = buildWeek(empId, WEEK_OFFSET);
    const total = wk.days.reduce((a,d)=>a+d.items.length,0);
    const url = location.origin + location.pathname.replace(/admin\/.*$/,'') + 'crew/#' + packWeek(wk);
    const label = `${fmtFull(wk.start)} to ${fmtFull(addDays(wk.start,6))}`;
    dlg.innerHTML = `<h2>${esc(wk.crew)}&rsquo;s week</h2>
      <p class="sub dlgsub">${esc(label)} · ${total} visit${total===1?'':'s'}</p>
      <div class="btnrow wkbar">
        <button class="btn btn-sm" id="wk-prev">&larr; Week before</button>
        <button class="btn btn-sm" id="wk-now">This week</button>
        <button class="btn btn-sm" id="wk-next">Week after &rarr;</button></div>
      ${total ? `<div class="dlglist">${wk.days.filter(d=>d.items.length).map(d=>
        `<div class="dlrow"><span class="mono">${fmtFull(d.date)}</span>
           <b>${d.items.map(i=>esc(i.client)).join(', ')}</b>
           <span class="sub">${d.items.map(i=>esc(i.kind)).join(', ')}</span></div>`).join('')}</div>`
        : `<div class="note warn">Nothing is assigned to ${esc(wk.crew)} that week. The link still works, it just opens an empty week. Assign them to a visit first under Jobs.</div>`}
      <div class="f"><label>The link to pin in their WhatsApp</label>
        <textarea id="wk-url" rows="3" readonly>${esc(url)}</textarea></div>
      <div class="note">Send this once and it stays pinned. <b>Send a fresh one when the week changes</b>, because the week is inside the link. Nothing on that page can be edited, and it shows only this person's work.</div>
      <div class="dlgacts">
        <button class="btn" value="cancel">Close</button>
        <button class="btn" id="wk-open">Open it myself</button>
        <button class="btn btn-p" id="wk-copy">Copy the link</button></div>`;
    if(!dlg.open) dlg.showModal();
    wireCancel();
    $('#wk-prev').onclick = () => { WEEK_OFFSET--; paint(); };
    $('#wk-next').onclick = () => { WEEK_OFFSET++; paint(); };
    $('#wk-now').onclick  = () => { WEEK_OFFSET=0;  paint(); };
    $('#wk-open').onclick = () => window.open(url,'_blank','noopener');
    $('#wk-copy').onclick = async () => {
      const b = $('#wk-copy');
      try{ await navigator.clipboard.writeText(url); b.textContent='Copied'; }
      catch(err){ $('#wk-url').select(); b.textContent='Press ⌘C'; }
      setTimeout(()=>{ b.textContent='Copy the link'; }, 2200);
    };
  };
  paint();
}

function wireCalc(){
  $('#pgo').onclick = () => {
    const w=+$('#pw').value, d=+$('#pd').value, layout=$('#pl').value, fin=$('#pf').value;
    if(w < 24){ $('#pout').innerHTML='<div class="note warn">Too narrow. A section cannot be under 24".</div>'; return; }
    const r = quickPrice(w,d,layout,fin,cat);
    $('#pout').innerHTML = `<div class="note calc">
      <b class="big">${money(r.price.price)}</b> installed &nbsp;·&nbsp; cost ${money(r.price.cost)} × ${r.price.markup}
      <br><span class="sub">${r.bays.length} sections · ${r.parts.length} parts · ${r.order.length} order lines · ${esc(fin)} · ${r.finish.lead} week lead</span></div>`;
  };
}

paintRegions(); render();
