import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { rejectImportItemSchema } from "@/lib/imports/schemas";
import { ImportWorkflowError } from "@/lib/imports/service";
import { SupabaseImportRepository } from "@/lib/imports/supabase-repository";
import { RequestValidationError } from "@/lib/validation/market-metric";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertTrustedJsonMutation(request);
    const admin = await requireAdminApi();
    const payload = rejectImportItemSchema.safeParse(await request.json());
    if (!payload.success) throw new RequestValidationError(payload.error.flatten());
    const { id } = await context.params;
    const client = await createServerSupabaseClient();
    const repository = new SupabaseImportRepository(client);
    if (!(await repository.getItem(id))) {
      throw new ImportWorkflowError("导入条目不存在", "IMPORT_ITEM_NOT_FOUND", 404);
    }
    const item = await repository.rejectItem(
      id,
      admin.id,
      payload.data.reviewer_note,
    );
    return NextResponse.json({ data: item });
  } catch (error) {
    return errorResponse(error);
  }
}
