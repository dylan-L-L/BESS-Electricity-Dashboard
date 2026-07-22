import "server-only";

import { requireAdminPage } from "@/lib/auth/admin";
import { SupabaseImportRepository } from "@/lib/imports/supabase-repository";
import { SupabaseImportBlobStore } from "@/lib/imports/storage";
import type {
  ExcelWorkbookPreview,
  ImportJobMetadata,
  SourcePreview,
} from "@/lib/imports/types";
import { SupabaseRegionRepository } from "@/lib/repositories/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function importContext() {
  await requireAdminPage();
  const client = await createServerSupabaseClient();
  return {
    repository: new SupabaseImportRepository(client),
    regions: new SupabaseRegionRepository(client),
    blobs: new SupabaseImportBlobStore(client),
  };
}

export async function getImportJobsData() {
  const { repository } = await importContext();
  return { jobs: await repository.listJobs() };
}

function workbookPreview(
  metadata: ImportJobMetadata | null | undefined,
): ExcelWorkbookPreview | null {
  const candidate = metadata?.workbook_preview;
  if (!candidate || !Array.isArray(candidate.sheets)) return null;
  return candidate as unknown as ExcelWorkbookPreview;
}

export async function getImportJobData(id: string) {
  const { repository } = await importContext();
  const [job, items] = await Promise.all([
    repository.getJob(id),
    repository.getItems(id),
  ]);
  return {
    job,
    items,
    workbookPreview: workbookPreview(job?.input_metadata),
  };
}

export async function getImportReviewData(jobId: string, itemId?: string) {
  const { repository, regions, blobs } = await importContext();
  const [job, items, regionRows] = await Promise.all([
    repository.getJob(jobId),
    repository.getItems(jobId),
    regions.list(),
  ]);
  const item =
    items.find((candidate) => candidate.id === itemId) ??
    items.find((candidate) =>
      ["ai_draft", "pending_review"].includes(candidate.review_status),
    ) ??
    items[0] ??
    null;

  let signedUrl: string | null = null;
  if (job?.storage_path) {
    try {
      signedUrl = await blobs.createSignedReadUrl(job.storage_path);
    } catch {
      // The review page still renders stored extracted text when Storage is
      // temporarily unavailable. The API remains the authorization boundary.
    }
  }

  const sourcePreview: SourcePreview | null = job
    ? {
        input_type: job.input_type,
        text: item?.extracted_text ?? job.extracted_text,
        source_url: job.canonical_url ?? job.source_url,
        storage_path: job.storage_path,
        signed_url: signedUrl,
        source_location: item?.source_location ?? {},
      }
    : null;

  return {
    job,
    items,
    item,
    regions: regionRows,
    sourcePreview,
  };
}
