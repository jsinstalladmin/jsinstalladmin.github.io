/* ============================================================================
   confirm-enquiry — both emails for a website enquiry.

   WHAT IT SENDS
   1. The customer gets a confirmation: we have it, here is what you told us,
      here is the number to call if any of it is wrong.
   2. The office gets the whole job: who, what they said, the room, the
      design section by section, everything on the walls with its real
      numbers, the warnings, the estimate and the full order list.

   WHY IT IS HERE AND NOT IN THE WEBSITE
   A mail provider's key lets whoever holds it send email as this business.
   Anything in the website is readable by anyone who opens the page. The key
   lives here as a Supabase secret; the website only asks this to send.

   WHAT IT WILL NOT DO
   It never takes the wording from the caller. Every sentence below is fixed,
   and every value from the request is escaped and length-capped before it
   goes near the markup. The worst a stranger calling this endpoint can do is
   cause one closet-enquiry confirmation to be sent to an address they typed.

   TO TURN IT ON
     supabase secrets set RESEND_API_KEY=re_xxx
     supabase secrets set OFFICE_TO=jsinstalladmin@gmail.com
     supabase secrets set MAIL_FROM="JS Closets <hello@yourdomain.com>"
     supabase functions deploy confirm-enquiry
   Without RESEND_API_KEY it answers 200 and does nothing, so the form is
   never held up by it.

   NOTE ON SENDING TO CUSTOMERS
   Until a domain is verified in Resend, their shared sender will only
   deliver to the Resend account's own address. The OFFICE copy therefore
   works today; the CUSTOMER copy starts working the day the domain is
   verified. Both are attempted and the result says which went.
   ========================================================================= */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUSINESS = 'JS Installations & Closets';
const PHONE    = '(646) 667-9572';
const REPLY_TO = 'jsinstallationsclosets@gmail.com';

const INK = '#16120D', MUT = '#857A6E', LINE = '#E5DCD0', PAPER = '#F8F5F0', ACC = '#6E5430';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const clip = (v: unknown, n = 200) => esc(String(v ?? '').slice(0, n));
const money = (n: unknown) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

/* The site, for the logo and the links. One constant, so the day the DNS
   moves to jsinstallationsclosets.com this is the only line that changes. */
const SITE = Deno.env.get('SITE_URL') ?? 'https://jsinstalladmin.github.io';

/* ── the letterhead ──
   This was a white card with text in it and nothing to say whose it was.
   An enquiry is the first thing a customer sees from the business after
   the website, and the first thing Joseph sees of a job, so it opens the
   way his own paperwork does: his mark, his name, his phone number.

   Email clients being what they are, this is tables and inline styles, no
   flexbox, no background images, and the logo degrades to the business name
   if images are off — which is the default in most inboxes. */
const shell = (inner: string, kicker = '') => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
            background:${PAPER};padding:26px 14px;color:${INK}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"
         style="max-width:620px;width:100%;margin:0 auto;border-collapse:separate">
    <tr><td style="background:${INK};border-radius:14px 14px 0 0;padding:20px 26px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
        <tr>
          <td style="width:46px;vertical-align:middle">
            <img src="${SITE}/img/icon-192.png" width="46" height="46" alt=""
                 style="display:block;width:46px;height:46px;border-radius:11px;border:0">
          </td>
          <td style="padding-left:13px;vertical-align:middle">
            <div style="font-size:1.02rem;color:#F8F5F0;letter-spacing:.01em;line-height:1.2">
              JS Closets</div>
            <div style="font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;
                        color:rgba(248,245,240,.56);margin-top:3px">Installations</div>
          </td>
          <td align="right" style="vertical-align:middle;font-size:.78rem;
                     color:rgba(248,245,240,.72);white-space:nowrap">${PHONE}</td>
        </tr>
      </table>
    </td></tr>
    ${kicker ? `<tr><td style="background:${ACC};padding:9px 26px;font-size:.68rem;
      letter-spacing:.16em;text-transform:uppercase;color:#fff">${kicker}</td></tr>` : ''}
    <tr><td style="background:#fff;border:1px solid ${LINE};border-top:0;
                   border-radius:0 0 14px 14px;padding:28px 26px">${inner}</td></tr>
    <tr><td style="padding:16px 26px 0;font-size:.72rem;line-height:1.6;color:${MUT};
                   text-align:center">
      ${BUSINESS} &middot; ${PHONE} &middot;
      <a href="${SITE}/" style="color:${MUT}">${SITE.replace(/^https?:\/\//, '')}</a><br>
      Measured, built and fitted by one company.
    </td></tr>
  </table>
</div>`;

const h2 = (t: string) => `<h2 style="font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;
  color:${MUT};margin:26px 0 10px;font-weight:600">${t}</h2>`;

const rows = (pairs: Array<[string, string]>) => !pairs.length ? '' :
  `<table style="border-collapse:collapse;width:100%">${pairs.map(([k, v]) => `<tr>
     <td style="padding:7px 14px 7px 0;border-bottom:1px solid ${LINE};font-size:.78rem;
                color:${MUT};white-space:nowrap;vertical-align:top;width:34%">${k}</td>
     <td style="padding:7px 0;border-bottom:1px solid ${LINE};font-size:.92rem">${v}</td>
   </tr>`).join('')}</table>`;

const bullets = (items: string[]) => !items.length ? '' :
  `<ul style="margin:0;padding-left:1.1em">${items.map(i =>
    `<li style="font-size:.9rem;line-height:1.6;margin-bottom:.35em">${i}</li>`).join('')}</ul>`;

/* ── the customer's copy ─────────────────────────────────────────────── */
function customerMail(c: Record<string, any>, d: Record<string, any> | null) {
  const pairs: Array<[string, string]> = [];
  if (c.phone) pairs.push(['Phone', clip(c.phone, 40)]);
  const where = [clip(c.address, 120), clip(c.location, 40)].filter(Boolean).join(', ');
  if (where) pairs.push(['Where', where]);
  if (c.project) pairs.push(['Room', clip(c.project, 60)]);
  if (c.timing) pairs.push(['Timing', clip(c.timing, 60)]);
  if (d?.summary) pairs.push(['Your design', clip(d.summary, 160)]);
  if (c.message) pairs.push(['You said', clip(c.message, 400)]);

  return shell(`
    <p style="font-size:1.05rem;margin:0 0 1em">Hi ${clip(c.name, 80) || 'there'},</p>
    <p style="margin:0 0 1em;line-height:1.65">Thank you for asking us to come and measure.
       We have your enquiry and we will be in touch the same working day to agree a time.</p>
    <p style="margin:0 0 1.5em;line-height:1.65">The measure is free, it takes about forty
       minutes, and you get a drawing and a fixed price before anything is ordered. There is
       nothing to pay until you are happy with both.</p>
    ${rows(pairs)}
    <p style="margin:1.5em 0 1em;line-height:1.65">If anything above is wrong, or you would
       rather just talk it through, call us on
       <a href="tel:+16466679572" style="color:${ACC}">${PHONE}</a>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;margin:1.8em 0 0;border-top:1px solid ${LINE}">
      <tr><td style="padding-top:16px">
        <a href="${SITE}/design/" style="display:inline-block;background:${INK};color:#F8F5F0;
           text-decoration:none;font-size:.86rem;padding:.78em 1.4em;border-radius:999px">
          Draw it yourself in 3D while you wait</a>
        <span style="display:block;margin-top:.7em;font-size:.8rem;color:${MUT};line-height:1.6">
          Put your room's real dimensions in and lay out the inside section by
          section. Whatever you draw comes to us with the enquiry.</span>
      </td></tr>
    </table>
    <p style="margin:1.4em 0 0;font-size:.74rem;color:#A49A8E;line-height:1.6">You are getting this
       because you asked for a free measure on our website. It is a one-off confirmation,
       not a list.</p>`, 'Your free measure');
}

/* ── the office's copy ───────────────────────────────────────────────── */
function officeMail(c: Record<string, any>, d: Record<string, any> | null) {
  const who: Array<[string, string]> = [];
  if (c.name)     who.push(['Name', clip(c.name, 80)]);
  if (c.phone)    who.push(['Phone', `<a href="tel:${clip(c.phone, 40).replace(/[^+\d]/g, '')}" style="color:${ACC}">${clip(c.phone, 40)}</a>`]);
  if (c.email)    who.push(['Email', `<a href="mailto:${clip(c.email, 120)}" style="color:${ACC}">${clip(c.email, 120)}</a>`]);
  if (c.region)   who.push(['Area', clip(c.region, 120)]);
  if (c.address || c.location)
    who.push(['Address', clip([c.address, c.location].filter(Boolean).join(', '), 180)]);
  if (c.project)  who.push(['Project', clip(c.project, 60)]);
  if (c.timing)   who.push(['Timing', clip(c.timing, 60)]);

  const room: Array<[string, string]> = [];
  if (d?.room) room.push(['Size', `${clip(d.room.w,8)}&quot; wide &middot; ${clip(d.room.d,8)}&quot; deep &middot; ${clip(d.room.h,8)}&quot; high`]);
  if (d?.mounting) room.push(['Mounting', d.mounting === 'wall' ? 'Wall hung' : 'On the floor']);
  if (d?.baseboard) {
    room.push(['Baseboard', `${clip(d.baseboard.height,8)}&quot; tall &middot; ${clip(d.baseboard.thickness,8)}&quot; thick`]);
    room.push(['They measured', d.baseboard.measuredFrom === 'baseboard' ? 'baseboard to baseboard' : 'wall to wall']);
    room.push(['At the baseboard', clip(d.baseboard.handling, 120)]);
  }
  if (d?.corner) room.push(['The corner', clip(d.corner, 160)]);
  if (d?.backs)  room.push(['Backs', clip(d.backs, 80)]);
  if (d?.door)   room.push(['Doors', clip(d.door, 60)]);
  if (d?.finish) room.push(['Finish', d.finish === d.frontFinish ? clip(d.finish, 80)
                           : `${clip(d.finish, 60)} carcass &middot; ${clip(d.frontFinish, 60)} fronts`]);
  if (d?.pull)   room.push(['Hardware', `${clip(d.pull, 60)} in ${clip(d.pullFinish, 40)}`]);

  const sections = (d?.bays || []).map((b: any, i: number) => {
    const parts = (b.stack || []).map((st: any) =>
      clip(st.module, 60) + (st.height ? ` ${clip(st.height,6)}&quot;` : '')
      + (st.options && Object.keys(st.options).length
          ? ' (' + Object.entries(st.options).map(([k, v]) => `${clip(k,20)} ${clip(v,8)}`).join(', ') + ')' : ''));
    return `<b>${i + 1}. ${clip(b.wall, 20)} wall &middot; ${clip(b.width, 8)}&quot; wide</b>`
         + (parts.length ? `<br><span style="color:${MUT}">${parts.join(' &middot; ')}</span>` : '');
  });

  const walls = (d?.fittings || []).map((f: any) => {
    const bits = [`${clip(f.wall, 30)}`, `${clip(f.inchesAlong, 8)}&quot; along`];
    if (f.heightOffFloor != null) bits.push(`${clip(f.heightOffFloor, 8)}&quot; off the floor`);
    if (f.widthInches != null)    bits.push(`${clip(f.widthInches, 8)}&quot; wide`);
    if (f.sillOrLowPoint != null) bits.push(`sill ${clip(f.sillOrLowPoint, 8)}&quot;`);
    if (f.tallInches != null)     bits.push(`${clip(f.tallInches, 8)}&quot; tall`);
    if (f.sticksOutInches != null)bits.push(`sticks out ${clip(f.sticksOutInches, 8)}&quot;`);
    if (f.where)                  bits.push(clip(f.where, 40));
    return `<b>${clip(f.item, 60)}</b> — ${bits.join(' &middot; ')}`
         + (f.note ? `<br><span style="color:${MUT}">They said: ${clip(f.note, 300)}</span>` : '');
  });

  const flags = (d?.warnings || []).map((w: any) => clip(w, 400));

  const order = (d?.order || []).slice(0, 80).map((o: any) =>
    `<tr>
       <td style="padding:5px 10px 5px 0;border-bottom:1px solid ${LINE};font-size:.84rem">${clip(o.item, 90)}
         ${o.detail ? `<br><span style="color:${MUT};font-size:.76rem">${clip(o.detail, 120)}</span>` : ''}</td>
       <td style="padding:5px 0;border-bottom:1px solid ${LINE};font-size:.84rem;text-align:right;white-space:nowrap">${clip(o.qty, 8)}</td>
     </tr>`).join('');
  const parts = (d?.order || []).reduce((a: number, o: any) => a + (Number(o.qty) || 0), 0);

  return shell(`
    <h1 style="font-size:1.5rem;margin:0;line-height:1.2">${clip(c.name, 80) || 'Website enquiry'}</h1>
    ${d?.price ? `<p style="margin:.35em 0 0;font-size:1.1rem;color:${ACC}"><b>${money(d.price)}</b>
       <span style="color:${MUT};font-size:.86rem">estimated for the cabinetry${parts ? ` &middot; ${parts} parts` : ''}</span></p>` : ''}

    ${h2('Who')}${rows(who)}
    ${c.message ? h2('What they said') + `<p style="margin:0;font-size:.95rem;line-height:1.6">${clip(c.message, 800)}</p>` : ''}
    ${room.length ? h2('The room') + rows(room) : ''}
    ${sections.length ? h2('The design') + bullets(sections) : ''}
    ${walls.length ? h2('On the walls') + bullets(walls) : ''}
    ${flags.length ? h2('Worth saying') + bullets(flags) : ''}
    ${order ? h2('Everything on the order') +
      `<table style="border-collapse:collapse;width:100%">
         <tr><th style="text-align:left;padding:0 10px 6px 0;font-size:.7rem;letter-spacing:.1em;
                        text-transform:uppercase;color:${MUT};border-bottom:1px solid ${LINE}">Part</th>
             <th style="text-align:right;padding:0 0 6px;font-size:.7rem;letter-spacing:.1em;
                        text-transform:uppercase;color:${MUT};border-bottom:1px solid ${LINE}">Qty</th></tr>
         ${order}</table>` : ''}

    <p style="margin:26px 0 0;font-size:.84rem;color:${MUT}">
      Reply to this email and it goes straight to ${clip(c.name, 60) || 'them'}.<br>
      It is already in the office system under Pipeline &rarr; New lead.</p>`, 'New enquiry');
}

async function send(key: string, from: string, to: string, subject: string,
                    html: string, replyTo: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, html }),
  });
  return { ok: r.ok, status: r.status };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: CORS });

  const json = (body: unknown) => new Response(JSON.stringify(body),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

  const KEY  = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('MAIL_FROM') ?? `${BUSINESS} <onboarding@resend.dev>`;
  const OFFICE = Deno.env.get('OFFICE_TO') ?? REPLY_TO;

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* handled below */ }

  const c = body?.contact ?? {};
  const d = body?.design ?? null;
  if (!KEY) return json({ ok: false, why: 'mail not configured yet' });

  const looksLikeEmail = (v: unknown) =>
    typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

  const out: Record<string, unknown> = {};

  /* the office always gets it, even if the customer typed a bad address */
  try {
    out.office = await send(KEY, FROM, OFFICE,
      `New closet enquiry — ${String(c.name ?? 'website').slice(0, 60)}`,
      officeMail(c, d), looksLikeEmail(c.email) ? String(c.email).trim() : REPLY_TO);
  } catch (err) { console.error('[office]', err); out.office = { ok: false }; }

  if (looksLikeEmail(c.email)) {
    try {
      out.customer = await send(KEY, FROM, String(c.email).trim(),
        `We have your closet enquiry — ${BUSINESS}`, customerMail(c, d), REPLY_TO);
    } catch (err) { console.error('[customer]', err); out.customer = { ok: false }; }
  } else {
    out.customer = { ok: false, why: 'no usable email' };
  }

  return json({ ok: true, ...out });
});
