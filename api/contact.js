// Formulaire de contact -> email via Resend (https://resend.com, plan gratuit)
// Variables d'environnement à configurer sur Vercel :
//   RESEND_API_KEY : clé API Resend
//   CONTACT_TO     : adresse qui reçoit les messages (ex. hello@foreigners.world)
// Tant qu'elles ne sont pas définies, l'endpoint répond 503 et la page
// contact.html affiche le repli Instagram.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 80);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
  const order = String(b.order || '').trim().slice(0, 40);
  const message = String(b.message || '').trim().slice(0, 4000);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) || !message) {
    res.status(400).json({ ok: false, error: 'invalid_input' });
    return;
  }

  const key = (process.env.RESEND_API_KEY || '').trim();
  const to = (process.env.CONTACT_TO || '').trim();
  if (!key || !to) {
    res.status(503).json({ ok: false, error: 'not_configured' });
    return;
  }

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: 'FOREIGNERS contact <onboarding@resend.dev>',
        to: [to],
        reply_to: email,
        subject: `[Contact] ${name || email}${order ? ` — order ${order}` : ''}`,
        html: `<p><strong>From:</strong> ${esc(name) || '—'} &lt;${esc(email)}&gt;</p>
<p><strong>Order:</strong> ${esc(order) || '—'}</p>
<hr>
<p style="white-space:pre-wrap">${esc(message)}</p>`,
      }),
    });

    if (r.ok) {
      res.status(200).json({ ok: true });
    } else {
      res.status(502).json({ ok: false, error: 'send_failed' });
    }
  } catch (_) {
    res.status(502).json({ ok: false, error: 'send_failed' });
  }
}
