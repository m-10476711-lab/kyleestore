
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from "./config.js";

const cart = JSON.parse(
  localStorage.getItem("kylee_cart") || "[]"
);

const box = document.getElementById("checkout-items");
const form = document.getElementById("checkout-form");
const payment = document.getElementById("payment");

let order = null;

const money = n => "RM " + Number(n).toFixed(2);

// CART DISPLAY
if (!cart.length) {
  box.textContent = "Cart kosong bro!";
  form.classList.add("hidden");
} else {
  box.textContent = "Produk dalam cart: " +
    cart.map(p => `${p.name || p.id} × ${p.quantity}`).join(", ");
}

// CREATE ORDER
form.addEventListener("submit", async e => {
  e.preventDefault();

  if (!cart.length) {
    alert("Cart kosong bro!");
    return;
  }

  const fd = new FormData(form);

  // CONVERT CART FORMAT
  const items = cart.map(item => ({
    product_id: String(item.product_id || item.id || ""),
    quantity: Number(item.quantity)
  }));

  // VALIDATE CART
  const invalidItem = items.some(item =>
    !item.product_id ||
    !Number.isInteger(item.quantity) ||
    item.quantity < 1
  );

  if (invalidItem) {
    alert("Item atau quantity dalam cart tak sah.");
    console.error("Invalid cart:", cart);
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "PROCESSING...";
  }

  try {
    const response = await fetch(
      `${FUNCTIONS_URL}/create-order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          customer_name: fd.get("name"),
          customer_phone: fd.get("phone"),
          customer_email: fd.get("email"),
          items
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Order gagal dibuat.");
    }

    order = result;

    form.classList.add("hidden");
    payment.classList.remove("hidden");

    document.getElementById("order-summary").textContent =
      `${order.order_number} — ${money(order.total)}`;

  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    alert(error.message || "Order gagal dibuat.");

  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "CHECKOUT";
    }
  }
});

// UPLOAD PAYMENT PROOF
document.getElementById("upload-proof")
.addEventListener("click", async () => {

  const file = document.getElementById("receipt").files[0];
  const msg = document.getElementById("payment-message");

  if (!file || !order) {
    msg.textContent = "Pilih resit dulu bro!";
    return;
  }

  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    msg.textContent = "Resit mesti JPG/PNG/WEBP bawah 5MB.";
    return;
  }

  const fd = new FormData();

  fd.append("order_id", order.order_id);
  fd.append("order_token", order.order_token);
  fd.append("receipt", file);

  const uploadBtn = document.getElementById("upload-proof");
  uploadBtn.disabled = true;

  try {
    const response = await fetch(
      `${FUNCTIONS_URL}/submit-proof`,
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: fd
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Upload gagal.");
    }

    msg.textContent =
      "RESIT DAH MASUK! Tunggu admin check payment.";

    localStorage.removeItem("kylee_cart");

  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    msg.textContent = error.message || "Upload gagal.";

  } finally {
    uploadBtn.disabled = false;
  }
});
