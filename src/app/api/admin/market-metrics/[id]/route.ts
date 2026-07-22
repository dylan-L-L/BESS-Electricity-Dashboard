import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { SupabaseMarketMetricRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { marketMetricUpdateSchema, parseWithSchema } from "@/lib/validation/market-metric";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminApi();
    const { id } = await context.params;
    const client = await createServerSupabaseClient();
    const metric = await new SupabaseMarketMetricRepository(client).getAdminById(id);
    if (!metric) return NextResponse.json({ error: { code: "NOT_FOUND", message: "市场指标不存在" } }, { status: 404 });
    return NextResponse.json({ data: metric });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertTrustedJsonMutation(request);
    await requireAdminApi();
    const { id } = await context.params;
    const payload = parseWithSchema(marketMetricUpdateSchema.safeParse(await request.json()));
    const client = await createServerSupabaseClient();
    const metric = await new SupabaseMarketMetricRepository(client).update(id, {
      ...payload,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ data: metric });
  } catch (error) {
    return errorResponse(error);
  }
}
