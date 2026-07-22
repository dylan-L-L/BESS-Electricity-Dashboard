"use server";

import { redirect } from "next/navigation";

import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  if (!getSupabaseConfig()) redirect("/admin/login?error=not-configured");

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/admin/login?error=missing-credentials");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/admin/login?error=invalid-credentials");

  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.app_metadata?.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/admin/login?error=admin-required");
  }

  redirect("/admin");
}

export async function logoutAction() {
  if (getSupabaseConfig()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}
