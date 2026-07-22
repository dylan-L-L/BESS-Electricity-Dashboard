import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/http/errors";
import { resolvePublicRegionQuery } from "@/lib/http/public-region-scope";
import {
  SupabaseMarketMetricRepository,
  SupabaseRegionRepository,
} from "@/lib/repositories/supabase";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!getSupabaseConfig()) return NextResponse.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
    const client = await createServerSupabaseClient();
    const url = new URL(request.url);
    const regionQuery = await resolvePublicRegionQuery(
      url.searchParams.get("region_id") || undefined,
      url.searchParams.get("scope"),
      new SupabaseRegionRepository(client),
    );
    const metrics = await new SupabaseMarketMetricRepository(client).listPublic(regionQuery);
    return NextResponse.json({ data: metrics });
  } catch (error) {
    return errorResponse(error);
  }
}
