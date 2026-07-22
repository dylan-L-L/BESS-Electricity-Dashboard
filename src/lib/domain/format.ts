/**
 * Formats absent data as an em dash. The explicit null check is important:
 * numeric zero is a real value and must never be confused with missing data.
 */
export function formatNullable(
  value: string | number | null | undefined,
  fallback = "—",
): string {
  return value === null || value === undefined ? fallback : String(value);
}
export function formatMetricValue(
  value: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return unit ? `${value} ${unit}` : String(value);
}
