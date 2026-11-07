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
import { DB, REGIONS, STAGES, STAGE_LABEL, KINDS, ROLES,
         PIPE, PIPE_ID, PIPE_LABEL, PIPE_COLOR } from './store.js';
import { quickPrice, MODULES, MODULE_IDS } from '../assets/js/design.js';
import { describe } from '../assets/js/enquiry.js';
import { packWeek, mondayOf, addDays } from '../assets/js/crewlink.js';
import { quoteDoc, quoteNumbers, linearFeet, orderSheet } from './quote.js';

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

/* ═══════════════ THE PIPELINE ═══════════════
   A list of rows tells you what exists. It does not tell you what is
   stuck. Six columns do: every client sits in exactly one, the column
   header carries how many and how much, and each card carries how many
   days it has sat there. Drag a card to move someone along, or open it
   and press a stage. That is the whole job.                            */

const stageDot = id => `<i class="sdot" style="background:${PIPE_COLOR[id]}"></i>`;

function pipeCard(c){
  const v    = DB.clientValue(c.id);
  const d    = DB.daysInStage(c);
  const load = DB.clientLoad(c.id);
  const next = DB.jobs('all').filter(j => j.client === c.id && j.date >= today())
                 .sort((a,b) => a.date.localeCompare(b.date))[0];
  const what = next ? `${next.kind} ${fmtD(next.date)}`
             : load.quotes ? `${load.quotes} quote${load.quotes===1?'':'s'}`
             : c.addr ? c.addr.split(',')[0] : (c.source || 'Website');
  return `<article class="pcrd" draggable="true" data-card="${c.id}" data-stage="${c.stage}"
            style="--c:${PIPE_COLOR[c.stage]}" tabindex="0"
            aria-label="${esc(c.name)}, ${PIPE_LABEL[c.stage]}">
      <b>${esc(c.name)}</b>
      <span class="pcsub">${esc(what)}</span>
      <span class="pcbot">
        ${v ? `<em>${money(v)}</em><u>est</u>` : '<em class="novalue">No value yet</em>'}
        <span class="pcage" title="How long this card has sat in this column">${d}d in stage</span>
      </span>
    </article>`;
}

V.pipeline = () => {
  const cl = DB.clients();
  const col = id => cl.filter(c => (c.stage || 'new') === id);
  const rm  = DB.regionMeta();
  const stuck = cl.filter(c => !['won','lost'].includes(c.stage) && DB.daysInStage(c) >= 5);

  return head(
      'Pipeline',
      DB.region()==='all'
        ? `Every client, every region, and how long each one has been waiting`
        : `Every client in ${rm.name}, and how long each one has been waiting`,
      `<button class="btn" data-act="newclient">+ Client</button>
       <button class="btn btn-p" data-nav="inbox">Website leads</button>`)

    + (stuck.length ? `<div class="stuckbar">
        <b>${stuck.length} ${stuck.length===1?'card has':'cards have'} not moved in five days or more.</b>
        ${stuck.slice(0,4).map(c=>`<button class="stuckpill" data-card-open="${c.id}">
          ${esc(c.name)} <i>${DB.daysInStage(c)}d</i></button>`).join('')}
        ${stuck.length>4?`<span class="sub">and ${stuck.length-4} more</span>`:''}
      </div>` : '')

    + `<div class="board">${PIPE.map(st => {
        const items = col(st.id);
        const val   = items.reduce((a,c) => a + DB.clientValue(c.id), 0);
        return `<section class="bcol" data-col="${st.id}" style="--c:${st.c}">
          <header title="${esc(st.note)}">
            ${stageDot(st.id)}<b>${st.label}</b>
            <span class="bcount">${items.length}${val?` &middot; ${money(val)}`:''}</span>
          </header>
          <div class="bdrop" data-drop="${st.id}">
            ${items.length ? items
                .sort((a,b) => DB.daysInStage(b) - DB.daysInStage(a))
                .map(pipeCard).join('')
              : `<p class="bempty">Nothing here</p>`}
          </div></section>`;
      }).join('')}</div>`;
};

/* One row of something that wants doing. The colour is what kind of thing
   it is, so the list reads as a shape before it reads as words. */
const doRow = (c, what, sub, go) =>
  `<button class="dorow" style="--c:${c}" ${go}>
     <span class="dobar"></span>
     <span class="dotxt"><b>${what}</b><i>${sub}</i></span>
     <span class="dogo">&rsaquo;</span></button>`;

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

  /* ── what actually wants doing, newest problem first ──
     Website leads used to live only in the Inbox, so the first screen of
     the morning could say "nothing booked, enjoy it" while three people
     sat unanswered one tab away. */
  const cls   = DB.clients();
  const unread = DB.newLeads()
    .filter(l => DB.region()==='all' || !l.region_id || l.region_id===DB.region());
  const stale = cls.filter(c => !['won','lost'].includes(c.stage) && DB.daysInStage(c) >= 5)
    .sort((a,b) => DB.daysInStage(b) - DB.daysInStage(a));
  const waiting = DB.quotes().filter(q => q.status === 'sent');
  const todo =
      unread.map(l => doRow('#C2572F', `Reply to ${esc(l.contact?.name || 'a new enquiry')}`,
          `${esc(l.source || 'Website')} &middot; came in ${fmtD((l.created||today()).slice(0,10))}`
          + (l.design?.price ? ` &middot; ${money(l.design.price)} drawn` : ''),
          `data-leadopen="${esc(l.id)}"`)).join('')
    + waiting.map(q => doRow('#5C6FA8', `Chase the quote for ${esc(DB.clientName(q.client))}`,
          `${money(q.total)} &middot; sent ${q.created ? fmtD(q.created) : 'recently'}, no answer yet`,
          `data-nav="quotes"`)).join('')
    + stale.slice(0,6).map(c => doRow('#B4832B', `${esc(c.name)} has not moved`,
          `${PIPE_LABEL[c.stage]} &middot; ${DB.daysInStage(c)} days in that column`,
          `data-card-open="${c.id}"`)).join('')
    + td.map(j => doRow('#3F7A4D', `${esc(j.kind.charAt(0).toUpperCase()+j.kind.slice(1))} at ${esc(DB.clientName(j.client))}`,
          `${esc(j.title)}${j.crew?` &middot; ${esc(j.crew)}`:' &middot; nobody assigned yet'}`,
          `data-job="${j.id}"`)).join('');

  return head(
      DB.region()==='all' ? 'All regions' : rm.name,
      new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})
        + (DB.region()==='all' ? '' : ' · '+rm.base),
      `<button class="btn" data-act="newclient">+ Client</button>
       <button class="btn btn-p" data-act="newjob">+ Book a visit</button>`)

  + panel('What wants doing',
      todo ? `${unread.length?unread.length+' unanswered · ':''}${waiting.length?waiting.length+' awaiting an answer':''}` : '',
      todo ? `<div class="dolist">${todo}</div>`
           : empty('Nothing waiting on you. Every lead is answered and nothing is stuck.'),
      unread.length ? 'accent' : '')

  + (td.length ? panel('On today', `${td.length} visit${td.length>1?'s':''}`,
      scroll(`<table><thead><tr><th>Client</th><th>Job</th><th>Visit</th>${DB.region()==='all'?'<th>Region</th>':''}<th>Crew</th><th>Stage</th><th class="mono">Value</th></tr></thead>
        <tbody>${td.map(j=>jobRow(j,false)).join('')}</tbody></table>`), 'accent') : '')

  + `<div class="cards">
      <div class="card"><span class="k">Pipeline</span><div class="v">${money(pipe.reduce((a,x)=>a+x.value,0))}</div><span class="d">${pipe.length} live jobs</span></div>
      <div class="card"><span class="k">Installed this month</span><div class="v">${money(month.reduce((a,x)=>a+x.value,0))}</div><span class="d">${month.length} completed</span></div>
      <div class="card ${unread.length?'hot':''}" data-nav="inbox"><span class="k">Unanswered leads</span><div class="v">${unread.length}</div><span class="d">${unread.length?'Straight off the website':'All answered'}</span></div>
      <div class="card" data-nav="pipeline"><span class="k">Waiting on a quote</span><div class="v">${leads.length}</div><span class="d">${leads.length?'Oldest '+fmtD([...leads].sort((a,b)=>a.date.localeCompare(b.date))[0].date):'All clear'}</span></div>
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
/* Which column of the pipeline the client list is filtered to. Everyone is
   a client here — a lead is just a client nobody has rung yet — so the only
   useful question is "show me the ones at this stage". */
let CLI_STAGE = 'all';
V.clients = () => {
  const all = [...DB.clients()].sort((a,b)=>a.name.localeCompare(b.name));
  const c   = CLI_STAGE === 'all' ? all : all.filter(x => (x.stage||'new') === CLI_STAGE);
  const rm  = DB.regionMeta();
  const count = id => all.filter(x => (x.stage||'new') === id).length;
  return head('Clients',
      `${all.length}${DB.region()==='all'?' across every region':' in '+rm.name} · every lead becomes a client here, click any row to open it`,
      `<button class="btn btn-p" data-act="newclient">+ Add client</button>`)
  + `<div class="cfilter">
      <button data-cstage="all" class="${CLI_STAGE==='all'?'on':''}">All <i>${all.length}</i></button>
      ${PIPE.map(st=>`<button data-cstage="${st.id}" style="--c:${st.c}"
        class="${CLI_STAGE===st.id?'on':''}" title="${esc(st.note)}">
        <i class="sdot" style="background:${st.c}"></i>${st.label} <i>${count(st.id)}</i></button>`).join('')}
     </div>`
  + panel('', '', c.length
    ? scroll(`<table><thead><tr><th>Name</th><th>Where they are</th><th>Phone</th><th>Address</th>${DB.region()==='all'?'<th>Region</th>':''}<th>Source</th><th>Jobs</th><th class="mono">Lifetime</th></tr></thead><tbody>
      ${c.map(x=>{
        const js = DB.jobs('all').filter(j=>j.client===x.id);
        const done = js.filter(j=>j.stage==='done').sort((a,b)=>b.date.localeCompare(a.date));
        const st = x.stage || 'new';
        return `<tr data-client="${x.id}">
          <td><b>${esc(x.name)}</b>${x.email?`<br><span class="sub">${esc(x.email)}</span>`:''}</td>
          <td><span class="stagetag" style="--c:${PIPE_COLOR[st]}">
            <i class="sdot" style="background:${PIPE_COLOR[st]}"></i>${PIPE_LABEL[st]}</span>
            <br><span class="sub">${DB.daysInStage(x)}d in stage</span></td>
          <td class="mono">${esc(x.phone)||'&ndash;'}</td>
          <td class="addr">${x.addr?`<a href="#" data-map="${esc(x.addr)}">${esc(x.addr)}</a>`:'<span class="sub">No address yet</span>'}</td>
          ${regionCell(x)}
          <td><span class="pill muted">${esc(x.source||'—')}</span></td>
          <td>${js.length}</td>
          <td class="mono">${money(js.filter(j=>j.stage==='done').reduce((a,j)=>a+j.value,0))}</td></tr>`;
      }).join('')}</tbody></table>`)
    : empty(CLI_STAGE==='all'
        ? 'No clients in this region yet. Add the first one with the button above.'
        : `Nobody is at &ldquo;${PIPE_LABEL[CLI_STAGE]}&rdquo; right now.`));
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
/* A quote is not one number. It is cabinetry, plus installation worked out
   from the linear feet, plus tax, and a deposit that books the job. All of
   that already existed inside quoteNumbers and none of it was on this page:
   the list showed a single "Total" column, so you could not see what a quote
   was actually made of without opening it one at a time.

   It also could not tell you the one thing most likely to be wrong, which is
   that with no install rate set EVERY quote on the page is cabinetry only. */
V.quotes = () => {
  const s = DB.settings();
  const all = [...DB.quotes()].sort((a,b)=>b.created.localeCompare(a.created));
  const N = q => quoteNumbers(q, s);
  const sum = list => list.reduce((a,q)=>a+N(q).total, 0);

  const out  = all.filter(q=>q.status==='sent');
  const draft= all.filter(q=>q.status==='draft');
  const won  = all.filter(q=>q.status==='accepted');
  const lost = all.filter(q=>q.status==='declined');
  const noRate = !(+s.installPerFt);

  const row = q => { const n = N(q); return `<tr data-quote="${q.id}">
      <td class="mono">${fmtD(q.created)}</td>
      <td>${esc(DB.clientName(q.client))}</td>
      <td><b>${esc(q.title)}</b>${q.summary?`<br><span class="sub">${esc(q.summary)}</span>`:''}
          ${q.design?'<span class="tagdot">from the 3D builder</span>':''}</td>
      ${regionCell(q)}
      <td class="mono">${money(n.cabinetry)}</td>
      <td class="mono">${n.install==null?'<span class="sub">not set</span>':money(n.install)}</td>
      <td class="mono">${n.tax?money(n.tax):'<span class="sub">—</span>'}</td>
      <td class="mono"><b>${money(n.total)}</b></td>
      <td class="mono sub">${money(n.deposit)}</td></tr>`; };

  const tbl = list => scroll(`<table><thead><tr>
      <th>Date</th><th>Client</th><th>Quote</th>${DB.region()==='all'?'<th>Region</th>':''}
      <th class="mono">Cabinetry</th><th class="mono">Install</th><th class="mono">Tax</th>
      <th class="mono">Total</th><th class="mono">Deposit</th></tr></thead>
      <tbody>${list.map(row).join('')}</tbody></table>`);

  return head('Quotes',
      `${all.length} on file · ${money(sum(out))} out awaiting a reply · ${money(sum(won))} accepted`,
      `<button class="btn btn-p" data-act="newquote">+ New quote</button>`)

  + (noRate ? panel('', '', `<div class="note warn"><b>No installation rate is set,
      so every quote here is cabinetry only.</b> Put the rate per linear foot and the
      minimum charge into <button class="lnkbtn" data-v="settings">Settings</button>
      and all of these recalculate. Tax and the deposit percentage are there too.</div>`) : '')

  + panel('Out, waiting on a reply', out.length ? money(sum(out)) : '',
      out.length ? tbl(out) : empty('Nothing is out with a customer.'), out.length?'accent':'')
  + panel('Drafts', draft.length ? `${draft.length} not sent yet` : '',
      draft.length ? tbl(draft) : empty('No drafts.'))
  + panel('Accepted', won.length ? money(sum(won)) : '',
      won.length ? tbl(won) : empty('None accepted yet.'))
  + (lost.length ? panel('Declined', `${lost.length}`, tbl(lost)) : '')

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
        <button class="btn btn-sm btn-p" data-weeklink="${e.id}" data-stop="1">Build the week</button>
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
  + panel('How a crew week works', '', `<div class="bd"><div class="note">
      <b>Build the week</b> opens that person's seven days. Put a client on a day, say what the
      visit is, and leave them a note for that morning. Everything you book there is a real
      visit: it shows up on the <b>Schedule</b> the moment you add it, with their name against it.
      <br><br>At the bottom of the same window is the link to pin in their WhatsApp. It opens
      their week on their phone: which day, whose house, the address as a tap-to-navigate
      button, what is going in, and your notes. It is read only — they cannot move a visit,
      change a price or see anyone else's work.
      <br><br><b>Send a fresh link when the week changes</b>, because the week travels inside the
      link itself. That is what lets it work with no login and no app.</div></div>`);
};

/* ═══════════════ INBOX ═══════════════
   The website is static, so a lead cannot be written straight into this
   browser from a customer's one. It arrives as an email carrying a reference
   code. Paste the code here and the client, the job and the quote are created
   in the right region with the whole parts list attached. */
let INBOX_DRAFT = null;

/* How long has this been sitting? The list was newest first, which buries the
   one that has been waiting longest under the one that came in an hour ago,
   and the old one is always the problem. Oldest first now, with the wait
   spelled out, and anything past two days says so in red. */
function leadAge(l){
  const t = Date.parse(l.created || l.at || '');
  if(!t) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 864e5));
}
function ageTag(l){
  const d = leadAge(l);
  if(d == null) return '<span class="sub">—</span>';
  const txt = d === 0 ? 'today' : d === 1 ? '1 day' : `${d} days`;
  return d >= 2 ? `<span class="pill p-lost">${txt}</span>`
       : d === 1 ? `<span class="pill p-quoted">${txt}</span>`
                 : `<span class="sub">${txt}</span>`;
}

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
      ? scroll(`<table><thead><tr><th>Came in</th><th>Waiting</th><th>Customer</th><th>What they drew</th><th class="mono">Estimate</th><th></th></tr></thead><tbody>
        ${[...fresh].sort((a,b)=>(a.created||'').localeCompare(b.created||'')).map(l=>`<tr>
          <td class="mono">${when(l)}</td>
          <td>${ageTag(l)}</td>
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

  + `<div id="inbox-out"></div>`

  + panel('How a lead gets here', '', `<div class="bd"><div class="note">
      <b>1.</b> The customer fills in the free measure form, or draws their closet at <b>/design/</b> and presses &ldquo;Send this to us&rdquo;.<br><br>
      <b>2.</b> It is written straight into this Inbox the moment they press send, they get an automatic reply, and you get an email. There is nothing to copy and nothing to paste.<br><br>
      <b>3.</b> You press <b>Open it</b>, check it, and file it. The client, a measure visit and a draft quote are created in the region the ZIP belongs to, with the whole parts list on the quote, and the client lands in the first column of the <b>Pipeline</b>.</div></div>`);
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
    <div class="f2">
      <div class="f"><label>Which region</label><select id="inbox-region">
        ${REGIONS.map(r=>`<option value="${r.id}"${r.id===(e.regionId||DB.region())?' selected':''}>${esc(r.name)}</option>`).join('')}
      </select></div>
      <div class="f"><label>Onto the board at</label><select id="inbox-stage">
        ${PIPE.filter(x=>x.id!=='lost').map(x=>`<option value="${x.id}"${x.id==='new'?' selected':''}>${esc(x.label)}</option>`).join('')}
      </select></div>
    </div>
    <p class="note">Filing makes the client, books a measure visit and starts a draft quote
      with the whole parts list on it. Pick the column it should land in: somebody you have
      already spoken to does not belong back in <b>New lead</b>.</p>
    <div class="btnrow"><button class="btn btn-p" data-act="inbox-file">File it onto the board</button></div>`;
}

function inboxFile(){
  const e = INBOX_DRAFT; if(!e) return;
  const region = $('#inbox-region')?.value || DB.region();
  const stage  = $('#inbox-stage')?.value || 'new';
  const d = e.design;
  let client = DB.findClient(e.contact.name);
  if(!client){
    client = DB.addClient({ region, name:e.contact.name || 'Website enquiry',
      phone:e.contact.phone||'', email:e.contact.email||'',
      addr:[e.contact.address, e.contact.location].filter(Boolean).join(', '),
      source: e.source || 'Website', notes: e.contact.message || '', stage });
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

  + panel('What you charge for installation', 'Used on every quote sheet', `<div class="bd">
      <div class="note">The builder prices <b>cabinetry</b>. A customer is buying a finished closet, so the quote sheet adds installation on top. Put your rate here and every quote works it out from the real linear feet of the design. Leave it empty and the quote says installation is confirmed at the measure, which is honest but means you have to fill it in by hand each time.</div>
      <div class="f3">
        <div class="f"><label>Rate per linear foot ($)</label><input id="s-ipf" type="number" step="1" value="${esc(s.installPerFt||'')}" placeholder="e.g. 45"></div>
        <div class="f"><label>Minimum charge ($)</label><input id="s-imin" type="number" step="1" value="${esc(s.installMin||'')}" placeholder="e.g. 350"></div>
        <div class="f"><label>Sales tax (%)</label><input id="s-tax" type="number" step="0.1" value="${esc(s.taxRate||'')}" placeholder="0 for none"></div>
      </div>
      <div class="f2">
        <div class="f"><label>Deposit to book (%)</label><input id="s-dep" type="number" step="1" value="${esc(s.depositPct ?? 50)}"></div>
        <div class="f"><label>Board waste allowance (%)</label>
          <input id="s-waste" type="number" step="1" min="0" max="40" value="${esc(s.boardWastePct ?? 15)}">
          <small>What the order sheet adds on top of the bare square footage before
            rounding up to whole sheets. It prints both numbers, so you can always
            see what the allowance did.</small></div>
      </div>
      <div class="btnrow"><button class="btn btn-p" data-act="savebiz">Save</button></div></div>`)

  + panel('Business', '', `<div class="bd">
      <div class="f2"><div class="f"><label>Business name</label><input id="s-biz" value="${esc(s.business)}"></div>
        <div class="f"><label>Phone</label><input id="s-phone" value="${esc(s.phone)}"></div></div>
      <div class="f2"><div class="f"><label>Email</label><input id="s-email" value="${esc(s.email)}"></div>
        <div class="f"><label>Markup multiplier</label><input id="s-markup" type="number" step="0.1" value="${s.markup}"></div></div>
      <div class="btnrow"><button class="btn btn-p" data-act="savebiz">Save</button></div></div>`)

  + panel('Still to connect', 'Three accounts, all free to start', `<div class="bd">
      <div class="f"><label>Where website enquiries are emailed</label>
        <input id="s-mailto" placeholder="jsinstalladmin@gmail.com" value="${esc(s.officeEmail||'')}">
        <small>Both emails — yours and the customer's confirmation — are sent by our own
          mail function. There is no third-party form service any more. Changing this address
          here is a note to yourself; the live one is the <b>OFFICE_TO</b> secret in Supabase.</small></div>
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
  if(lop){ e.stopPropagation(); return openLead(lop.dataset.leadopen); }

  const lo = e.target.closest('[data-lead-open]');
  if(lo){ e.stopPropagation(); return lo.dataset.leadOpen ? openClient(lo.dataset.leadOpen) : null; }

  const act = e.target.closest('[data-act]'); if(act) return doAct(act.dataset.act);

  if(stop) return;                                   // a control inside a row

  const emp = e.target.closest('[data-emp]');  if(emp) return openEmployee(emp.dataset.emp);
  const job = e.target.closest('[data-job]');  if(job){ e.stopPropagation(); return openJob(job.dataset.job); }
  const qr  = e.target.closest('[data-quote]');if(qr)  return openQuote(qr.dataset.quote);
  const cf  = e.target.closest('[data-cstage]');
  if(cf){ CLI_STAGE = cf.dataset.cstage; render(); return; }
  const cl  = e.target.closest('[data-client]');if(cl) return openClient(cl.dataset.client);
  const bc  = e.target.closest('[data-card],[data-card-open]');
  if(bc) return openClient(bc.dataset.card || bc.dataset.cardOpen);
  const day = e.target.closest('.day');        if(day) return openDay(day.dataset.date);
});

function doAct(a){
  /* The reference code is gone. A lead writes itself into the database the
     moment it is sent, so asking anyone to copy a line of gibberish out of
     an email and paste it back in was a workaround for a problem that no
     longer exists. */
  if(a==='inbox-sync'){
    toast('Checking…');
    DB.refresh().then(()=>{ render(); toast('Up to date.'); })
      .catch(err=>toast('Could not reach the database: '+err.message, true));
    return;
  }
  if(a==='inbox-file'){ const r = inboxFile(); if(dlg.open) dlg.close(); return r; }
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
      markup:+($('#s-markup')?.value||2.8), officeEmail:$('#s-mailto')?.value,
      resendKey:$('#s-resend')?.value, mapsEmbed:$('#s-map')?.value,
      installPerFt:+($('#s-ipf')?.value||0), installMin:+($('#s-imin')?.value||0),
      taxRate:+($('#s-tax')?.value||0), depositPct:+($('#s-dep')?.value||50),
      boardWastePct:+($('#s-waste')?.value||15)});
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

/* A lead used to open UNDERNEATH the table it was listed in: the page
   re-rendered, the preview was written into a div below the rows, and it
   scrolled you down to it. You lost your place in the list, the row you came
   from was off screen, and nothing told you the thing you were now reading
   belonged to it. Every other record here already opens as a modal, so a
   lead does too, with the whole enquiry in it and the filing action at the
   bottom where it is on every other record. */
function openLead(id){
  const l = DB.lead(id); if(!l) return;
  INBOX_DRAFT = { ...l, regionId:l.region_id };
  const c = INBOX_DRAFT.contact || {};
  dlg.innerHTML = `<h2>${esc(c.name || 'Website enquiry')}</h2>
    <p class="sub dlgsub">${esc(INBOX_DRAFT.source || 'Website')} · came in ${esc(when(INBOX_DRAFT))}</p>
    ${inboxPreview(INBOX_DRAFT)}
    <form method="dialog" class="btnrow" style="margin-top:.9em">
      <button class="btn" value="cancel">Close</button>
    </form>`;
  dlg.showModal(); wireCancel();
}

function openClient(id){
  const c = id ? DB.client(id) : null;
  const load = c ? DB.clientLoad(c.id) : {jobs:0,quotes:0};
  const jobs = c ? DB.jobs('all').filter(j=>j.client===c.id).sort((a,b)=>b.date.localeCompare(a.date)) : [];
  /* What this client has actually been worth. Only the installed ones count,
     because a lead with a number against it is a hope, not revenue. */
  const doneTotal = jobs.filter(j=>j.stage==='done').reduce((a,j)=>a+(+j.value||0),0);
  dlg.innerHTML = `<h2>${c?esc(c.name):'New client'}</h2>
   ${c?`<p class="sub dlgsub">${load.jobs} job${load.jobs===1?'':'s'} · ${load.quotes} quote${load.quotes===1?'':'s'} · in ${esc(DB.regionMeta(c.region).name)}</p>`:''}
   <div class="f"><label>Name</label><input id="m-n" value="${esc(c?.name||'')}" placeholder="Who the invoice goes to"></div>
   <div class="f2"><div class="f"><label>Phone</label><input id="m-p" value="${esc(c?.phone||'')}"></div>
     <div class="f"><label>Email</label><input id="m-e" type="email" value="${esc(c?.email||'')}"></div></div>
   <div class="f"><label>Address</label><input id="m-a" value="${esc(c?.addr||'')}" placeholder="Street, town, state, ZIP"></div>
   <div class="f"><label>Where are they in the pipeline?</label>
     <div class="pickrow" id="m-stage" data-pick="${esc(c?.stage||'new')}">
       ${PIPE.map(st=>`<button type="button" data-stage-pick="${st.id}" style="--c:${st.c}"
         class="${(c?.stage||'new')===st.id?'on':''}" title="${esc(st.note)}">
         <i class="sdot" style="background:${st.c}"></i>${st.label}</button>`).join('')}
     </div></div>
   <div class="f"><label>Which state are they in?</label>
     <div class="pickrow wide" id="m-r" data-pick="${esc(c?.region||DB.region()==='all'?(c?.region||'fl'):DB.region())}">
       ${REGIONS.map(r=>`<button type="button" data-region-pick="${r.id}"
         class="${(c?.region || (DB.region()==='all'?'fl':DB.region()))===r.id?'on':''}">
         <b>${r.short}</b><span>${esc(r.name)}</span></button>`).join('')}
     </div></div>
   <div class="f"><label>Where did they come from?</label>
     <div class="pickrow" id="m-s" data-pick="${esc(c?.source||'Website')}">
       ${['Website','Referral','Google','Houzz','Trade','Walk-in'].map(x=>`<button type="button"
         data-source-pick="${x}" class="${(c?.source||'Website')===x?'on':''}">${x}</button>`).join('')}
     </div></div>
   <div class="f"><label>Notes</label><textarea id="m-no" rows="2">${esc(c?.notes||'')}</textarea></div>
   ${jobs.length?`<div class="dlglist"><label>Their jobs, and what each install is worth</label>${jobs.slice(0,8).map(j=>
      `<div class="dlrow"><span class="mono">${fmtD(j.date)}</span><b>${esc(j.title)}</b>
        <span class="pill p-${j.stage}">${STAGE_LABEL[j.stage]}</span>
        <input class="jval mono" type="number" min="0" step="1" data-jval="${j.id}"
               value="${+j.value||0}" aria-label="What this install is worth"></div>`).join('')}
      <div class="dlrow dltot"><span class="mono"></span><b>Installed and counted</b>
        <span></span><span class="mono" id="m-donetot">${money(doneTotal)}</span></div>
      </div>
      <p class="note">Type a figure in and it stays typed in. Nothing recalculates it
        later from a quote, and only the jobs marked <b>Installed</b> are added into the
        month&rsquo;s total on Today.</p>`:''}
   <div class="dlgacts">${c?'<button class="btn danger" id="m-del">Delete</button>':''}
     <button class="btn" value="cancel">Cancel</button>
     <button class="btn btn-p" id="m-ok">${c?'Save changes':'Add client'}</button></div>`;
  dlg.showModal(); wireCancel();
  /* A row of real buttons instead of a 140px dropdown. Same data, but you can
     see every option at once and hit it with a thumb. */
  dlg.querySelectorAll('.pickrow').forEach(row => {
    row.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if(!b) return;
      ev.preventDefault();
      row.dataset.pick = b.dataset.stagePick || b.dataset.regionPick || b.dataset.sourcePick;
      row.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });
  });
  /* The price is the one number in here somebody types from a piece of paper,
     so it saves the moment they leave the field and the total under it moves
     with it. Redrawing the whole modal would take the cursor with it. */
  dlg.querySelectorAll('[data-jval]').forEach(inp => {
    inp.addEventListener('change', () => {
      const v = Math.max(0, +inp.value || 0);
      inp.value = v;
      DB.updateJob(inp.dataset.jval, { value: v });
      const fresh = DB.jobs('all').filter(j => j.client === c.id && j.stage === 'done')
                      .reduce((a,j) => a + (+j.value||0), 0);
      const tot = $('#m-donetot'); if(tot) tot.textContent = money(fresh);
      render();
    });
  });

  $('#m-del')?.addEventListener('click',()=>{
    const msg = load.jobs||load.quotes
      ? `Delete ${c.name}? This also deletes ${load.jobs} job${load.jobs===1?'':'s'} and ${load.quotes} quote${load.quotes===1?'':'s'}. It cannot be undone.`
      : `Delete ${c.name}? It cannot be undone.`;
    if(confirm(msg)){ DB.removeClient(c.id); close(); render(); toast('Client deleted.'); }
  });
  $('#m-ok').onclick = () => {
    const name = $('#m-n').value.trim();
    if(!name){ $('#m-n').focus(); toast('A client needs a name.', true); return; }
    const picked = sel => $(sel)?.dataset.pick || '';
    const stage = picked('#m-stage') || 'new';
    const p = {name, phone:$('#m-p').value, email:$('#m-e').value, addr:$('#m-a').value,
               region:picked('#m-r') || 'fl', source:picked('#m-s') || 'Website',
               notes:$('#m-no').value};
    if(c){
      DB.updateClient(c.id, p);
      /* the stage is stamped with its own time, so it goes through its own door */
      if(stage !== c.stage) DB.setClientStage(c.id, stage);
    } else {
      DB.addClient({ ...p, stage });
    }
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
  /* A row of real buttons instead of a 140px dropdown. Same data, but you can
     see every option at once and hit it with a thumb. */
  dlg.querySelectorAll('.pickrow').forEach(row => {
    row.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if(!b) return;
      ev.preventDefault();
      row.dataset.pick = b.dataset.stagePick || b.dataset.regionPick || b.dataset.sourcePick;
      row.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });
  });
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
  /* A row of real buttons instead of a 140px dropdown. Same data, but you can
     see every option at once and hit it with a thumb. */
  dlg.querySelectorAll('.pickrow').forEach(row => {
    row.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if(!b) return;
      ev.preventDefault();
      row.dataset.pick = b.dataset.stagePick || b.dataset.regionPick || b.dataset.sourcePick;
      row.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });
  });
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
      <div class="btnrow"><button class="btn btn-sm" id="q-csv">Download the parts list</button>
        <button class="btn btn-sm" id="q-order">Open the order sheet</button></div></div>`:''}
    ${q ? (() => {
      const n = quoteNumbers(q, DB.settings());
      return `<div class="dlglist"><label>What the customer would see</label>
        <div class="qsum">
          <div class="qrow"><span>Cabinetry</span><b>${money(n.cabinetry)}</b></div>
          <div class="qrow"><span>Installation${n.install!==null?` · ${n.ft} ft at ${money(n.rate)}/ft`:''}</span>
            <b>${n.install!==null?money(n.install):'<i>rate not set</i>'}</b></div>
          ${n.taxPct?`<div class="qrow"><span>Sales tax ${n.taxPct}%</span><b>${money(n.tax)}</b></div>`:''}
          <div class="qrow tot"><span>Total</span><b>${money(n.total)}</b></div>
          <div class="qrow dep"><span>Deposit to book</span><b>${money(n.deposit)}</b></div>
        </div>
        ${n.install===null?`<div class="note warn">No installation rate is set, so the quote will say installation is confirmed at the measure. Put a rate per linear foot in <b>Settings</b> and it is priced automatically.</div>`:''}
        <div class="f"><label>Anything to add to the quote</label>
          <textarea id="q-note" rows="2" placeholder="Lead time, access, anything agreed on the phone">${esc(q.note||'')}</textarea></div>
        <div class="btnrow">
          <button class="btn btn-p" id="q-doc">Open the quote sheet</button>
          <button class="btn" id="q-mail">Email it to ${esc((DB.client(q.client)||{}).name || 'the client')}</button>
        </div></div>`;
    })() : ''}
    <div class="dlgacts">${q?'<button class="btn danger" id="m-del">Delete</button>':''}
      <button class="btn" value="cancel">Close</button>
      <button class="btn btn-p" id="m-ok">${q?'Save changes':'Add quote'}</button></div>`;
  dlg.showModal(); wireCancel();
  /* A row of real buttons instead of a 140px dropdown. Same data, but you can
     see every option at once and hit it with a thumb. */
  dlg.querySelectorAll('.pickrow').forEach(row => {
    row.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if(!b) return;
      ev.preventDefault();
      row.dataset.pick = b.dataset.stagePick || b.dataset.regionPick || b.dataset.sourcePick;
      row.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });
  });
  $('#m-del')?.addEventListener('click',()=>{
    if(confirm('Delete this quote? It cannot be undone.')){ DB.removeQuote(q.id); close(); render(); toast('Quote deleted.'); }});
  $('#m-ok').onclick = () => {
    const cl = DB.client($('#m-c').value);
    const p = { client:$('#m-c').value, region: cl?cl.region:DB.region(),
      title:$('#m-t').value.trim()||'Untitled quote', total:+$('#m-v').value,
      status:$('#m-st').value, summary:$('#m-su').value };
    const was = q?.status;
    const saved = q ? DB.updateQuote(q.id,p) : DB.addQuote(p);

    /* ACCEPTING A QUOTE USED TO DO NOTHING.

       You changed the dropdown to "accepted", the row went green, and that was
       the end of it: no job existed, nothing was on the schedule, and the
       money never reached the installed total because no job carried it. The
       workflow stopped at the one step that matters. Accepting now books the
       install for real, with the full quoted figure on it, and moves the
       client to Booked in. */
    if(p.status === 'accepted' && was !== 'accepted'){
      const n = quoteNumbers(saved, DB.settings());
      const c = DB.client(p.client);
      const already = DB.jobs('all').some(j => j.client === p.client && j.kind === 'install'
                        && j.title === p.title);
      if(!already){
        DB.addJob({ region: c?.region || DB.region(), client: p.client, kind:'install',
                    title: p.title, stage:'won', value: n.total,
                    date: addDays(today(), 21),
                    finish: saved.design?.finish || 'n/a',
                    notes: `From the accepted quote. ${money(n.cabinetry)} cabinetry`
                         + (n.install ? ` + ${money(n.install)} installation` : '')
                         + (n.tax ? ` + ${money(n.tax)} tax` : '') + '.' });
        if(c && c.stage !== 'won') DB.setClientStage(p.client, 'won');
        toast(`Accepted. The install is booked at ${money(n.total)} and ${c?.name||'the client'} is Booked in.`);
        close(); render(); return;
      }
    }
    close(); render(); toast(q?'Saved.':'Quote added.');
  };
  /* The quote is what the customer signs. The order sheet is the other half:
     the same parts list, grouped the way board and hardware are bought, with
     the sheet count worked out per finish. */
  const osb = dlg.querySelector('#q-order');
  if(osb) osb.onclick = () => {
    const w = window.open('', '_blank');
    if(!w) return toast('Your browser blocked the new tab. Allow pop-ups for this page.', true);
    w.document.write(orderSheet(q, DB.client(q.client), DB.settings()));
    w.document.close();
  };
  const doc = dlg.querySelector('#q-doc');
  if(doc) doc.onclick = () => {
    const note = dlg.querySelector('#q-note')?.value || '';
    if(note !== (q.note||'')) DB.updateQuote(q.id, { note });
    const w = window.open('', '_blank');
    if(!w) return toast('Your browser blocked the new tab. Allow pop-ups for this page.', true);
    w.document.write(quoteDoc(q, DB.client(q.client), DB.settings(), { note }));
    w.document.close();
  };
  const mail = dlg.querySelector('#q-mail');
  if(mail) mail.onclick = () => {
    const c = DB.client(q.client) || {};
    if(!c.email) return toast('That client has no email address on file yet.', true);
    const n = quoteNumbers(q, DB.settings());
    const s2 = DB.settings();
    const body = [
      `Hi ${(c.name||'').split(' ')[0]},`, '',
      `Here is the quote for ${q.title}.`, '',
      q.summary || '',
      `Cabinetry: ${money(n.cabinetry)}`,
      n.install !== null ? `Installation: ${money(n.install)} (${n.ft} linear feet)`
                         : 'Installation: confirmed at the measure',
      n.taxPct ? `Sales tax: ${money(n.tax)}` : '',
      `Total: ${money(n.total)}`,
      n.deposit ? `Deposit to book it: ${money(n.deposit)}` : '', '',
      'This holds for 30 days. Every dimension is confirmed at the measure before anything is cut.',
      '', s2.business || 'JS Installations & Closets', s2.phone || '', s2.email || ''
    ].filter(Boolean).join('\n');
    location.href = `mailto:${encodeURIComponent(c.email)}?subject=${
      encodeURIComponent(`Your quote from ${s2.business||'JS Closets'} — ${q.title}`)}&body=${encodeURIComponent(body)}`;
    DB.updateQuote(q.id, { status:'sent' });
    close(); render(); toast('Quote marked as sent.');
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
    days.push({ date:iso, items, note: DB.crewNote(empId, iso) });
  }
  return { v:1, crew:e?.name || 'Crew', role:e?.role || '',
           biz:s.business || 'JS Installations & Closets', bizPhone:s.phone || '',
           start, made:new Date().toISOString(), days };
}
/* ═══════════════ BUILDING A CREW'S WEEK ═══════════════
   Copying a link was never the job. The job is "who is Luis seeing on
   Thursday and what does he need to know". So this is the week itself:
   seven days, a visit goes on a day, a note goes on a day, and the link
   to pin in their WhatsApp sits underneath it rather than being the
   whole point. Anything booked here is a real visit on the Schedule the
   moment it is added, with their name against it.                     */
function openWeekLink(empId){
  WEEK_OFFSET = 0;
  let openDay = null;                       // which day's "add" form is showing
  let pickDay = today();                    // which day's panel is open

  const paint = () => {
    const e  = DB.employee(empId);
    const wk = buildWeek(empId, WEEK_OFFSET);
    const total = wk.days.reduce((a,d)=>a+d.items.length,0);
    const url = location.origin + location.pathname.replace(/admin\/.*$/,'') + 'crew/#' + packWeek(wk);
    const label = `${fmtD(wk.start)} to ${fmtD(addDays(wk.start,6))}`;

    /* Two lists, not one. "Which client?" used to be every client ever, in
       one alphabetical run, so somebody who came off the website this morning
       sat between two jobs finished last year. The ones with no visit booked
       yet are the ones you are usually putting on a day, so they come first
       and they are labelled. */
    const all    = DB.clients('all').sort((a,b)=>a.name.localeCompare(b.name));
    const booked = new Set(DB.jobs('all').map(j=>j.client));
    const fresh  = all.filter(c=>!booked.has(c.id));
    const older  = all.filter(c=> booked.has(c.id));
    const opt = c => `<option value="${c.id}">${esc(c.name)}${c.addr?' — '+esc(c.addr.split(',')[0]):''}</option>`;
    const clientOpts = !all.length ? '<option value="">No clients yet</option>'
      : (fresh.length ? `<optgroup label="New — nothing booked yet">${fresh.map(opt).join('')}</optgroup>` : '')
      + (older.length ? `<optgroup label="Everyone else">${older.map(opt).join('')}</optgroup>` : '');

    /* keep the open day inside the week being looked at */
    if(!wk.days.some(d=>d.date===pickDay)) pickDay = wk.days[0].date;

    const jobsOn = iso => DB.jobs('all').filter(j =>
      j.date === iso && (j.crewIds||[]).includes(empId) && j.stage !== 'lost');

    /* THE WEEK, as a week. It was seven stacked boxes you scrolled through,
       which is a list wearing a calendar's name. Seven columns you can take
       in at once, each showing whether anything is on, and clicking one opens
       that day underneath. */
    const strip = wk.days.map(d => {
      const n = jobsOn(d.date).length;
      const dt = new Date(d.date+'T12:00');
      return `<button type="button" class="wkc${d.date===pickDay?' on':''}${d.date===today()?' now':''}"
          data-wkpick="${d.date}" aria-pressed="${d.date===pickDay}">
        <i>${dt.toLocaleDateString('en-US',{weekday:'short'})}</i>
        <b>${dt.getDate()}</b>
        <span class="wkdots">${n ? '<em></em>'.repeat(Math.min(n,3)) : '&nbsp;'}</span>
      </button>`;
    }).join('');

    const iso  = pickDay;
    const jobs = jobsOn(iso);
    const adding = openDay === iso;
    const panel = `<section class="wkday${iso===today()?' now':''}${jobs.length?' has':''}">
        <header>
          <b>${fmtFull(iso)}${iso===today()?' · today':''}</b>
          <span>${jobs.length ? `${jobs.length} visit${jobs.length===1?'':'s'}` : 'Nothing booked'}</span>
        </header>

        ${jobs.map(j => {
          const c = DB.client(j.client) || {};
          return `<div class="wkvisit">
            <span class="kdot k-${j.kind}"></span>
            <span class="wkv">
              <b>${esc(c.name || DB.clientName(j.client))}</b>
              <i>${esc(j.kind)}${j.title && j.title!=='Untitled' ? ' · '+esc(j.title) : ''}</i>
              ${c.addr||c.phone ? `<i class="wkwho">${esc([c.addr, c.phone].filter(Boolean).join(' · '))}</i>` : ''}
            </span>
            <button class="lnkbtn" data-wkedit="${j.id}" title="Open this visit">Open</button>
            <button class="lnkbtn danger" data-wkoff="${j.id}" title="Take ${esc(e?.name||'them')} off this visit">Remove</button>
          </div>`;
        }).join('')}

        ${adding ? `<div class="wkadd">
            <label>Which client?</label>
            <select data-wkclient>${clientOpts}</select>
            <label>What is the visit?</label>
            <div class="pickrow" data-wkkind data-pick="measure">
              ${KINDS.map(k=>`<button type="button" data-kindpick="${k}" class="${k==='measure'?'on':''}">
                <span class="kdot k-${k}"></span>${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}
            </div>
            <div class="btnrow">
              <button class="btn btn-sm btn-p" data-wkbook="${iso}" ${all.length?'':'disabled'}>Book it</button>
              <button class="btn btn-sm" data-wkcancel="1">Cancel</button>
              <button class="btn btn-sm" data-wknewclient="1">The client is not on the system yet</button>
            </div>
          </div>`
        : `<button class="wkplus" data-wkopen="${iso}">+ Put someone on this day</button>`}

        <label class="wknote">
          <em>A note for ${esc((e?.name||'them').split(' ')[0])} on this day</em>
          <textarea data-wknote="${iso}" rows="2"
            placeholder="Gate code, who has the key, park on the street…">${esc(DB.crewNote(empId, iso))}</textarea>
        </label>
      </section>`;

    const msg = `${e?.name || 'Your'} week, ${label}. ${total} visit${total===1?'':'s'}: ${url}`;

    dlg.innerHTML = `<h2>${esc(wk.crew)}&rsquo;s week</h2>
      <p class="sub dlgsub">${esc(label)} · ${total} visit${total===1?'':'s'} booked</p>
      <div class="btnrow wkbar">
        <button class="btn btn-sm" id="wk-prev">&larr; Week before</button>
        <button class="btn btn-sm" id="wk-now">This week</button>
        <button class="btn btn-sm" id="wk-next">Week after &rarr;</button></div>

      <div class="wkcal">${strip}</div>
      ${panel}

      <details class="wklink">
        <summary>Send this week to ${esc((e?.name||'them').split(' ')[0])}</summary>
        <p class="note">The week travels inside the link, so send a fresh one whenever it
          changes. Nothing on that page can be edited and it shows only this person&rsquo;s work.</p>
        <div class="btnrow wkshare">
          <a class="btn btn-sm" id="wk-wa" target="_blank" rel="noopener">WhatsApp</a>
          <a class="btn btn-sm" id="wk-sms">Text it</a>
          <a class="btn btn-sm" id="wk-mail">Email it</a>
          <button class="btn btn-sm" id="wk-open">Open it myself</button>
          <button class="btn btn-sm btn-p" id="wk-copy">Copy the link</button></div>
        <div class="f"><textarea id="wk-url" rows="2" readonly>${esc(url)}</textarea></div>
      </details>

      <div class="dlgacts"><button class="btn btn-p" value="cancel">Done</button></div>`;

    if(!dlg.open) dlg.showModal();
    wireCancel();
    $('#wk-prev').onclick = () => { WEEK_OFFSET--; openDay=null; paint(); };
    $('#wk-next').onclick = () => { WEEK_OFFSET++; openDay=null; paint(); };
    $('#wk-now').onclick  = () => { WEEK_OFFSET=0;  openDay=null; pickDay=today(); paint(); };
    $('#wk-open').onclick = () => window.open(url,'_blank','noopener');

    /* one link, four ways out of the office: whichever one that person
       actually reads. The phone number we hold for them is prefilled where
       the app accepts one. */
    const ph = (e?.phone || '').replace(/[^0-9+]/g,'');
    $('#wk-wa').href   = `https://wa.me/${ph.replace(/^\+/,'')}?text=${encodeURIComponent(msg)}`;
    $('#wk-sms').href  = `sms:${ph}${/iPhone|iPad|Mac/.test(navigator.platform)?'&':'?'}body=${encodeURIComponent(msg)}`;
    $('#wk-mail').href = `mailto:${encodeURIComponent(e?.email||'')}`
      + `?subject=${encodeURIComponent(`Your week, ${label}`)}&body=${encodeURIComponent(msg)}`;

    $('#wk-copy').onclick = async () => {
      const b = $('#wk-copy');
      try{ await navigator.clipboard.writeText(url); b.textContent='Copied'; }
      catch(err){ $('#wk-url').select(); b.textContent='Press ⌘C'; }
      setTimeout(()=>{ b.textContent='Copy the link'; }, 2200);
    };

    /* the kind picker inside the add form */
    dlg.querySelectorAll('[data-wkkind]').forEach(row => {
      row.addEventListener('click', ev => {
        const b = ev.target.closest('button'); if(!b) return;
        ev.preventDefault();
        row.dataset.pick = b.dataset.kindpick;
        row.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      });
    });

    /* a note is saved when they leave the box, not on every keystroke, so
       the panel is never redrawn out from under what they are typing */
    dlg.querySelectorAll('[data-wknote]').forEach(t => {
      t.addEventListener('change', () => DB.setCrewNote(empId, t.dataset.wknote, t.value));
    });

    dlg.onclick = ev => {
      const t = ev.target.closest('button'); if(!t) return;

      if(t.dataset.wkpick !== undefined){ pickDay = t.dataset.wkpick; openDay = null; paint(); return; }
      if(t.dataset.wkopen !== undefined){ openDay = t.dataset.wkopen; paint(); return; }
      if(t.dataset.wkcancel !== undefined){ openDay = null; paint(); return; }

      if(t.dataset.wknewclient !== undefined){
        /* Straight to the client form. When it saves, we come back here. */
        const day = openDay;
        close();
        openClient(null);
        const ok = $('#m-ok'); const was = ok?.onclick;
        if(ok) ok.onclick = () => { was?.(); openDay = day; openWeekLink(empId); };
        return;
      }

      if(t.dataset.wkbook !== undefined){
        const iso = t.dataset.wkbook;
        const cid = dlg.querySelector('[data-wkclient]')?.value;
        const kind = dlg.querySelector('[data-wkkind]')?.dataset.pick || 'measure';
        if(!cid){ toast('Pick a client first, or add one.', true); return; }
        const c = DB.client(cid);
        DB.addJob({ region:c?.region || DB.region(), client:cid,
                    title:`${kind[0].toUpperCase()+kind.slice(1)} — ${c?.name||''}`.trim(),
                    kind, date:iso, stage:'lead', crewIds:[empId] });
        /* a booked measure means the client has moved along the board */
        if(kind === 'measure' && c && ['new','contacted'].includes(c.stage)) DB.setClientStage(cid, 'measure');
        openDay = null; paint(); render();
        toast(`${c?.name || 'Booked'} on ${fmtD(iso)} — it is on the schedule.`);
        return;
      }

      if(t.dataset.wkedit !== undefined){ const id=t.dataset.wkedit; close(); return openJob(id); }

      if(t.dataset.wkoff !== undefined){
        const j = DB.job(t.dataset.wkoff); if(!j) return;
        DB.updateJob(j.id, { crewIds:(j.crewIds||[]).filter(x=>x!==empId) });
        paint(); render();
        toast('Taken off that visit. The visit itself is still booked.');
        return;
      }
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


/* ═══════════════ MOVING A CARD ALONG THE BOARD ═══════════════
   Dragging is the obvious gesture and it is what the board is for, but a
   drag is not available to everyone: it needs a pointer, a steady hand and
   sight of the whole row. So the same move is also one keystroke — select
   a card, press the left or right arrow — and the card itself is a button
   that opens the client, where the six stages are a row of real buttons.
   Three ways to the same change, none of them the only way.            */
(function pipelineDnD(){
  const main = document.getElementById('main');
  if(!main) return;
  let held = null;

  const clearOver = () =>
    main.querySelectorAll('.bdrop.over').forEach(d => d.classList.remove('over'));

  main.addEventListener('dragstart', e => {
    const card = e.target.closest('[data-card]'); if(!card) return;
    held = card.dataset.card;
    card.classList.add('lifting');
    e.dataTransfer.effectAllowed = 'move';
    /* Firefox refuses to start a drag without data on the transfer */
    try{ e.dataTransfer.setData('text/plain', held); }catch(err){}
  });
  main.addEventListener('dragend', e => {
    e.target.closest('[data-card]')?.classList.remove('lifting');
    held = null; clearOver();
  });
  main.addEventListener('dragover', e => {
    const drop = e.target.closest('[data-drop]'); if(!drop || !held) return;
    e.preventDefault();                       // without this the drop never fires
    e.dataTransfer.dropEffect = 'move';
    if(!drop.classList.contains('over')){ clearOver(); drop.classList.add('over'); }
  });
  main.addEventListener('dragleave', e => {
    const drop = e.target.closest('[data-drop]');
    if(drop && !drop.contains(e.relatedTarget)) drop.classList.remove('over');
  });
  main.addEventListener('drop', e => {
    const drop = e.target.closest('[data-drop]'); if(!drop) return;
    e.preventDefault();
    const id = held || (() => { try{ return e.dataTransfer.getData('text/plain'); }catch(err){ return ''; } })();
    clearOver(); held = null;
    if(!id) return;
    moveCard(id, drop.dataset.drop);
  });

  /* the keyboard route */
  main.addEventListener('keydown', e => {
    const card = e.target.closest('[data-card]'); if(!card) return;
    if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Enter' && e.key !== ' ') return;
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); return openClient(card.dataset.card); }
    e.preventDefault();
    const at = PIPE_ID.indexOf(card.dataset.stage);
    const to = PIPE_ID[at + (e.key === 'ArrowRight' ? 1 : -1)];
    if(to) moveCard(card.dataset.card, to, true);
  });

  function moveCard(id, stage, keepFocus){
    const c = DB.client(id);
    if(!c || c.stage === stage) return;
    const from = PIPE_LABEL[c.stage];
    DB.setClientStage(id, stage);
    render();
    if(keepFocus) document.querySelector(`[data-card="${id}"]`)?.focus();
    toast(`${c.name}: ${from} → ${PIPE_LABEL[stage]}`);
  }
})();
