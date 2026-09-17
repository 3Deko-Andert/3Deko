/* ==========================================================
   3Deko – Script
   Navigation, Warenkorb (localStorage), Produkte
   ========================================================== */

/* ---------- Produkte ---------- */
/* Die Produktdaten liegen in content/products.json und werden dort über
   das CMS unter /admin/ verwaltet (Fotos, Preise, Kategorie, Saison). */
let PRODUCTS = [];

async function loadProducts(){
  try {
    const res = await fetch("content/products.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Antwort war nicht ok");
    const data = await res.json();
    PRODUCTS = data.products || [];
  } catch (err) {
    console.error("Produkte konnten nicht geladen werden:", err);
    PRODUCTS = [];
  }
}

/* Leitet ein kleines Saison-Emoji aus dem im CMS gesetzten Text ab. */
function seasonIcon(season){
  if (!season) return "✨";
  if (season.includes("Weihnachten")) return "🎄";
  if (season.includes("Winter") && !season.includes("Herbst")) return "❄️";
  if (season.includes("Herbst")) return "🍂";
  if (season.includes("Frühling")) return "🌱";
  if (season.includes("Sommer")) return "☀️";
  return "✨";
}

/* ---------- Warenkorb (localStorage) ---------- */
const CART_KEY = "3deko_cart";

function newLineId(){
  return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getCart(){
  let cart;
  try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch(e){ return []; }

  // Reparatur für Warenkörbe aus einer älteren Version der Website, die
  // noch keine eindeutige Zeilen-Kennung hatten (sonst lässt sich "entfernen"
  // bei solchen Alt-Eintägen nicht anklicken).
  let migrated = false;
  cart.forEach(item => {
    if (!item.lineId){ item.lineId = newLineId(); migrated = true; }
  });
  if (migrated) localStorage.setItem(CART_KEY, JSON.stringify(cart));

  return cart;
}
function saveCart(cart){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

/* note = optionaler Personalisierungs-Wunsch. Zeilen mit unterschiedlichem
   Wunschtext bleiben getrennt (z. B. zwei Namensschilder mit je eigenem Namen). */
function addToCart(id, qty = 1, note = ""){
  const cart = getCart();
  note = (note || "").trim();
  const existing = cart.find(i => i.id === id && (i.note || "") === note);
  if (existing) existing.qty += qty;
  else cart.push({ lineId: newLineId(), id, qty, note });
  saveCart(cart);
  renderCartDrawer();
  openCart();
}
function updateQty(lineId, delta){
  const cart = getCart();
  const item = cart.find(i => i.lineId === lineId);
  if (!item) return;
  item.qty += delta;
  const filtered = cart.filter(i => i.qty > 0);
  saveCart(filtered);
  renderCartDrawer();
}
function removeFromCart(lineId){
  saveCart(getCart().filter(i => i.lineId !== lineId));
  renderCartDrawer();
}
function cartCount(){
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}
function updateCartCount(){
  document.querySelectorAll("[data-cart-count]").forEach(el => {
    const n = cartCount();
    el.textContent = n;
    el.style.display = n > 0 ? "flex" : "none";
  });
}

function formatPrice(v){
  return v.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

/* ---------- Cart Drawer rendern ---------- */
function renderCartDrawer(){
  const wrap = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  if (!wrap) return;

  const cart = getCart();
  if (cart.length === 0){
    wrap.innerHTML = `<div class="cart-empty">Dein Warenkorb ist noch leer &mdash; stöber gern im <a href="shop.html">Shop</a>.</div>`;
    if (totalEl) totalEl.textContent = formatPrice(0);
    return;
  }

  let total = 0;
  wrap.innerHTML = cart.map(item => {
    const p = PRODUCTS.find(pr => pr.id === item.id);
    if (!p) return "";
    total += p.price * item.qty;
    return `
      <div class="cart-item">
        <div class="thumb"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
        <div class="cart-item-info">
          <h4>${p.name}</h4>
          ${item.note ? `<p class="cart-item-note">✎ ${item.note}</p>` : ""}
          <div class="row">
            <div class="qty-control">
              <button type="button" onclick="updateQty('${item.lineId}', -1)" aria-label="Menge verringern">−</button>
              <span>${item.qty}</span>
              <button type="button" onclick="updateQty('${item.lineId}', 1)" aria-label="Menge erhöhen">+</button>
            </div>
            <strong>${formatPrice(p.price * item.qty)}</strong>
          </div>
          <button type="button" class="remove-link" onclick="removeFromCart('${item.lineId}')">entfernen</button>
        </div>
      </div>`;
  }).join("");

  if (totalEl) totalEl.textContent = formatPrice(total);
}

function openCart(){
  document.getElementById("cartDrawer")?.classList.add("open");
  document.getElementById("cartOverlay")?.classList.add("open");
}
function closeCart(){
  document.getElementById("cartDrawer")?.classList.remove("open");
  document.getElementById("cartOverlay")?.classList.remove("open");
}

/* ---------- Produktkarte (gemeinsam für Shop & Startseite) ---------- */
function productCard(p){
  const personalizeField = p.personalizable ? `
        <label class="personalize-field">
          <span>${p.personalizeLabel || "Deine Wünsche"}</span>
          <textarea rows="2" placeholder="z. B. „Anna“"></textarea>
        </label>` : "";

  const photoHint = p.needsPhoto
    ? `<p class="personalize-photo-hint">📸 Du bekommst nach der Bestellung eine Nachricht, wie du uns deine Wunschfotos per E-Mail schickst.</p>`
    : "";

  return `
    <article class="product-card">
      <div class="product-media">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
        <span class="season-badge">${seasonIcon(p.season)} ${p.season}</span>
      </div>
      <div class="product-body">
        <span class="product-cat">${p.category}</span>
        <h3>${p.name}</h3>
        <p class="product-desc">${p.desc}</p>
        <p class="product-price">${formatPrice(p.price)}</p>
        ${personalizeField}
        ${photoHint}
        <div class="product-actions">
          <button type="button" class="btn btn-primary btn-small" onclick="handleAddToCart(this, '${p.id}')">In den Warenkorb</button>
        </div>
      </div>
    </article>`;
}

/* Liest ein eventuelles Wunsch-Textfeld direkt aus der jeweiligen Karte aus,
   damit mehrere gleiche Produkte auf einer Seite sich nicht in die Quere kommen. */
function handleAddToCart(button, id){
  const card = button.closest(".product-card");
  const textarea = card ? card.querySelector(".personalize-field textarea") : null;
  const product = PRODUCTS.find(p => p.id === id);

  if (textarea && product?.personalizable && textarea.value.trim() === ""){
    textarea.focus();
    textarea.style.borderColor = "var(--rose-deep)";
    return;
  }

  addToCart(id, 1, textarea ? textarea.value : "");
  if (textarea) textarea.value = "";
}

/* ---------- Produkte im Shop rendern ---------- */
function renderProductGrid(filterCat){
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  if (PRODUCTS.length === 0){
    grid.innerHTML = `<p style="grid-column:1/-1; color:var(--ink-soft);">Die Produkte konnten gerade nicht geladen werden. Bitte lade die Seite neu.</p>`;
    return;
  }
  const items = filterCat && filterCat !== "Alle"
    ? PRODUCTS.filter(p => p.category === filterCat)
    : PRODUCTS;
  grid.innerHTML = items.map(productCard).join("");
}

/* ---------- Startseiten-Vorschau (3 Produkte) ---------- */
function renderFeatured(){
  const grid = document.getElementById("featuredGrid");
  if (!grid) return;
  const featured = PRODUCTS.slice(0, 3);
  grid.innerHTML = featured.map(productCard).join("");
}

/* ---------- Filter-Chips ---------- */
function initFilters(){
  const filterBar = document.getElementById("filterBar");
  if (!filterBar) return;
  const cats = ["Alle", ...new Set(PRODUCTS.map(p => p.category))];
  filterBar.innerHTML = cats.map((c, i) =>
    `<button type="button" class="chip ${i === 0 ? "active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");

  filterBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    filterBar.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    renderProductGrid(btn.dataset.cat);
  });
}

/* ---------- Mobile Nav ---------- */
function initNav(){
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("mainNav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => nav.classList.toggle("open"));
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));
}

/* ---------- Demo-Formulare (kein Backend angebunden) ---------- */
function initDemoForms(){
  document.querySelectorAll("form[data-demo-form]").forEach(form => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const note = form.querySelector(".form-feedback");
      if (note){
        note.textContent = "Demo-Formular: Es ist noch keine Versandfunktion angebunden. Verbinde ein Kontaktformular-Backend (z. B. Formspree, ein E-Mail-Skript deines Hosters oder dein Shopsystem), damit Anfragen wirklich ankommen.";
        note.style.display = "block";
      }
    });
  });
}

/* ---------- Kasse (Stripe) ---------- */
async function goToCheckout(){
  const button = document.getElementById("checkoutButton");
  const note = document.getElementById("checkoutNote");
  const cart = getCart();

  if (cart.length === 0){
    if (note) note.textContent = "Dein Warenkorb ist noch leer.";
    return;
  }

  if (button){ button.disabled = true; button.textContent = "Einen Moment …"; }
  if (note) note.textContent = "";

  try {
    const res = await fetch("/.netlify/functions/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart })
    });
    const data = await res.json();

    if (!res.ok || !data.url){
      throw new Error(data.error || "Die Kasse konnte nicht geöffnet werden.");
    }
    window.location.href = data.url;
  } catch (err) {
    console.error(err);
    if (note) note.textContent = err.message || "Die Kasse konnte gerade nicht geöffnet werden. Bitte versuch es in ein paar Minuten erneut.";
    if (button){ button.disabled = false; button.textContent = "Zur Kasse"; }
  }
}

/* ---------- Kontaktformular ---------- */
function initContactForm(){
  const form = document.getElementById("contactForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = document.getElementById("contactSubmit");
    const note = document.getElementById("contactNote");

    const payload = {
      name: form.querySelector("#name").value,
      email: form.querySelector("#email").value,
      message: form.querySelector("#message").value
    };

    if (button){ button.disabled = true; button.textContent = "Wird gesendet …"; }
    if (note) note.textContent = "";

    try {
      const res = await fetch("/.netlify/functions/send-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok){
        throw new Error(data.error || "Nachricht konnte nicht verschickt werden.");
      }
      form.reset();
      if (button){ button.textContent = "Gesendet ✓"; }
      if (note) note.textContent = "Danke! Deine Nachricht ist angekommen – du bekommst gleich eine Bestätigung per E-Mail.";
    } catch (err) {
      console.error(err);
      if (note) note.textContent = err.message || "Da ist etwas schiefgegangen. Bitte versuch es später erneut oder schreib direkt an office@3deko-andert.at.";
      if (button){ button.disabled = false; button.textContent = "Nachricht senden"; }
    }
  });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadProducts();

  updateCartCount();
  renderCartDrawer();
  renderProductGrid();
  renderFeatured();
  initFilters();
  initNav();
  initDemoForms();
  initContactForm();

  document.getElementById("cartButton")?.addEventListener("click", openCart);
  document.getElementById("cartClose")?.addEventListener("click", closeCart);
  document.getElementById("cartOverlay")?.addEventListener("click", closeCart);
  document.getElementById("checkoutButton")?.addEventListener("click", goToCheckout);
});
