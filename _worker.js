// Cloudflare Pages – « advanced mode » : ce fichier gère l'envoi des e-mails (/api/envoyer)
// et laisse Cloudflare servir toutes les autres pages du site.
// Secret requis (Settings > Variables and Secrets) : RESEND_API_KEY  (contient la clé Resend)
// Variables facultatives : FROM_EMAIL, REPLY_TO

const H = '7bbc641d269a9d10a999220d1dee363d4c2297638d2ad9bce1def756b5989152'; // empreinte du mot de passe du site
const S = 'bf|devis|2026|';

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/envoyer') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'Origine refusée' }, 403);

    // Le mot de passe du site est revérifié ici, côté serveur.
    const code = request.headers.get('x-code') || '';
    if ((await sha256(S + code)) !== H) return json({ error: 'Mot de passe incorrect' }, 401);

    if (!env.RESEND_API_KEY) return json({ error: 'Secret RESEND_API_KEY introuvable sur ce projet' }, 500);

    let d;
    try { d = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const to = String(d.to || '').trim();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(to)) return json({ error: 'Adresse e-mail invalide' }, 400);
    const subject = String(d.subject || '').slice(0, 200);
    const html = String(d.html || '');
    const text = String(d.text || '');
    if (!subject || !html || html.length > 200000) return json({ error: 'Contenu invalide' }, 400);

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.FROM_EMAIL || 'Belloni & Fils <onboarding@resend.dev>',
        to: [to], subject, html, text,
        reply_to: env.REPLY_TO || 'bbelloni@hotmail.fr'
      })
    });
    const t = await r.text();
    let j = {}; try { j = JSON.parse(t); } catch {}
    if (!r.ok) return json({ error: j.message || j.error || ('Resend ' + r.status) }, 502);
    return json({ ok: true, id: j.id });
  }
};
