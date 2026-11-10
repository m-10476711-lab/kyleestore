
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from "./config.js";

const cart = JSON.parse(
  localStorage.getItem("kylee_cart") || "[]"
);

const box = document.getElementById("checkout-items");
const form = document.getElementById("checkout-form");
const payment = document.getElementById("payment");

let order = null;

const money = n => "RM " + Number(n).toFixed(2);

if (!cart.length) {
  box.textContent = "Cart kosong bro!";
  form.classList.add("hidden");
} else {
  box.textContent = "Produk dalam cart: " +
    cart.map(p => `${p.id} × ${p.quantity}`).join(", ");
}

form.addEventListener("submit", async e => {
  e.preventDefault();

  if (!cart.length) return;

  const fd = new FormData(form);

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
          items: cart
        })
      }
    );

    const result = await response.json();

    if (!response.ok) throw new Error(result.error);

    order = result;

    form.classList.add("hidden");
    payment.classList.remove("hidden");

    document.getElementById("order-summary").textContent =
      `${order.order_number} — ${money(order.total)}`;

  } catch (error) {
    alert(error.message || "Order gagal dibuat.");
  }
});

document.getElementById("upload-proof")
.addEventListener("click", async () => {
  const file = document.getElementById("receipt").files[0];
  const msg = document.getElementById("payment-message");

  if (!file || !order) {
    msg.textContent = "Pilih resit dulu bro!";
    return;
  }

  if (!["image/jpeg","image/png","image/webp"].includes(file.type)
      || file.size > 5 * 1024 * 1024) {
    msg.textContent = "Resit mesti JPG/PNG/WEBP bawah 5MB.";
    return;
  }

  const fd = new FormData();
  fd.append("order_id", order.order_id);
  fd.append("order_token", order.order_token);
  fd.append("receipt", file);

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

    if (!response.ok) throw new Error(result.error);

    msg.textContent =
      "RESIT DAH MASUK! Tunggu admin check payment.";

    localStorage.removeItem("kylee_cart");

  } catch (error) {
    msg.textContent = error.message || "Upload gagal.";
  }
});
