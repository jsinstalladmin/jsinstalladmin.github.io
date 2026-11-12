/* ============================================================
   store.js — all CRM data, now in a real database.

   HOW THIS WORKS, because it matters if anyone touches it later.

   Everything is loaded once at sign-in into an in-memory copy. Every
   read below is synchronous and answers from that copy, which is why
   the application is instant and why none of the screens had to be
   rewritten. Every write updates the copy first so the screen redraws
   at once, then persists to Postgres in the background. If a write
   fails, onError fires, the screen says so, and the copy is refreshed
   from the database so what you see is never a lie.

   The Anthropic key is deliberately NOT in here. It is a billing
   credential, so it stays in the browser that typed it and is never
   sent anywhere, including to this database.
   ============================================================ */
import { sb } from './supa.js';

export const REGIONS = [
  { id:'fl', name:'Florida', short:'FL', base:'Boca Raton, FL',
    /* the whole peninsula, Orlando and Tampa down through the Keys */
    areas:['Boca Raton','Delray Beach','Boynton Beach','Fort Lauderdale','West Palm Beach','Miami','Naples','Fort Myers','Sarasota','Tampa','Orlando','Melbourne','Port St. Lucie','Key Largo','Key West'] },
  { id:'nj', name:'New Jersey',    short:'NJ', base:'Paramus, NJ',
    areas:['Bergen County','Essex County','Morris County','Hudson County','Monmouth County'] },
  { id:'ny', name:'New York',      short:'NY', base:'Westchester, NY',
    areas:['Westchester','Long Island','Rockland','Brooklyn','Queens'] },
  { id:'ct', name:'Connecticut',   short:'CT', base:'Stamford, CT',
    areas:['Fairfield County','New Haven County','Hartford County'] },
  { id:'pa', name:'Pennsylvania',  short:'PA', base:'Bucks County, PA',
    areas:['Bucks County','Montgomery County','Philadelphia','Chester County','Delaware County'] }
];
/* ───────── where a client is, which is the whole pipeline ─────────
   A lead and a client were two different things, which meant the same
   person existed twice and nobody could see where they had got to. There
   is one record now — a client — and this is the only thing that moves.
   The colour is the column's colour on the board and the dot on the card. */
export const PIPE = [
  { id:'new',       label:'New lead',        c:'#C2572F',
    note:'Came in off the website. Nobody has spoken to them yet.' },
  { id:'contacted', label:'Contacted',       c:'#B4832B',
    note:'Someone has reached them. No measure booked.' },
  { id:'measure',   label:'Measure booked',  c:'#4E7F93',
    note:'A measure is on the calendar.' },
  { id:'quoted',    label:'Quoted',          c:'#5C6FA8',
    note:'A price has gone out and you are waiting on an answer.' },
  { id:'won',       label:'Booked in',       c:'#3F7A4D',
    note:'They said yes. This is work.' },
  { id:'lost',      label:'Not going ahead', c:'#8A8178',
    note:'Kept on file, so you know who to call back next year.' },
];
export const PIPE_ID    = PIPE.map(p => p.id);
export const PIPE_LABEL = Object.fromEntries(PIPE.map(p => [p.id, p.label]));
export const PIPE_COLOR = Object.fromEntries(PIPE.map(p => [p.id, p.c]));

export const STAGES = ['lead','quoted','won','ordered','scheduled','done','lost'];
export const STAGE_LABEL = {lead:'Lead',quoted:'Quoted',won:'Won',ordered:'Ordered',
  scheduled:'Scheduled',done:'Installed',lost:'Lost'};
export const KINDS = ['measure','delivery','install','service'];
export const ROLES = ['Installer','Lead installer','Measurer','Shop','Driver','Office'];

const LOCAL = 'js_crm_v2';          // the old browser-only store, kept for the one-time move
const PREFS = 'js_crm_prefs';       // this browser's own preferences, never shared

const today = () => new Date().toISOString().slice(0,10);

/* ───────── the in-memory copy ───────── */
let db = { clients:[], jobs:[], quotes:[], employees:[], leads:[], settings:{} };
let prefs = { activeRegion:'fl', anthropicKey:'', model:'claude-sonnet-4-6' };
try{ Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS) || '{}')); }catch(e){}
const savePrefs = () => { try{ localStorage.setItem(PREFS, JSON.stringify(prefs)); }catch(e){} };

let errHandler = () => {};
export const onError = fn => { errHandler = fn; };
const fail = (what, err) => { console.error('[store]', what, err); errHandler(what, err); };

/* A new record is shown at once with a temporary id so the screen never waits
   on the network. The database then answers with the real id. Until the screen
   is redrawn, every button on that row is still carrying the temporary one,
   which means editing or deleting something you have only just added silently
   does nothing. So the moment an id is swapped, the screen is told to redraw. */
let savedHandler = () => {};
export const onSaved = fn => { savedHandler = fn; };

/* ───────── ids ─────────
   AN ID OFF A FORM IS A STRING. AN ID OUT OF POSTGRES IS A NUMBER.

   `<select>.value` and `dataset.crew` are always strings, because that is
   what HTML holds. Postgres hands back bigints. Every lookup in here and
   every comparison in app.js uses `===`, so the moment a form-made id met a
   database-made id they stopped matching, and the screen said so: a quote
   you had just added showed its client as "Unknown", a visit you had just
   booked showed its crew as "Unassigned", and accepting a quote quietly
   failed to move the client to Booked in or to spot the install it had
   already booked. A reload fixed it, which is the worst kind of bug: it
   looks broken, then it looks fine, so nobody can say what happened.

   Two rules, and the fifteen `===` comparisons scattered through app.js all
   come right on their own:

     idIn   every id is made canonical the moment it enters, so a numeric
            string becomes a number and a temporary 'tmp_x9f2' stays a
            string. Nothing downstream ever sees the form's version.
     sameId the lookups compare by value anyway, so the next select somebody
            adds cannot bring this back. */
const idIn = v => (v === null || v === undefined || v === '') ? null
  : (typeof v === 'number' ? v : (/^\d+$/.test(String(v)) ? Number(v) : v));
const idsIn  = a => (Array.isArray(a) ? a : []).map(idIn).filter(v => v !== null);
const sameId = (a,b) => a !== null && a !== undefined && b !== null && b !== undefined
  && String(a) === String(b);

/* ───────── row shapes: the database uses snake_case, the app does not ───────── */
const jobIn  = r => ({ id:idIn(r.id), region:r.region, client:idIn(r.client_id), title:r.title, type:r.type,
  stage:r.stage, value:Number(r.value)||0, date:r.date, kind:r.kind, finish:r.finish,
  crewIds:idsIn(r.crew_ids), crew:'', notes:r.notes||'' });
const jobOut = j => ({ region:j.region, client_id:idIn(j.client), title:j.title, type:j.type||'',
  stage:j.stage, value:j.value||0, date:j.date, kind:j.kind, finish:j.finish||'n/a',
  crew_ids:idsIn(j.crewIds), notes:j.notes||'' });

const quoteIn  = r => ({ id:idIn(r.id), region:r.region, client:idIn(r.client_id), title:r.title,
  total:Number(r.total)||0, status:r.status, summary:r.summary||'', design:r.design||null,
  created:(r.created||'').slice(0,10) });
const quoteOut = q => ({ region:q.region, client_id:idIn(q.client), title:q.title,
  total:q.total||0, status:q.status||'draft', summary:q.summary||'', design:q.design||null });

const empIn  = r => ({ id:idIn(r.id), region:r.region, name:r.name, role:r.role, phone:r.phone||'',
  email:r.email||'', active:r.active!==false, started:r.started||'', notes:r.notes||'' });
const empOut = e => ({ region:e.region, name:e.name, role:e.role||'Installer', phone:e.phone||'',
  email:e.email||'', active:e.active!==false, started:e.started||today(), notes:e.notes||'' });

const cliIn  = r => ({ id:idIn(r.id), region:r.region, name:r.name, phone:r.phone||'', email:r.email||'',
  addr:r.addr||'', source:r.source||'Website', notes:r.notes||'', created:(r.created||'').slice(0,10),
  stage: PIPE_ID.includes(r.stage) ? r.stage : 'new',
  stageAt: r.stage_at || r.created || null });
const cliOut = c => ({ region:c.region, name:c.name, phone:c.phone||'', email:c.email||'',
  addr:c.addr||'', source:c.source||'Website', notes:c.notes||'',
  stage: PIPE_ID.includes(c.stage) ? c.stage : 'new',
  stage_at: c.stageAt || new Date().toISOString() });

/* the crew names on a job, derived rather than stored twice */
const stampCrew = j => { j.crew = (j.crewIds||[]).map(id=>(db.employees.find(e=>sameId(e.id,id))||{}).name)
  .filter(Boolean).join(' + '); return j; };

/* ───────── load ───────── */
export async function hydrate(){
  const [c,e,j,q,l,s] = await Promise.all([
    sb.from('clients').select('*'),
    sb.from('employees').select('*'),
    sb.from('jobs').select('*'),
    sb.from('quotes').select('*'),
    sb.from('leads').select('*').order('created',{ascending:false}).limit(500),
    sb.from('settings').select('data').eq('id',1).maybeSingle(),
  ]);
  for(const r of [c,e,j,q,l,s]) if(r.error) throw r.error;
  db.clients   = (c.data||[]).map(cliIn);
  db.employees = (e.data||[]).map(empIn);
  db.jobs      = (j.data||[]).map(jobIn).map(stampCrew);
  db.quotes    = (q.data||[]).map(quoteIn);
  db.leads     = l.data||[];
  db.settings  = (s.data?.data) || {};
  return db;
}

/* ───────── writes: cache first so the screen is instant, then persist ───────── */
async function push(table, row, local){
  const { data, error } = await sb.from(table).insert(row).select().single();
  if(error){ fail('could not save that', error); await hydrate(); savedHandler(); return null; }
  if(local && data){
    local.id = data.id;                           // swap the temporary id for the real one
    if(data.created) local.created = String(data.created).slice(0,10);
    savedHandler();                               // redraw, so the buttons carry the real id
  }
  return data;
}
async function patch(table, id, row, what){
  const { error } = await sb.from(table).update(row).eq('id', id);
  if(error){ fail(what || 'could not save that change', error); await hydrate(); }
}
async function drop(table, id, what){
  const { error } = await sb.from(table).delete().eq('id', id);
  if(error){ fail(what || 'could not delete that', error); await hydrate(); }
}
const tmpId = () => 'tmp_' + Math.random().toString(36).slice(2,10);

export const DB = {
  all: () => db,
  ready: () => !!db.clients,

  region: () => prefs.activeRegion,
  setRegion: r => { prefs.activeRegion = r; savePrefs(); return r; },
  regionMeta: id => REGIONS.find(r=>r.id===(id||prefs.activeRegion)) || REGIONS[0],

  clients: region => { const r = region||prefs.activeRegion;
    return r==='all' ? db.clients : db.clients.filter(c=>c.region===r); },
  jobs: region => { const r = region||prefs.activeRegion;
    return r==='all' ? db.jobs : db.jobs.filter(j=>j.region===r); },
  quotes: region => { const r = region||prefs.activeRegion;
    return r==='all' ? db.quotes : db.quotes.filter(q=>q.region===r); },
  employees: region => { const r = region||prefs.activeRegion;
    return r==='all' ? db.employees : db.employees.filter(e=>e.region===r); },

  client: id => db.clients.find(c=>sameId(c.id,id)),
  clientName: id => (db.clients.find(c=>sameId(c.id,id))||{}).name || 'Unknown',
  findClient: name => { const n=String(name||'').toLowerCase().trim(); if(!n) return null;
    return db.clients.find(c=>c.name.toLowerCase()===n)
        || db.clients.find(c=>c.name.toLowerCase().includes(n))
        || db.clients.find(c=>n.includes(c.name.toLowerCase().split(' ')[0])) || null; },
  clientLoad: id => ({ jobs: db.jobs.filter(j=>sameId(j.client,id)).length,
                       quotes: db.quotes.filter(q=>sameId(q.client,id)).length }),

  addClient: c => { const row = { id:tmpId(), created:today(),
      region:c.region||prefs.activeRegion, name:c.name, phone:c.phone||'', email:c.email||'',
      addr:c.addr||'', source:c.source||'Website', notes:c.notes||'',
      stage: PIPE_ID.includes(c.stage) ? c.stage : 'new',
      stageAt: new Date().toISOString() };
    db.clients.push(row); push('clients', cliOut(row), row); return row; },

  /* Moving someone along the board is the one action the whole office is
     built around, so it stamps WHEN it moved. That is what lets a card say
     "3d in stage", which is the number that tells you who is being left. */
  setClientStage: (id, stage) => { const c = DB.client(id); if(!c) return null;
    if(!PIPE_ID.includes(stage) || c.stage === stage) return c;
    c.stage = stage; c.stageAt = new Date().toISOString();
    patch('clients', id, { stage:c.stage, stage_at:c.stageAt }, 'could not move that client');
    return c; },

  /* What a client is worth: their quotes if any have been priced, otherwise
     the jobs booked for them. Nothing invented — a client with no numbers
     against them shows no number. */
  clientValue: id => {
    /* The four statuses a quote can have are draft, sent, accepted and
       declined. This filtered out 'rejected', which is not one of them and
       never has been, so a quote the customer had turned down still counted
       toward what the client was worth. The office was looking at money it
       was never going to get. */
    const q = db.quotes.filter(x => sameId(x.client, id) && x.status !== 'declined');
    if(q.length) return q.reduce((a,x) => a + (+x.total || 0), 0);
    return db.jobs.filter(x => sameId(x.client, id)).reduce((a,x) => a + (+x.value || 0), 0);
  },
  /* whole days since the card last moved */
  daysInStage: c => {
    if(!c?.stageAt) return 0;
    const t = new Date(c.stageAt).getTime();
    if(!Number.isFinite(t)) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
  },
  updateClient: (id,p) => { const c = DB.client(id); if(!c) return null;
    Object.assign(c,p); patch('clients', id, cliOut(c)); return c; },
  removeClient: id => { const i=db.clients.findIndex(c=>sameId(c.id,id)); if(i<0) return false;
    db.clients.splice(i,1);
    db.jobs   = db.jobs.filter(j=>j.client!==id);
    db.quotes = db.quotes.filter(q=>q.client!==id);
    drop('clients', id);                      /* the database cascades the rest */
    return true; },

  job: id => db.jobs.find(j=>sameId(j.id,id)),
  findJob: t => { const n=String(t||'').toLowerCase().trim(); if(!n) return null;
    return db.jobs.find(j=>j.title.toLowerCase()===n)
        || db.jobs.find(j=>j.title.toLowerCase().includes(n)) || null; },
  addJob: j => { const row = stampCrew({ id:tmpId(), region:j.region||prefs.activeRegion,
      client:idIn(j.client), title:j.title||'Untitled', type:j.type||'', stage:j.stage||'lead',
      value:+j.value||0, date:j.date||today(), kind:j.kind||'measure',
      finish:j.finish||'n/a', crewIds:idsIn(j.crewIds), notes:j.notes||'' });
    db.jobs.push(row); push('jobs', jobOut(row), row); return row; },
  updateJob: (id,p) => { const j = DB.job(id); if(!j) return null;
    Object.assign(j, p, ('client' in p) ? {client:idIn(p.client)} : {},
                     ('crewIds' in p) ? {crewIds:idsIn(p.crewIds)} : {});
    stampCrew(j); patch('jobs', j.id, jobOut(j)); return j; },
  removeJob: id => { const i=db.jobs.findIndex(j=>sameId(j.id,id)); if(i<0) return false;
    db.jobs.splice(i,1); drop('jobs', id); return true; },

  quote: id => db.quotes.find(q=>sameId(q.id,id)),
  addQuote: q => { const row = { id:tmpId(), created:today(), region:q.region||prefs.activeRegion,
      client:idIn(q.client), title:q.title||'Untitled quote', total:+q.total||0,
      status:q.status||'draft', summary:q.summary||'', design:q.design||null };
    db.quotes.push(row); push('quotes', quoteOut(row), row); return row; },
  updateQuote: (id,p) => { const q = DB.quote(id); if(!q) return null;
    Object.assign(q, p, ('client' in p) ? {client:idIn(p.client)} : {});
    patch('quotes', q.id, quoteOut(q)); return q; },
  removeQuote: id => { const i=db.quotes.findIndex(q=>sameId(q.id,id)); if(i<0) return false;
    db.quotes.splice(i,1); drop('quotes', id); return true; },

  employee: id => db.employees.find(e=>sameId(e.id,id)),
  employeeName: id => (DB.employee(id)||{}).name || '',
  addEmployee: e => { const row = { id:tmpId(), region:e.region||prefs.activeRegion,
      name:e.name, role:e.role||'Installer', phone:e.phone||'', email:e.email||'',
      active:e.active!==false, started:e.started||today(), notes:e.notes||'' };
    db.employees.push(row); push('employees', empOut(row), row); return row; },
  updateEmployee: (id,p) => { const e = DB.employee(id); if(!e) return null;
    Object.assign(e,p); patch('employees', id, empOut(e));
    db.jobs.forEach(stampCrew); return e; },
  removeEmployee: id => { const i=db.employees.findIndex(e=>sameId(e.id,id)); if(i<0) return false;
    db.employees.splice(i,1);
    /* the database has a trigger that takes them off every visit; mirror it here
       so the screen agrees with the database without waiting for a round trip */
    for(const j of db.jobs) if(j.crewIds?.some(x=>sameId(x,id))){
      j.crewIds = j.crewIds.filter(x=>!sameId(x,id)); stampCrew(j);
    }
    drop('employees', id); return true; },

  /* ───────── leads from the website ───────── */
  leads: () => db.leads,
  newLeads: () => db.leads.filter(l => !l.handled),
  enquiries: () => db.leads.filter(l => l.handled),
  lead: id => db.leads.find(l=>sameId(l.id,id)),
  addEnquiry: e => { const row = { id:tmpId(), created:new Date().toISOString(), handled:true,
      region_id:e.regionId||null, source:e.source||'Website', contact:e.contact,
      design:e.design||null, client_id:e.clientId||null };
    db.leads.unshift(row);
    push('leads', { handled:true, region_id:row.region_id, source:row.source,
      contact:row.contact, design:row.design, client_id:row.client_id }, row);
    return row; },
  markLeadHandled: (id, clientId, regionId) => { const l = DB.lead(id); if(!l) return null;
    l.handled = true; l.client_id = clientId || l.client_id; l.region_id = regionId || l.region_id;
    patch('leads', id, { handled:true, client_id:l.client_id, region_id:l.region_id });
    return l; },
  removeEnquiry: id => { const i=db.leads.findIndex(l=>sameId(l.id,id)); if(i<0) return false;
    db.leads.splice(i,1); drop('leads', id); return true; },

  /* ───────── settings ─────────
     Shared business details live in the database. The Anthropic key and the
     chosen model are per browser and never leave it. */
  settings: () => ({ ...db.settings, anthropicKey:prefs.anthropicKey, model:prefs.model }),

  /* ── A note for one crew member on one day ──────────────────────────
     Not a property of a job: it is what the boss wants that person to
     know that morning, whether or not there is a visit booked. It rides
     in the settings blob keyed by person and date, so it needs no table
     of its own and it travels into the week link with everything else. */
  crewNote: (empId, iso) => (db.settings.crewNotes || {})[empId + '|' + iso] || '',
  setCrewNote: (empId, iso, text) => {
    const notes = { ...(db.settings.crewNotes || {}) };
    const key = empId + '|' + iso;
    if(String(text||'').trim()) notes[key] = String(text).trim(); else delete notes[key];
    db.settings.crewNotes = notes;
    DB.setSettings({ crewNotes: notes });
  },
  setSettings: s => {
    if('anthropicKey' in s){ prefs.anthropicKey = s.anthropicKey; savePrefs(); delete s.anthropicKey; }
    if('model' in s){ prefs.model = s.model; savePrefs(); delete s.model; }
    if(Object.keys(s).length){
      Object.assign(db.settings, s);
      sb.from('settings').update({ data: db.settings }).eq('id',1)
        .then(({error}) => { if(error) fail('could not save the business settings', error); });
    }
    return DB.settings();
  },

  refresh: hydrate,
  export: () => JSON.stringify({ ...db, exportedAt:new Date().toISOString() }, null, 2),

  /* ───────── the one-time move from the old browser-only store ───────── */
  localBackup: () => { try{ return JSON.parse(localStorage.getItem(LOCAL) || 'null'); }catch(e){ return null; } },
  async importLocal(old){
    if(!old) return { clients:0, employees:0, jobs:0, quotes:0 };
    const idmap = new Map();
    const count = { clients:0, employees:0, jobs:0, quotes:0 };

    for(const e of (old.employees||[])){
      const { data, error } = await sb.from('employees').insert(empOut(e)).select().single();
      if(error) throw error; idmap.set(e.id, data.id); count.employees++;
    }
    for(const c of (old.clients||[])){
      const { data, error } = await sb.from('clients').insert(cliOut(c)).select().single();
      if(error) throw error; idmap.set(c.id, data.id); count.clients++;
    }
    for(const j of (old.jobs||[])){
      const row = jobOut({ ...j, client: idmap.get(j.client) || null,
        crewIds: (j.crewIds||[]).map(x=>idmap.get(x)).filter(Boolean) });
      const { error } = await sb.from('jobs').insert(row);
      if(error) throw error; count.jobs++;
    }
    for(const q of (old.quotes||[])){
      const { error } = await sb.from('quotes').insert(quoteOut({ ...q, client: idmap.get(q.client) || null }));
      if(error) throw error; count.quotes++;
    }
    if(old.settings){
      const { anthropicKey, model, ...rest } = old.settings;
      await sb.from('settings').update({ data: rest }).eq('id',1);
    }
    await hydrate();
    return count;
  },
};

/* app.js compares ids too; it uses the same rule rather than its own. */
export { idIn, sameId };
