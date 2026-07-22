import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/http/errors";
import { resolvePublicRegionQuery } from "@/lib/http/public-region-scope";
import { toPublicSignal } from "@/lib/http/public-signal";
import {
  SupabaseRegionRepository,
  SupabaseSignalRepository,
} from "@/lib/repositories/supabase";
import { SignalService } from "@/lib/services/signal-service";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!getSupabaseConfig()) return NextResponse.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.trunc(requestedLimit), 100))
      : 100;
    const client = await createServerSupabaseClient();
    const regionQuery = await resolvePublicRegionQuery(
      url.searchParams.get("region_id") || undefined,
      url.searchParams.get("scope"),
      new SupabaseRegionRepository(client),
    );
    const service = new SignalService(new SupabaseSignalRepository(client));
    const signals = await service.listPublic({
      ...regionQuery,
      search: url.searchParams.get("q") || undefined,
      limit,
    });
    return NextResponse.json({ data: signals.map(toPublicSignal) });
  } catch (error) {
    return errorResponse(error);
  }
}
