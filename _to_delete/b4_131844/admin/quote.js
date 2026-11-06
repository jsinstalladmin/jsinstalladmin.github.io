/* ============================================================
   quote.js — the sheet that actually goes to the customer.

   The builder prices CABINETRY. A customer is buying a finished
   closet, so the quote has to carry the installation too, and it has
   to say plainly which part is which. Nothing here invents a number:
   installation comes from the rate Joseph sets in Settings, applied to
   the real linear feet of the design. If he has not set a rate, the
   quote says installation is confirmed at the measure rather than
   printing a figure nobody stands behind.
   ============================================================ */

const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money = n => '$' + Math.round(n||0).toLocaleString();
const dayFmt = iso => new Date(iso+'T12:00').toLocaleDateString('en-US',
  { weekday:'long', month:'long', day:'numeric', year:'numeric' });

/* linear feet of cabinetry in a design, which is what installation is sold by */
export function linearFeet(design){
  if(!design) return 0;
  const byWall = {};
  for(const b of (design.bays||[])) byWall[b.wall] = (byWall[b.wall]||0) + (+b.width||0);
  return +(Object.values(byWall).reduce((a,v)=>a+v,0) / 12).toFixed(1);
}

export function quoteNumbers(quote, settings){
  const d = quote.design;
  const ft = linearFeet(d);
  const cabinetry = Math.round(quote.total || d?.price || 0);
  const rate = +settings.installPerFt || 0;
  const minimum = +settings.installMin || 0;
  const install = rate ? Math.max(Math.round(ft * rate), minimum) : null;
  const taxPct = +settings.taxRate || 0;
  const sub = cabinetry + (install || 0);
  const tax = taxPct ? Math.round(sub * taxPct / 100) : 0;
  return { ft, cabinetry, rate, install, taxPct, tax, total: sub + tax,
           deposit: Math.round((sub + tax) * ((+settings.depositPct || 50) / 100)) };
}

/* ───────── the printable sheet ───────── */
export function quoteDoc(quote, client, settings, opts = {}){
  const n = quoteNumbers(quote, settings);
  const d = quote.design;
  const today = new Date().toISOString().slice(0,10);
  const good  = new Date(Date.now() + 30*864e5).toISOString().slice(0,10);
  const biz   = settings.business || 'JS Installations & Closets';

  const sections = (d?.bays||[]).map((b,i) => `
    <tr><td class="n">${i+1}</td>
        <td><b>${esc((b.wall||'').replace(/^./,c=>c.toUpperCase()))} wall &middot; ${b.width}" wide</b><br>
            <span class="dim">${b.stack.map(s=>esc(s.module)+(s.height?` at ${s.height}"`:'')).join(' over ') || 'Empty'}${b.topShelf===false?' &middot; open top':''}</span></td></tr>`).join('');

  const lines = [
    ['Cabinetry', d ? `${(d.bays||[]).length} sections &middot; ${n.ft} linear feet &middot; ${esc(d.finish||'')}` : esc(quote.summary||''), money(n.cabinetry)],
    n.install !== null
      ? ['Installation', `${n.ft} linear feet at ${money(n.rate)} a foot${settings.installMin?`, ${money(settings.installMin)} minimum`:''}`, money(n.install)]
      : ['Installation', 'Confirmed at the measure. It depends on access, what has to come out and whether the baseboard comes off.', '&mdash;'],
  ];
  if(n.taxPct) lines.push(['Sales tax', `${n.taxPct}%`, money(n.tax)]);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quote ${esc(quote.title)} — ${esc(client?.name||'')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Archivo:wght@300..600&display=swap">
<style>
  :root{--ink:#16120D;--body:#5A5048;--muted:#8A8075;--line:#E4DFD6;--paper:#FFFDFA;--accent:#A8824C}
  *{box-sizing:border-box}
  body{margin:0;background:#F3F0EA;color:var(--body);font-family:'Archivo',system-ui,sans-serif;
    font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
  .sheet{max-width:820px;margin:28px auto;background:var(--paper);padding:48px 52px 44px;
    border-radius:14px;box-shadow:0 10px 50px rgba(26,18,10,.1)}
  h1,h2{font-family:'Instrument Serif',Georgia,serif;font-weight:400;color:var(--ink);margin:0;letter-spacing:-.02em}
  h1{font-size:2.3rem;line-height:1.05}
  h2{font-size:1.25rem;margin:2.1em 0 .7em}
  .top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;
    padding-bottom:22px;border-bottom:2px solid var(--ink)}
  .top .biz b{font-family:'Instrument Serif',serif;font-size:1.3rem;color:var(--ink);display:block;font-weight:400}
  .top .biz span{display:block;font-size:.84rem;color:var(--muted)}
  .top .meta{text-align:right;font-size:.84rem;color:var(--muted)}
  .top .meta b{color:var(--ink);font-weight:500}
  .to{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));
    gap:22px;margin:26px 0 6px}
  .to .lbl{font-size:.63rem;letter-spacing:.17em;text-transform:uppercase;color:var(--muted);
    display:block;margin-bottom:.3em}
  .to b{color:var(--ink);font-weight:500}
  table{width:100%;border-collapse:collapse}
  .lines th{text-align:left;font-size:.63rem;letter-spacing:.15em;text-transform:uppercase;
    color:var(--muted);font-weight:500;padding:0 0 9px;border-bottom:1px solid var(--line)}
  .lines td{padding:15px 0;border-bottom:1px solid var(--line);vertical-align:top}
  .lines .amt{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;
    color:var(--ink);font-weight:500}
  .lines .what b{color:var(--ink);font-weight:500;display:block}
  .lines .what span{font-size:.86rem;color:var(--muted)}
  .tot{display:flex;justify-content:flex-end;margin-top:18px}
  .totbox{min-width:300px}
  .totrow{display:flex;justify-content:space-between;gap:30px;padding:7px 0;font-size:.92rem}
  .totrow.big{border-top:2px solid var(--ink);margin-top:9px;padding-top:13px;
    font-size:1.5rem;font-family:'Instrument Serif',serif;color:var(--ink)}
  .totrow.dep{color:var(--accent)}
  .secs td{padding:11px 0;border-bottom:1px solid var(--line);vertical-align:top}
  .secs .n{width:34px;color:var(--muted);font-variant-numeric:tabular-nums}
  .secs b{color:var(--ink);font-weight:500}
  .dim{color:var(--muted);font-size:.87rem}
  .specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));
    gap:14px;margin-top:4px}
  .spec{border:1px solid var(--line);border-radius:11px;padding:12px 14px}
  .spec span{display:block;font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted)}
  .spec b{color:var(--ink);font-weight:500;font-size:.95rem}
  .terms{margin-top:30px;padding-top:20px;border-top:1px solid var(--line);
    font-size:.84rem;color:var(--muted)}
  .terms li{margin:.4em 0}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:34px}
  .sigline{border-top:1px solid var(--ink);padding-top:7px;font-size:.76rem;color:var(--muted)}
  .noprint{max-width:820px;margin:0 auto 10px;display:flex;gap:8px;flex-wrap:wrap}
  .noprint button{font:inherit;font-size:.85rem;padding:.6em 1.1em;border-radius:999px;
    border:1px solid var(--line);background:var(--paper);color:var(--ink);cursor:pointer}
  .noprint button.p{background:var(--ink);color:var(--paper);border-color:var(--ink)}
  @media print{ body{background:#fff} .sheet{box-shadow:none;margin:0;max-width:none;
    border-radius:0;padding:0} .noprint{display:none} }
</style></head><body>
<div class="noprint">
  <button class="p" onclick="window.print()">Print or save as PDF</button>
  <button onclick="navigator.clipboard.writeText(document.getElementById('plain').textContent).then(()=>this.textContent='Copied')">Copy as plain text</button>
  <button onclick="window.close()">Close</button>
</div>
<div class="sheet">
  <div class="top">
    <div class="biz"><b>${esc(biz)}</b>
      <span>${esc(settings.phone||'')}</span>
      <span>${esc(settings.email||'')}</span></div>
    <div class="meta">
      <b>Quote</b><br>${esc(today)}<br>
      <span>Good until ${esc(good)}</span></div>
  </div>

  <div class="to">
    <div><span class="lbl">Prepared for</span>
      <b>${esc(client?.name||'—')}</b><br>
      ${client?.addr?esc(client.addr)+'<br>':''}
      ${client?.phone?esc(client.phone)+'<br>':''}
      ${client?.email?esc(client.email):''}</div>
    <div><span class="lbl">The job</span>
      <b>${esc(quote.title)}</b><br>
      ${esc(quote.summary||'')}</div>
  </div>

  <h2>What this covers</h2>
  <table class="lines">
    <thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${lines.map(([t,sub,amt])=>`<tr>
      <td class="what"><b>${t}</b><span>${sub}</span></td>
      <td class="amt">${amt}</td></tr>`).join('')}</tbody>
  </table>

  <div class="tot"><div class="totbox">
    ${n.install !== null ? `<div class="totrow"><span>Cabinetry and installation</span><b>${money(n.cabinetry + n.install)}</b></div>` : ''}
    ${n.taxPct ? `<div class="totrow"><span>Sales tax</span><b>${money(n.tax)}</b></div>` : ''}
    <div class="totrow big"><span>Total</span><b>${money(n.total)}</b></div>
    <div class="totrow dep"><span>Deposit to book it</span><b>${money(n.deposit)}</b></div>
  </div></div>

  ${d ? `<h2>The design</h2>
  <div class="specs">
    <div class="spec"><span>Room</span><b>${d.room.w}" &times; ${d.room.d}" &times; ${d.room.h}"</b></div>
    <div class="spec"><span>Carcass finish</span><b>${esc(d.finish||'')}</b></div>
    ${d.frontFinish && d.frontFinish!==d.finish?`<div class="spec"><span>Front finish</span><b>${esc(d.frontFinish)}</b></div>`:''}
    <div class="spec"><span>Hardware</span><b>${esc(d.pull||'')}${d.pullFinish?', '+esc(d.pullFinish):''}</b></div>
    <div class="spec"><span>Doors</span><b>${esc(d.door||'None')}</b></div>
    <div class="spec"><span>Linear feet</span><b>${n.ft}</b></div>
  </div>
  <table class="secs"><tbody>${sections}</tbody></table>` : ''}

  ${opts.note ? `<h2>Notes</h2><p>${esc(opts.note).replace(/\n/g,'<br>')}</p>` : ''}

  <div class="terms"><ul>
    <li>This quote holds for 30 days from the date above.</li>
    <li>Every dimension is confirmed at the measure before anything is cut. If the room differs from the drawing, we tell you what changes and what it costs before we order.</li>
    <li>${n.deposit ? `A deposit of ${money(n.deposit)} books the job and orders the board. The balance is due on completion.` : 'Payment terms are agreed before the job is booked.'}</li>
    <li>Lead time runs from the day the board is ordered, not from the day you accept.</li>
    <li>We do not subcontract. The crew that measures is the crew that installs.</li>
  </ul></div>

  <div class="sign">
    <div class="sigline">Signature</div>
    <div class="sigline">Date</div>
  </div>
</div>

<pre id="plain" hidden>${esc([
  biz, settings.phone||'', settings.email||'', '',
  'QUOTE  ' + today + '   (good until ' + good + ')', '',
  'For: ' + (client?.name||''), client?.addr||'', client?.phone||'', '',
  quote.title, quote.summary||'', '',
  ...lines.map(([t,sub,amt]) => `${t}: ${amt.replace('&mdash;','to be confirmed')}  (${sub.replace(/<[^>]+>/g,'')})`),
  '', 'TOTAL: ' + money(n.total),
  n.deposit ? 'Deposit to book: ' + money(n.deposit) : '',
  '', 'This quote holds for 30 days. Every dimension is confirmed at the measure before anything is cut.'
].filter(Boolean).join('\n'))}</pre>
</body></html>`;
}
