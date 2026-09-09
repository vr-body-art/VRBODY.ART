exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Methode non autorisee' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const prenom = data.prenom;
    const email = data.email;
    const zone = data.zone;
    const taille = data.taille;
    const disponibilites = data.disponibilites;
    const description = data.description;
    const lienReference = data.lienReference;
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];

  if (!prenom || !email || !description) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Champs requis manquants' }) };
  }

  let emailHtml = '<h2>Nouvelle demande de projet</h2><p><strong>Prenom:</strong> ' + prenom + '</p><p><strong>Email:</strong> ' + email + '</p><p><strong>Zone:</strong> ' + (zone || 'Non precisee') + '</p><p><strong>Taille:</strong> ' + (taille ? taille + ' cm' : 'Non precisee') + '</p>';
    if (disponibilites) {
      emailHtml += '<p><strong>Disponibilites:</strong> ' + disponibilites + '</p>';
    }
    emailHtml += '<p><strong>Description:</strong></p><p>' + description + '</p>';
    if (lienReference) {
      emailHtml += '<p><strong>Lien de reference:</strong> <a href="' + lienReference + '">' + lienReference + '</a></p>';
    }
    if (attachments.length) {
      emailHtml += '<p><strong>Images jointes:</strong> ' + attachments.length + '</p>';
    }

  const resendAttachments = attachments.map((a) => ({
    filename: a.filename,
    content: a.content,
  }));

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'VR Body Art <onboarding@resend.dev>',
      to: ['vraimbaud23@gmail.com'],
      reply_to: email,
      subject: 'Nouvelle demande de projet - ' + prenom,
      html: emailHtml,
      attachments: resendAttachments,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Resend error:', err);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "Echec de l'envoi" }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
