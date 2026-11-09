// The event runs in America/Denver. November is MST (UTC-7, no DST change
// during the event), so a fixed offset is exact and keeps ES queries simple.
export const EVENT_TZ = "America/Denver";
export const OFFSET = "-07:00";
export const EVENT_DAYS = ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"];

/** Schedule times have no offset; they are local MST. */
export function mst(local: string): string {
  return local.length === 19 ? `${local}${OFFSET}` : local;
}

/** The local MST calendar day (YYYY-MM-DD) of an instant. */
export function dayOf(d: Date | string | number): string {
  const t = new Date(d).getTime() - 7 * 3600_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Local MST wall clock HH:MM of an instant. */
export function clockOf(d: Date | string | number): string {
  const t = new Date(d).getTime() - 7 * 3600_000;
  return new Date(t).toISOString().slice(11, 16);
}

export function at(day: string, hhmm: string): Date {
  return new Date(`${day}T${hhmm}:00${OFFSET}`);
}

export function dayBounds(day: string): { start: Date; end: Date } {
  return { start: at(day, "00:00"), end: new Date(at(day, "00:00").getTime() + 24 * 3600_000) };
}

export function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}
