exports.handler = async (event) => {
if (event.httpMethod !== “POST”) {
return {
statusCode: 405,
body: JSON.stringify({ error: “Méthode non autorisée” })
};
}

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
return {
statusCode: 500,
body: JSON.stringify({ error: “Clé Resend manquante sur Netlify” })
};
}

let data;

try {
data = JSON.parse(event.body || “{}”);
} catch {
return {
statusCode: 400,
body: JSON.stringify({ error: “Données invalides” })
};
}

const password = event.headers[“x-code”];

if (!password || password !== process.env.DEVIS_PASSWORD) {
return {
statusCode: 401,
body: JSON.stringify({ error: “Mot de passe incorrect” })
};
}

if (!data.to || !data.subject || !data.html) {
return {
statusCode: 400,
body: JSON.stringify({ error: “Informations manquantes” })
};
}

try {
const response = await fetch(“https://api.resend.com/emails”, {
method: “POST”,
headers: {
Authorization: Bearer ${apiKey},
“Content-Type”: “application/json”
},
body: JSON.stringify({
from: process.env.RESEND_FROM,
to: [data.to],
subject: data.subject,
html: data.html,
text: data.text || “”
})
});

const result = await response.json();
return {
  statusCode: response.ok ? 200 : response.status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(
    response.ok
      ? { ok: true }
      : { error: result.message || result.name || "Erreur Resend" }
  )
};

} catch {
return {
statusCode: 502,
body: JSON.stringify({ error: “Impossible de contacter Resend” })
};
}
};
