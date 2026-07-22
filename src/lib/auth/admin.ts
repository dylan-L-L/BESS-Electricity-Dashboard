import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminIdentity = {
  id: string;
  email: string | null;
  role: "admin";
};

export class AuthenticationError extends Error {
  readonly status = 401;
  readonly code = "AUTHENTICATION_REQUIRED";
}

export class AuthorizationError extends Error {
  readonly status = 403;
  readonly code = "ADMIN_REQUIRED";
}

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (!getSupabaseConfig()) return null;
  const supabase = await createServerSupabaseClient();
  const authorization = (await headers()).get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data, error } = await supabase.auth.getUser(bearerToken);

  if (error || !data.user) return null;
  if (data.user.app_metadata?.role !== "admin") return null;

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: "admin",
  };
}

export async function requireAdminPage(): Promise<AdminIdentity> {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");
  return identity;
}

export async function requireAdminApi(): Promise<AdminIdentity> {
  if (!getSupabaseConfig()) throw new AuthenticationError("Supabase is not configured");

  const supabase = await createServerSupabaseClient();
  const authorization = (await headers()).get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data, error } = await supabase.auth.getUser(bearerToken);
  if (error || !data.user) throw new AuthenticationError("Admin login required");
  if (data.user.app_metadata?.role !== "admin") {
    throw new AuthorizationError("Admin role required");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: "admin",
  };
}
