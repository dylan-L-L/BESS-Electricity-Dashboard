import type { Region } from "./types";

const CONTINENT_ORDER = new Map<string, number>([
  ["CONT-AS", 0],
  ["CONT-EU", 1],
  ["CONT-NA", 2],
  ["CONT-SA", 3],
  ["CONT-OC", 4],
  ["CONT-AF", 5],
]);

function stableRegionLabel(region: Region): string {
  return region.name_en || region.name_zh || region.code || region.slug;
}

/**
 * Keeps the public directory in one predictable business order while still
 * allowing newly configured continents to fall back to an alphabetical label.
 */
export function compareContinents(left: Region, right: Region): number {
  const leftRank = CONTINENT_ORDER.get(left.code || "") ?? Number.MAX_SAFE_INTEGER;
  const rightRank = CONTINENT_ORDER.get(right.code || "") ?? Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) return leftRank - rightRank;

  return stableRegionLabel(left).localeCompare(stableRegionLabel(right), "en");
}

/**
 * Country links use their English names as the stable tie-break so homepage
 * cards and the sidebar do not inherit database insertion order.
 */
export function compareCountries(left: Region, right: Region): number {
  return stableRegionLabel(left).localeCompare(stableRegionLabel(right), "en");
}
