import "server-only";

import { requireAdminPage } from "@/lib/auth/admin";
import {
  SupabaseMarketMetricRepository,
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
  };
}

export async function getAdminDashboardData() {
  const repository = await repositories();
  const [regions, signals, metrics] = await Promise.all([
    repository.regions.list(),
    repository.signals.listAdmin(),
    repository.metrics.listAdmin(),
  ]);
  return { regions, signals, metrics };
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
