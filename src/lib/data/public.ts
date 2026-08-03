import "server-only";

import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  SupabaseCfdAuctionRepository,
  SupabaseMarketMetricRepository,
  SupabaseProvinceTopicRepository,
  SupabaseRegionRepository,
  SupabaseSignalRepository,
} from "@/lib/repositories/supabase";
import { SignalService } from "@/lib/services/signal-service";
import { ProvinceTopicService } from "@/lib/services/province-topic-service";
import type {
  ChinaCfdAuction,
  MarketMetric,
  ProvinceTopicRecordWithFields,
  Region,
  Signal,
} from "@/lib/types";

export type PublicDashboardData = {
  configured: boolean;
  regions: Region[];
  signals: Signal[];
  marketMetrics: MarketMetric[];
  provinceTopics: ProvinceTopicRecordWithFields[];
  cfdAuctions: ChinaCfdAuction[];
};

async function getMockDashboardData(): Promise<PublicDashboardData> {
  const { MOCK_DASHBOARD_DATA } = await import("./mock");
  return MOCK_DASHBOARD_DATA;
}

export async function getPublicDashboardData(): Promise<PublicDashboardData> {
  if (!getSupabaseConfig()) {
    return getMockDashboardData();
  }

  try {
    const client = await createServerSupabaseClient();
    const regionRepository = new SupabaseRegionRepository(client);
    const signalService = new SignalService(new SupabaseSignalRepository(client));
    const metricRepository = new SupabaseMarketMetricRepository(client);
    const provinceTopicService = new ProvinceTopicService(
      new SupabaseProvinceTopicRepository(client),
    );
    const cfdAuctionRepository = new SupabaseCfdAuctionRepository(client);

    const [regions, signals, marketMetrics, provinceTopics, cfdAuctions] =
      await Promise.all([
        regionRepository.list(),
        signalService.listPublic(),
        metricRepository.listPublic(),
        provinceTopicService.listPublic(),
        cfdAuctionRepository.listPublic(),
      ]);

    return {
      configured: true,
      regions,
      signals,
      marketMetrics,
      provinceTopics,
      cfdAuctions,
    };
  } catch {
    // Local/dev fallback when Supabase is configured but unreachable.
    return getMockDashboardData();
  }
}

export async function getPublishedSignalDetail(id: string) {
  if (!getSupabaseConfig()) {
    const { MOCK_SIGNALS, MOCK_REGIONS } = await import("./mock");
    const signal = MOCK_SIGNALS.find((item) => item.id === id) ?? null;
    const region = signal?.region_id
      ? (MOCK_REGIONS.find((item) => item.id === signal.region_id) ?? null)
      : null;
    return { configured: true, signal, region };
  }

  try {
    const client = await createServerSupabaseClient();
    const signalService = new SignalService(new SupabaseSignalRepository(client));
    const regionRepository = new SupabaseRegionRepository(client);
    const signal = await signalService.getPublicById(id);
    const region = signal?.region_id ? await regionRepository.getById(signal.region_id) : null;
    return { configured: true, signal, region };
  } catch {
    const { MOCK_SIGNALS, MOCK_REGIONS } = await import("./mock");
    const signal = MOCK_SIGNALS.find((item) => item.id === id) ?? null;
    const region = signal?.region_id
      ? (MOCK_REGIONS.find((item) => item.id === signal.region_id) ?? null)
      : null;
    return { configured: true, signal, region };
  }
}
