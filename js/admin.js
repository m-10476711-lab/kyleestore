
import { supabase } from "./supabase.js";

const msg = document.getElementById("admin-message");
const productList = document.getElementById("admin-products");
const productForm = document.getElementById("product-form");
const ordersList = document.getElementById("orders");

const ORDER_STATUSES = [
  ["pending", "Pending"],
  ["processing", "Processing"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"]
];

function showMessage(message, isError = false) {
  msg.textContent = message;
  msg.style.color = isError ? "#ff5555" : "#a78bfa";
}

function createElement(tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) element.className = className;

  return element;
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

    const title = createElement("h3", p.name);

    const price = createElement(
      "p",
      "RM " + Number(p.price).toFixed(2)
    );

    const category = createElement(
      "p",
      "Category: " + (p.category || "-")
    );

    const status = createElement(
      "p",
      p.is_active ? "Active" : "Inactive"
    );

    const toggleBtn = createElement(
      "button",
      p.is_active ? "HIDE PRODUCT" : "RESTORE PRODUCT",
      "btn toggle-product"
    );

    toggleBtn.type = "button";
    toggleBtn.dataset.id = p.id;
    toggleBtn.dataset.active = String(p.is_active);

    card.append(title, price, category, status, toggleBtn);
    productList.appendChild(card);
  });
}

// LOAD RECEIPTS
async function loadReceipts(orderId) {
  const { data: proofs, error } = await supabase
    .from("payment_proofs")
    .select("file_path")
    .eq("order_id", orderId);

  if (error) {
    console.error("RECEIPT DATABASE ERROR:", error);
    return {
      error: "Gagal membaca rekod receipt."
    };
  }

  if (!proofs || proofs.length === 0) {
    return {
      empty: true
    };
  }

  const receipts = [];

  for (const proof of proofs) {
    const { data, error: signedError } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(proof.file_path, 3600);

    if (signedError || !data?.signedUrl) {
      console.error("SIGNED URL ERROR:", signedError);
      continue;
    }

    receipts.push(data.signedUrl);
  }

  return { receipts };
}

// LOAD ORDERS
async function loadOrders() {
  ordersList.textContent = "Loading orders...";

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    ordersList.textContent = error.message;
    showMessage("Gagal load orders: " + error.message, true);
    return;
  }

  ordersList.innerHTML = "";

  if (!orders || orders.length === 0) {
    ordersList.textContent = "Belum ada order.";
    return;
  }

  for (const o of orders) {
    const card = document.createElement("div");
    card.className = "product";

    const heading = createElement(
      "h3",
      o.order_number || "Order"
    );

    const customer = createElement(
      "p",
      `${o.customer_name || "-"} · ${o.customer_phone || "-"}`
    );

    const total = createElement(
      "p",
      "RM " + Number(o.total || 0).toFixed(2)
    );

    const payment = createElement(
      "p",
      "Payment Status: " + (o.payment_status || "-")
    );

    const orderStatus = createElement(
      "p",
      "Order Status: " + (o.order_status || "-")
    );

    // RECEIPT SECTION
    const receiptSection = document.createElement("div");
    receiptSection.style.margin = "15px 0";

    const receiptHeading = createElement(
      "h4",
      "PAYMENT RECEIPT"
    );

    receiptSection.appendChild(receiptHeading);

    const receiptResult = await loadReceipts(o.id);

    if (receiptResult.error) {
      receiptSection.appendChild(
        createElement("p", receiptResult.error)
      );

    } else if (receiptResult.empty) {
      receiptSection.appendChild(
        createElement("p", "Receipt belum dihantar.")
      );

    } else if (!receiptResult.receipts?.length) {
      receiptSection.appendChild(
        createElement("p", "Receipt tak dapat dibuka.")
      );

    } else {
      receiptResult.receipts.forEach((url, index) => {
        const image = document.createElement("img");

        image.src = url;
        image.alt = "Customer payment receipt";
        image.loading = "lazy";
        image.style.width = "100%";
        image.style.maxWidth = "280px";
        image.style.display = "block";
        image.style.margin = "10px 0";
        image.style.borderRadius = "12px";
        image.style.border = "1px solid #6d5b9b";

        const openLink = document.createElement("a");
        openLink.href = url;
        openLink.target = "_blank";
        openLink.rel = "noopener noreferrer";
        openLink.textContent = `OPEN RECEIPT ${index + 1}`;

        receiptSection.append(image, openLink);
      });
    }

    // ORDER STATUS DROPDOWN
    const label = createElement(
      "label",
      "Update Order Status"
    );

    const select = document.createElement("select");
    select.className = "order-status-select";
    select.dataset.id = o.id;

    const currentStatus = o.order_status || "pending";

    const statuses = [...ORDER_STATUSES];

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

    const updateBtn = createElement(
      "button",
      "UPDATE STATUS",
      "btn update-order"
    );

    updateBtn.type = "button";
    updateBtn.dataset.id = o.id;

    card.append(
      heading,
      customer,
      total,
      payment,
      orderStatus,
      receiptSection,
      label,
      select,
      updateBtn
    );

    ordersList.appendChild(card);
  }
}

// UPDATE ORDER STATUS
ordersList.addEventListener("click", async e => {
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

  try {
    const { error } = await supabase
      .from("orders")
      .update({ order_status: newStatus })
      .eq("id", id);

    if (error) throw error;

    showMessage("Order status berjaya dikemaskini!");
    await loadOrders();

  } catch (error) {
    console.error(error);
    showMessage("Gagal update order: " + error.message, true);

    btn.disabled = false;
    btn.textContent = "UPDATE STATUS";
  }
});

// ADD PRODUCT
productForm.addEventListener("submit", async e => {
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

    if (error) throw error;

    showMessage("Produk berjaya ditambah: " + data.name);

    productForm.reset();
    await loadProducts();

  } catch (error) {
    console.error(error);
    showMessage("Gagal tambah produk: " + error.message, true);

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "ADD PRODUCT";
  }
});

// HIDE / RESTORE PRODUCT
productList.addEventListener("click", async e => {
  const btn = e.target.closest(".toggle-product");

  if (!btn) return;

  const id = btn.dataset.id;
  const currentlyActive = btn.dataset.active === "true";
  const newActive = !currentlyActive;

  const action = newActive ? "restore" : "hide";

  if (!confirm(`Confirm ${action} product ni?`)) return;

  btn.disabled = true;

  try {
    const { error } = await supabase
      .from("products")
      .update({ is_active: newActive })
      .eq("id", id);

    if (error) throw error;

    showMessage(
      newActive
        ? "Product berjaya di-restore!"
        : "Product berjaya disembunyikan!"
    );

    await loadProducts();

  } catch (error) {
    console.error(error);
    showMessage("Gagal update product: " + error.message, true);
    btn.disabled = false;
  }
});

// INITIAL LOAD
await Promise.all([
  loadProducts(),
  loadOrders()
]);
