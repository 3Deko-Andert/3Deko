// ==========================================================
// 3Deko – Erstellt eine sichere Stripe-Kasse (Checkout Session)
// ==========================================================
// Läuft als Netlify Function unter /.netlify/functions/create-checkout
// Braucht die Umgebungsvariable STRIPE_SECRET_KEY (in Netlify eintragen,
// niemals im Code oder im Browser).

const fs = require("fs");
const path = require("path");

/* Lädt die Produktdaten direkt aus der mitgelieferten Datei (siehe
   netlify.toml -> included_files), statt sich die Website selbst
   per Netzwerk-Aufruf zu holen – das ist zuverlässiger. */
function loadProductsFromDisk(){
  const candidates = [
    path.join(__dirname, "content", "products.json"),
    path.join(__dirname, "..", "..", "content", "products.json"),
    path.join(process.cwd(), "content", "products.json"),
    "/var/task/content/products.json"
  ];
  for (const file of candidates){
    try {
      if (fs.existsSync(file)){
        const raw = fs.readFileSync(file, "utf8");
        return JSON.parse(raw).products || [];
      }
    } catch (e) { /* nächsten Pfad probieren */ }
  }
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Die Kasse ist noch nicht eingerichtet. Es fehlt der Stripe-Schlüssel in den Netlify-Einstellungen."
      })
    };
  }

  let cart;
  try {
    cart = JSON.parse(event.body).cart;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Ungültige Anfrage." }) };
  }
  if (!Array.isArray(cart) || cart.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Warenkorb ist leer." }) };
  }

  // Produktdaten UND Preise serverseitig laden – so kann niemand über
  // den Browser einen anderen Preis vorgeben.
  let products = loadProductsFromDisk();

  // Falls die mitgelieferte Datei aus irgendeinem Grund nicht gefunden wird,
  // notfalls doch über die Website nachladen.
  if (!products){
    try {
      const site = process.env.URL || `https://${event.headers.host}`;
      const productsRes = await fetch(`${site}/content/products.json`);
      products = (await productsRes.json()).products;
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: "Produktdaten konnten nicht geladen werden." }) };
    }
  }

  const items = cart
    .map(entry => {
      const product = products.find(p => p.id === entry.id);
      if (!product) return null;
      const qty = Math.max(1, Math.min(20, parseInt(entry.qty, 10) || 1));
      const note = typeof entry.note === "string" ? entry.note.trim().slice(0, 400) : "";
      return { product, qty, note };
    })
    .filter(Boolean);

  if (items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Keine gültigen Artikel im Warenkorb." }) };
  }

  const site = process.env.URL || `https://${event.headers.host}`;

  // Kurze, gut lesbare Bestellnummer erzeugen (z. B. 3D-8K42F1). Wird
  // zusätzlich als Kundenreferenz bei Stripe hinterlegt, damit die Bestellung
  // auch im Stripe-Dashboard leicht wiederzufinden ist.
  const orderNumber = "3D-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("client_reference_id", orderNumber);
  params.append("success_url", `${site}/bestellung-erfolgreich.html?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${site}/shop.html`);
  params.append("shipping_address_collection[allowed_countries][]", "AT");
  params.append("locale", "de");

  // Kund:in kann zwischen Versand (6,90 €, automatisch berechnet) und
  // Abholung in Pamhagen (kostenlos, nur nach Vereinbarung) wählen.
  params.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  params.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "690");
  params.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "eur");
  params.append("shipping_options[0][shipping_rate_data][display_name]", "Versand");
  params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
  params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "3");
  params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
  params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "14");

  params.append("shipping_options[1][shipping_rate_data][type]", "fixed_amount");
  params.append("shipping_options[1][shipping_rate_data][fixed_amount][amount]", "0");
  params.append("shipping_options[1][shipping_rate_data][fixed_amount][currency]", "eur");
  params.append("shipping_options[1][shipping_rate_data][display_name]", "Abholung in Pamhagen (nur nach Vereinbarung)");

  // Erstellt zusätzlich zum Zahlungsbeleg eine echte Rechnung (PDF, mit
  // fortlaufender Rechnungsnummer) und schickt sie automatisch an die
  // Kundin/den Kunden.
  params.append("invoice_creation[enabled]", "true");
  params.append(
    "invoice_creation[invoice_data][footer]",
    "3Deko – Cindy Andert – Kapellensiedlung 17, 7152 Pamhagen – office@3deko-andert.at – " +
    "Kleinunternehmerin gemäß § 6 Abs. 1 Z 27 UStG, daher weisen wir keine Umsatzsteuer aus."
  );

  // Freiwilliges Notizfeld, das direkt bei der Bezahlung angezeigt wird –
  // zusätzlich zu den Wünschen, die schon pro Produkt im Warenkorb erfasst wurden.
  params.append("custom_fields[0][key]", "anmerkung");
  params.append("custom_fields[0][label][type]", "custom");
  params.append("custom_fields[0][label][custom]", "Anmerkung zur Bestellung (optional)");
  params.append("custom_fields[0][type]", "text");
  params.append("custom_fields[0][optional]", "true");

  items.forEach((entry, i) => {
    // Persönlicher Wunsch (Name, Fototext, ...) wird direkt sichtbar an den
    // Produktnamen angehängt UND zusätzlich als Metadaten gespeichert, damit
    // er in der Stripe-Übersicht garantiert nicht übersehen wird.
    const displayName = entry.note
      ? `${entry.product.name} — ${entry.note}`
      : entry.product.name;

    params.append(`line_items[${i}][quantity]`, entry.qty);
    params.append(`line_items[${i}][price_data][currency]`, "eur");
    // Bei Sale-Produkten den im Verwaltungspanel frei gewählten Rabatt anwenden
    // (serverseitig, damit niemand über den Browser einen falschen Preis vorgeben kann)
    const salePercent = entry.product.salePercent || 15;
    const unitPrice = entry.product.onSale
      ? Math.round(entry.product.price * (1 - salePercent / 100) * 100) / 100
      : entry.product.price;
    params.append(`line_items[${i}][price_data][unit_amount]`, Math.round(unitPrice * 100));
    params.append(`line_items[${i}][price_data][product_data][name]`, displayName);
    if (entry.note){
      params.append(`line_items[${i}][price_data][product_data][metadata][wunsch]`, entry.note);
    }
  });

  try {
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: session.error?.message || "Stripe hat die Anfrage abgelehnt." }) };
    }
    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Verbindung zu Stripe ist fehlgeschlagen." }) };
  }
};
