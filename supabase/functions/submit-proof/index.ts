
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json"
    }
  });

async function hashToken(token: string) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const form = await req.formData();

    const orderId = String(form.get("order_id") || "");
    const token = String(form.get("order_token") || "");
    const file = form.get("receipt");

    if (
      !/^[0-9a-f-]{36}$/i.test(orderId) ||
      token.length < 20 ||
      !(file instanceof File)
    ) {
      return json({ error: "Maklumat resit tak sah." }, 400);
    }

    if (
      file.size < 1 ||
      file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      return json({ error: "Resit mesti JPG, PNG atau WEBP bawah 5MB." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: access } = await admin
      .from("order_access_tokens")
      .select("order_id")
      .eq("order_id", orderId)
      .eq("token_hash", await hashToken(token))
      .maybeSingle();

    if (!access) {
      return json({ error: "Order token tak sah." }, 403);
    }

    const { data: order } = await admin
      .from("orders")
      .select("id,payment_status,order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (
      !order ||
      !["pending", "rejected"].includes(order.payment_status) ||
      ["completed", "cancelled"].includes(order.order_status)
    ) {
      return json({ error: "Order tak boleh menerima resit." }, 400);
    }

    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[file.type];

    const path =
      `${orderId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from("payment-proofs")
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      return json({ error: "Upload resit gagal." }, 500);
    }

    const { error: proofError } = await admin
      .from("payment_proofs")
      .insert({
        order_id: orderId,
        file_path: path
      });

    if (proofError) {
      await admin.storage
        .from("payment-proofs")
        .remove([path]);

      return json({ error: "Rekod resit gagal." }, 500);
    }

    const { error: updateError } = await admin
      .from("orders")
      .update({ payment_status: "review" })
      .eq("id", orderId);

    if (updateError) {
      return json({ error: "Status order gagal dikemaskini." }, 500);
    }

    return json({
      success: true,
      message: "Resit berjaya dihantar."
    });

  } catch {
    return json({ error: "Server error." }, 500);
  }
});
