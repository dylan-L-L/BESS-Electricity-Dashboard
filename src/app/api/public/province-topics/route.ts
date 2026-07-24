import { NextResponse } from "next/server";

import {
  CHINA_MARKET_TOPIC_IDS,
  type ChinaMarketTopicId,
} from "@/lib/china-market/taxonomy";
import { errorResponse } from "@/lib/http/errors";
import { resolvePublicRegionQuery } from "@/lib/http/public-region-scope";
import {
  SupabaseProvinceTopicRepository,
  SupabaseRegionRepository,
} from "@/lib/repositories/supabase";
import { ProvinceTopicService } from "@/lib/services/province-topic-service";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!getSupabaseConfig()) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED" } },
        { status: 503 },
      );
    }

    const url = new URL(request.url);
    const requestedTopic = url.searchParams.get("topic_id");
    const topicId = CHINA_MARKET_TOPIC_IDS.includes(
      requestedTopic as ChinaMarketTopicId,
    )
      ? (requestedTopic as ChinaMarketTopicId)
      : undefined;
    const client = await createServerSupabaseClient();
    const regionQuery = await resolvePublicRegionQuery(
      url.searchParams.get("region_id") || undefined,
      url.searchParams.get("scope"),
      new SupabaseRegionRepository(client),
    );
    const records = await new ProvinceTopicService(
      new SupabaseProvinceTopicRepository(client),
    ).listPublic({ ...regionQuery, topic_id: topicId });
    return NextResponse.json({ data: records });
  } catch (error) {
    return errorResponse(error);
  }
}
