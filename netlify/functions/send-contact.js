// ==========================================================
// 3Deko – Kontaktformular
// ==========================================================
// Nimmt die Angaben aus dem Kontaktformular entgegen und verschickt:
//  1) eine Detail-Mail an office@3deko-andert.at
//  2) eine Bestätigungsmail an die absendende Person
//
// Braucht die Umgebungsvariable RESEND_API_KEY (schon vorhanden).
//
// Hinweis: Die Bestätigungsmail an die Kundin/den Kunden ist nur so lange
// zuverlässig zustellbar, wie noch keine eigene Domain bei Resend verifiziert
// ist – siehe Erklärung im Chat.

const STORE_EMAIL = "office@3deko-andert.at";
const BRAND = {
  bg: "#F6F6F4",
  card: "#FFFFFF",
  ink: "#4A3A33",
  inkSoft: "#8A776D",
  roseDeep: "#B98F7C",
  line: "#E6DED6"
};

function escapeHtml(str){
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapEmail(innerHtml){
  return `
  <div style="background:${BRAND.bg}; padding:32px 16px; font-family:Arial, sans-serif;">
    <div style="max-width:560px; margin:0 auto; background:${BRAND.card}; border-radius:20px; overflow:hidden; border:1px solid ${BRAND.line};">
      <div style="padding:28px 32px; border-bottom:1px solid ${BRAND.line};">
        <div style="font-family:Georgia, serif; font-size:22px; color:${BRAND.ink};">3Deko</div>
      </div>
      <div style="padding:24px 32px; color:${BRAND.ink};">
        ${innerHtml}
      </div>
    </div>
  </div>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "E-Mail-Versand ist noch nicht eingerichtet." }) };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Ungültige Anfrage." }) };
  }

  // Honeypot: Dieses Feld ist für Menschen unsichtbar. Füllt es jemand (bzw.
  // ein Bot) trotzdem aus, tun wir so, als hätte alles geklappt, verschicken
  // aber in Wirklichkeit nichts.
  if ((data.hpWebsite || "").trim() !== "") {
    return { statusCode: 200, body: JSON.stringify({ ownerSent: true, customerSent: true }) };
  }

  const name = (data.name || "").trim().slice(0, 200);
  const email = (data.email || "").trim().slice(0, 200);
  const message = (data.message || "").trim().slice(0, 4000);

  if (!name || !email || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: "Bitte alle Felder ausfüllen." }) };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Bitte eine gültige E-Mail-Adresse angeben." }) };
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  // 1) Mail an Cindy mit allen Angaben
  const ownerHtml = wrapEmail(`
    <p style="margin:0 0 6px; font-size:13px; color:${BRAND.roseDeep}; text-transform:uppercase; letter-spacing:.06em;">Neue Nachricht über das Kontaktformular</p>
    <p style="margin:0 0 20px;"><strong>${safeName}</strong><br>${safeEmail}</p>
    <div style="padding:14px 16px; background:${BRAND.bg}; border-left:3px solid ${BRAND.roseDeep}; border-radius:4px 12px 12px 4px;">
      ${safeMessage}
    </div>
    <p style="margin-top:20px;"><a href="mailto:${safeEmail}" style="color:${BRAND.roseDeep};">Direkt antworten</a></p>
  `);

  // 2) Bestätigungsmail an die absendende Person
  const customerHtml = wrapEmail(`
    <p>Hallo ${safeName},</p>
    <p>danke für deine Nachricht – ich habe sie erhalten und melde mich in der Regel innerhalb von 2 Werktagen bei dir.</p>
    <p style="margin:20px 0 6px; font-size:13px; color:${BRAND.inkSoft};">Deine Nachricht zur Erinnerung</p>
    <div style="padding:14px 16px; background:${BRAND.bg}; border-left:3px solid ${BRAND.roseDeep}; border-radius:4px 12px 12px 4px;">
      ${safeMessage}
    </div>
    <p style="margin-top:20px;">Liebe Grüße<br>Cindy von 3Deko</p>
  `);

  const results = { ownerSent: false, customerSent: false };

  try {
    const ownerRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "3Deko Kontaktformular <onboarding@resend.dev>",
        to: [STORE_EMAIL],
        reply_to: email,
        subject: `Kontaktformular: ${name}`,
        html: ownerHtml
      })
    });
    results.ownerSent = ownerRes.ok;
    if (!ownerRes.ok) console.error("Fehler beim Senden an Shop:", await ownerRes.text());
  } catch (err) {
    console.error("Fehler beim Senden an Shop:", err);
  }

  try {
    const customerRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "3Deko <onboarding@resend.dev>",
        to: [email],
        subject: "Deine Nachricht ist bei 3Deko angekommen",
        html: customerHtml
      })
    });
    results.customerSent = customerRes.ok;
    if (!customerRes.ok) console.error("Fehler beim Senden an Kundin/Kunden:", await customerRes.text());
  } catch (err) {
    console.error("Fehler beim Senden an Kundin/Kunden:", err);
  }

  if (!results.ownerSent) {
    return { statusCode: 500, body: JSON.stringify({ error: "Nachricht konnte nicht verschickt werden. Bitte versuch es später erneut." }) };
  }

  return { statusCode: 200, body: JSON.stringify(results) };
};
