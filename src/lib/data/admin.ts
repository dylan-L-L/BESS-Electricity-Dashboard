import "server-only";

import { requireAdminPage } from "@/lib/auth/admin";
import {
  SupabaseMarketMetricRepository,
  SupabaseProvinceTopicRepository,
  SupabaseRegionRepository,
  SupabaseSignalRepository,
} from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function repositories() {
  await requireAdminPage();
  const client = await createServerSupabaseClient();
  return {
    regions: new SupabaseRegionRepository(client),
    signals: new SupabaseSignalRepository(client),
    metrics: new SupabaseMarketMetricRepository(client),
    provinceTopics: new SupabaseProvinceTopicRepository(client),
  };
}

export async function getAdminDashboardData() {
  const repository = await repositories();
  const [regions, signals, metrics, provinceTopics] = await Promise.all([
    repository.regions.list(),
    repository.signals.listAdmin(),
    repository.metrics.listAdmin(),
    repository.provinceTopics.listAdmin(),
  ]);
  return { regions, signals, metrics, provinceTopics };
}

export async function getAdminSignalListData() {
  const repository = await repositories();
  const [regions, signals] = await Promise.all([
    repository.regions.list(),
    repository.signals.listAdmin(),
  ]);
  return { regions, signals };
}

export async function getAdminMetricListData() {
  const repository = await repositories();
  const [regions, metrics] = await Promise.all([
    repository.regions.list(),
    repository.metrics.listAdmin(),
  ]);
  return { regions, metrics };
}

export async function getAdminProvinceTopicListData() {
  const repository = await repositories();
  const [regions, provinceTopics] = await Promise.all([
    repository.regions.list(),
    repository.provinceTopics.listAdmin(),
  ]);
  return { regions, provinceTopics };
}

export async function getAdminSignalData(id?: string) {
  const repository = await repositories();
  const [regions, signal] = await Promise.all([
    repository.regions.list(),
    id ? repository.signals.getAdminById(id) : Promise.resolve(null),
  ]);
  return { regions, signal };
}

export async function getAdminMetricData(id?: string) {
  const repository = await repositories();
  const [regions, metric] = await Promise.all([
    repository.regions.list(),
    id ? repository.metrics.getAdminById(id) : Promise.resolve(null),
  ]);
  return { regions, metric };
}

export async function getAdminProvinceTopicData(id?: string) {
  const repository = await repositories();
  const [regions, record] = await Promise.all([
    repository.regions.list(),
    id
      ? repository.provinceTopics.getAdminById(id)
      : Promise.resolve(null),
  ]);
  return { regions, record };
}
