export function validateVoucherTitle(value: unknown): string {
  if (typeof value !== "string" || value.trim().length > 120 || /[\r\n\x00-\x1f]/.test(value)) throw new Error("Usa un título de hasta 120 caracteres en una sola línea.");
  return value.trim();
}
