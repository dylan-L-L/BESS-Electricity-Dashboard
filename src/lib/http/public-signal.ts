import type { Signal } from "@/lib/types";

/** Stable public DTO. Internal Auth UUIDs never cross the Viewer API. */
export function toPublicSignal(signal: Signal) {
  return {
    id: signal.id,
    region_id: signal.region_id,
    signal_type: signal.signal_type,
    title: signal.title,
    summary: signal.summary,
    category: signal.category,
    original_status: signal.original_status,
    normalized_status: signal.normalized_status,
    event_date: signal.event_date,
    effective_date: signal.effective_date,
    impact_channel: signal.impact_channel,
    impact_direction: signal.impact_direction,
    impact_level: signal.impact_level,
    source_url: signal.source_url,
    source_name: signal.source_name,
    reviewer_note: signal.reviewer_note,
    review_status: signal.review_status,
    published_at: signal.published_at,
    is_demo: signal.is_demo,
    created_at: signal.created_at,
    updated_at: signal.updated_at,
  };
}
