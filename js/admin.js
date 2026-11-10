
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

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn toggle-product";
    toggleBtn.dataset.id = p.id;
    toggleBtn.dataset.active = String(p.is_active);

    toggleBtn.textContent = p.is_active
      ? "HIDE PRODUCT"
      : "RESTORE PRODUCT";

    card.append(title, price, category, status, toggleBtn);
    productList.appendChild(card);
  });
}

// LOAD ORDERS
async function loadOrders() {
  ordersList.textContent = "Loading orders...";

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    ordersList.textContent = error.message;
    showMessage("Gagal load orders: " + error.message, true);
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
    heading.textContent = o.order_number || "Order";

    const customer = document.createElement("p");
    customer.textContent =
      `${o.customer_name || "-"} · ${o.customer_phone || "-"}`;

    const total = document.createElement("p");
    total.textContent = "RM " + Number(o.total || 0).toFixed(2);

    const payment = document.createElement("p");
    payment.textContent =
      "Payment Status: " + (o.payment_status || "-");

    const currentStatus = o.order_status || "pending";

    const statusText = document.createElement("p");
    statusText.textContent = "Order Status: " + currentStatus;

    const label = document.createElement("label");
    label.textContent = "Update Order Status";

    const select = document.createElement("select");
    select.className = "order-status-select";
    select.dataset.id = o.id;

    const statuses = [
      ["pending", "Pending"],
      ["processing", "Processing"],
      ["completed", "Completed"],
      ["cancelled", "Cancelled"]
    ];

    // Preserve current value if it differs from standard options
    if (!statuses.some(([value]) => value === currentStatus)) {
      statuses.unshift([currentStatus, currentStatus]);
    }

    statuses.forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    });

    select.value = currentStatus;

    const updateBtn = document.createElement("button");
    updateBtn.className = "btn update-order";
    updateBtn.dataset.id = o.id;
    updateBtn.textContent = "UPDATE STATUS";

    card.append(
      heading,
      customer,
      total,
      payment,
      statusText,
      label,
      select,
      updateBtn
    );

    ordersList.appendChild(card);
  });
}

// UPDATE ORDER STATUS
ordersList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".update-order");

  if (!btn) return;

  const id = btn.dataset.id;
  const select = ordersList.querySelector(
    `.order-status-select[data-id="${CSS.escape(id)}"]`
  );

  if (!select) return;

  const newStatus = select.value;

  if (!confirm("Confirm update order status kepada " + newStatus + "?")) {
    return;
  }

  btn.disabled = true;
  btn.textContent = "UPDATING...";

  const { error } = await supabase
    .from("orders")
    .update({ order_status: newStatus })
    .eq("id", id);

  if (error) {
    console.error("UPDATE ORDER ERROR:", error);
    showMessage("Gagal update order: " + error.message, true);
    btn.disabled = false;
    btn.textContent = "UPDATE STATUS";
    return;
  }

  showMessage("Order status berjaya dikemaskini!");
  await loadOrders();
});

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

// HIDE / RESTORE PRODUCT
productList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".toggle-product");

  if (!btn) return;

  const id = btn.dataset.id;
  const currentlyActive = btn.dataset.active === "true";
  const newActive = !currentlyActive;

  const action = newActive ? "restore" : "hide";

  if (!confirm(`Confirm ${action} product ni?`)) return;

  btn.disabled = true;

  const { error } = await supabase
    .from("products")
    .update({ is_active: newActive })
    .eq("id", id);

  if (error) {
    showMessage("Gagal update product: " + error.message, true);
    btn.disabled = false;
    return;
  }

  showMessage(
    newActive
      ? "Product berjaya di-restore!"
      : "Product berjaya disembunyikan!"
  );

  await loadProducts();
});

// INITIAL LOAD
await Promise.all([
  loadProducts(),
  loadOrders()
]);
