
import { supabase } from "./supabase.js";

const grid = document.getElementById("product-grid");
const search = document.getElementById("search");

let products = [];

const money = n => "RM " + Number(n).toFixed(2);

function safe(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;",
    '"':"&quot;", "'":"&#39;"
  })[c]);
}

function render() {
  const q = search.value.toLowerCase();

  const filtered = products.filter(p =>
    (p.name + " " + (p.category || ""))
    .toLowerCase().includes(q)
  );

  grid.innerHTML = filtered.length
    ? filtered.map(p => `
      <div class="product">
        <img src="${safe(p.image_url || "")}" alt="">
        <h3>${safe(p.name)}</h3>
        <p>${safe(p.description || "Produk digital")}</p>
        <p class="price">${money(p.price)}</p>
        <button class="btn" data-id="${p.id}">
          ADD TO CART
        </button>
      </div>
    `).join("")
    : "<p>Belum ada produk bro!</p>";
}

grid.addEventListener("click", e => {
  const button = e.target.closest("button[data-id]");
  if (!button) return;

  const product = products.find(p => p.id === button.dataset.id);

  let cart = JSON.parse(
    localStorage.getItem("kylee_cart") || "[]"
  );

  const existing = cart.find(p => p.id === product.id);

  if (existing) existing.quantity++;
  else cart.push({ id: product.id, quantity: 1 });

  localStorage.setItem("kylee_cart", JSON.stringify(cart));

  button.textContent = "DAH MASUK ✓";
});

search.addEventListener("input", render);

const { data, error } = await supabase
  .from("products")
  .select("*")
  .eq("is_active", true)
  .order("created_at", { ascending: false });

if (error) {
  grid.textContent = "Produk tak dapat dimuatkan.";
} else {
  products = data || [];
  render();
}
