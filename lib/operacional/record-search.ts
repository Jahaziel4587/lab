export type RecordFilter = { field: string; value: string };
export const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function fieldValues(value: unknown, path: string[]): unknown[] {
  if (Array.isArray(value)) return value.flatMap(item => fieldValues(item, path));
  if (!path.length) return value && typeof value === "object" ? Object.values(value).flatMap(item => fieldValues(item, [])) : [value];
  if (!value || typeof value !== "object") return [];
  return fieldValues((value as Record<string, unknown>)[path[0]], path.slice(1));
}
export function matchesRecord(id: string, data: Record<string, unknown>, filters: RecordFilter[]) {
  return filters.every(({ field, value }) => (field === "__id__" ? [id] : fieldValues(data, field ? field.split(".") : [])).some(item => normalize(item).includes(normalize(value))));
}
export function recordFields(value: unknown, prefix = "", depth = 0): string[] {
  if (depth > 8 || !value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(item => recordFields(item, prefix, depth + 1));
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...recordFields(item, path, depth + 1)];
  });
}
