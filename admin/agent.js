/* ============================================================
   agent.js — the assistant.
   Calls Anthropic DIRECTLY from this browser with the owner's own
   key. The key stays on this machine; usage is billed to them.
   Supports images: photograph a handwritten schedule, drop it in,
   and it reads the names, numbers and prices and books the work.
   ============================================================ */
import { DB, REGIONS, STAGE_LABEL, STAGES, KINDS } from './store.js';
import { refresh } from './app.js';
import { quickPrice, MODULES, MODULE_IDS } from '../assets/js/design.js';

const cat = await (await fetch((window.BASE||"")+'assets/data/catalog.json')).json();
const $ = s => document.querySelector(s);
const chat = $('#chat');
let history = [];
let pending = [];          // images staged for the next message

/* ───────────── tools ───────────── */
const R = REGIONS.map(r=>r.id);
const TOOLS = [
  { name:'read_schedule', description:'Read booked visits. Filter by region and/or an ISO date range. Use this for any question about what is on, who is where, or what is coming up.',
    input_schema:{type:'object',properties:{region:{type:'string',enum:[...R,'all']},from:{type:'string'},to:{type:'string'},stage:{type:'string',enum:STAGES}}} },
  { name:'list_clients', description:'List clients with contact details, job count and lifetime value. Optional text search on name, email or address.',
    input_schema:{type:'object',properties:{region:{type:'string',enum:[...R,'all']},search:{type:'string'}}} },
  { name:'get_client', description:'Everything about one client, including all of their jobs and quotes.',
    input_schema:{type:'object',required:['name'],properties:{name:{type:'string'}}} },
  { name:'create_client', description:'Add a new client. Region defaults to the one currently selected.',
    input_schema:{type:'object',required:['name'],properties:{name:{type:'string'},phone:{type:'string'},
      email:{type:'string'},address:{type:'string'},region:{type:'string',enum:R},
      source:{type:'string'},notes:{type:'string'}}} },
  { name:'update_client', description:'Change a client’s contact details or notes.',
    input_schema:{type:'object',required:['name'],properties:{name:{type:'string'},phone:{type:'string'},
      email:{type:'string'},address:{type:'string'},notes:{type:'string'},region:{type:'string',enum:R}}} },
  { name:'create_job', description:'Book a visit on the schedule. If the client does not exist yet it is created first. Use this when asked to add someone to the schedule.',
    input_schema:{type:'object',required:['client_name','title','date'],properties:{
      client_name:{type:'string'},title:{type:'string'},date:{type:'string',description:'YYYY-MM-DD'},
      kind:{type:'string',enum:KINDS},stage:{type:'string',enum:STAGES},value:{type:'number'},
      crew:{type:'string'},finish:{type:'string'},notes:{type:'string'},
      region:{type:'string',enum:R},client_phone:{type:'string'},client_address:{type:'string'}}} },
  { name:'update_job', description:'Change an existing visit: move the date, change the stage, value, crew or notes.',
    input_schema:{type:'object',required:['job_title'],properties:{job_title:{type:'string',description:'Enough of the title to identify it'},
      date:{type:'string'},stage:{type:'string',enum:STAGES},value:{type:'number'},kind:{type:'string',enum:KINDS},
      crew:{type:'string'},finish:{type:'string'},notes:{type:'string'}}} },
  { name:'cancel_job', description:'Remove a visit from the schedule entirely.',
    input_schema:{type:'object',required:['job_title'],properties:{job_title:{type:'string'}}} },
  { name:'list_quotes', description:'List quotes with their status and total.',
    input_schema:{type:'object',properties:{region:{type:'string',enum:[...R,'all']}}} },
  { name:'create_quote', description:'Save a quote against a client.',
    input_schema:{type:'object',required:['client_name','title','total'],properties:{
      client_name:{type:'string'},title:{type:'string'},total:{type:'number'},
      summary:{type:'string'},status:{type:'string',enum:['draft','sent','accepted','declined']}}} },
  { name:'price_closet', description:'Price a closet run off the real supplier catalogue with the business markup applied. Returns supplier cost and the installed client price.',
    input_schema:{type:'object',required:['width_in'],properties:{width_in:{type:'number'},depth_in:{type:'number'},
      contents:{type:'string',enum:MODULE_IDS,description:'What goes in the bays'},
      finish:{type:'string'},with_order_list:{type:'boolean',description:'Also return every part to order'}}} },
  { name:'list_finishes', description:'List available finishes with price level, cost per square foot and lead time.',
    input_schema:{type:'object',properties:{level:{type:'number'},search:{type:'string'}}} },
  { name:'business_summary', description:'Pipeline value, revenue installed this month, open quotes and client counts, broken down by region.',
    input_schema:{type:'object',properties:{region:{type:'string',enum:[...R,'all']}}} },
  { name:'switch_region', description:'Change which region the dashboard is showing.',
    input_schema:{type:'object',required:['region'],properties:{region:{type:'string',enum:[...R,'all']}}} }
];

const clientOut = c => ({ name:c.name, phone:c.phone, email:c.email, address:c.addr,
  region:DB.regionMeta(c.region).name, source:c.source, notes:c.notes });
const jobOut = j => ({ title:j.title, client:DB.clientName(j.client), date:j.date, visit:j.kind,
  stage:STAGE_LABEL[j.stage], value:j.value, crew:j.crew, finish:j.finish,
  region:DB.regionMeta(j.region).short, notes:j.notes });

function runTool(name, a={}){
  switch(name){
    case 'read_schedule': {
      let r = DB.jobs(a.region||DB.region());
      if(a.from) r=r.filter(j=>j.date>=a.from);
      if(a.to)   r=r.filter(j=>j.date<=a.to);
      if(a.stage)r=r.filter(j=>j.stage===a.stage);
      return { count:r.length, today:new Date().toISOString().slice(0,10),
               jobs:r.sort((x,y)=>x.date.localeCompare(y.date)).map(jobOut) };
    }
    case 'list_clients': {
      let c = DB.clients(a.region||DB.region());
      if(a.search){ const q=a.search.toLowerCase();
        c=c.filter(x=>(x.name+x.email+x.addr).toLowerCase().includes(q)); }
      return c.map(x=>({ ...clientOut(x),
        jobs:DB.jobs('all').filter(j=>j.client===x.id).length,
        lifetime:DB.jobs('all').filter(j=>j.client===x.id&&j.stage==='done').reduce((s,j)=>s+j.value,0) }));
    }
    case 'get_client': {
      const c=DB.findClient(a.name);
      if(!c) return { error:`No client matching "${a.name}". Call list_clients to see who exists.` };
      return { ...clientOut(c),
        jobs:DB.jobs('all').filter(j=>j.client===c.id).map(jobOut),
        quotes:DB.quotes('all').filter(q=>q.client===c.id).map(q=>({title:q.title,total:q.total,status:q.status,created:q.created})) };
    }
    case 'create_client': {
      const ex=DB.findClient(a.name);
      if(ex) return { note:'That client already exists — nothing created.', client:clientOut(ex) };
      const c=DB.addClient({name:a.name,phone:a.phone||'',email:a.email||'',addr:a.address||'',
        region:a.region||DB.region(),source:a.source||'Assistant',notes:a.notes||''});
      refresh(); return { created:clientOut(c) };
    }
    case 'update_client': {
      const c=DB.findClient(a.name);
      if(!c) return { error:`No client matching "${a.name}".` };
      const p={}; if(a.phone)p.phone=a.phone; if(a.email)p.email=a.email;
      if(a.address)p.addr=a.address; if(a.notes)p.notes=a.notes; if(a.region)p.region=a.region;
      DB.updateClient(c.id,p); refresh(); return { updated:clientOut(DB.client(c.id)) };
    }
    case 'create_job': {
      let c=DB.findClient(a.client_name);
      let createdClient=null;
      if(!c){ c=DB.addClient({name:a.client_name,phone:a.client_phone||'',email:'',
          addr:a.client_address||'',region:a.region||DB.region(),source:'Assistant',notes:''});
        createdClient=c.name; }
      else if(a.client_phone && !c.phone) DB.updateClient(c.id,{phone:a.client_phone});
      const j=DB.addJob({client:c.id,region:a.region||c.region,title:a.title,date:a.date,
        kind:a.kind||'measure',stage:a.stage||'lead',value:a.value||0,crew:a.crew||'',
        finish:a.finish||'—',notes:a.notes||'',type:'—'});
      refresh();
      return { booked:jobOut(j), new_client_created:createdClient };
    }
    case 'update_job': {
      const j=DB.findJob(a.job_title);
      if(!j) return { error:`No job matching "${a.job_title}". Call read_schedule first.` };
      const p={}; for(const k of ['date','stage','value','kind','crew','finish','notes'])
        if(a[k]!==undefined) p[k]=a[k];
      DB.updateJob(j.id,p); refresh(); return { updated:jobOut(DB.job(j.id)) };
    }
    case 'cancel_job': {
      const j=DB.findJob(a.job_title);
      if(!j) return { error:`No job matching "${a.job_title}".` };
      const snap=jobOut(j); DB.removeJob(j.id); refresh(); return { cancelled:snap };
    }
    case 'list_quotes':
      return DB.quotes(a.region||DB.region()).map(q=>({title:q.title,client:DB.clientName(q.client),
        total:q.total,status:q.status,created:q.created,summary:q.summary}));
    case 'create_quote': {
      const c=DB.findClient(a.client_name);
      if(!c) return { error:`No client matching "${a.client_name}". Create the client first.` };
      const q=DB.addQuote({client:c.id,region:c.region,title:a.title,total:a.total,
        summary:a.summary||'',status:a.status||'draft'});
      refresh(); return { created:{title:q.title,client:c.name,total:q.total,status:q.status} };
    }
    case 'price_closet': {
      const d=a.depth_in||24, w=a.width_in;
      if(w<24) return { error:`${w}" is under the 24" minimum bay width.` };
      const fin=cat.finishes.find(f=>f.n.toLowerCase().includes(String(a.finish||'').toLowerCase()))||cat.finishes[0];
      const r=quickPrice(w,d,a.contents||'DOUBLE_HANG',fin.n,cat);
      const out={ bays:r.bays.length, contents:MODULES[a.contents||'DOUBLE_HANG'].label,
        parts:r.parts.length, finish:fin.n, finish_level:fin.lv, lead_weeks:fin.lead,
        supplier_cost:r.price.cost, markup:r.price.markup, installed_price:Math.round(r.price.price) };
      if(a.with_order_list) out.order_list=r.order;
      return out;
    }
    case 'list_finishes': {
      let f=cat.finishes;
      if(a.level) f=f.filter(x=>x.lv===a.level);
      if(a.search){ const q=a.search.toLowerCase(); f=f.filter(x=>x.n.toLowerCase().includes(q)); }
      return f.map(x=>({name:x.n,level:x.lv,per_sqft:x.sq,lead_weeks:x.lead}));
    }
    case 'business_summary': {
      const reg = a.region || 'all';
      const per = (reg==='all'?REGIONS.map(r=>r.id):[reg]).map(id=>{
        const j=DB.jobs(id), m=new Date().toISOString().slice(0,7);
        return { region:DB.regionMeta(id).name,
          pipeline:j.filter(x=>['quoted','won','ordered','scheduled'].includes(x.stage)).reduce((s,x)=>s+x.value,0),
          installed_this_month:j.filter(x=>x.stage==='done'&&x.date.slice(0,7)===m).reduce((s,x)=>s+x.value,0),
          live_jobs:j.filter(x=>!['done','lost'].includes(x.stage)).length,
          leads_awaiting_quote:j.filter(x=>x.stage==='lead').length,
          clients:DB.clients(id).length };
      });
      return { as_of:new Date().toISOString().slice(0,10), regions:per };
    }
    case 'switch_region': {
      DB.setRegion(a.region); refresh();
      return { now_showing: a.region==='all'?'Every region':DB.regionMeta(a.region).name };
    }
  }
  return { error:'unknown tool' };
}

/* ───────────── system prompt ───────────── */
const SYSTEM = () => {
  const s=DB.settings();
  return `You are the assistant inside the admin dashboard for ${s.business}, a custom closet company.

You are not a chatbot bolted onto a website. You operate this business's real system: the schedule, the client list, the jobs, the quotes and the pricing all run through your tools, and anything you change is changed for real, immediately.

REGIONS. The business works in five: South Florida (base Boca Raton), New Jersey, New York, Connecticut and Pennsylvania. Each has its own schedule, clients and crews. The dashboard shows one region at a time, or all of them. A question without a stated region means the one currently selected; if the answer would genuinely differ by region, say which you used.

TODAY IS ${new Date().toISOString().slice(0,10)}. Work out "tomorrow", "next Tuesday" and "week after next" from that and use real YYYY-MM-DD dates in tool calls. Never ask the user to convert a date for you.

HOW TO WORK
- Use the tools. Never answer from memory about this business — if asked what is on this week, call read_schedule. If asked what something costs, call price_closet.
- Chain tools freely. "Move the Ferrante delivery back a week" is read_schedule, then update_job.
- Before you create, change or delete anything, say in one short line what you are about to do. Afterwards confirm what actually changed, with the real values.
- If something is ambiguous — two clients with similar names, a date that could be two things — ask one short question rather than guessing.
- If a tool returns an error, read it, fix the input and try again. Do not report a raw error to the user without acting on it.
- Be brief. This is a working tool used between jobs, often on a phone. Short sentences, real numbers, no preamble, no filler, no bullet lists unless you are genuinely listing things.

PHOTOS. The owner will photograph handwritten notes — a day's schedule, a pad of client details, a measurement sheet — and send them to you. When you get an image:
1. Read everything on it. Names, phone numbers, addresses, dates, times, prices, closet types, finishes, anything.
2. Write back what you read, as a short list, so they can see you got it right.
3. Say what you are about to create.
4. Create it — one create_job per visit, creating clients as needed (create_job does that for you if the client is new; pass client_phone and client_address when the note has them).
5. Confirm what went in.
If handwriting is genuinely unclear on something important — a digit in a phone number, a price — say which part you could not read and ask, rather than inventing it. Getting a phone number wrong is worse than asking.

THE TRADE. You know this business properly:
- Top shelf 84". Long hang rod 66". Double hang 80" and 40". Hanging depth 24", shelf-only 14–16". Shoe shelves at 8" spacing. Toe kick 3.5". Panels are 3/4".
- Sections run 24" to 36" wide. Past 36", a 3/4" melamine shelf sags under load — so the answer to "can we do a 48 inch span" is no, we put a partition in.
- Under 5 feet wide is a reach-in, not a walk-in. Say so.
- Lighting strips only fit FIXED shelves. Adjustable shelves move, so they cannot carry a wired strip. This comes up constantly — be clear about it.
- Finishes run four price levels. Level 2 is the everyday range at two to three weeks; Level 5 is high gloss at five to eight weeks. The level changes the surface, not the construction — a Level 2 closet is not a cheaper-built closet.
- Glass-front doors are orderable, but the manufacturer ships the frame WITHOUT the glass; glass is sourced locally and priced separately.

PRICING. price_closet returns supplier cost and the installed client price with the business markup applied. Quote the installed price. Mention supplier cost only if asked. Never quote a price you have not got from the tool.

WHAT YOU CANNOT DO. You cannot send email or text messages, take payments, or order from the supplier — those connections are not wired up. If asked, say so plainly and offer to draft the message or prepare the details instead.`;
};

/* ───────────── UI ───────────── */
function bubble(cls, text, imgs){
  const d=document.createElement('div'); d.className='msg '+cls;
  if(imgs?.length){ const row=document.createElement('div'); row.className='thumbs';
    imgs.forEach(src=>{ const i=document.createElement('img'); i.src=src; row.appendChild(i); });
    d.appendChild(row); }
  if(text){ const t=document.createElement('div'); t.textContent=text; d.appendChild(t); }
  chat.appendChild(d); chat.scrollTop=chat.scrollHeight; return d;
}

function stageImage(file){
  if(!file || !/^image\//.test(file.type)) return;
  if(pending.length>=4){ bubble('e','Four images at a time is the limit.'); return; }
  const r=new FileReader();
  r.onload=()=>{
    // downscale big phone photos — a 12MP original is slow and costs more than it helps
    const img=new Image();
    img.onload=()=>{
      const max=1600, sc=Math.min(1, max/Math.max(img.width,img.height));
      const c=document.createElement('canvas');
      c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      const data=c.toDataURL('image/jpeg',0.85);
      pending.push({media:'image/jpeg', b64:data.split(',')[1], src:data});
      paintPending();
    };
    img.src=r.result;
  };
  r.readAsDataURL(file);
}
function paintPending(){
  const box=$('#pend');
  box.innerHTML = pending.map((p,i)=>`<span class="pimg"><img src="${p.src}"><button data-i="${i}" aria-label="Remove">×</button></span>`).join('');
  box.hidden = !pending.length;
}
$('#pend').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  pending.splice(+b.dataset.i,1); paintPending();
});

/* ───────────── transport ───────────── */
async function send(text){
  const s=DB.settings();
  if(!s.anthropicKey){
    bubble('e','No API key yet. Open Settings and paste your own Anthropic key — the assistant runs on your account and the key stays in this browser.');
    return;
  }
  const imgs = pending.slice(); pending=[]; paintPending();
  bubble('u', text, imgs.map(i=>i.src));

  const content = [];
  for(const im of imgs) content.push({type:'image',source:{type:'base64',media_type:im.media,data:im.b64}});
  content.push({type:'text',text: text || 'Read this and do what it says.'});
  history.push({role:'user',content});

  const thinking = bubble('a','…');
  $('#ask').disabled = true;

  try{
    for(let turn=0; turn<8; turn++){
      const res = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'content-type':'application/json','x-api-key':s.anthropicKey,
          'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:s.model||'claude-sonnet-4-6',max_tokens:2400,
          system:SYSTEM(), tools:TOOLS, messages:history})
      });
      if(!res.ok){
        const t=await res.text(); thinking.remove();
        bubble('e', res.status===401 ? 'Anthropic rejected that key. Check it in Settings.'
              : res.status===429 ? 'Rate limited by Anthropic — wait a moment and try again.'
              : `Anthropic returned ${res.status}.\n${t.slice(0,280)}`);
        history.pop(); return;
      }
      const data = await res.json();
      history.push({role:'assistant',content:data.content});
      const say = data.content.filter(c=>c.type==='text').map(c=>c.text).join('\n').trim();
      const calls = data.content.filter(c=>c.type==='tool_use');
      if(say){ thinking.remove(); bubble('a', say); }
      if(!calls.length){ thinking.remove(); break; }
      const results=[];
      for(const c of calls){
        bubble('t', `▸ ${c.name}(${JSON.stringify(c.input||{}).slice(0,120)})`);
        let out; try{ out=runTool(c.name, c.input||{}); }catch(err){ out={error:String(err)}; }
        results.push({type:'tool_result',tool_use_id:c.id,content:JSON.stringify(out)});
      }
      history.push({role:'user',content:results});
    }
    thinking.remove();
  }catch(err){
    thinking.remove();
    bubble('e','Could not reach Anthropic: '+err.message);
  }finally{
    $('#ask').disabled=false; $('#ask').focus();
  }
}

/* ───────────── wiring ───────────── */
$('#agentToggle').onclick=()=>{
  const a=$('.agent'); a.classList.toggle('open');
  if(a.classList.contains('open')) $('#ask').focus();
};
$('#agentClose').onclick=()=>$('.agent').classList.remove('open');
$('#askform').onsubmit=e=>{
  e.preventDefault();
  const t=$('#ask').value.trim();
  if(!t && !pending.length) return;
  $('#ask').value=''; $('#ask').style.height='auto';
  $('#chips')?.remove();
  send(t);
};
$('#ask').addEventListener('input',e=>{e.target.style.height='auto';e.target.style.height=Math.min(140,e.target.scrollHeight)+'px'});
$('#ask').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#askform').requestSubmit();} });
$('#chips')?.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  $('#ask').value=b.textContent; $('#askform').requestSubmit();
});
/* images: button, paste, drag-drop */
$('#attach').onclick=()=>$('#imgFile').click();
$('#imgFile').onchange=e=>{ [...e.target.files].forEach(stageImage); e.target.value=''; };
$('#ask').addEventListener('paste',e=>{
  const items=[...(e.clipboardData?.items||[])].filter(i=>i.type.startsWith('image/'));
  if(items.length){ e.preventDefault(); items.forEach(i=>stageImage(i.getAsFile())); }
});
const drop=$('.agent');
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();
  if(ev==='drop'||!drop.contains(e.relatedTarget)) drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>{ [...(e.dataTransfer?.files||[])].forEach(stageImage); });

if(DB.settings().anthropicKey) document.querySelector('.agent .dot')?.classList.add('on');
