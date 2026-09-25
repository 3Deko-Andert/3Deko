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

/* Gibt das erste (Haupt-)Foto eines Produkts zurück. */
function mainImage(p){
  return (p.images && p.images.length > 0) ? p.images[0] : "images/products/placeholder.jpg";
}

/* Blättert die Mini-Galerie auf einer Produktkarte einen Schritt weiter/zurück. */
function cycleImage(button, dir){
  const media = button.closest(".product-media");
  if (!media) return;
  const imgs = [...media.querySelectorAll(".media-img")];
  const dots = [...media.querySelectorAll(".media-dot")];
  if (imgs.length < 2) return;

  let current = imgs.findIndex(img => img.classList.contains("active"));
  imgs[current].classList.remove("active");
  dots[current]?.classList.remove("active");

  current = (current + dir + imgs.length) % imgs.length;
  imgs[current].classList.add("active");
  dots[current]?.classList.add("active");
}

/* ---------- Lightbox: Foto vergrößert ansehen ---------- */
let lightboxImages = [];
let lightboxIndex = 0;

function initLightbox(){
  if (document.getElementById("lightboxOverlay")) return; // schon vorhanden
  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.id = "lightboxOverlay";
  overlay.innerHTML = `
    <button type="button" class="lightbox-close" id="lightboxClose" aria-label="Schließen">×</button>
    <button type="button" class="lightbox-nav lightbox-prev" id="lightboxPrev" aria-label="Vorheriges Foto">‹</button>
    <img class="lightbox-img" id="lightboxImg" src="" alt="">
    <button type="button" class="lightbox-nav lightbox-next" id="lightboxNext" aria-label="Nächstes Foto">›</button>
    <div class="lightbox-dots" id="lightboxDots"></div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeLightbox(); });
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightboxPrev").addEventListener("click", () => lightboxStep(-1));
  document.getElementById("lightboxNext").addEventListener("click", () => lightboxStep(1));
  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") lightboxStep(-1);
    if (e.key === "ArrowRight") lightboxStep(1);
  });
}

function openLightbox(mediaDiv, id){
  const product = PRODUCTS.find(p => p.id === id);
  if (!product) return;
  lightboxImages = (product.images && product.images.length > 0) ? product.images : ["images/products/placeholder.jpg"];

  const imgs = [...mediaDiv.querySelectorAll(".media-img")];
  const activeIdx = imgs.findIndex(img => img.classList.contains("active"));
  lightboxIndex = activeIdx >= 0 ? activeIdx : 0;

  renderLightbox();
  document.getElementById("lightboxOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function renderLightbox(){
  document.getElementById("lightboxImg").src = lightboxImages[lightboxIndex];
  const multi = lightboxImages.length > 1;
  document.getElementById("lightboxPrev").style.display = multi ? "flex" : "none";
  document.getElementById("lightboxNext").style.display = multi ? "flex" : "none";
  document.getElementById("lightboxDots").innerHTML = multi
    ? lightboxImages.map((_, i) => `<span class="lightbox-dot${i === lightboxIndex ? " active" : ""}"></span>`).join("")
    : "";
}

function lightboxStep(dir){
  lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
  renderLightbox();
}

function closeLightbox(){
  document.getElementById("lightboxOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
}

/* Verhindert, dass eigene Eingaben (Wunschtext, Farbauswahl) als HTML im
   Warenkorb interpretiert werden könnten. */
function escapeHtml(str){
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    total += effectivePrice(p) * item.qty;
    return `
      <div class="cart-item">
        <div class="thumb"><img src="${mainImage(p)}" alt="${p.name}" loading="lazy"></div>
        <div class="cart-item-info">
          <h4>${p.name}</h4>
          ${item.note ? `<p class="cart-item-note">✎ ${escapeHtml(item.note)}</p>` : ""}
          <div class="row">
            <div class="qty-control">
              <button type="button" onclick="updateQty('${item.lineId}', -1)" aria-label="Menge verringern">−</button>
              <span>${item.qty}</span>
              <button type="button" onclick="updateQty('${item.lineId}', 1)" aria-label="Menge erhöhen">+</button>
            </div>
            <strong>${formatPrice(effectivePrice(p) * item.qty)}</strong>
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
/* Rechnet bei Sale-Produkten den im Verwaltungspanel frei gewählten Rabatt ab (Standard 15%). */
function effectivePrice(p){
  const percent = p.onSale ? (p.salePercent || 15) : 0;
  return p.onSale ? Math.round(p.price * (1 - percent / 100) * 100) / 100 : p.price;
}

/* Wandelt Zeilenumbrüche in der Produktbeschreibung sauber in HTML um
   (doppelte Leerzeile = neuer Absatz, einzelne = Zeilenumbruch). */
function formatDesc(text){
  return (text || "")
    .split(/\n\s*\n/)
    .map(block => `<p>${block.trim().replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/* Kurze Vorschau (erste Zeile) + bei längeren Texten ein Aufklapper mit dem
   restlichen, vollständig formatierten Text. */
function descBlock(p){
  const full = (p.desc || "").trim();
  const blocks = full.split(/\n\s*\n/);
  const firstLine = blocks[0].trim();
  const rest = blocks.slice(1).join("\n\n").trim();

  if (!rest){
    return `<p class="product-desc">${firstLine}</p>`;
  }
  return `
    <p class="product-desc">${firstLine}</p>
    <details class="desc-details">
      <summary>Mehr erfahren</summary>
      <div class="desc-full">${formatDesc(rest)}</div>
    </details>`;
}

function productCard(p){
  const personalizeField = p.personalizable ? `
        <label class="personalize-field">
          <span>${p.personalizeLabel || "Deine Wünsche"}</span>
          <textarea rows="2" placeholder="z. B. „Anna“"></textarea>
        </label>` : "";

  const colorList = (p.colorOptions || "").split(",").map(c => c.trim()).filter(Boolean);
  const colorField = (p.hasColors && colorList.length > 0) ? `
        <label class="personalize-field color-field">
          <span>Farbe wählen *</span>
          <select class="color-select">
            <option value="">Bitte wählen …</option>
            ${colorList.map(c => `<option value="${c}">${c}</option>`).join("")}
          </select>
        </label>` : "";

  const colorList1 = (p.colorOptions1 || "").split(",").map(c => c.trim()).filter(Boolean);
  const colorList2 = (p.colorOptions2 || "").split(",").map(c => c.trim()).filter(Boolean);
  const twoColorFields = (p.hasTwoColors && colorList1.length > 0 && colorList2.length > 0) ? `
        <label class="personalize-field color-field">
          <span>${p.colorLabel1 || "Farbe 1"} *</span>
          <select class="color-select-1">
            <option value="">Bitte wählen …</option>
            ${colorList1.map(c => `<option value="${c}">${c}</option>`).join("")}
          </select>
        </label>
        <label class="personalize-field color-field">
          <span>${p.colorLabel2 || "Farbe 2"} *</span>
          <select class="color-select-2">
            <option value="">Bitte wählen …</option>
            ${colorList2.map(c => `<option value="${c}">${c}</option>`).join("")}
          </select>
        </label>` : "";

  const photoHint = p.needsPhoto
    ? `<p class="personalize-photo-hint">📸 Du bekommst nach der Bestellung eine Nachricht, wie du uns deine Wunschfotos per E-Mail schickst.</p>`
    : "";

  const saleBadge = p.onSale ? `<span class="sale-badge">-${p.salePercent || 15}%</span>` : "";
  const priceBlock = p.onSale
    ? `<p class="product-price"><span class="price-old">${formatPrice(p.price)}</span> <span class="price-sale">${formatPrice(effectivePrice(p))}</span></p>`
    : `<p class="product-price">${formatPrice(p.price)}</p>`;

  const images = (p.images && p.images.length > 0) ? p.images : ["images/products/placeholder.jpg"];
  const galleryImgs = images.map((src, i) => `<img src="${src}" alt="${p.name}" class="media-img${i === 0 ? " active" : ""}" loading="lazy">`).join("");
  const galleryNav = images.length > 1 ? `
        <button type="button" class="media-nav media-prev" onclick="event.stopPropagation(); cycleImage(this, -1)" aria-label="Vorheriges Foto">‹</button>
        <button type="button" class="media-nav media-next" onclick="event.stopPropagation(); cycleImage(this, 1)" aria-label="Nächstes Foto">›</button>
        <div class="media-dots">${images.map((_, i) => `<span class="media-dot${i === 0 ? " active" : ""}"></span>`).join("")}</div>` : "";

  return `
    <article class="product-card">
      <div class="product-media">
        <div class="media-images" onclick="openLightbox(this, '${p.id}')">${galleryImgs}</div>
        ${galleryNav}
        ${saleBadge}
        <span class="season-badge">${seasonIcon(p.season)} ${p.season}</span>
      </div>
      <div class="product-body">
        <span class="product-cat">${p.category}</span>
        <h3>${p.name}</h3>
        ${descBlock(p)}
        ${priceBlock}
        ${colorField}
        ${twoColorFields}
        ${personalizeField}
        ${photoHint}
        <div class="product-actions">
          <button type="button" class="btn btn-primary btn-small" onclick="handleAddToCart(this, '${p.id}')">In den Warenkorb</button>
        </div>
      </div>
    </article>`;
}

/* Liest ein eventuelles Wunsch-Textfeld und/oder eine Farbauswahl direkt aus
   der jeweiligen Karte aus, damit mehrere gleiche Produkte auf einer Seite
   sich nicht in die Quere kommen. Beides ist Pflicht, wenn vorhanden. */
function handleAddToCart(button, id){
  const card = button.closest(".product-card");
  const textarea = card ? card.querySelector(".personalize-field textarea") : null;
  const colorSelect = card ? card.querySelector(".color-select") : null;
  const colorSelect1 = card ? card.querySelector(".color-select-1") : null;
  const colorSelect2 = card ? card.querySelector(".color-select-2") : null;
  const product = PRODUCTS.find(p => p.id === id);

  if (colorSelect && product?.hasColors && colorSelect.value === ""){
    colorSelect.focus();
    colorSelect.style.borderColor = "var(--rose-deep)";
    return;
  }

  if (product?.hasTwoColors && colorSelect1?.value === ""){
    colorSelect1.focus();
    colorSelect1.style.borderColor = "var(--rose-deep)";
    return;
  }
  if (product?.hasTwoColors && colorSelect2?.value === ""){
    colorSelect2.focus();
    colorSelect2.style.borderColor = "var(--rose-deep)";
    return;
  }

  if (textarea && product?.personalizable && textarea.value.trim() === ""){
    textarea.focus();
    textarea.style.borderColor = "var(--rose-deep)";
    return;
  }

  const noteParts = [];
  if (colorSelect && colorSelect.value) noteParts.push(`Farbe: ${colorSelect.value}`);
  if (colorSelect1 && colorSelect1.value) noteParts.push(`${product?.colorLabel1 || "Farbe 1"}: ${colorSelect1.value}`);
  if (colorSelect2 && colorSelect2.value) noteParts.push(`${product?.colorLabel2 || "Farbe 2"}: ${colorSelect2.value}`);
  if (textarea && textarea.value.trim()) noteParts.push(`Wunsch: ${textarea.value.trim()}`);

  addToCart(id, 1, noteParts.join(" · "));
  if (textarea) textarea.value = "";
  if (colorSelect) colorSelect.value = "";
  if (colorSelect1) colorSelect1.value = "";
  if (colorSelect2) colorSelect2.value = "";
}

/* ---------- Produkte im Shop rendern ---------- */
function renderProductGrid(filterCat){
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  if (PRODUCTS.length === 0){
    grid.innerHTML = `<p style="grid-column:1/-1; color:var(--ink-soft);">Die Produkte konnten gerade nicht geladen werden. Bitte lade die Seite neu.</p>`;
    return;
  }
  let items = PRODUCTS;
  if (filterCat === "Sale") items = PRODUCTS.filter(p => p.onSale);
  else if (filterCat && filterCat !== "Alle") items = PRODUCTS.filter(p => p.category === filterCat);
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
  const hasSale = PRODUCTS.some(p => p.onSale);
  const cats = ["Alle", ...(hasSale ? ["Sale"] : []), ...new Set(PRODUCTS.map(p => p.category))];
  filterBar.innerHTML = cats.map((c, i) =>
    `<button type="button" class="chip ${i === 0 ? "active" : ""} ${c === "Sale" ? "chip-sale" : ""}" data-cat="${c}">${c === "Sale" ? "🔥 Sale" : c}</button>`
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
      message: form.querySelector("#message").value,
      hpWebsite: form.querySelector("#hpWebsite")?.value || ""
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

/* ---------- Verstecktes Gewinnspiel: Links ausblenden, falls schon vergeben ---------- */
function initSecretLink(){
  const link1 = document.getElementById("secretLink");
  const link2 = document.getElementById("secretLink2");
  if (!link1 && !link2) return;
  fetch("/.netlify/functions/prize")
    .then(res => res.json())
    .then(data => { if (data.claimed){ link1?.remove(); link2?.remove(); } })
    .catch(() => {}); // bei Fehler lieber unauffällig nichts tun
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
  initSecretLink();
  initLightbox();

  document.getElementById("cartButton")?.addEventListener("click", openCart);
  document.getElementById("cartClose")?.addEventListener("click", closeCart);
  document.getElementById("cartOverlay")?.addEventListener("click", closeCart);
  document.getElementById("checkoutButton")?.addEventListener("click", goToCheckout);
});
