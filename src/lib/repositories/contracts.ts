import type {
  MarketMetric,
  Region,
  ReviewStatus,
  Signal,
} from "../types";

export interface AdminSignalQuery {
  region_id?: string;
  review_status?: ReviewStatus;
  search?: string;
  limit?: number;
}
export interface PublicSignalQuery {
  region_id?: string;
  region_ids?: string[];
  search?: string;
  limit?: number;
}

export type CreateSignalRecord = Omit<Signal, "id">;
export type UpdateSignalRecord = Partial<
  Omit<Signal, "id" | "created_at">
>;

/**
 * Public methods are a security boundary and implementations must query with
 * review_status = published. SignalService repeats that check defensively.
 */
export interface SignalRepository {
  listAdmin(query?: AdminSignalQuery): Promise<Signal[]>;
  listPublic(query?: PublicSignalQuery): Promise<Signal[]>;
  getAdminById(id: string): Promise<Signal | null>;
  getPublicById(id: string): Promise<Signal | null>;
  create(input: CreateSignalRecord): Promise<Signal>;
  update(id: string, input: UpdateSignalRecord): Promise<Signal>;
}

export interface RegionRepository {
  list(): Promise<Region[]>;
  getById(id: string): Promise<Region | null>;
  getBySlug(slug: string): Promise<Region | null>;
}

export interface PublicMarketMetricQuery {
  region_id?: string;
  region_ids?: string[];
}

export type CreateMarketMetricRecord = Omit<MarketMetric, "id">;
export type UpdateMarketMetricRecord = Partial<
  Omit<MarketMetric, "id" | "created_at">
>;

export interface MarketMetricRepository {
  listAdmin(regionId?: string): Promise<MarketMetric[]>;
  listPublic(query?: PublicMarketMetricQuery): Promise<MarketMetric[]>;
  getAdminById(id: string): Promise<MarketMetric | null>;
  create(input: CreateMarketMetricRecord): Promise<MarketMetric>;
  update(id: string, input: UpdateMarketMetricRecord): Promise<MarketMetric>;
}
