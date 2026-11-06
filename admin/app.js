import { DB, REGIONS, STAGES, STAGE_LABEL, KINDS } from './store.js';
import { quickPrice, MODULES, MODULE_IDS } from '../assets/js/design.js';
import { unpack, describe } from '../assets/js/enquiry.js';

const cat = await (await fetch((window.BASE||"")+'assets/data/catalog.json')).json();
const $ = s => document.querySelector(s);
const money = n => '$'+Math.round(n||0).toLocaleString();
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today = () => new Date().toISOString().slice(0,10);
const fmtD = iso => new Date(iso+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
const fmtFull = iso => new Date(iso+'T12:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});

export const refresh = () => render();

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

/* ═══════════════ VIEWS ═══════════════ */
const V = {};

V.today = () => {
  const jobs = DB.jobs(), rm = DB.regionMeta();
  const live = jobs.filter(j=>!['done','lost'].includes(j.stage));
  const td = jobs.filter(j=>j.date===today());
  const next = [...live].filter(j=>j.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,7);
  const month = jobs.filter(j=>j.stage==='done' && j.date.slice(0,7)===today().slice(0,7));
  const pipe = jobs.filter(j=>['quoted','won','ordered','scheduled'].includes(j.stage));
  const needQuote = jobs.filter(j=>j.stage==='lead');
  return `
  <div class="hd"><div><h1>${DB.region()==='all'?'All regions':rm.name}</h1>
    <p>${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}${DB.region()==='all'?'':' · '+rm.base}</p></div>
    <div class="hdacts"><button class="btn" data-act="newclient">+ Client</button>
      <button class="btn btn-p" data-act="newjob">+ Job</button></div></div>

  ${td.length?`<div class="panel accent"><header><h3>On today</h3><span>${td.length} visit${td.length>1?'s':''}</span></header>
    <table><tbody>${td.map(j=>row(j)).join('')}</tbody></table></div>`:''}

  <div class="cards">
    <div class="card"><span class="k">Pipeline</span><div class="v">${money(pipe.reduce((a,x)=>a+x.value,0))}</div><span class="d">${pipe.length} live jobs</span></div>
    <div class="card"><span class="k">Installed this month</span><div class="v">${money(month.reduce((a,x)=>a+x.value,0))}</div><span class="d">${month.length} completed</span></div>
    <div class="card"><span class="k">Waiting on a quote</span><div class="v">${needQuote.length}</div><span class="d">${needQuote.length?'Oldest '+fmtD([...needQuote].sort((a,b)=>a.date.localeCompare(b.date))[0].date):'All clear'}</span></div>
    <div class="card"><span class="k">Clients</span><div class="v">${DB.clients().length}</div><span class="d">${DB.region()==='all'?'across every region':'in '+rm.short}</span></div>
  </div>

  <div class="panel"><header><h3>Next up</h3><button class="btn btn-sm" data-nav="schedule">Full schedule →</button></header>
  ${next.length?`<table><thead><tr><th>Date</th><th>Client</th><th>Job</th><th>Visit</th>${DB.region()==='all'?'<th>Region</th>':''}<th>Stage</th><th class="mono">Value</th></tr></thead>
    <tbody>${next.map(j=>row(j,true)).join('')}</tbody></table>`:'<div class="empty">Nothing booked. Enjoy it.</div>'}</div>

  <div class="panel"><header><h3>Pipeline</h3></header><div class="bd">
    ${(() => {
      /* Bar by VALUE, not by count. The old version sized the bar on how many
         jobs were in a stage and then printed the money next to it, so a lead
         worth nothing drew a longer bar than an ordered job worth $5,240.
         Scale against the biggest stage so the chart has a real axis. */
      const rows = STAGES.filter(s => s !== 'lost').map(s => {
        const it = jobs.filter(j => j.stage === s);
        return { s, n: it.length, v: it.reduce((a,x) => a + x.value, 0) };
      });
      const peak = Math.max(1, ...rows.map(r => r.v));
      return rows.map(r => {
        const pct = r.v ? Math.max(4, (r.v / peak) * 100) : 0;
        return `<div class="pipe"><span class="pill p-${r.s}">${STAGE_LABEL[r.s]}</span>
        <div class="bar"${r.v ? '' : ' data-empty="1"'}><div style="width:${pct.toFixed(1)}%"></div></div>
        <span class="pn">${r.n} job${r.n===1?'':'s'} · ${money(r.v)}</span></div>`;
      }).join('');
    })()}
  </div></div>`;
};

const row = (j,withHead) => `<tr data-job="${j.id}">
  <td class="mono">${fmtD(j.date)}</td><td>${esc(DB.clientName(j.client))}</td>
  <td><b>${esc(j.title)}</b></td><td class="cap">${esc(j.kind)}</td>
  ${DB.region()==='all'?`<td><span class="rtag">${DB.regionMeta(j.region).short}</span></td>`:''}
  <td><span class="pill p-${j.stage}">${STAGE_LABEL[j.stage]}</span></td>
  <td class="mono">${j.value?money(j.value):'&ndash;'}</td></tr>`;

V.schedule = () => {
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  const first=new Date(y,m,1), start=new Date(first); start.setDate(1-first.getDay());
  const jobs=DB.jobs();
  let cells='';
  for(let i=0;i<42;i++){
    const dt=new Date(start); dt.setDate(start.getDate()+i);
    const iso=dt.toISOString().slice(0,10);
    const ev=jobs.filter(j=>j.date===iso);
    cells+=`<div class="day ${dt.getMonth()!==m?'out':''} ${iso===today()?'today':''}" data-date="${iso}">
      <span class="dnum">${dt.getDate()}</span>
      ${ev.map(e=>`<span class="ev ${e.kind}" data-job="${e.id}" title="${esc(DB.clientName(e.client))} · ${esc(e.title)}">${esc(DB.clientName(e.client).split(' ')[0])} · ${esc(e.title)}</span>`).join('')}
    </div>`;
  }
  const mo=jobs.filter(j=>j.date.slice(0,7)===today().slice(0,7));
  return `<div class="hd"><div><h1>${now.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h1>
    <p>${mo.length} booked${DB.region()==='all'?' across every region':' in '+DB.regionMeta().name} · ${money(mo.reduce((a,x)=>a+x.value,0))}</p></div>
    <button class="btn btn-p" data-act="newjob">+ Book a visit</button></div>
  <div class="panel"><div class="bd">
    <div class="legend">${KINDS.map(k=>`<span><i class="k-${k}"></i>${k[0].toUpperCase()+k.slice(1)}</span>`).join('')}
      <span style="margin-left:auto;color:var(--muted)">Click any day to book · click a visit to edit</span></div>
    <div class="cal">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="dow">${x}</div>`).join('')}${cells}</div>
  </div></div>`;
};

V.clients = () => {
  const c=DB.clients();
  return `<div class="hd"><div><h1>Clients</h1><p>${c.length}${DB.region()==='all'?' across every region':' in '+DB.regionMeta().name}</p></div>
    <button class="btn btn-p" data-act="newclient">+ Add client</button></div>
  <div class="panel">${c.length?`<table><thead><tr><th>Name</th><th>Phone</th><th>Address</th>${DB.region()==='all'?'<th>Region</th>':''}<th>Source</th><th>Jobs</th><th class="mono">Lifetime</th></tr></thead><tbody>
  ${c.map(x=>{const js=DB.jobs('all').filter(j=>j.client===x.id);
    return `<tr data-client="${x.id}"><td><b>${esc(x.name)}</b><br><span class="sub">${esc(x.email)}</span></td>
    <td class="mono">${esc(x.phone)}</td><td class="sub">${esc(x.addr)}</td>
    ${DB.region()==='all'?`<td><span class="rtag">${DB.regionMeta(x.region).short}</span></td>`:''}
    <td><span class="pill" style="color:var(--muted)">${esc(x.source)}</span></td><td>${js.length}</td>
    <td class="mono">${money(js.filter(j=>j.stage==='done').reduce((a,j)=>a+j.value,0))}</td></tr>`}).join('')}
  </tbody></table>`:'<div class="empty">No clients in this region yet.</div>'}</div>`;
};

V.jobs = () => {
  const j=[...DB.jobs()].sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="hd"><div><h1>Jobs</h1><p>${j.length} total · ${money(j.filter(x=>x.stage!=='lost').reduce((a,x)=>a+x.value,0))} booked</p></div>
    <button class="btn btn-p" data-act="newjob">+ New job</button></div>
  <div class="panel">${j.length?`<table><thead><tr><th>Date</th><th>Client</th><th>Job</th><th>Finish</th>${DB.region()==='all'?'<th>Region</th>':''}<th>Crew</th><th>Stage</th><th class="mono">Value</th></tr></thead><tbody>
  ${j.map(x=>`<tr data-job="${x.id}"><td class="mono">${fmtD(x.date)}</td><td>${esc(DB.clientName(x.client))}</td>
    <td><b>${esc(x.title)}</b>${x.notes?`<br><span class="sub">${esc(x.notes.slice(0,70))}${x.notes.length>70?'…':''}</span>`:''}</td>
    <td class="sub">${esc(x.finish)}</td>
    ${DB.region()==='all'?`<td><span class="rtag">${DB.regionMeta(x.region).short}</span></td>`:''}
    <td class="sub">${esc(x.crew||'')||'&ndash;'}</td>
    <td><span class="pill p-${x.stage}">${STAGE_LABEL[x.stage]}</span></td><td class="mono">${x.value?money(x.value):'&ndash;'}</td></tr>`).join('')}
  </tbody></table>`:'<div class="empty">No jobs in this region yet.</div>'}</div>`;
};

V.quotes = () => {
  const q=DB.quotes();
  return `<div class="hd"><div><h1>Quotes</h1><p>${q.length} on file · ${money(q.filter(x=>x.status==='sent').reduce((a,x)=>a+x.total,0))} awaiting a reply</p></div></div>
  <div class="panel">${q.length?`<table><thead><tr><th>Date</th><th>Client</th><th>Quote</th><th>Status</th><th class="mono">Total</th></tr></thead><tbody>
  ${q.map(x=>`<tr data-quote="${x.id}"><td class="mono">${fmtD(x.created)}</td><td>${esc(DB.clientName(x.client))}</td>
    <td><b>${esc(x.title)}</b><br><span class="sub">${esc(x.summary)}</span></td>
    <td><span class="pill ${x.status==='accepted'?'p-won':x.status==='sent'?'p-quoted':'p-lead'} cap">${x.status}</span></td>
    <td class="mono">${money(x.total)}</td></tr>`).join('')}
  </tbody></table>`:'<div class="empty">No quotes in this region yet.</div>'}</div>

  <div class="panel"><header><h3>Price a closet</h3><span>Same engine as the website builder</span></header>
  <div class="bd"><div class="f3">
    <div class="f"><label>Wall width (in)</label><input id="pw" type="number" value="120"></div>
    <div class="f"><label>Depth (in)</label><input id="pd" type="number" value="24"></div>
    <div class="f"><label>What's in it</label><select id="pl">${MODULE_IDS.map(k=>`<option value="${k}">${MODULES[k].label}</option>`).join('')}</select></div>
  </div>
  <div class="f"><label>Finish</label><select id="pf">${cat.finishes.map(f=>`<option value="${esc(f.n)}">${esc(f.n)} · Level ${f.lv} · $${f.sq.toFixed(2)}/sq ft</option>`).join('')}</select></div>
  <button class="btn btn-p" id="pgo">Calculate</button>
  <div id="pout"></div></div></div>`;
};

/* ═══════════════ INBOX ═══════════════
   The website is static, so a lead cannot be written straight into this
   browser from a customer's one. It arrives as an email carrying a reference
   code. Paste the code here and the client, the job and the quote are created
   in the right region with the whole parts list attached. Nothing is retyped.
   When a shared database goes in later, this view reads from it instead and
   everything below it stays as it is. */
let INBOX_DRAFT = null;

V.inbox = () => {
  const saved = DB.enquiries();
  return `<div class="hd"><div><h1>Inbox</h1>
    <p>Paste the reference code from a website enquiry. It carries the customer, the room, every section, every part and the price.</p></div></div>

  <div class="panel"><header><h3>Add a web enquiry</h3><span>Paste the code from the email</span></header><div class="bd">
    <div class="f"><label>Reference code</label>
      <textarea id="inbox-code" rows="4" placeholder="JSC1...."></textarea></div>
    <div class="btnrow">
      <button class="btn btn-p" data-act="inbox-read">Read it</button>
      <button class="btn" data-act="inbox-clear">Clear</button>
    </div>
    <div id="inbox-out"></div>
  </div></div>

  <div class="panel"><header><h3>Filed from the website</h3><span>${saved.length} so far</span></header>
  ${saved.length ? `<table><thead><tr><th>Received</th><th>Customer</th><th>What they drew</th><th>Region</th><th class="mono">Estimate</th></tr></thead><tbody>
    ${saved.slice().reverse().map(e=>`<tr data-client="${esc(e.clientId||'')}">
      <td class="mono">${fmtD((e.sent||today()).slice(0,10))}</td>
      <td><b>${esc(e.contact?.name||'Unknown')}</b><br><span class="sub">${esc(e.contact?.phone||'')} ${esc(e.contact?.email||'')}</span></td>
      <td>${esc(describe(e))}</td>
      <td><span class="pill cap">${esc((e.regionId||'').toUpperCase()||'—')}</span></td>
      <td class="mono">${money(e.design?.price||0)}</td></tr>`).join('')}
  </tbody></table>` : '<div class="empty">Nothing filed yet. Paste the first code above.</div>'}</div>

  <div class="panel"><header><h3>How a lead gets here</h3></header><div class="bd">
    <div class="note"><b>1.</b> The customer draws their closet at <b>/design/</b> and presses "Send this to us". They see exactly what is being sent, then fill in their name, phone, email, town and address.<br><br>
    <b>2.</b> That enquiry emails you, through Web3Forms, with a readable summary and a reference code. Your Web3Forms key goes in Settings; until it is in, the enquiry opens in the customer's own mail client instead, so nothing is lost either way.<br><br>
    <b>3.</b> You paste the code above. The client, a measure visit and a draft quote are created in the region the ZIP belongs to, with the whole parts list on the quote.</div>
  </div></div>`;
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
    ${existing?`<div class="note warn">There is already a client called <b>${esc(existing.name)}</b> in ${esc(DB.regionMeta(existing.region).name)}. Filing this will add the job to them rather than making a second record.</div>`:''}
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
      source: e.source || 'Website',
      notes: e.contact.message || '' });
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
    finish: d?.finish || 'n/a', crew:'',
    notes: [describe(e), e.contact.message].filter(Boolean).join(' — ') });

  let quote = null;
  if(d){
    quote = DB.addQuote({ region, client:client.id, title,
      total: Math.round(d.price||0), status:'draft',
      summary: d.summary,
      /* the whole drawing rides along, so the parts list is one click away
         and nobody has to go back to the email */
      design: d });
  }

  DB.addEnquiry({ ...e, clientId:client.id, jobId:job.id, quoteId:quote?.id });
  INBOX_DRAFT = null;
  render();
  alert(`Filed. ${client.name} is in ${REGIONS.find(r=>r.id===region).name}, with a measure visit booked for today and ${quote?'a draft quote of '+money(quote.total):'no quote yet'}.`);
}

V.settings = () => {
  const s=DB.settings();
  return `<div class="hd"><div><h1>Settings</h1><p>Keys and business details. Everything here stays in this browser.</p></div></div>

  <div class="panel"><header><h3>Claude assistant</h3><span class="dot ${s.anthropicKey?'on':''}"></span></header><div class="bd">
    <div class="note warn"><b>Your own Anthropic key goes here.</b> The assistant calls Anthropic directly from this browser and is billed to your account. The key never leaves this machine and never touches our servers. Get one at <b>console.anthropic.com → API Keys</b>.</div>
    <div class="f"><label>Anthropic API key</label><input id="s-key" type="password" placeholder="sk-ant-..." value="${esc(s.anthropicKey)}"></div>
    <div class="f"><label>Model</label><select id="s-model">
      ${['claude-sonnet-4-6','claude-opus-4-1','claude-haiku-4-5'].map(m=>`<option${m===s.model?' selected':''}>${m}</option>`).join('')}</select></div>
    <button class="btn btn-p" data-act="savekey">Save key</button>
    <span id="keymsg" class="inline-msg"></span>
  </div></div>

  <div class="panel"><header><h3>Business</h3></header><div class="bd">
    <div class="f2"><div class="f"><label>Business name</label><input id="s-biz" value="${esc(s.business)}"></div>
      <div class="f"><label>Phone</label><input id="s-phone" value="${esc(s.phone)}"></div></div>
    <div class="f2"><div class="f"><label>Email</label><input id="s-email" value="${esc(s.email)}"></div>
      <div class="f"><label>Markup multiplier</label><input id="s-markup" type="number" step="0.1" value="${s.markup}"></div></div>
    <button class="btn btn-p" data-act="savebiz">Save</button></div></div>

  <div class="panel"><header><h3>Still to connect</h3></header><div class="bd">
    <div class="f"><label>Web3Forms key, for the website contact form</label><input id="s-w3f" placeholder="Sign up free at web3forms.com" value="${esc(s.web3forms)}"></div>
    <div class="f"><label>Resend API key, for quote emails</label><input id="s-resend" type="password" placeholder="re_..." value="${esc(s.resendKey)}"></div>
    <div class="f"><label>Google Maps embed URL, for the contact page</label><input id="s-map" placeholder="Maps → Share → Embed a map → copy the src" value="${esc(s.mapsEmbed)}"></div>
    <button class="btn" data-act="savebiz">Save</button></div></div>

  <div class="panel"><header><h3>Your data</h3></header><div class="bd">
    <div class="note">Everything lives in this browser. That is fine for one person on one computer. It is not fine for a crew on three phones. <b>Download a backup weekly.</b> The handover notes explain the one change that moves this to a shared database.</div>
    <div class="btnrow">
      <button class="btn" data-act="export">Download backup</button>
      <button class="btn" data-act="import">Restore from backup</button>
      <button class="btn danger" data-act="reset">Reset to demo data</button>
    </div>
    <input type="file" id="importFile" accept="application/json" hidden></div></div>`;
};

/* ═══════════════ ROUTER ═══════════════ */
let view='today';
function render(){
  $('#main').innerHTML = V[view]();
  document.querySelectorAll('.nvi').forEach(b=>b.toggleAttribute('aria-current', b.dataset.v===view));
  $('#main').scrollTop=0;
  paintRegions();
  if(view==='quotes') wireCalc();
}
document.addEventListener('click', e=>{
  const nav=e.target.closest('[data-v],[data-nav]');
  if(nav){ view=nav.dataset.v||nav.dataset.nav; render(); return; }
  const act=e.target.closest('[data-act]'); if(act) return doAct(act.dataset.act);
  const job=e.target.closest('[data-job]'); if(job){ e.stopPropagation(); return openJob(job.dataset.job); }
  const qr=e.target.closest('[data-quote]'); if(qr) return openQuote(qr.dataset.quote);
  const cl=e.target.closest('[data-client]'); if(cl) return openClient(cl.dataset.client);
  const day=e.target.closest('.day'); if(day) return openJob(null, day.dataset.date);
});

function doAct(a){
  if(a==='inbox-read'){
    const out=$('#inbox-out');
    try{
      INBOX_DRAFT = unpack($('#inbox-code').value);
      out.innerHTML = inboxPreview(INBOX_DRAFT);
    }catch(err){
      INBOX_DRAFT = null;
      out.innerHTML = `<div class="note warn"><b>${esc(err.message)}</b> Paste the whole line, starting with JSC1. It is at the bottom of the enquiry email.</div>`;
    }
    return;
  }
  if(a==='inbox-clear'){ INBOX_DRAFT=null; $('#inbox-code').value=''; $('#inbox-out').innerHTML=''; return; }
  if(a==='inbox-file') return inboxFile();
  if(a==='newclient') return openClient(null);
  if(a==='newjob')    return openJob(null);
  if(a==='savekey'){
    DB.setSettings({anthropicKey:$('#s-key').value.trim(), model:$('#s-model').value});
    $('#keymsg').textContent='Saved. The assistant is live.';
    document.querySelector('.agent .dot')?.classList.toggle('on', !!$('#s-key').value.trim());
    return;
  }
  if(a==='savebiz'){
    DB.setSettings({business:$('#s-biz')?.value, phone:$('#s-phone')?.value, email:$('#s-email')?.value,
      markup:+($('#s-markup')?.value||2.8), web3forms:$('#s-w3f')?.value,
      resendKey:$('#s-resend')?.value, mapsEmbed:$('#s-map')?.value});
    render(); return;
  }
  if(a==='export'){
    const b=new Blob([DB.export()],{type:'application/json'});
    const u=URL.createObjectURL(b), l=document.createElement('a');
    l.href=u; l.download=`js-closets-backup-${today()}.json`; l.click();
    setTimeout(()=>URL.revokeObjectURL(u),2000); return;
  }
  if(a==='import'){
    const f=$('#importFile'); f.value=''; f.click();
    f.onchange=()=>{ const file=f.files[0]; if(!file) return;
      const r=new FileReader();
      r.onload=()=>{ try{ DB.import(r.result); render(); alert('Backup restored.'); }
                     catch(err){ alert('Could not read that file: '+err.message); } };
      r.readAsText(file); };
    return;
  }
  if(a==='reset'){ if(confirm('Reset everything back to the demo data? Your current records will be lost.')){DB.reset(); render();} return; }
}

/* A quote that came in from the 3D builder carries the whole drawing, so the
   parts list is a click away rather than back in the email it arrived in. */
function openQuote(id){
  const q = DB.quotes('all').find(x=>x.id===id); if(!q) return;
  const d = q.design;
  dlg.innerHTML = `<h2>${esc(q.title)}</h2>
    <p class="sub">${esc(DB.clientName(q.client))} · ${esc(q.summary||'')} · <b>${money(q.total)}</b></p>
    ${d ? `<table class="kv"><tbody>
      <tr><th>Room</th><td>${d.room.w}" × ${d.room.d}" × ${d.room.h}"</td></tr>
      <tr><th>Finish</th><td>${esc(d.finish)}${d.frontFinish&&d.frontFinish!==d.finish?' carcass · '+esc(d.frontFinish)+' fronts':''}</td></tr>
      <tr><th>Hardware</th><td>${esc(d.pull||'')} in ${esc(d.pullFinish||'')}</td></tr>
      <tr><th>Doors</th><td>${esc(d.door||'')}</td></tr>
      ${(d.fittings||[]).length?`<tr><th>On the walls</th><td>${d.fittings.map(f=>esc(f.item)+(f.note?' ('+esc(f.note)+')':'')).join(', ')}</td></tr>`:''}
    </tbody></table>
    <h3 style="margin:1.1em 0 .4em;font-size:.95rem">Every section</h3>
    <table class="kv"><tbody>${(d.bays||[]).map((b,i)=>`<tr><th>${i+1}. ${esc(b.wall||'')} ${b.width}"</th>
      <td>${b.stack.map(s=>esc(s.module)+(s.height?' at '+s.height+'"':'')).join(' over ')}${b.topShelf===false?' · open top':''}</td></tr>`).join('')}</tbody></table>
    <h3 style="margin:1.1em 0 .4em;font-size:.95rem">Parts list</h3>
    <table><thead><tr><th>Item</th><th class="mono">Qty</th><th class="mono">Sq ft</th><th class="mono">Band ft</th><th>Detail</th></tr></thead>
      <tbody>${(d.order||[]).map(o=>`<tr><td>${esc(o.item)}</td><td class="mono">${o.qty}</td>
        <td class="mono">${o.sq_ft??''}</td><td class="mono">${o.edgeband_ft??''}</td><td class="sub">${esc(o.detail||'')}</td></tr>`).join('')}</tbody></table>
    <div class="btnrow" style="margin-top:1em"><button class="btn" id="q-csv">Download the parts list</button></div>`
    : '<div class="empty">This quote was written by hand, so there is no parts list on it.</div>'}
    <div class="dlgacts"><button class="btn" value="cancel">Close</button></div>`;
  dlg.showModal();
  dlg.querySelector('[value=cancel]').onclick = close;
  const csv = dlg.querySelector('#q-csv');
  if(csv) csv.onclick = () => {
    const rows = [['Item','Qty','Sq ft','Edgeband ft','Finish','Detail'],
      ...(d.order||[]).map(o=>[o.item,o.qty,o.sq_ft,o.edgeband_ft,o.finish,o.detail])];
    const text = rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const u = URL.createObjectURL(new Blob([text],{type:'text/csv'}));
    const a = document.createElement('a');
    a.href = u; a.download = `${q.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-parts.csv`; a.click();
    setTimeout(()=>URL.revokeObjectURL(u),1500);
  };
}

/* ═══════════════ MODALS ═══════════════ */
const dlg=$('#dlg');
const close=()=>dlg.close();
function openClient(id){
  const c = id ? DB.client(id) : null;
  dlg.innerHTML=`<h2>${c?'Client':'New client'}</h2>
   <div class="f"><label>Name</label><input id="m-n" value="${esc(c?.name||'')}"></div>
   <div class="f2"><div class="f"><label>Phone</label><input id="m-p" value="${esc(c?.phone||'')}"></div>
     <div class="f"><label>Email</label><input id="m-e" type="email" value="${esc(c?.email||'')}"></div></div>
   <div class="f"><label>Address</label><input id="m-a" value="${esc(c?.addr||'')}"></div>
   <div class="f2"><div class="f"><label>Region</label><select id="m-r">${REGIONS.map(r=>`<option value="${r.id}"${(c?.region||DB.region())===r.id?' selected':''}>${r.name}</option>`).join('')}</select></div>
     <div class="f"><label>Source</label><select id="m-s">${['Website','Referral','Google','Houzz','Trade','Walk-in'].map(x=>`<option${c?.source===x?' selected':''}>${x}</option>`).join('')}</select></div></div>
   <div class="f"><label>Notes</label><textarea id="m-no" rows="2">${esc(c?.notes||'')}</textarea></div>
   <div class="dlgacts"><button class="btn" value="cancel">Cancel</button><button class="btn btn-p" id="m-ok">${c?'Save':'Add client'}</button></div>`;
  dlg.showModal();
  dlg.querySelector('[value=cancel]').onclick=close;
  $('#m-ok').onclick=()=>{
    if(!$('#m-n').value.trim()) return;
    const p={name:$('#m-n').value,phone:$('#m-p').value,email:$('#m-e').value,addr:$('#m-a').value,
             region:$('#m-r').value,source:$('#m-s').value,notes:$('#m-no').value};
    c?DB.updateClient(c.id,p):DB.addClient(p);
    close(); render();
  };
}
function openJob(id, presetDate){
  const j = id ? DB.job(id) : null;
  const cs = DB.clients('all');
  dlg.innerHTML=`<h2>${j?'Visit':'New visit'}</h2>
   <div class="f"><label>Client</label><select id="m-c">${cs.map(c=>`<option value="${c.id}"${j&&j.client===c.id?' selected':''}>${esc(c.name)} · ${DB.regionMeta(c.region).short}</option>`).join('')}</select></div>
   <div class="f"><label>Job title</label><input id="m-t" value="${esc(j?.title||'')}" placeholder="e.g. Primary walk-in"></div>
   <div class="f2"><div class="f"><label>Date</label><input id="m-d" type="date" value="${j?.date||presetDate||today()}"></div>
     <div class="f"><label>Visit type</label><select id="m-k">${KINDS.map(k=>`<option${j&&j.kind===k?' selected':''}>${k}</option>`).join('')}</select></div></div>
   <div class="f2"><div class="f"><label>Stage</label><select id="m-st">${STAGES.map(s=>`<option value="${s}"${j&&j.stage===s?' selected':''}>${STAGE_LABEL[s]}</option>`).join('')}</select></div>
     <div class="f"><label>Value ($)</label><input id="m-v" type="number" value="${j?.value||0}"></div></div>
   <div class="f2"><div class="f"><label>Crew</label><input id="m-cr" value="${esc(j?.crew||'')}" placeholder="Who's going"></div>
     <div class="f"><label>Finish</label><input id="m-fi" value="${esc(j?.finish||'')}"></div></div>
   <div class="f"><label>Notes</label><textarea id="m-no" rows="3">${esc(j?.notes||'')}</textarea></div>
   <div class="dlgacts">${j?'<button class="btn danger" id="m-del">Delete</button>':''}
     <button class="btn" value="cancel">Cancel</button><button class="btn btn-p" id="m-ok">${j?'Save':'Book it'}</button></div>`;
  dlg.showModal();
  dlg.querySelector('[value=cancel]').onclick=close;
  $('#m-del')?.addEventListener('click',()=>{ if(confirm('Delete this visit?')){DB.removeJob(j.id); close(); render();} });
  $('#m-ok').onclick=()=>{
    const cl=DB.client($('#m-c').value);
    const p={client:$('#m-c').value, region:cl?cl.region:DB.region(),
      title:$('#m-t').value||'Untitled', date:$('#m-d').value, kind:$('#m-k').value,
      stage:$('#m-st').value, value:+$('#m-v').value, crew:$('#m-cr').value,
      finish:$('#m-fi').value||'n/a', notes:$('#m-no').value};
    j?DB.updateJob(j.id,p):DB.addJob({...p,type:'n/a'});
    close(); render();
  };
}

function wireCalc(){
  $('#pgo').onclick=()=>{
    const w=+$('#pw').value, d=+$('#pd').value, layout=$('#pl').value, fin=$('#pf').value;
    if(w < 24){ $('#pout').innerHTML='<div class="note">Too narrow. A bay cannot be under 24".</div>'; return; }
    const r=quickPrice(w,d,layout,fin,cat);
    $('#pout').innerHTML=`<div class="note calc">
      <b class="big">${money(r.price.price)}</b> installed &nbsp;·&nbsp; cost ${money(r.price.cost)} × ${r.price.markup}
      <br><span class="sub">${r.bays.length} bays · ${r.parts.length} parts · ${r.order.length} order lines · ${esc(fin)} · ${r.finish.lead} week lead</span></div>`;
  };
}

paintRegions(); render();
