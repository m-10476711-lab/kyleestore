
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return respond({ error: "Server configuration missing" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json();
    const {
      customer_name,
      customer_email,
      customer_phone,
      items,
    } = body;

    if (
      !customer_name?.trim() ||
      !customer_email?.trim() ||
      !customer_phone?.trim() ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 30
    ) {
      return respond({ error: "Maklumat order tak lengkap" }, 400);
    }

    const quantities = new Map<string, number>();

    for (const item of items) {
      if (
        typeof item.product_id !== "string" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      ) {
        return respond({ error: "Item atau quantity tak sah" }, 400);
      }

      quantities.set(
        item.product_id,
        (quantities.get(item.product_id) || 0) + item.quantity,
      );
    }

    const productIds = [...quantities.keys()];

    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, price, stock, is_active")
      .in("id", productIds);

    if (productError || !products || products.length !== productIds.length) {
      return respond({ error: "Produk tak dijumpai" }, 400);
    }

    const orderItems = [];

    for (const product of products) {
      const quantity = quantities.get(product.id)!;

      if (!product.is_active || Number(product.stock) < quantity) {
        return respond({
          error: `Produk ${product.name} tak tersedia atau stok tak cukup`,
        }, 400);
      }

      const price = Number(product.price);

      if (!Number.isFinite(price) || price < 0) {
        return respond({ error: "Harga produk tak sah" }, 400);
      }

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        price,
        quantity,
        subtotal: price * quantity,
      });
    }

    const total = orderItems.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    const orderNumber =
      "KYL-" + Date.now().toString(36).toUpperCase();

    const orderToken = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = await sha256(orderToken);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_name: customer_name.trim(),
        customer_email: customer_email.trim(),
        customer_phone: customer_phone.trim(),
        total,
        payment_status: "pending",
        order_status: "pending",
      })
      .select("id, order_number, total")
      .single();

    if (orderError || !order) {
      return respond({ error: "Gagal create order" }, 500);
    }

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(
        orderItems.map((item) => ({
          ...item,
          order_id: order.id,
        })),
      );

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      return respond({ error: "Gagal simpan order items" }, 500);
    }

    const { error: tokenError } = await supabase
      .from("order_access_tokens")
      .insert({
        order_id: order.id,
        token_hash: tokenHash,
      });

    if (tokenError) {
      await supabase.from("orders").delete().eq("id", order.id);
      return respond({ error: "Gagal jana order token" }, 500);
    }

    return respond({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      total: order.total,
      order_token: orderToken,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return respond({ error: "Internal server error" }, 500);
  }
});
