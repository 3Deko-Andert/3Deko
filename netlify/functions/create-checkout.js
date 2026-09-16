// ==========================================================
// 3Deko – Erstellt eine sichere Stripe-Kasse (Checkout Session)
// ==========================================================
// Läuft als Netlify Function unter /.netlify/functions/create-checkout
// Braucht die Umgebungsvariable STRIPE_SECRET_KEY (in Netlify eintragen,
// niemals im Code oder im Browser).

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

  // Produktdaten UND Preise serverseitig aus products.json laden – so kann
  // niemand über den Browser einen anderen Preis vorgeben.
  const site = process.env.URL || `https://${event.headers.host}`;
  let products;
  try {
    const productsRes = await fetch(`${site}/content/products.json`);
    products = (await productsRes.json()).products;
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Produktdaten konnten nicht geladen werden." }) };
  }

  const items = cart
    .map(entry => {
      const product = products.find(p => p.id === entry.id);
      if (!product) return null;
      const qty = Math.max(1, Math.min(20, parseInt(entry.qty, 10) || 1));
      return { product, qty };
    })
    .filter(Boolean);

  if (items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Keine gültigen Artikel im Warenkorb." }) };
  }

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("success_url", `${site}/bestellung-erfolgreich.html?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${site}/shop.html`);
  params.append("shipping_address_collection[allowed_countries][]", "AT");
  params.append("shipping_address_collection[allowed_countries][]", "DE");
  params.append("locale", "de");

  items.forEach((entry, i) => {
    params.append(`line_items[${i}][quantity]`, entry.qty);
    params.append(`line_items[${i}][price_data][currency]`, "eur");
    params.append(`line_items[${i}][price_data][unit_amount]`, Math.round(entry.product.price * 100));
    params.append(`line_items[${i}][price_data][product_data][name]`, entry.product.name);
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
