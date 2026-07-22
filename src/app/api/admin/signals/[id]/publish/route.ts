import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { SupabaseSignalRepository } from "@/lib/repositories/supabase";
import { SignalService } from "@/lib/services/signal-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
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
    const signal = await service.publish(
      { id: admin.id, role: "admin" },
      id,
      typeof payload.reviewer_note === "string" ? payload.reviewer_note : "",
    );
    return NextResponse.json({ data: signal });
  } catch (error) {
    return errorResponse(error);
  }
}
