import type { InventoryComponent, Lot } from "./types";
export function storageConditions(temperature: unknown, humidity: unknown) {
  function value(raw: unknown, label: string) {
    if (typeof raw !== "string" || !raw.trim() || raw.length > 200) throw new Error(`Especifica ${label} (máximo 200 caracteres; usa N/A si no aplica).`);
    return raw.trim();
  }
  return { temperatureCondition: value(temperature, "temperatura"), humidityCondition: value(humidity, "humedad") };
}
export function conditionsDiffer(a: Partial<Lot>, b: Partial<Lot>) {
  return (a.temperatureCondition || "").trim() !== (b.temperatureCondition || "").trim() || (a.humidityCondition || "").trim() !== (b.humidityCondition || "").trim();
}
export function affectedLots(component: InventoryComponent, next: Partial<Lot>) {
  return component.lots.filter(l => Object.values(l.stock).some(q => q > 0) && conditionsDiffer(l, next));
}
export function bioanaDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Mexico_City", day: "2-digit", month: "numeric", year: "2-digit" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  return `${get("day")}/${["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][Number(get("month")) - 1]}/${get("year")}`;
}
