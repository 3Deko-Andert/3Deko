/* ==========================================================
   3Deko – Script
   Navigation, Warenkorb (localStorage), Produkte
   ========================================================== */

/* ---------- Produkte ---------- */
/* Preise sind Schätzungen und müssen vor dem Verkauf von dir geprüft/angepasst werden. */
const PRODUCTS = [
  {
    id: "p1",
    name: "Ablage-Set \u201ERiga\u201C",
    category: "Tabletts & Schalen",
    season: "Ganzjährig",
    seasonIcon: "✨",
    price: 22.90,
    image: "images/products/product-trays.jpg",
    desc: "Vier gerillte Ablageschalen zum Stapeln oder Kombinieren – für Schlüssel, Schmuck oder Kerzen."
  },
  {
    id: "p2",
    name: "Kürbis-Dose \u201EZucca Legno\u201C",
    category: "Herbstdeko",
    season: "Herbst",
    seasonIcon: "🍂",
    price: 16.90,
    image: "images/products/product-wood-pumpkin-box.jpg",
    desc: "Kürbisförmige Dose in Holzoptik mit abnehmbarem Deckel – hübsches Versteck für kleine Schätze."
  },
  {
    id: "p3",
    name: "Lotus-Leuchte \u201EFiore\u201C",
    category: "Leuchten",
    season: "Ganzjährig",
    seasonIcon: "✨",
    price: 24.90,
    image: "images/products/product-lotus-lamp.jpg",
    desc: "LED-Blütenleuchte mit warmem Licht – verwandelt jede Kommode in einen gemütlichen Rückzugsort."
  },
  {
    id: "p4",
    name: "Personalisiertes Namensschild",
    category: "Personalisierte Geschenke",
    season: "Ganzjährig",
    seasonIcon: "✨",
    price: 28.90,
    image: "images/products/product-name-sign.jpg",
    desc: "Individuelles Namensschild mit herbstlichen Blatt-Akzenten – dein Wunschname, frei wählbar."
  },
  {
    id: "p5",
    name: "Kürbis-Dosen-Duo \u201EZucca\u201C",
    category: "Herbstdeko",
    season: "Herbst",
    seasonIcon: "🍂",
    price: 26.90,
    image: "images/products/product-pumpkin-duo.jpg",
    desc: "Zwei Kürbis-Dosen in klassischem Orange – als Tischdeko oder kleines Nascherei-Versteck."
  },
  {
    id: "p6",
    name: "Foto-Lichtwürfel \u201ERicordo\u201C",
    category: "Personalisierte Geschenke",
    season: "Ganzjährig",
    seasonIcon: "✨",
    price: 34.90,
    image: "images/products/product-photo-cube-lamp.jpg",
    desc: "Dein Lieblingsfoto als Lithophanie im leuchtenden Würfel – ein Geschenk, das bleibt."
  },
  {
    id: "p7",
    name: "Kerzenhalter-Set \u201ENotte Nera\u201C",
    category: "Kerzenhalter",
    season: "Herbst",
    seasonIcon: "🍂",
    price: 19.90,
    image: "images/products/product-black-candle-pumpkin.jpg",
    desc: "Schwarzer Kerzenhalter mit Ringdetail plus passendem Mini-Kürbis – schlicht und stimmungsvoll."
  },
  {
    id: "p8",
    name: "Foto-Leuchte \u201EMomento\u201C",
    category: "Personalisierte Geschenke",
    season: "Ganzjährig",
    seasonIcon: "✨",
    price: 32.90,
    image: "images/products/product-photo-lantern-dog.jpg",
    desc: "Lithophanie-Leuchte mit eingraviertem Lieblingsfoto – warmes Licht inklusive."
  },
  {
    id: "p9",
    name: "Kürbis-Windlicht-Trio \u201EAutunno\u201C",
    category: "Kerzenhalter",
    season: "Herbst",
    seasonIcon: "🍂",
    price: 24.90,
    image: "images/products/product-tealight-pumpkin-trio.jpg",
    desc: "Drei Windlicht-Kürbisse mit Lochmuster in Grün, Senfgelb und Schwarz – zusammen ein Hingucker."
  },
  {
    id: "p10",
    name: "Kerzenhalter-Duo \u201EPanna\u201C",
    category: "Kerzenhalter",
    season: "Herbst/Winter",
    seasonIcon: "🍂",
    price: 29.90,
    image: "images/products/product-cream-candle-duo.jpg",
    desc: "Zwei cremefarbene Kerzenhalter mit Kürbis- und Wickel-Detail auf gerillter Tablett-Unterlage."
  },
  {
    id: "p11",
    name: "Herz-Windlicht \u201ECuore\u201C",
    category: "Kerzenhalter",
    season: "Herbst",
    seasonIcon: "🍂",
    price: 13.90,
    image: "images/products/product-heart-pumpkin.jpg",
    desc: "Schwarzer Kürbis-Windlicht mit herzförmigem Ausschnitt – romantisches Glühen für dunkle Abende."
  }
];

/* ---------- Warenkorb (localStorage) ---------- */
const CART_KEY = "3deko_cart";

function getCart(){
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch(e){ return []; }
}
function saveCart(cart){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}
function addToCart(id, qty = 1){
  const cart = getCart();
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty += qty;
  else cart.push({ id, qty });
  saveCart(cart);
  renderCartDrawer();
  openCart();
}
function updateQty(id, delta){
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  const filtered = cart.filter(i => i.qty > 0);
  saveCart(filtered);
  renderCartDrawer();
}
function removeFromCart(id){
  saveCart(getCart().filter(i => i.id !== id));
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
          <div class="row">
            <div class="qty-control">
              <button type="button" onclick="updateQty('${p.id}', -1)" aria-label="Menge verringern">−</button>
              <span>${item.qty}</span>
              <button type="button" onclick="updateQty('${p.id}', 1)" aria-label="Menge erhöhen">+</button>
            </div>
            <strong>${formatPrice(p.price * item.qty)}</strong>
          </div>
          <button type="button" class="remove-link" onclick="removeFromCart('${p.id}')">entfernen</button>
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
  return `
    <article class="product-card">
      <div class="product-media">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
        <span class="season-badge">${p.seasonIcon} ${p.season}</span>
      </div>
      <div class="product-body">
        <span class="product-cat">${p.category}</span>
        <h3>${p.name}</h3>
        <p class="product-desc">${p.desc}</p>
        <p class="product-price">${formatPrice(p.price)} <span class="placeholder-tag">geschätzter Preis</span></p>
        <div class="product-actions">
          <button type="button" class="btn btn-primary btn-small" onclick="addToCart('${p.id}')">In den Warenkorb</button>
        </div>
      </div>
    </article>`;
}

/* ---------- Produkte im Shop rendern ---------- */
function renderProductGrid(filterCat){
  const grid = document.getElementById("productGrid");
  if (!grid) return;
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

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  renderCartDrawer();
  renderProductGrid();
  renderFeatured();
  initFilters();
  initNav();
  initDemoForms();

  document.getElementById("cartButton")?.addEventListener("click", openCart);
  document.getElementById("cartClose")?.addEventListener("click", closeCart);
  document.getElementById("cartOverlay")?.addEventListener("click", closeCart);
});
