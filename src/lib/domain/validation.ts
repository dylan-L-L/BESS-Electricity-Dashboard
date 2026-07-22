import type { ZodError } from "zod";

import type { Signal } from "../types";
import {
  PublishValidationError,
  type DomainError,
} from "./errors";
import { publishableSignalSchema } from "./schemas";

export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "_form";
    errors[field] = [...(errors[field] ?? []), issue.message];
  }

  return errors;
}
/** Throws a structured 422 error when a signal cannot cross the publish gate. */
export function assertSignalPublishable(
  signal: Signal,
  reviewerNote: string,
): void {
  const result = publishableSignalSchema.safeParse({
    region_id: signal.region_id,
    title: signal.title,
    summary: signal.summary,
    source_url: signal.source_url,
    normalized_status: signal.normalized_status,
    reviewer_note: reviewerNote,
  });

  if (!result.success) {
    throw new PublishValidationError(zodFieldErrors(result.error));
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof Error && "code" in error && "status" in error;
}
