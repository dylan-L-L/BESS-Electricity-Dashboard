import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/http/errors";
import { SupabaseRegionRepository } from "@/lib/repositories/supabase";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!getSupabaseConfig()) return NextResponse.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
    const client = await createServerSupabaseClient();
    const regions = await new SupabaseRegionRepository(client).list();
    return NextResponse.json({ data: regions });
  } catch (error) {
    return errorResponse(error);
  }
}
