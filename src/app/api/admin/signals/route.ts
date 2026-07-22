import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { SupabaseSignalRepository } from "@/lib/repositories/supabase";
import { SignalService } from "@/lib/services/signal-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { REVIEW_STATUSES, type ReviewStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminApi();
    const url = new URL(request.url);
    const requestedStatus = url.searchParams.get("review_status");
    const reviewStatus = REVIEW_STATUSES.includes(requestedStatus as ReviewStatus)
      ? (requestedStatus as ReviewStatus)
      : undefined;
    const client = await createServerSupabaseClient();
    const repository = new SupabaseSignalRepository(client);
    const signals = await repository.listAdmin({
      region_id: url.searchParams.get("region_id") || undefined,
      review_status: reviewStatus,
      search: url.searchParams.get("q") || undefined,
    });
    return NextResponse.json({ data: signals });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedJsonMutation(request);
    const admin = await requireAdminApi();
    const payload = await request.json();
    const client = await createServerSupabaseClient();
    const service = new SignalService(new SupabaseSignalRepository(client));
    const signal = await service.saveDraft({ id: admin.id, role: "admin" }, payload);
    return NextResponse.json({ data: signal }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
