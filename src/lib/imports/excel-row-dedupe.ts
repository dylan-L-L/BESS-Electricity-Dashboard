import { createHash } from "node:crypto";

import type { JsonObject, JsonValue } from "@/lib/imports/types";

/**
 * JSON.stringify preserves insertion order, so the same Excel row could receive
 * a different hash when a parser returns its headers in a different order.
 * Canonicalising object keys makes the hash independent of that incidental
 * ordering while deliberately preserving string whitespace, null and zero.
 */
function canonicalJson(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Excel row hash only accepts finite JSON numbers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function normalizedExcelRowHash(rawData: JsonObject): string {
  return createHash("sha256").update(canonicalJson(rawData)).digest("hex");
}

export function excelRowIdentityKey(input: {
  sourceRowNumber: number;
  rawRowHash: string;
}): string {
  return `${input.sourceRowNumber}:${input.rawRowHash}`;
}
