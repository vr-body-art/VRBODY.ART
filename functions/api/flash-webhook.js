// Cloudflare Pages Function : POST /api/flash-webhook
// Cal.com -> marque un flash "réservé" (ou à nouveau disponible) dans Supabase.
// Variables à définir dans Cloudflare : SUPABASE_SERVICE_KEY (CAL_WEBHOOK_SECRET en option).
const SUPABASE_URL = 'https://djuvwmxuplkzplahjcdm.supabase.co';
const RESERVE = ['BOOKING_PAID', 'BOOKING_CREATED'];
const LIBERE = ['BOOKING_CANCELLED', 'BOOKING_REJECTED'];
const text = (status, body) => new Response(body, { status });

async function hmacHex(secret, raw) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  const key = env.SUPABASE_SERVICE_KEY;
  if (!key) return text(500, 'Configuration manquante');
  const raw = await request.text();

  if (env.CAL_WEBHOOK_SECRET) {
    const expected = await hmacHex(env.CAL_WEBHOOK_SECRET, raw);
    if ((request.headers.get('x-cal-signature-256') || '') !== expected) return text(401, 'Signature invalide');
  }

  let data;
  try { data = JSON.parse(raw); } catch { return text(400, 'JSON invalide'); }
  const trigger = data.triggerEvent;
  const p = data.payload || {};
  const slug = p.type || p.eventTypeSlug || (p.eventType && p.eventType.slug) || '';
  if (!slug) return text(200, 'Pas de lien Cal.com, rien à faire');

  let disponible;
  if (RESERVE.includes(trigger)) disponible = false;
  else if (LIBERE.includes(trigger)) disponible = true;
  else return text(200, 'Événement ignoré');

  // Réservation créée avec acompte : on attend "Réservation payée".
  if (trigger === 'BOOKING_CREATED') {
    const acompte = Number(p.price || 0) > 0 || p.paymentRequired === true ||
      (Array.isArray(p.paymentId) ? p.paymentId.length > 0 : !!p.paymentId);
    if (acompte) return text(200, 'En attente du paiement');
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/flashs?cal_slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ disponible }),
  });
  if (!res.ok) return text(502, 'Erreur Supabase ' + res.status);
  const rows = await res.json().catch(() => []);
  if (!rows.length) return text(200, 'Pas un flash, rien à faire');
  return text(200, `${rows[0].id} -> disponible=${disponible}`);
}
