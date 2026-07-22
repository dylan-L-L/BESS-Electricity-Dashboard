import { describe, expect, it, vi } from "vitest";

import { resolvePublicRegionQuery } from "@/lib/http/public-region-scope";
import type { Region } from "@/lib/types";

function region(
  id: string,
  regionType: Region["region_type"],
  parentId: string | null,
): Region {
  return {
    id,
    slug: id,
    code: id.toUpperCase(),
    name_zh: id,
    name_en: id,
    region_type: regionType,
    parent_id: parentId,
    is_demo: true,
    created_at: "2026-07-22T00:00:00.000Z",
    updated_at: "2026-07-22T00:00:00.000Z",
  };
}

const regions = [
  region("global", "global", null),
  region("asia", "continent", "global"),
  region("europe", "continent", "global"),
  region("china", "country", "asia"),
  region("japan", "country", "asia"),
  region("germany", "country", "europe"),
  region("shandong", "province", "china"),
];

describe("public API region scope contract", () => {
  it("keeps exact matching as the default without loading the region tree", async () => {
    const list = vi.fn(async () => regions);

    await expect(
      resolvePublicRegionQuery("asia", null, { list }),
    ).resolves.toEqual({ region_id: "asia" });
    await expect(
      resolvePublicRegionQuery("asia", "unknown", { list }),
    ).resolves.toEqual({ region_id: "asia" });
    expect(list).not.toHaveBeenCalled();
  });

  it("returns the root and every descendant only when explicitly requested", async () => {
    const list = vi.fn(async () => regions);

    const query = await resolvePublicRegionQuery("asia", "descendants", {
      list,
    });

    expect(query).toHaveProperty("region_ids");
    expect(new Set("region_ids" in query ? query.region_ids : [])).toEqual(
      new Set(["asia", "china", "japan", "shandong"]),
    );
    expect("region_ids" in query ? query.region_ids : []).not.toContain(
      "germany",
    );
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("leaves an unfiltered request unfiltered for either scope", async () => {
    const list = vi.fn(async () => regions);

    await expect(
      resolvePublicRegionQuery(undefined, "descendants", { list }),
    ).resolves.toEqual({});
    expect(list).not.toHaveBeenCalled();
  });

  it("terminates safely if corrupt input contains a region cycle", async () => {
    const list = vi.fn(async () => [
      region("a", "country", "b"),
      region("b", "province", "a"),
    ]);

    const query = await resolvePublicRegionQuery("a", "descendants", { list });

    expect(new Set("region_ids" in query ? query.region_ids : [])).toEqual(
      new Set(["a", "b"]),
    );
  });
});
