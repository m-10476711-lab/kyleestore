
import { supabase } from "./supabase.js";

const msg = document.getElementById("admin-message");

const { data: { session } } = await supabase.auth.getSession();

if (!session) location.href = "index.html";

const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", session.user.id)
  .single();

if (profile?.role !== "admin") {
  await supabase.auth.signOut();
  location.href = "index.html";
}

document.getElementById("logout").onclick = async () => {
  await supabase.auth.signOut();
  location.href = "index.html";
};

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    msg.textContent = error.message;
    return;
  }

  document.getElementById("admin-products").innerHTML =
    (data || []).map(p => `
      <div class="product">
        <h3>${p.name}</h3>
        <p>RM ${Number(p.price).toFixed(2)}</p>
        <button class="btn delete" data-id="${p.id}">
          DELETE
        </button>
      </div>
    `).join("") || "Belum ada produk.";
}

async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    document.getElementById("orders").textContent = error.message;
    return;
  }

  document.getElementById("orders").innerHTML =
    (data || []).map(o => `
      <div class="product">
        <h3>${o.order_number}</h3>
        <p>${o.customer_name} · ${o.customer_phone}</p>
        <p>RM ${Number(o.total).toFixed(2)}</p>
        <p>${o.payment_status} / ${o.order_status}</p>
      </div>
    `).join("") || "Belum ada order.";
}

document.getElementById("product-form").onsubmit = async e => {
  e.preventDefault();

  const fd = new FormData(e.target);

  const { error } = await supabase.from("products").insert({
    name: fd.get("name"),
    price: Number(fd.get("price")),
    category: fd.get("category"),
    description: fd.get("description"),
    image_url: fd.get("image_url") || null
  });

  msg.textContent = error?.message || "Produk berjaya ditambah!";
  if (!error) {
    e.target.reset();
    loadProducts();
  }
};

document.getElementById("admin-products").onclick =
async e => {
  const btn = e.target.closest(".delete");
  if (!btn) return;

  if (!confirm("Confirm delete produk ni?")) return;

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", btn.dataset.id);

  msg.textContent = error?.message || "Produk dipadam!";
  loadProducts();
};

await Promise.all([loadProducts(), loadOrders()]);
