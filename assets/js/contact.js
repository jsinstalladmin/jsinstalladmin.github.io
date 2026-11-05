const f=document.getElementById('leadform'), msg=document.getElementById('formmsg');
// carry a quote across from the builder
try{
  const q=JSON.parse(localStorage.getItem('js_quote')||'null');
  if(q){
    document.getElementById('quote_payload').value=JSON.stringify(q);
    const n=document.getElementById('quoteNote');
    n.hidden=false;
    n.innerHTML=`<b>Your builder design is attached.</b><br>${q.summary}, estimated <b>$${q.price.toLocaleString()}</b>. <a href=(window.BASE||"")+"design/" style="color:var(--brass)">Edit it</a>`;
    const sel=document.getElementById('t'); if(q.typeLabel) [...sel.options].forEach(o=>{if(o.text===q.typeLabel)o.selected=true});
  }
}catch(e){}

f?.addEventListener('submit',async ev=>{
  const key=f.access_key.value;
  if(key==='WEB3FORMS_KEY_HERE'){
    ev.preventDefault();
    msg.innerHTML='<span style="color:var(--brass)">Form not connected yet. The Web3Forms key still needs to go in. Until then, call or email and it comes straight through.</span>';
    return;
  }
  ev.preventDefault();
  msg.textContent='Sending…';
  try{
    const r=await fetch(f.action,{method:'POST',body:new FormData(f)});
    if(r.ok){ f.reset(); msg.innerHTML='<b>Thank you, that is with us.</b> We reply the same working day.'; localStorage.removeItem('js_quote'); }
    else msg.textContent='Something went wrong. Please call us instead.';
  }catch(e){ msg.textContent='Something went wrong. Please call us instead.'; }
});
