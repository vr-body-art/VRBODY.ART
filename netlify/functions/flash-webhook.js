// Cal.com -> marque un flash "réservé" (ou à nouveau disponible) dans Supabase.
// Variable à définir sur Netlify : SUPABASE_SERVICE_KEY (CAL_WEBHOOK_SECRET en option).
const crypto = require('crypto');

const SUPABASE_URL = 'https://djuvwmxuplkzplahjcdm.supabase.co';

// fin du lien Cal.com  ->  identifiant du flash dans la table "flashs"
const FLASHS = {
  'tatouage-oni-450': 'flash-oni',
  'tatouage-carpe-koi-450': 'flash-koi',
  'tatouage-miroir-190': 'flash-miroir',
};

const RESERVE = ['BOOKING_PAID', 'BOOKING_CREATED'];
const LIBERE = ['BOOKING_CANCELLED', 'BOOKING_REJECTED'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const secret = process.env.CAL_WEBHOOK_SECRET;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) return { statusCode: 500, body: 'Configuration manquante' };

  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  // si un secret est réglé dans Cal.com et sur Netlify, on vérifie que l'appel vient bien de Cal.com
  if (secret) {
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const received = event.headers['x-cal-signature-256'] || '';
    const ok = received.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
    if (!ok) return { statusCode: 401, body: 'Signature invalide' };
  }

  let data;
  try { data = JSON.parse(raw); } catch { return { statusCode: 400, body: 'JSON invalide' }; }

  const trigger = data.triggerEvent;
  const p = data.payload || {};
  const slug = p.type || p.eventTypeSlug || (p.eventType && p.eventType.slug) || '';
  const flashId = FLASHS[slug];
  if (!flashId) return { statusCode: 200, body: 'Pas un flash, rien à faire' };

  let disponible;
  if (RESERVE.includes(trigger)) disponible = false;
  else if (LIBERE.includes(trigger)) disponible = true;
  else return { statusCode: 200, body: 'Événement ignoré' };

  // BOOKING_CREATED arrive avant le paiement : on ne bloque que si l'acompte est payé
  if (trigger === 'BOOKING_CREATED' && p.paymentRequired !== false && p.status !== 'ACCEPTED') {
    return { statusCode: 200, body: 'En attente du paiement' };
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/flashs?id=eq.${encodeURIComponent(flashId)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ disponible }),
  });
  if (!res.ok) return { statusCode: 502, body: 'Erreur Supabase ' + res.status };

  return { statusCode: 200, body: `${flashId} -> disponible=${disponible}` };
};
