// ==========================================================
// 3Deko – Widerrufsformular
// ==========================================================
// Nimmt die Angaben aus dem Widerrufsformular entgegen und verschickt:
//  1) eine Detail-Mail an office@3deko-andert.at
//  2) eine Bestätigungsmail an die absendende Person
//
// Braucht die Umgebungsvariable RESEND_API_KEY (schon vorhanden).

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
  return String(str ?? "")
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

  // Honeypot: unsichtbares Feld gegen Bots
  if ((data.hpWebsite || "").trim() !== "") {
    return { statusCode: 200, body: JSON.stringify({ ownerSent: true, customerSent: true }) };
  }

  const name = (data.name || "").trim().slice(0, 200);
  const email = (data.email || "").trim().slice(0, 200);
  const address = (data.address || "").trim().slice(0, 400);
  const orderNumber = (data.orderNumber || "").trim().slice(0, 100);
  const orderedOn = (data.orderedOn || "").trim().slice(0, 50);
  const items = (data.items || "").trim().slice(0, 2000);

  if (!name || !email || !address || !items) {
    return { statusCode: 400, body: JSON.stringify({ error: "Bitte alle Pflichtfelder ausfüllen." }) };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Bitte eine gültige E-Mail-Adresse angeben." }) };
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeAddress = escapeHtml(address).replace(/\n/g, "<br>");
  const safeOrderNumber = escapeHtml(orderNumber) || "(nicht angegeben)";
  const safeOrderedOn = escapeHtml(orderedOn) || "(nicht angegeben)";
  const safeItems = escapeHtml(items).replace(/\n/g, "<br>");

  const ownerHtml = wrapEmail(`
    <p style="margin:0 0 6px; font-size:13px; color:${BRAND.roseDeep}; text-transform:uppercase; letter-spacing:.06em;">Widerruf eingegangen</p>
    <p style="margin:0 0 20px;"><strong>${safeName}</strong><br>${safeEmail}<br>${safeAddress}</p>
    <p style="margin:0 0 6px; font-size:13px; color:${BRAND.inkSoft};">Bestellnummer</p>
    <p style="margin:0 0 16px;">${safeOrderNumber}</p>
    <p style="margin:0 0 6px; font-size:13px; color:${BRAND.inkSoft};">Bestellt/erhalten am</p>
    <p style="margin:0 0 16px;">${safeOrderedOn}</p>
    <p style="margin:0 0 6px; font-size:13px; color:${BRAND.inkSoft};">Widerrufene Ware(n)</p>
    <div style="padding:14px 16px; background:${BRAND.bg}; border-left:3px solid ${BRAND.roseDeep}; border-radius:4px 12px 12px 4px;">
      ${safeItems}
    </div>
    <p style="margin-top:20px;"><a href="mailto:${safeEmail}" style="color:${BRAND.roseDeep};">Direkt antworten</a></p>
  `);

  const customerHtml = wrapEmail(`
    <p>Hallo ${safeName},</p>
    <p>dein Widerruf ist bei uns eingegangen – danke für die Nachricht. Wir melden uns wegen der Rückabwicklung (Rücksendeadresse, ggf. Erstattung) in Kürze bei dir.</p>
    <p style="margin:20px 0 6px; font-size:13px; color:${BRAND.inkSoft};">Zur Erinnerung: deine Angaben</p>
    <p style="margin:0 0 10px;">Bestellnummer: ${safeOrderNumber}<br>Bestellt/erhalten am: ${safeOrderedOn}</p>
    <div style="padding:14px 16px; background:${BRAND.bg}; border-left:3px solid ${BRAND.roseDeep}; border-radius:4px 12px 12px 4px;">
      ${safeItems}
    </div>
    <p style="margin-top:20px;">Liebe Grüße<br>Cindy von 3Deko</p>
  `);

  const results = { ownerSent: false, customerSent: false };

  try {
    const ownerRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "3Deko Widerruf <office@3deko-andert.at>",
        to: [STORE_EMAIL],
        reply_to: email,
        subject: `Widerruf: ${name}${orderNumber ? " – " + orderNumber : ""}`,
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
        from: "3Deko <office@3deko-andert.at>",
        to: [email],
        subject: "Dein Widerruf ist bei 3Deko angekommen",
        html: customerHtml
      })
    });
    results.customerSent = customerRes.ok;
    if (!customerRes.ok) console.error("Fehler beim Senden an Kundin/Kunden:", await customerRes.text());
  } catch (err) {
    console.error("Fehler beim Senden an Kundin/Kunden:", err);
  }

  if (!results.ownerSent) {
    return { statusCode: 500, body: JSON.stringify({ error: "Widerruf konnte nicht verschickt werden. Bitte versuch es später erneut." }) };
  }

  return { statusCode: 200, body: JSON.stringify(results) };
};
