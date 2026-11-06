/* ============================================================================
   confirm-enquiry — the automatic reply the customer gets.

   WHY THIS EXISTS AT ALL
   Web3Forms sends the office its copy, but it will only send the CUSTOMER an
   automatic reply on a paid plan. So the reply is sent from here instead.

   WHY IT IS NOT IN THE WEBSITE
   A mail provider's key gives whoever holds it the ability to send email as
   this business. Anything in the website is readable by anyone who opens the
   page. The key therefore lives here, as a Supabase secret, and the website
   only ever asks this function to send — it never sees the key.

   WHAT IT WILL NOT DO
   It does not take the message body from the caller. The wording is fixed
   below, so a stranger calling this endpoint cannot use the business's own
   mail domain to send whatever they like. The most they can do is cause one
   confirmation of a closet enquiry to be sent, which is all it is for.

   TO TURN IT ON
     supabase secrets set RESEND_API_KEY=re_xxx
     supabase secrets set MAIL_FROM="JS Closets <hello@yourdomain.com>"
     supabase functions deploy confirm-enquiry --no-verify-jwt
   Until RESEND_API_KEY is set it answers 200 and does nothing, so the form
   on the website is never held up by it.
   ========================================================================= */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUSINESS = 'JS Installations & Closets';
const PHONE    = '(646) 667-9572';
const REPLY_TO = 'jsinstallationsclosets@gmail.com';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/* Only ever the first 200 characters of anything they typed, and escaped, so
   nothing a caller sends can become markup inside the email. */
const clip = (v: unknown, n = 200) => esc(String(v ?? '').slice(0, n));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')
    return new Response('POST only', { status: 405, headers: CORS });

  const KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('MAIL_FROM') ?? `${BUSINESS} <onboarding@resend.dev>`;

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* fall through to the check below */ }

  const c = body?.contact ?? {};
  const to = String(c.email ?? '').trim();
  /* good enough to stop an obvious mistake; the provider does the real check */
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to))
    return new Response(JSON.stringify({ ok: false, why: 'no usable email' }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

  if (!KEY)
    return new Response(JSON.stringify({ ok: false, why: 'mail not configured yet' }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

  const name  = clip(c.name, 80) || 'there';
  const where = [clip(c.address, 120), clip(c.location, 40)].filter(Boolean).join(', ');
  const rows: Array<[string, string]> = [];
  if (c.phone)   rows.push(['Phone', clip(c.phone, 40)]);
  if (where)     rows.push(['Where', where]);
  if (c.project) rows.push(['Room', clip(c.project, 60)]);
  if (c.timing)  rows.push(['Timing', clip(c.timing, 60)]);
  if (body?.design?.summary) rows.push(['Your design', clip(body.design.summary, 160)]);
  if (c.message) rows.push(['You said', clip(c.message, 400)]);

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
            max-width:560px;margin:0 auto;padding:28px 22px;color:#16120D">
  <p style="font-size:1.05rem;margin:0 0 1em">Hi ${name},</p>
  <p style="margin:0 0 1em;line-height:1.6">Thank you for asking us to come and measure.
     We have your enquiry and we will be in touch the same working day to agree a time.</p>
  <p style="margin:0 0 1.4em;line-height:1.6">The measure is free, it takes about forty
     minutes, and you get a drawing and a fixed price before anything is ordered.
     There is nothing to pay until you are happy with both.</p>
  ${rows.length ? `<table style="border-collapse:collapse;width:100%;margin:0 0 1.5em">
    ${rows.map(([k, v]) => `<tr>
      <td style="padding:8px 14px 8px 0;border-bottom:1px solid #E5DCD0;
                 font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;
                 color:#857A6E;white-space:nowrap;vertical-align:top">${k}</td>
      <td style="padding:8px 0;border-bottom:1px solid #E5DCD0;font-size:.95rem">${v}</td>
    </tr>`).join('')}
  </table>` : ''}
  <p style="margin:0 0 1em;line-height:1.6">If anything above is wrong, or you would
     rather just talk it through, call us on
     <a href="tel:+16466679572" style="color:#6E5430">${PHONE}</a>.</p>
  <p style="margin:1.6em 0 0;font-size:.85rem;color:#857A6E">
     ${BUSINESS}<br>${PHONE}</p>
  <p style="margin:.9em 0 0;font-size:.75rem;color:#A49A8E">
     You are getting this because you asked for a free measure on our website.
     It is a one-off confirmation, not a mailing list.</p>
</div>`;

  const text = [
    `Hi ${String(c.name ?? 'there').slice(0, 80)},`, '',
    'Thank you for asking us to come and measure. We have your enquiry and we will',
    'be in touch the same working day to agree a time.', '',
    'The measure is free, takes about forty minutes, and you get a drawing and a',
    'fixed price before anything is ordered.', '',
    ...rows.map(([k, v]) => `${k}: ${v.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')}`),
    '', `If anything above is wrong, call ${PHONE}.`, '', BUSINESS, PHONE,
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [to], reply_to: REPLY_TO,
        subject: `We have your closet enquiry — ${BUSINESS}`,
        html, text,
      }),
    });
    const ok = r.ok;
    return new Response(JSON.stringify({ ok, status: r.status }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    /* The office already has the enquiry. A failure here must never be the
       customer's problem, so it is logged and swallowed. */
    console.error('[confirm-enquiry]', err);
    return new Response(JSON.stringify({ ok: false }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
