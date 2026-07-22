import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { SupabaseSignalRepository } from "@/lib/repositories/supabase";
import { SignalService } from "@/lib/services/signal-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminApi();
    const { id } = await context.params;
    const client = await createServerSupabaseClient();
    const signal = await new SupabaseSignalRepository(client).getAdminById(id);
    if (!signal) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Signal 不存在" } }, { status: 404 });
    return NextResponse.json({ data: signal });
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
    const admin = await requireAdminApi();
    const { id } = await context.params;
    const payload = await request.json();
    const client = await createServerSupabaseClient();
    const service = new SignalService(new SupabaseSignalRepository(client));
    const signal = await service.saveDraft({ id: admin.id, role: "admin" }, payload, id);
    return NextResponse.json({ data: signal });
  } catch (error) {
    return errorResponse(error);
  }
}
