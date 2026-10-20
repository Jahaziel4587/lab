import { locationName } from "./catalogs";

export function voucherComments(line?: string, general?: string) {
  return [...new Set([line, general].map(value => value?.trim()).filter(Boolean))].join("\n");
}

export function voucherLocation(location: string, detail?: string) {
  const name = locationName(location);
  if (location === "externo:recepcion") return detail?.trim() || name;
  return detail?.trim() || name;
}
