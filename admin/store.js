/* ============================================================
   store.js: all CRM data.
   Multi-region: every client, job and quote belongs to a region.
   Storage is this browser. To go multi-device, every read/write
   goes through DB.* below. Swap the bodies for Supabase calls
   and nothing else in the app changes.
   ============================================================ */
const K = 'js_crm_v2';
const d = n => { const t=new Date(); t.setDate(t.getDate()+n); return t.toISOString().slice(0,10); };

export const REGIONS = [
  { id:'fl', name:'South Florida', short:'FL', base:'Boca Raton, FL',
    areas:['Boca Raton','Delray Beach','Boynton Beach','Fort Lauderdale','West Palm Beach','Parkland'] },
  { id:'nj', name:'New Jersey',    short:'NJ', base:'Paramus, NJ',
    areas:['Bergen County','Essex County','Morris County','Hudson County','Monmouth County'] },
  { id:'ny', name:'New York',      short:'NY', base:'Westchester, NY',
    areas:['Westchester','Long Island','Rockland','Brooklyn','Queens'] },
  { id:'ct', name:'Connecticut',   short:'CT', base:'Stamford, CT',
    areas:['Fairfield County','New Haven County','Hartford County'] },
  { id:'pa', name:'Pennsylvania',  short:'PA', base:'Bucks County, PA',
    areas:['Bucks County','Montgomery County','Philadelphia','Chester County','Delaware County'] }
];
export const STAGES = ['lead','quoted','won','ordered','scheduled','done','lost'];
export const STAGE_LABEL = {lead:'Lead',quoted:'Quoted',won:'Won',ordered:'Ordered',
  scheduled:'Scheduled',done:'Installed',lost:'Lost'};
export const KINDS = ['measure','delivery','install','service'];
export const ROLES = ['Installer','Lead installer','Measurer','Shop','Driver','Office'];

const SEED = {
  activeRegion:'fl',
  enquiries:[],
  employees:[
    {id:'e1',region:'fl',name:'Luis Ortega',  role:'Lead installer',phone:'(561) 555-0210',email:'',active:true,started:'2022-04-11',notes:'Runs the Boca crew.'},
    {id:'e2',region:'fl',name:'Marco Pineda', role:'Installer',     phone:'(561) 555-0233',email:'',active:true,started:'2023-01-09',notes:''},
    {id:'e3',region:'nj',name:'Tomas Reyes',  role:'Lead installer',phone:'(201) 555-0144',email:'',active:true,started:'2021-08-02',notes:'Also covers New York.'},
    {id:'e4',region:'nj',name:'Ray Dunham',   role:'Installer',     phone:'(201) 555-0166',email:'',active:true,started:'2024-03-18',notes:''},
    {id:'e5',region:'ny',name:'Andre Silva',  role:'Measurer',      phone:'(914) 555-0177',email:'',active:true,started:'2023-06-05',notes:''}
  ],
  clients:[
    {id:'c1',region:'fl',name:'Marisol Vega',phone:'(561) 555-0142',email:'marisol.vega@example.com',addr:'418 NW 7th Ave, Boca Raton, FL 33486',source:'Website',notes:'',created:d(-26)},
    {id:'c2',region:'fl',name:'Daniel Okafor',phone:'(561) 555-0188',email:'d.okafor@example.com',addr:'2210 Spanish River Rd, Boca Raton, FL 33432',source:'Referral',notes:'',created:d(-19)},
    {id:'c3',region:'fl',name:'The Ferrante Residence',phone:'(954) 555-0109',email:'ferrante.home@example.com',addr:'7712 NW 52nd Ct, Parkland, FL 33076',source:'Houzz',notes:'',created:d(-12)},
    {id:'c4',region:'nj',name:'Alicia Brandt',phone:'(201) 555-0171',email:'abrandt@example.com',addr:'88 Ridgewood Ave, Paramus, NJ 07652',source:'Website',notes:'',created:d(-9)},
    {id:'c5',region:'nj',name:'Hoffman Builders',phone:'(201) 555-0133',email:'ops@hoffmanbuilt.example',addr:'15 Industrial Way, Teterboro, NJ 07608',source:'Trade',notes:'Builder account, four units this quarter.',created:d(-34)},
    {id:'c6',region:'ny',name:'Priya Raghunathan',phone:'(914) 555-0188',email:'praghu@example.com',addr:'62 Larchmont Ave, Larchmont, NY 10538',source:'Google',notes:'',created:d(-7)},
    {id:'c7',region:'ny',name:'Sandra Whitlock',phone:'(516) 555-0120',email:'swhitlock@example.com',addr:'310 Shore Rd, Port Washington, NY 11050',source:'Referral',notes:'',created:d(-3)},
    {id:'c8',region:'ct',name:'Gareth Ellison',phone:'(203) 555-0164',email:'g.ellison@example.com',addr:'44 Hoyt St, Stamford, CT 06905',source:'Website',notes:'',created:d(-15)},
    {id:'c9',region:'pa',name:'The Marchetti Family',phone:'(215) 555-0147',email:'marchetti@example.com',addr:'920 Yardley Rd, Newtown, PA 18940',source:'Referral',notes:'',created:d(-5)}
  ],
  jobs:[
    {id:'j1',region:'fl',client:'c1',title:'Primary walk-in, U-shape',type:'Walk-In Closets',stage:'done',value:6480,date:d(-9),kind:'install',finish:'Acacia Honey L591',crew:'Luis + Marco',notes:'Installed in one day. Asked about a quote for the guest room.',crewIds:['e1','e2']},
    {id:'j2',region:'fl',client:'c2',title:'Guest reach-in ×2',type:'Reach-In Closets',stage:'scheduled',value:3120,date:d(2),kind:'install',finish:'After Hours M2010',crew:'Luis + Marco',notes:'Two 6ft openings. Double hang + drawers both.',crewIds:['e1','e2']},
    {id:'j3',region:'fl',client:'c3',title:'Garage storage wall',type:'Garage Storage',stage:'ordered',value:5240,date:d(10),kind:'delivery',finish:'White Brava M175B',crew:'',notes:'Wall-hung throughout. Confirm water heater clearance.',crewIds:[]},
    {id:'j4',region:'fl',client:'c1',title:'Guest room reach-in',type:'Reach-In Closets',stage:'lead',value:0,date:d(1),kind:'measure',finish:'n/a',crew:'',notes:'Repeat client.',crewIds:[]},
    {id:'j5',region:'nj',client:'c4',title:'Primary walk-in',type:'Walk-In Closets',stage:'quoted',value:7890,date:d(3),kind:'measure',finish:'n/a',crew:'',notes:'Quote sent Tuesday. Deciding between Level 2 and 3.',crewIds:[]},
    {id:'j6',region:'nj',client:'c5',title:'Unit 12, reach-ins ×4',type:'Reach-In Closets',stage:'ordered',value:9600,date:d(8),kind:'delivery',finish:'White Fineline H3195',crew:'Tomas + Ray',notes:'Builder account. Site access 7am only.',crewIds:['e3','e4']},
    {id:'j7',region:'nj',client:'c5',title:'Unit 14, reach-ins ×4',type:'Reach-In Closets',stage:'won',value:9600,date:d(21),kind:'measure',finish:'n/a',crew:'',notes:'Same spec as Unit 12.',crewIds:[]},
    {id:'j8',region:'ny',client:'c6',title:'Walk-in with island',type:'Walk-In Closets',stage:'lead',value:0,date:d(4),kind:'measure',finish:'n/a',crew:'',notes:'Came through the 3D builder. Her layout is on the quote.',crewIds:[]},
    {id:'j9',region:'ny',client:'c7',title:'Pantry + laundry',type:'Pantries',stage:'scheduled',value:4390,date:d(6),kind:'install',finish:'White Brava M175B',crew:'Tomas + Ray',notes:'',crewIds:['e3','e4']},
    {id:'j10',region:'ct',client:'c8',title:'Primary + guest walk-ins',type:'Walk-In Closets',stage:'ordered',value:11250,date:d(14),kind:'delivery',finish:'Carte blanche PM115 Lummia',crew:'',notes:'Gloss finish, 6 week lead, ordered three weeks ago.',crewIds:[]},
    {id:'j11',region:'pa',client:'c9',title:'Mudroom + laundry',type:'Laundry Rooms',stage:'won',value:5120,date:d(5),kind:'measure',finish:'n/a',crew:'',notes:'Deposit taken. Confirm machine heights at measure.'}
  ],
  quotes:[
    {id:'q1',region:'nj',client:'c4',title:'Primary walk-in, Level 2',total:7890,status:'sent',created:d(-5),summary:'U-shape · 108"×120"×96" · 8 sections · Acacia Honey L591',crewIds:[]},
    {id:'q2',region:'ny',client:'c6',title:'Walk-in island (from builder)',total:11240,status:'draft',created:d(-1),summary:'Island · 132"×132"×96" · 11 sections · Carte blanche PM115 Lummia'},
    {id:'q3',region:'fl',client:'c3',title:'Garage storage wall',total:5240,status:'accepted',created:d(-18),summary:'One wall · 144"×24"×96" · 5 sections · White Brava M175B'},
    {id:'q4',region:'pa',client:'c9',title:'Mudroom + laundry',total:5120,status:'accepted',created:d(-11),summary:'Two walls · counter + lockers · White Fineline H3195'}
  ],
  settings:{
    business:'JS Installations & Closets', email:'jsinstallationsclosets@gmail.com',
    phone:'(646) 667-9572', markup:2.8,
    anthropicKey:'', model:'claude-sonnet-4-6',
    web3forms:'', resendKey:'', mapsEmbed:''
  }
};

function load(){
  try{ const r=localStorage.getItem(K); if(r) return JSON.parse(r); }catch(e){}
  try{ localStorage.setItem(K, JSON.stringify(SEED)); }catch(e){}
  return structuredClone(SEED);
}
let db = load();
/* A store saved before crew existed has no employees array. Rather than make
   everyone reset their data, anything the seed has and the saved copy does
   not is filled in on load. */
for(const k of ['employees','enquiries','clients','jobs','quotes']) if(!Array.isArray(db[k])) db[k] = structuredClone(SEED[k] || []);
if(!db.settings) db.settings = structuredClone(SEED.settings);
const save = () => { try{ localStorage.setItem(K, JSON.stringify(db)); }catch(e){
  console.warn('[store] could not save; storage may be full or blocked', e); } };
const uid = p => p + Math.random().toString(36).slice(2,8);
const today = () => new Date().toISOString().slice(0,10);

export const DB = {
  all: () => db,
  region: () => db.activeRegion,
  setRegion: r => { db.activeRegion = r; save(); return r; },
  regionMeta: id => REGIONS.find(r=>r.id===(id||db.activeRegion)) || REGIONS[0],

  /* pass region:'all' to cross every region */
  clients: (region) => { const r = region||db.activeRegion;
    return r==='all' ? db.clients : db.clients.filter(c=>c.region===r); },
  jobs: (region) => { const r = region||db.activeRegion;
    return r==='all' ? db.jobs : db.jobs.filter(j=>j.region===r); },
  quotes: (region) => { const r = region||db.activeRegion;
    return r==='all' ? db.quotes : db.quotes.filter(q=>q.region===r); },

  client: id => db.clients.find(c=>c.id===id),
  clientName: id => (db.clients.find(c=>c.id===id)||{}).name || 'Unknown',
  findClient: name => { const n=String(name||'').toLowerCase().trim(); if(!n) return null;
    return db.clients.find(c=>c.name.toLowerCase()===n)
        || db.clients.find(c=>c.name.toLowerCase().includes(n))
        || db.clients.find(c=>n.includes(c.name.toLowerCase().split(' ')[0])) || null; },

  addClient: c => { c.id=uid('c'); c.region=c.region||db.activeRegion;
    c.created=today(); db.clients.push(c); save(); return c; },
  updateClient: (id,p) => { const c=DB.client(id); if(!c) return null; Object.assign(c,p); save(); return c; },

  job: id => db.jobs.find(j=>j.id===id),
  findJob: t => { const n=String(t||'').toLowerCase().trim(); if(!n) return null;
    return db.jobs.find(j=>j.title.toLowerCase()===n) || db.jobs.find(j=>j.title.toLowerCase().includes(n)) || null; },
  addJob: j => { j.id=uid('j'); j.region=j.region||db.activeRegion; db.jobs.push(j); save(); return j; },
  updateJob: (id,p) => { const j=DB.job(id); if(!j) return null; Object.assign(j,p); save(); return j; },
  removeJob: id => { const i=db.jobs.findIndex(j=>j.id===id); if(i<0) return false;
    db.jobs.splice(i,1); save(); return true; },

  addQuote: q => { q.id=uid('q'); q.region=q.region||db.activeRegion;
    q.created=today(); db.quotes.push(q); save(); return q; },
  updateQuote: (id,p) => { const q=db.quotes.find(x=>x.id===id); if(!q) return null; Object.assign(q,p); save(); return q; },

  /* leads that came in from the website, filed through Admin -> Inbox */
  enquiries: () => (db.enquiries = db.enquiries || []),
  addEnquiry: e => { db.enquiries = db.enquiries || [];
    e.id = uid('e'); e.filed = new Date().toISOString();
    db.enquiries.push(e); save(); return e; },

  /* ───── crew ─────
     Region scoped like everything else, so switching to New Jersey shows the
     New Jersey crew and nobody else. */
  employees: (region) => { const r = region || db.activeRegion;
    db.employees = db.employees || [];
    return r==='all' ? db.employees : db.employees.filter(e=>e.region===r); },
  employee: id => (db.employees||[]).find(e=>e.id===id),
  employeeName: id => (DB.employee(id)||{}).name || '',
  addEmployee: e => { db.employees = db.employees || [];
    e.id = uid('e'); e.region = e.region || db.activeRegion;
    e.active = e.active !== false; e.started = e.started || today();
    db.employees.push(e); save(); return e; },
  updateEmployee: (id,p) => { const e = DB.employee(id); if(!e) return null;
    Object.assign(e,p); save(); return e; },
  removeEmployee: id => { const i=(db.employees||[]).findIndex(e=>e.id===id); if(i<0) return false;
    const gone = db.employees[i].id;
    db.employees.splice(i,1);
    /* a deleted person must not stay assigned to next week's visits */
    for(const j of db.jobs) if(j.crewIds) j.crewIds = j.crewIds.filter(x=>x!==gone);
    save(); return true; },

  /* Deleting a client takes their jobs and quotes with them, because a job
     with no client is a row nobody can act on. The caller shows the count
     first and asks. */
  clientLoad: id => ({
    jobs: db.jobs.filter(j=>j.client===id).length,
    quotes: db.quotes.filter(q=>q.client===id).length }),
  removeClient: id => { const i=db.clients.findIndex(c=>c.id===id); if(i<0) return false;
    db.clients.splice(i,1);
    db.jobs   = db.jobs.filter(j=>j.client!==id);
    db.quotes = db.quotes.filter(q=>q.client!==id);
    save(); return true; },
  removeQuote: id => { const i=db.quotes.findIndex(q=>q.id===id); if(i<0) return false;
    db.quotes.splice(i,1); save(); return true; },
  removeEnquiry: id => { db.enquiries = db.enquiries || [];
    const i=db.enquiries.findIndex(e=>e.id===id); if(i<0) return false;
    db.enquiries.splice(i,1); save(); return true; },

  settings: () => db.settings,
  setSettings: s => { Object.assign(db.settings,s); save(); return db.settings; },

  export: () => JSON.stringify(db,null,2),
  import: json => { const next=JSON.parse(json);
    if(!next.clients||!next.jobs) throw new Error('That file is not a JS Closets backup.');
    db=next; save(); return db; },
  reset: () => { try{ localStorage.removeItem(K); }catch(e){} db=load(); return db; }
};
