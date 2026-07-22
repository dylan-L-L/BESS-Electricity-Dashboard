import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdminSignalQuery,
  CreateMarketMetricRecord,
  CreateSignalRecord,
  MarketMetricRepository,
  PublicMarketMetricQuery,
  PublicSignalQuery,
  RegionRepository,
  SignalRepository,
  UpdateMarketMetricRecord,
  UpdateSignalRecord,
} from "./contracts";
import type { MarketMetric, Region, Signal } from "../types";

const PUBLIC_SIGNAL_COLUMNS = [
  "id",
  "region_id",
  "signal_type",
  "title",
  "summary",
  "category",
  "original_status",
  "normalized_status",
  "event_date",
  "effective_date",
  "impact_channel",
  "impact_direction",
  "impact_level",
  "source_url",
  "source_name",
  "reviewer_note",
  "review_status",
  "published_at",
  "is_demo",
  "created_at",
  "updated_at",
].join(",");

class PersistenceError extends Error {
  readonly status = 500;
  readonly code = "DATABASE_ERROR";

  constructor(operation: string, detail?: string) {
    super(`Database operation failed: ${operation}${detail ? ` (${detail})` : ""}`);
  }
}

function throwIfError(operation: string, error: { message: string } | null) {
  if (error) throw new PersistenceError(operation, error.message);
}

function matchesSearch(signal: Signal, search?: string) {
  const needle = search?.trim().toLocaleLowerCase("zh-CN");
  if (!needle) return true;

  return [signal.title, signal.summary, signal.category, signal.original_status, signal.source_name]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase("zh-CN").includes(needle));
}

export class SupabaseSignalRepository implements SignalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAdmin(query: AdminSignalQuery = {}): Promise<Signal[]> {
    let request = this.client.from("signals").select("*").order("updated_at", { ascending: false });
    if (query.region_id) request = request.eq("region_id", query.region_id);
    if (query.review_status) request = request.eq("review_status", query.review_status);
    if (query.limit) request = request.limit(query.limit);

    const { data, error } = await request;
    throwIfError("list admin signals", error);
    return ((data ?? []) as Signal[]).filter((signal) => matchesSearch(signal, query.search));
  }

  async listPublic(query: PublicSignalQuery = {}): Promise<Signal[]> {
    let request = this.client
      .from("signals")
      .select(PUBLIC_SIGNAL_COLUMNS)
      .eq("review_status", "published")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });

    if (query.region_ids?.length) request = request.in("region_id", query.region_ids);
    else if (query.region_id) request = request.eq("region_id", query.region_id);
    if (query.limit && !query.search) request = request.limit(query.limit);

    const { data, error } = await request;
    throwIfError("list published signals", error);
    const filtered = ((data ?? []) as unknown as Signal[]).filter((signal) =>
      matchesSearch(signal, query.search),
    );
    return query.limit ? filtered.slice(0, query.limit) : filtered;
  }

  async getAdminById(id: string): Promise<Signal | null> {
    const { data, error } = await this.client.from("signals").select("*").eq("id", id).maybeSingle();
    throwIfError("read admin signal", error);
    return (data as unknown as Signal | null) ?? null;
  }

  async getPublicById(id: string): Promise<Signal | null> {
    const { data, error } = await this.client
      .from("signals")
      .select(PUBLIC_SIGNAL_COLUMNS)
      .eq("id", id)
      .eq("review_status", "published")
      .not("published_at", "is", null)
      .maybeSingle();
    throwIfError("read published signal", error);
    return (data as unknown as Signal | null) ?? null;
  }

  async create(input: CreateSignalRecord): Promise<Signal> {
    const { data, error } = await this.client.from("signals").insert(input).select("*").single();
    throwIfError("create signal", error);
    return data as Signal;
  }

  async update(id: string, input: UpdateSignalRecord): Promise<Signal> {
    const { data, error } = await this.client
      .from("signals")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();
    throwIfError("update signal", error);
    return data as Signal;
  }
}

export class SupabaseRegionRepository implements RegionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<Region[]> {
    const { data, error } = await this.client
      .from("regions")
      .select("*")
      .order("region_type")
      .order("name_zh");
    throwIfError("list regions", error);
    return (data ?? []) as Region[];
  }

  async getById(id: string): Promise<Region | null> {
    const { data, error } = await this.client.from("regions").select("*").eq("id", id).maybeSingle();
    throwIfError("read region", error);
    return (data as Region | null) ?? null;
  }

  async getBySlug(slug: string): Promise<Region | null> {
    const { data, error } = await this.client.from("regions").select("*").eq("slug", slug).maybeSingle();
    throwIfError("read region by slug", error);
    return (data as Region | null) ?? null;
  }
}

export class SupabaseMarketMetricRepository implements MarketMetricRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAdmin(regionId?: string): Promise<MarketMetric[]> {
    let request = this.client
      .from("market_metrics")
      .select("*")
      .order("updated_at", { ascending: false });
    if (regionId) request = request.eq("region_id", regionId);
    const { data, error } = await request;
    throwIfError("list admin market metrics", error);
    return (data ?? []) as MarketMetric[];
  }

  async listPublic(query: PublicMarketMetricQuery = {}): Promise<MarketMetric[]> {
    let request = this.client
      .from("market_metrics")
      .select("*")
      .eq("is_published", true)
      .order("label");
    if (query.region_ids?.length) request = request.in("region_id", query.region_ids);
    else if (query.region_id) request = request.eq("region_id", query.region_id);
    const { data, error } = await request;
    throwIfError("list published market metrics", error);
    return (data ?? []) as MarketMetric[];
  }

  async getAdminById(id: string): Promise<MarketMetric | null> {
    const { data, error } = await this.client
      .from("market_metrics")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfError("read admin market metric", error);
    return (data as MarketMetric | null) ?? null;
  }

  async create(input: CreateMarketMetricRecord): Promise<MarketMetric> {
    const { data, error } = await this.client
      .from("market_metrics")
      .insert(input)
      .select("*")
      .single();
    throwIfError("create market metric", error);
    return data as MarketMetric;
  }

  async update(id: string, input: UpdateMarketMetricRecord): Promise<MarketMetric> {
    const { data, error } = await this.client
      .from("market_metrics")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();
    throwIfError("update market metric", error);
    return data as MarketMetric;
  }
}
