import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  SupabaseMarketMetricRepository,
  SupabaseSignalRepository,
} from "@/lib/repositories/supabase";

type QueryCall = [method: string, ...arguments_: unknown[]];

function recordingClient() {
  const calls: QueryCall[] = [];
  const result = Promise.resolve({ data: [], error: null });
  const query = {
    select(...arguments_: unknown[]) {
      calls.push(["select", ...arguments_]);
      return query;
    },
    eq(...arguments_: unknown[]) {
      calls.push(["eq", ...arguments_]);
      return query;
    },
    not(...arguments_: unknown[]) {
      calls.push(["not", ...arguments_]);
      return query;
    },
    order(...arguments_: unknown[]) {
      calls.push(["order", ...arguments_]);
      return query;
    },
    in(...arguments_: unknown[]) {
      calls.push(["in", ...arguments_]);
      return query;
    },
    then<TResult1 = { data: never[]; error: null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: never[]; error: null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return result.then(onfulfilled, onrejected);
    },
  };
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      return query;
    },
  } as unknown as SupabaseClient;

  return { calls, client };
}

describe("descendant-scope repository boundary", () => {
  it("keeps the published Signal predicates when querying multiple regions", async () => {
    const { calls, client } = recordingClient();

    await new SupabaseSignalRepository(client).listPublic({
      region_ids: ["asia", "china", "shandong"],
    });

    expect(calls).toContainEqual(["eq", "review_status", "published"]);
    expect(calls).toContainEqual(["not", "published_at", "is", null]);
    expect(calls).toContainEqual([
      "in",
      "region_id",
      ["asia", "china", "shandong"],
    ]);
  });

  it("keeps the published Metric predicate when querying multiple regions", async () => {
    const { calls, client } = recordingClient();

    await new SupabaseMarketMetricRepository(client).listPublic({
      region_ids: ["asia", "china", "shandong"],
    });

    expect(calls).toContainEqual(["eq", "is_published", true]);
    expect(calls).toContainEqual([
      "in",
      "region_id",
      ["asia", "china", "shandong"],
    ]);
  });
});
