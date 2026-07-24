import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { CHINA_MARKET_TOPIC_IDS } from "@/lib/china-market/taxonomy";
import { errorResponse } from "@/lib/http/errors";
import { assertTrustedJsonMutation } from "@/lib/http/security";
import { SupabaseProvinceTopicRepository } from "@/lib/repositories/supabase";
import { ProvinceTopicService } from "@/lib/services/province-topic-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  REVIEW_STATUSES,
  type ReviewStatus,
} from "@/lib/types";
import type { ChinaMarketTopicId } from "@/lib/china-market/taxonomy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminApi();
    const url = new URL(request.url);
    const rawTopic = url.searchParams.get("topic_id");
    const rawStatus = url.searchParams.get("review_status");
    const topicId = CHINA_MARKET_TOPIC_IDS.includes(
      rawTopic as ChinaMarketTopicId,
    )
      ? (rawTopic as ChinaMarketTopicId)
      : undefined;
    const reviewStatus = REVIEW_STATUSES.includes(rawStatus as ReviewStatus)
      ? (rawStatus as ReviewStatus)
      : undefined;
    const client = await createServerSupabaseClient();
    const records = await new SupabaseProvinceTopicRepository(client).listAdmin({
      region_id: url.searchParams.get("region_id") || undefined,
      topic_id: topicId,
      review_status: reviewStatus,
    });
    return NextResponse.json({ data: records });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedJsonMutation(request);
    const admin = await requireAdminApi();
    const client = await createServerSupabaseClient();
    const service = new ProvinceTopicService(
      new SupabaseProvinceTopicRepository(client),
    );
    const record = await service.saveDraft(
      { id: admin.id, role: "admin" },
      await request.json(),
    );
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
