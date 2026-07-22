import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { SupabaseMarketMetricRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { marketMetricCreateSchema, parseWithSchema } from "@/lib/validation/market-metric";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminApi();
    const client = await createServerSupabaseClient();
    const regionId = new URL(request.url).searchParams.get("region_id") || undefined;
    const metrics = await new SupabaseMarketMetricRepository(client).listAdmin(regionId);
    return NextResponse.json({ data: metrics });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedJsonMutation(request);
    await requireAdminApi();
    const payload = parseWithSchema(marketMetricCreateSchema.safeParse(await request.json()));
    const now = new Date().toISOString();
    const client = await createServerSupabaseClient();
    const metric = await new SupabaseMarketMetricRepository(client).create({
      ...payload,
      created_at: now,
      updated_at: now,
    });
    return NextResponse.json({ data: metric }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
