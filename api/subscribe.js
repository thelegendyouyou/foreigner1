// Inscription newsletter -> client Shopify (tags: newsletter, drop-001)
// Auth 2026 : client credentials grant (SHOPIFY_API_KEY + SHOPIFY_API_SECRET sur Vercel).
// Le token Admin API expire apres 24h -> on le regenere et on le met en cache.

const SHOP = 'foreigners-3882.myshopify.com';
const API_VERSION = '2026-07';
const GRAPHQL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

let cached = null; // { token, expiresAt }

async function getAccessToken() {
  if (cached && Date.now() < cached.expiresAt - 60 * 1000) return cached.token;

  const clientId = (process.env.SHOPIFY_API_KEY || '').trim();
  const clientSecret = (process.env.SHOPIFY_API_SECRET || '').trim();
  if (!clientId || !clientSecret) return null;

  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!r.ok) throw new Error('token_exchange_' + r.status);

  const d = await r.json();
  cached = {
    token: d.access_token,
    expiresAt: Date.now() + (d.expires_in || 86399) * 1000,
  };
  return cached.token;
}

const MUTATION = `
mutation subscribe($input: CustomerInput!) {
  customerCreate(input: $input) {
    customer { id }
    userErrors { field message }
  }
}`;

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

  try {
    const token = await getAccessToken();
    if (!token) {
      res.status(503).json({ ok: false, error: 'not_configured' });
      return;
    }

    const r = await fetch(GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: MUTATION,
        variables: {
          input: {
            email,
            tags: ['newsletter', 'drop-001'],
            emailMarketingConsent: {
              marketingState: 'SUBSCRIBED',
              marketingOptInLevel: 'SINGLE_OPT_IN',
            },
          },
        },
      }),
    });

    if (!r.ok) {
      cached = null; // token peut-etre revoque -> forcer un refresh au prochain appel
      res.status(502).json({ ok: false, error: 'shopify_' + r.status });
      return;
    }

    const d = await r.json();
    const errs = (d.data && d.data.customerCreate && d.data.customerCreate.userErrors) || [];

    if (errs.length === 0 && d.data.customerCreate.customer) {
      res.status(200).json({ ok: true });
      return;
    }
    // email deja inscrit : pour le visiteur c'est un succes
    if (errs.some(e => /taken|already/i.test(e.message))) {
      res.status(200).json({ ok: true, already: true });
      return;
    }
    res.status(502).json({ ok: false, error: 'shopify_user_error' });
  } catch (e) {
    const msg = String(e && e.message || '');
    if (msg.startsWith('token_exchange_')) {
      res.status(502).json({ ok: false, error: msg });
      return;
    }
    res.status(502).json({ ok: false, error: 'network' });
  }
}
