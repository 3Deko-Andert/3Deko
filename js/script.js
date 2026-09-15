/* ==========================================================
   3Deko – Script
   Navigation, Warenkorb (localStorage), Produkt-Platzhalter
   ========================================================== */

/* ---------- Platzhalter-Icons für Produkte (Fotos folgen später) ---------- */
const ICONS = {
  vase: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M38 14h24l4 16-6 8 8 14c4 8 2 20-10 24H42c-12-4-14-16-10-24l8-14-6-8 4-16z" stroke="#B98F7C" stroke-width="4" stroke-linejoin="round"/>
    <path d="M40 40c6 3 14 3 20 0" stroke="#B98F7C" stroke-width="2.4" opacity=".6"/>
  </svg>`,
  star: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 14 L58 40 L86 40 L63 56 L71 82 L50 66 L29 82 L37 56 L14 40 L42 40 Z" stroke="#A47F45" stroke-width="4" stroke-linejoin="round" fill="#CBA46A" fill-opacity=".18"/>
  </svg>`,
  pendant: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="24" r="8" stroke="#8B9678" stroke-width="4"/>
    <path d="M50 32v10" stroke="#8B9678" stroke-width="4"/>
    <path d="M28 42 C28 66, 72 66, 72 42" stroke="#8B9678" stroke-width="4" stroke-linecap="round"/>
    <circle cx="50" cy="78" r="6" fill="#8B9678" opacity=".5"/>
  </svg>`,
  planter: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 46h40l-6 34H36l-6-34z" stroke="#B98F7C" stroke-width="4" stroke-linejoin="round"/>
    <path d="M50 46V30" stroke="#8B9678" stroke-width="4"/>
    <path d="M50 30c-10-4-14-16-6-22 8 4 12 14 6 22z" fill="#C3CBB0" stroke="#8B9678" stroke-width="3"/>
    <path d="M50 34c8-2 14-10 10-18-7 1-13 8-10 18z" fill="#ADB79C" stroke="#8B9678" stroke-width="3"/>
  </svg>`,
  candle: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M36 46h28v34a14 14 0 0 1-28 0V46z" stroke="#B9A2A8" stroke-width="4" stroke-linejoin="round"/>
    <path d="M50 30c6 6 6 12 0 16-6-4-6-10 0-16z" fill="#CBA46A" stroke="#A47F45" stroke-width="2"/>
  </svg>`,
  moon: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M62 20c-18 4-30 20-26 38 4 18 22 28 40 22-14 10-34 8-46-6-12-14-10-36 6-48 8-6 17-8 26-6z" fill="#B9A2A8" fill-opacity=".25" stroke="#9C8890" stroke-width="4" stroke-linejoin="round"/>
  </svg>`
};

const PRODUCTS = [
  { id: "p1", name: "Wellen-Vase \u201EOnda\u201C", category: "Vasen", price: 24.90, icon: "vase" },
  { id: "p2", name: "Sternenanhänger \u201ELumi\u201C", category: "Anhänger", price: 8.50, icon: "star" },
  { id: "p3", name: "Kettenhalter \u201EBogen\u201C", category: "Deko-Objekte", price: 14.00, icon: "pendant" },
  { id: "p4", name: "Mini-Pflanzstecker \u201ESpross\u201C", category: "Pflanzenfreunde", price: 6.90, icon: "planter" },
  { id: "p5", name: "Kerzenring \u201EHalo\u201C", category: "Kerzenhalter", price: 12.50, icon: "candle" },
  { id: "p6", name: "Mondphase \u201ENotte\u201C", category: "Wanddeko", price: 18.90, icon: "moon" },
  { id: "p7", name: "Tropfen-Vase \u201EPerla\u201C", category: "Vasen", price: 27.00, icon: "vase" },
  { id: "p8", name: "Sternchen-Set \u201EPiccolo\u201C", category: "Anhänger", price: 9.90, icon: "star" },
  { id: "p9", name: "Blattstecker \u201EFoglia\u201C", category: "Pflanzenfreunde", price: 7.50, icon: "planter" }
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
        <div class="thumb">${ICONS[p.icon]}</div>
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

/* ---------- Produkte im Shop rendern ---------- */
function renderProductGrid(filterCat){
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  const items = filterCat && filterCat !== "Alle"
    ? PRODUCTS.filter(p => p.category === filterCat)
    : PRODUCTS;

  grid.innerHTML = items.map(p => `
    <article class="product-card">
      <div class="product-media" style="background:${mediaBg(p.icon)}">
        ${ICONS[p.icon]}
        <span class="photo-note">Foto folgt</span>
      </div>
      <div class="product-body">
        <span class="product-cat">${p.category}</span>
        <h3>${p.name}</h3>
        <p class="product-price">${formatPrice(p.price)} <span class="placeholder-tag">Platzhalterpreis</span></p>
        <div class="product-actions">
          <button type="button" class="btn btn-primary btn-small" onclick="addToCart('${p.id}')">In den Warenkorb</button>
        </div>
      </div>
    </article>
  `).join("");
}

function mediaBg(icon){
  const map = {
    vase: "linear-gradient(160deg, #F3E6DF, #EFE9E3)",
    star: "linear-gradient(160deg, #F1E6D3, #EFE9E3)",
    pendant: "linear-gradient(160deg, #EEF0E6, #EFE9E3)",
    planter: "linear-gradient(160deg, #EEF0E6, #F3E6DF)",
    candle: "linear-gradient(160deg, #EFE7E3, #EFE9E3)",
    moon: "linear-gradient(160deg, #EFE7E3, #F3E6DF)"
  };
  return map[icon] || "#EFE9E3";
}

/* ---------- Startseiten-Vorschau (3 Produkte) ---------- */
function renderFeatured(){
  const grid = document.getElementById("featuredGrid");
  if (!grid) return;
  const featured = PRODUCTS.slice(0, 3);
  grid.innerHTML = featured.map(p => `
    <article class="product-card">
      <div class="product-media" style="background:${mediaBg(p.icon)}">
        ${ICONS[p.icon]}
        <span class="photo-note">Foto folgt</span>
      </div>
      <div class="product-body">
        <span class="product-cat">${p.category}</span>
        <h3>${p.name}</h3>
        <p class="product-price">${formatPrice(p.price)} <span class="placeholder-tag">Platzhalterpreis</span></p>
        <div class="product-actions">
          <button type="button" class="btn btn-primary btn-small" onclick="addToCart('${p.id}')">In den Warenkorb</button>
        </div>
      </div>
    </article>
  `).join("");
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
