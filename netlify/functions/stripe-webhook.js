// ==========================================================
// 3Deko – Bestell-Benachrichtigung per E-Mail
// ==========================================================
// Wird von Stripe automatisch aufgerufen ("Webhook"), sobald eine
// Bestellung erfolgreich bezahlt wurde. Schickt daraufhin eine
// detaillierte E-Mail mit allen Bestelldaten an office@3deko-andert.at.
//
// Braucht zwei Umgebungsvariablen in Netlify:
//   STRIPE_SECRET_KEY      (schon vorhanden)
//   STRIPE_WEBHOOK_SECRET  (neu, siehe Anleitung im Chat)
//   RESEND_API_KEY         (neu, siehe Anleitung im Chat)

const crypto = require("crypto");

const STORE_EMAIL = "office@3deko-andert.at";
const BRAND = {
  bg: "#F6F6F4",
  card: "#FFFFFF",
  ink: "#4A3A33",
  inkSoft: "#8A776D",
  rose: "#D9BCAE",
  roseDeep: "#B98F7C",
  line: "#E6DED6"
};

/* Prüft, ob die Anfrage wirklich von Stripe kommt (Sicherheitscheck). */
function verifyStripeSignature(rawBody, signatureHeader, secret){
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map(p => p.split("="))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (e) {
    return false;
  }
}

function formatPrice(cents, currency = "eur"){
  const value = cents / 100;
  return value.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (currency === "eur" ? "€" : currency.toUpperCase());
}

/* Baut die HTML-E-Mail im 3Deko-Look. */
function buildEmailHtml({ orderNumber, session, lineItems }){
  const customer = session.customer_details || {};
  const shipping = session.shipping_details || session.customer_details || {};
  const address = shipping.address || {};
  const note = (session.custom_fields || []).find(f => f.key === "anmerkung");
  const noteText = note && note.text && note.text.value ? note.text.value : "";

  const rows = lineItems.map(li => `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid ${BRAND.line}; color:${BRAND.ink};">
        ${li.description}${li.quantity > 1 ? ` <span style="color:${BRAND.inkSoft};">× ${li.quantity}</span>` : ""}
      </td>
      <td style="padding:10px 0; border-bottom:1px solid ${BRAND.line}; text-align:right; white-space:nowrap; color:${BRAND.ink}; font-weight:600;">
        ${formatPrice(li.amount_total, li.currency)}
      </td>
    </tr>`).join("");

  return `
  <div style="background:${BRAND.bg}; padding:32px 16px; font-family:Arial, sans-serif;">
    <div style="max-width:560px; margin:0 auto; background:${BRAND.card}; border-radius:20px; overflow:hidden; border:1px solid ${BRAND.line};">
      <div style="padding:28px 32px; border-bottom:1px solid ${BRAND.line};">
        <div style="font-family:Georgia, serif; font-size:22px; color:${BRAND.ink};">3Deko</div>
        <div style="font-size:12px; letter-spacing:.08em; color:${BRAND.roseDeep}; text-transform:uppercase; margin-top:4px;">Neue Bestellung eingegangen</div>
      </div>

      <div style="padding:24px 32px;">
        <p style="margin:0 0 6px; color:${BRAND.inkSoft}; font-size:13px;">Bestellnummer</p>
        <p style="margin:0 0 20px; color:${BRAND.ink}; font-size:16px; font-weight:700; font-family:monospace;">${orderNumber}</p>

        <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
          ${rows}
        </table>
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding-top:8px; font-weight:700; color:${BRAND.ink};">Gesamt</td>
            <td style="padding-top:8px; font-weight:700; text-align:right; color:${BRAND.ink};">${formatPrice(session.amount_total, session.currency)}</td>
          </tr>
        </table>

        ${noteText ? `
        <div style="margin-top:20px; padding:14px 16px; background:${BRAND.bg}; border-left:3px solid ${BRAND.rose}; border-radius:4px 12px 12px 4px;">
          <p style="margin:0; font-size:13px; color:${BRAND.inkSoft};">Anmerkung der Kundin/des Kunden</p>
          <p style="margin:4px 0 0; color:${BRAND.ink};">${noteText}</p>
        </div>` : ""}

        <div style="margin-top:24px; padding-top:20px; border-top:1px solid ${BRAND.line};">
          <p style="margin:0 0 6px; font-size:13px; color:${BRAND.inkSoft};">Kontakt</p>
          <p style="margin:0; color:${BRAND.ink};">${customer.name || "(kein Name angegeben)"}<br>${customer.email || ""}${customer.phone ? "<br>" + customer.phone : ""}</p>
        </div>

        <div style="margin-top:20px;">
          <p style="margin:0 0 6px; font-size:13px; color:${BRAND.inkSoft};">Lieferadresse</p>
          <p style="margin:0; color:${BRAND.ink};">
            ${address.line1 || ""}${address.line2 ? ", " + address.line2 : ""}<br>
            ${address.postal_code || ""} ${address.city || ""}<br>
            ${address.country || ""}
          </p>
        </div>
      </div>

      <div style="padding:18px 32px; background:${BRAND.bg}; font-size:12px; color:${BRAND.inkSoft};">
        Diese Bestellung findest du auch in deinem Stripe-Dashboard unter der Kundenreferenz ${orderNumber}.
      </div>
    </div>
  </div>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !RESEND_API_KEY) {
    console.error("Fehlende Umgebungsvariable(n) für die Bestell-Benachrichtigung.");
    return { statusCode: 500, body: "Server nicht vollständig konfiguriert." };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  const signatureHeader = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  if (!verifyStripeSignature(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET)) {
    return { statusCode: 400, body: "Ungültige Signatur." };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, body: "Ungültiger Inhalt." };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: "Ignoriert (falscher Ereignistyp)." };
  }

  const session = stripeEvent.data.object;
  const orderNumber = session.client_reference_id || session.id;

  // Vollständige Session (inkl. Kundendaten/Versand) und die Positionen laden.
  let fullSession, lineItems;
  try {
    const sessionRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${session.id}?expand[]=customer_details`,
      { headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` } }
    );
    fullSession = await sessionRes.json();

    const lineItemsRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items?limit=50`,
      { headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` } }
    );
    const lineItemsData = await lineItemsRes.json();
    lineItems = lineItemsData.data || [];
  } catch (err) {
    console.error("Konnte Bestelldetails nicht laden:", err);
    return { statusCode: 500, body: "Bestelldetails konnten nicht geladen werden." };
  }

  const html = buildEmailHtml({ orderNumber, session: fullSession, lineItems });

  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "3Deko Shop <onboarding@resend.dev>",
        to: [STORE_EMAIL],
        subject: `Neue Bestellung ${orderNumber} – ${formatPrice(fullSession.amount_total, fullSession.currency)}`,
        html
      })
    });
    if (!emailRes.ok){
      const errText = await emailRes.text();
      console.error("Resend-Fehler:", errText);
    }
  } catch (err) {
    console.error("E-Mail-Versand fehlgeschlagen:", err);
  }

  return { statusCode: 200, body: "OK" };
};
