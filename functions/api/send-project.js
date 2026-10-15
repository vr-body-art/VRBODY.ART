// Cloudflare Pages Function : POST /api/send-project
// Envoie la demande de projet par e-mail via Resend.
// Variable à définir dans Cloudflare (Settings > Variables and Secrets) : RESEND_API_KEY
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const onRequestOptions = () => new Response('', { status: 200, headers: CORS });

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json().catch(() => ({}));
    if (data.site_web) return json(200, { success: true }); // anti-spam (champ caché)

    const { prenom, email, zone, taille, disponibilites, description, lienReference } = data;
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    if (!prenom || !email || !description) return json(400, { error: 'Champs requis manquants' });

    let html = '<h2>Nouvelle demande de projet</h2>'
      + '<p><strong>Prénom :</strong> ' + esc(prenom) + '</p>'
      + '<p><strong>Email :</strong> ' + esc(email) + '</p>'
      + '<p><strong>Zone :</strong> ' + esc(zone || 'Non précisée') + '</p>'
      + '<p><strong>Taille :</strong> ' + (taille ? esc(taille) + ' cm' : 'Non précisée') + '</p>';
    if (disponibilites) html += '<p><strong>Disponibilités :</strong> ' + esc(disponibilites) + '</p>';
    html += '<p><strong>Description :</strong></p><p>' + esc(description).replace(/\n/g, '<br>') + '</p>';
    if (lienReference) html += '<p><strong>Lien de référence :</strong> <a href="' + esc(lienReference) + '">' + esc(lienReference) + '</a></p>';
    if (attachments.length) html += '<p><strong>Images jointes :</strong> ' + attachments.length + '</p>';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'VR Body Art <onboarding@resend.dev>',
        to: ['vraimbaud23@gmail.com'],
        reply_to: email,
        subject: 'Nouvelle demande de projet - ' + prenom,
        html,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })),
      }),
    });
    if (!res.ok) { console.error('Resend error:', await res.text()); return json(502, { error: "Échec de l'envoi" }); }
    return json(200, { success: true });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Erreur serveur' });
  }
}
