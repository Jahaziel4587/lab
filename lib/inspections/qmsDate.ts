const QMS_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats calendar dates without shifting them, and instants in Mexico City time. */
export function formatQmsDate(value: string | Date | undefined): string {
  if (!value) return "";
  let year: string, month: string, day: string;
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return "";
    [, year, month, day] = match;
    const date = new Date(`${value}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "";
  } else {
    if (!Number.isFinite(value.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Mexico_City",
    }).formatToParts(value);
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    year = part("year"); month = part("month"); day = part("day");
  }
  return `${day}/${QMS_MONTHS[Number(month) - 1]}/${year.slice(-2)}`;
}
