// Presence as time-range "stints": one doc per check-in with
// active = [start, start + 30m). Renew extends the end, leave/move cuts it
// to now. Expiry is just the range end, so live counts, history and the
// murmuration all read the same docs and nothing needs cleaning up.
import { STINT_MINUTES } from "./config";
import { zoneById } from "./data";
import { es, INDEX } from "./es";
import { getProfile } from "./attendees";
import { recomputeTables } from "./tables";
import { addMinutes } from "./time";

export type Stint = {
  attendee_id: string;
  zone: string;
  floor: string;
  active: { gte: string; lt: string };
  interests: string[];
  open_topics: string[];
  hint: string | null;
  newcomer: boolean;
  source: "live" | "sim";
  created_at: string;
};

export const activeAt = (field: string, t: Date): any => ({
  range: { [field]: { gte: t.toISOString(), lte: t.toISOString(), relation: "intersects" } },
});

export async function activeStint(attendeeId: string, now = new Date()): Promise<{ id: string; stint: Stint } | null> {
  const r = await es().search<Stint>({
    index: INDEX.stints,
    size: 1,
    query: { bool: { filter: [{ term: { attendee_id: attendeeId } }, activeAt("active", now)] } },
    sort: [{ created_at: "desc" }],
  });
  const h = r.hits.hits[0];
  return h ? { id: h._id!, stint: h._source! } : null;
}

async function endStint(id: string, stint: Stint, now: Date) {
  // A range can't be empty: if the stint started this very second, drop it.
  if (now.getTime() - new Date(stint.active.gte).getTime() < 1000) {
    await es().delete({ index: INDEX.stints, id, refresh: "wait_for" }, { ignore: [404] });
  } else {
    await es().update({
      index: INDEX.stints,
      id,
      doc: { active: { gte: stint.active.gte, lt: now.toISOString() } },
      refresh: "wait_for",
    });
  }
}

export type CheckIn = {
  attendeeId: string;
  zone: string;
  openTopics?: string[];
  hint?: string | null;
  now?: Date;
  minutes?: number;
  source?: "live" | "sim";
  interests?: string[];
  newcomer?: boolean;
  /** Sim backfill writes in bulk and recomputes tables itself. */
  skipTables?: boolean;
};

export async function checkIn(c: CheckIn): Promise<Stint> {
  const now = c.now ?? new Date();
  const zone = zoneById(c.zone);
  if (!zone) throw new Error(`unknown zone ${c.zone}`);
  const prev = await activeStint(c.attendeeId, now);
  if (prev) await endStint(prev.id, prev.stint, now);

  let interests = c.interests;
  let newcomer = c.newcomer;
  if (!interests || newcomer === undefined) {
    const p = await getProfile(c.attendeeId);
    interests ??= p?.interests ?? [];
    newcomer ??= p?.newcomer ?? false;
  }
  // You can only be open to connect about your own interests.
  const openTopics = (c.openTopics ?? []).filter((t) => interests!.includes(t)).slice(0, 3);
  const stint: Stint = {
    attendee_id: c.attendeeId,
    zone: zone.id,
    floor: zone.floor,
    active: { gte: now.toISOString(), lt: addMinutes(now, c.minutes ?? STINT_MINUTES).toISOString() },
    interests,
    open_topics: openTopics,
    hint: openTopics.length ? (c.hint ?? "").slice(0, 80) || null : null,
    newcomer: !!newcomer,
    source: c.source ?? "live",
    created_at: now.toISOString(),
  };
  await es().index({ index: INDEX.stints, document: stint, refresh: "wait_for" });
  if (!c.skipTables) {
    if (prev && prev.stint.zone !== zone.id) await recomputeTables(prev.stint.zone, now);
    await recomputeTables(zone.id, now);
  }
  return stint;
}

export async function renew(attendeeId: string, now = new Date()): Promise<Stint | null> {
  const cur = await activeStint(attendeeId, now);
  if (!cur) return null;
  const active = { gte: cur.stint.active.gte, lt: addMinutes(now, STINT_MINUTES).toISOString() };
  await es().update({ index: INDEX.stints, id: cur.id, doc: { active }, refresh: "wait_for" });
  return { ...cur.stint, active };
}

export async function leave(attendeeId: string, now = new Date()): Promise<void> {
  const cur = await activeStint(attendeeId, now);
  if (!cur) return;
  await endStint(cur.id, cur.stint, now);
  await recomputeTables(cur.stint.zone, now);
}
