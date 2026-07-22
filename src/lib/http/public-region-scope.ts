import type { RegionRepository } from "@/lib/repositories/contracts";

export type PublicRegionQuery =
  | Record<string, never>
  | { region_id: string }
  | { region_ids: string[] };

/**
 * Resolves the optional public API tree scope without changing the existing
 * exact-match default. The region repository uses the same request-scoped
 * Supabase client as the business-data repository, so normal RLS remains in
 * force throughout the request.
 */
export async function resolvePublicRegionQuery(
  regionId: string | undefined,
  scope: string | null,
  regions: Pick<RegionRepository, "list">,
): Promise<PublicRegionQuery> {
  if (!regionId) return {};
  if (scope !== "descendants") return { region_id: regionId };

  const allRegions = await regions.list();
  const regionIds = new Set<string>([regionId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const region of allRegions) {
      if (
        region.parent_id &&
        regionIds.has(region.parent_id) &&
        !regionIds.has(region.id)
      ) {
        regionIds.add(region.id);
        changed = true;
      }
    }
  }

  return { region_ids: [...regionIds] };
}
