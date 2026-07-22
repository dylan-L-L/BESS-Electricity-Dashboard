import { z } from "zod";

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const nullableText = z.preprocess(emptyToNull, z.string().trim().min(1).nullable());
const nullableUrl = z.preprocess(emptyToNull, z.string().trim().url().nullable());
const nullableDate = z.preprocess(
  emptyToNull,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期必须为 YYYY-MM-DD").nullable(),
);

export const marketMetricCreateSchema = z.object({
  region_id: z.string().uuid(),
  metric_key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  value: z.number().finite().nullable(),
  unit: nullableText,
  period_label: nullableText,
  as_of_date: nullableDate,
  source_url: nullableUrl,
  source_name: nullableText,
  notes: nullableText,
  is_demo: z.boolean(),
  is_published: z.boolean(),
});

export const marketMetricUpdateSchema = marketMetricCreateSchema.partial();

export class RequestValidationError extends Error {
  readonly status = 422;
  readonly code = "INVALID_INPUT";

  constructor(readonly issues: unknown) {
    super("请求字段不符合要求");
  }
}

export function parseWithSchema<T>(result: z.ZodSafeParseResult<T>): T {
  if (!result.success) throw new RequestValidationError(result.error.flatten());
  return result.data;
}
