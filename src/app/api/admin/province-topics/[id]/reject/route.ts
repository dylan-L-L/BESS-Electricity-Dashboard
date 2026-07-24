import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { SupabaseProvinceTopicRepository } from "@/lib/repositories/supabase";
import { ProvinceTopicService } from "@/lib/services/province-topic-service";
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
    const record = await new ProvinceTopicService(
      new SupabaseProvinceTopicRepository(client),
    ).reject(
      { id: admin.id, role: "admin" },
      id,
      typeof payload.reviewer_note === "string"
        ? payload.reviewer_note
        : "",
    );
    return NextResponse.json({ data: record });
  } catch (error) {
    return errorResponse(error);
  }
}
