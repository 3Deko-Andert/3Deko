// ==========================================================
// 3Deko – Verstecktes Gewinnspiel
// ==========================================================
// GET  -> gibt zurück, ob der Gewinn schon eingelöst wurde
// POST -> trägt Name/E-Mail als Gewinner:in ein (nur beim allerersten Mal)
//         und schickt eine Benachrichtigung an office@3deko-andert.at
//
// Speichert den Status dauerhaft über Netlify Blobs (in Netlify eingebaut,
// kein zusätzliches Konto nötig).

const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_EMAIL = "office@3deko-andert.at";

function escapeHtml(str){
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

exports.handler = async (event) => {
  connectLambda(event); // aktiviert die Blobs-Umgebung für dieses klassische Funktionsformat

  let store;
  try {
    store = getStore("prize");
  } catch (err) {
    console.error("Blobs-Store nicht verfügbar:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Speicher nicht verfügbar." }) };
  }

  if (event.httpMethod === "GET") {
    const status = (await store.get("status", { type: "json" })) || { claimed: false };
    return { statusCode: 200, body: JSON.stringify({ claimed: !!status.claimed }) };
  }

  if (event.httpMethod === "POST") {
    let data;
    try {
      data = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: "Ungültige Anfrage." }) };
    }

    // Honeypot: für Menschen unsichtbares Feld. Ist es ausgefüllt, war es ein
    // Bot – wir tun so, als wäre der Gewinn erfolgreich beansprucht worden,
    // tragen ihn aber tatsächlich nicht ein.
    if ((data.hpWebsite || "").trim() !== "") {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    const name = (data.name || "").trim().slice(0, 200);
    const email = (data.email || "").trim().slice(0, 200);
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Bitte Name und eine gültige E-Mail-Adresse angeben." }) };
    }

    // Bereits vergeben? (verhindert auch doppelte Klicks kurz hintereinander)
    const current = (await store.get("status", { type: "json" })) || { claimed: false };
    if (current.claimed) {
      return { statusCode: 409, body: JSON.stringify({ error: "Der Gewinn wurde schon eingelöst." }) };
    }

    await store.setJSON("status", {
      claimed: true,
      name,
      email,
      claimedAt: new Date().toISOString()
    });

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(email);
      const html = `
        <div style="background:#F6F6F4; padding:32px 16px; font-family:Arial, sans-serif;">
          <div style="max-width:560px; margin:0 auto; background:#FFFFFF; border-radius:20px; overflow:hidden; border:1px solid #E6DED6;">
            <div style="padding:28px 32px; border-bottom:1px solid #E6DED6;">
              <div style="font-family:Georgia, serif; font-size:22px; color:#4A3A33;">3Deko</div>
              <div style="font-size:12px; letter-spacing:.06em; color:#B98F7C; text-transform:uppercase; margin-top:4px;">Gewinnspiel eingelöst</div>
            </div>
            <div style="padding:24px 32px; color:#4A3A33;">
              <p>Der versteckte Link auf der Startseite wurde gefunden und eingelöst!</p>
              <p style="margin:0 0 6px; font-size:13px; color:#8A776D;">Gewinner:in</p>
              <p style="margin:0 0 20px;"><strong>${safeName}</strong><br>${safeEmail}</p>
              <p>Der Link ist jetzt für alle anderen Besucher:innen automatisch deaktiviert.</p>
            </div>
          </div>
        </div>`;
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "3Deko Gewinnspiel <onboarding@resend.dev>",
            to: [STORE_EMAIL],
            subject: `🎉 Gewinnspiel eingelöst von ${name}`,
            html
          })
        });
      } catch (err) {
        console.error("Mail konnte nicht verschickt werden:", err);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};
