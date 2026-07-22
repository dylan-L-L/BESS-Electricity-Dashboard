import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { requireSupabaseConfig } from "./config";

export async function createServerSupabaseClient() {
  const config = requireSupabaseConfig();
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");

  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    global: authorization
      ? { headers: { Authorization: authorization } }
      : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. The root proxy keeps
          // sessions refreshed for those requests.
        }
      },
    },
  });
}
