
import { supabase } from "./supabase.js";

document.getElementById("login").onclick = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msg = document.getElementById("message");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg.textContent = error.message;
    return;
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

  if (profileError || profile?.role !== "admin") {
    await supabase.auth.signOut();
    msg.textContent = "Akses admin sahaja bro.";
    return;
  }

  location.href = "dashboard.html";
};
