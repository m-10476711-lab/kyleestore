
import { supabase } from "./supabase.js";

const msg = document.getElementById("admin-message");
const productList = document.getElementById("admin-products");
const productForm = document.getElementById("product-form");
const ordersList = document.getElementById("orders");

function showMessage(message, isError = false) {
  msg.textContent = message;
  msg.style.color = isError ? "#ff5555" : "#a78bfa";
}

// ADMIN AUTH
const {
  data: { session },
  error: sessionError
} = await supabase.auth.getSession();

if (sessionError || !session) {
  location.href = "/admin";
  throw new Error("Admin session not found");
}

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", session.user.id)
  .single();

if (profileError || profile?.role !== "admin") {
  await supabase.auth.signOut();
  location.href = "/admin";
  throw new Error("Admin access denied");
}

// LOGOUT
document.getElementById("logout").onclick = async () => {
  await supabase.auth.signOut();
  location.href = "/admin";
};

// LOAD PRODUCTS
async function loadProducts() {
  productList.textContent = "Loading products...";

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    productList.textContent = error.message;
    showMessage("Gagal load produk: " + error.message, true);
    return;
  }

  productList.innerHTML = "";

  if (!data || data.length === 0) {
    productList.textContent = "Belum ada produk.";
    return;
  }

  data.forEach(p => {
    const card = document.createElement("div");
    card.className = "product";

    const title = document.createElement("h3");
    title.textContent = p.name;

    const price = document.createElement("p");
    price.textContent = "RM " + Number(p.price).toFixed(2);

    const category = document.createElement("p");
    category.textContent = "Category: " + (p.category || "-");

    const status = document.createElement("p");
    status.textContent = p.is_active ? "Active" : "Inactive";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn delete";
    deleteBtn.textContent = "DELETE";
    deleteBtn.dataset.id = p.id;

    card.append(title, price, category, status, deleteBtn);
    productList.appendChild(card);
  });
}

// LOAD ORDERS
async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    ordersList.textContent = error.message;
    return;
  }

  ordersList.innerHTML = "";

  if (!data || data.length === 0) {
    ordersList.textContent = "Belum ada order.";
    return;
  }

  data.forEach(o => {
    const card = document.createElement("div");
    card.className = "product";

    const heading = document.createElement("h3");
    heading.textContent = o.order_number;

    const customer = document.createElement("p");
    customer.textContent =
      `${o.customer_name} · ${o.customer_phone}`;

    const total = document.createElement("p");
    total.textContent = "RM " + Number(o.total).toFixed(2);

    const status = document.createElement("p");
    status.textContent =
      `${o.payment_status} / ${o.order_status}`;

    card.append(heading, customer, total, status);
    ordersList.appendChild(card);
  });
}

// ADD PRODUCT
productForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = productForm.querySelector(
    'button[type="submit"]'
  );

  const fd = new FormData(productForm);

  const name = String(fd.get("name") || "").trim();
  const price = Number(fd.get("price"));
  const category = String(fd.get("category") || "").trim();
  const description = String(fd.get("description") || "").trim();
  const imageUrl = String(fd.get("image_url") || "").trim();

  if (!name || !category || !Number.isFinite(price) || price <= 0) {
    showMessage("Sila isi nama, kategori dan harga yang sah.", true);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "ADDING...";

  try {
    const { data, error } = await supabase
      .from("products")
      .insert({
        name,
        price,
        category,
        description,
        image_url: imageUrl || null,
        is_active: true,
        stock: 999
      })
      .select()
      .single();

    if (error) {
      console.error("ADD PRODUCT ERROR:", error);
      showMessage("Gagal tambah produk: " + error.message, true);
      return;
    }

    showMessage("Produk berjaya ditambah: " + data.name);

    productForm.reset();

    await loadProducts();

  } catch (error) {
    console.error(error);
    showMessage("Unexpected error: " + error.message, true);

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "ADD PRODUCT";
  }
});

// DELETE PRODUCT
productList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".delete");

  if (!btn) return;

  if (!confirm("Confirm delete produk ni?")) return;

  btn.disabled = true;

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", btn.dataset.id);

  if (error) {
    showMessage("Gagal delete: " + error.message, true);
    btn.disabled = false;
    return;
  }

  showMessage("Produk berjaya dipadam!");
  await loadProducts();
});

// INITIAL LOAD
await Promise.all([
  loadProducts(),
  loadOrders()
]);
