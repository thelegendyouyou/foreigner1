// Inscription newsletter -> client Shopify (tags: newsletter, drop-001)
// Nécessite la variable d'environnement SHOPIFY_ADMIN_TOKEN sur Vercel
// (custom app Shopify avec le scope write_customers).

const SHOP = 'foreigners-3882.myshopify.com';
const API = `https://${SHOP}/admin/api/2026-07/customers.json`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const email = ((req.body && req.body.email) || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    res.status(400).json({ ok: false, error: 'invalid_email' });
    return;
  }

  const token = (process.env.SHOPIFY_ADMIN_TOKEN || '').trim();
  if (!token) {
    res.status(503).json({ ok: false, error: 'not_configured' });
    return;
  }

  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        customer: {
          email,
          tags: 'newsletter,drop-001',
          email_marketing_consent: {
            state: 'subscribed',
            opt_in_level: 'single_opt_in',
          },
        },
      }),
    });

    if (r.status === 201) {
      res.status(200).json({ ok: true });
      return;
    }
    if (r.status === 422) {
      // email deja inscrit : pour le visiteur c'est un succes
      res.status(200).json({ ok: true, already: true });
      return;
    }
    res.status(502).json({ ok: false, error: 'shopify_' + r.status });
  } catch {
    res.status(502).json({ ok: false, error: 'network' });
  }
}
