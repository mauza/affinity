// Map numbers. Every count is distinct attendees (cardinality) per zone, and
// passes through floorCount() so filtered counts below 3 read "a few".
import { es, INDEX } from "./es";
import { floorCount } from "./privacy";
import { activeAt } from "./presence";
import { dayBounds } from "./time";

export type Mode = "now" | "open" | "planned";
export type Filters = { interests: string[]; includeSim: boolean };

function filters(f: Filters, interestField = "interests"): any[] {
  const out: any[] = [];
  if (f.interests.length) out.push({ terms: { [interestField]: f.interests } });
  if (!f.includeSim) out.push({ term: { source: "live" } });
  return out;
}

const byZone = {
  zones: { terms: { field: "zone", size: 200 }, aggs: { people: { cardinality: { field: "attendee_id", precision_threshold: 3000 } } } },
};

function zoneCounts(aggs: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of aggs.zones.buckets) out[b.key] = floorCount(b.people.value);
  return out;
}

/** Per-zone counts at an instant. */
export async function snapshot(mode: Mode, f: Filters, at = new Date()): Promise<Record<string, number>> {
  if (mode === "planned") {
    const r: any = await es().search({
      index: INDEX.plans, size: 0,
      query: { bool: { filter: [activeAt("when", at), ...filters(f)] } },
      aggs: byZone,
    });
    return zoneCounts(r.aggregations);
  }
  const base = [activeAt("active", at)];
  // "Open to connect" filters on the topics people are open about.
  const extra = mode === "open"
    ? [{ exists: { field: "open_topics" } }, ...filters(f, "open_topics")]
    : filters(f);
  const r: any = await es().search({ index: INDEX.stints, size: 0, query: { bool: { filter: [...base, ...extra] } }, aggs: byZone });
  return zoneCounts(r.aggregations);
}

export type Series = { day: string; start: string; intervalMinutes: number; times: string[]; zones: Record<string, number[]>; peak: number };

/**
 * The murmuration: one query, terms(zone) -> date_histogram(range field) ->
 * cardinality. A stint counts in every bucket it overlaps, so any minute of
 * the day can be replayed without snapshots.
 */
export async function series(kind: "presence" | "planned", day: string, f: Filters, intervalMinutes = 5): Promise<Series> {
  const { start, end } = dayBounds(day);
  const field = kind === "planned" ? "when" : "active";
  const index = kind === "planned" ? INDEX.plans : INDEX.stints;
  const r: any = await es().search({
    index,
    size: 0,
    query: {
      bool: {
        filter: [
          { range: { [field]: { gte: start.toISOString(), lt: end.toISOString(), relation: "intersects" } } },
          ...filters(f),
        ],
      },
    },
    aggs: {
      zones: {
        terms: { field: "zone", size: 200 },
        aggs: {
          t: {
            date_histogram: {
              field,
              fixed_interval: `${intervalMinutes}m`,
              hard_bounds: { min: start.toISOString(), max: new Date(end.getTime() - 1).toISOString() },
              min_doc_count: 0,
            },
            aggs: { people: { cardinality: { field: "attendee_id", precision_threshold: 3000 } } },
          },
        },
      },
    },
  });
  const n = Math.round((end.getTime() - start.getTime()) / (intervalMinutes * 60_000));
  const times = Array.from({ length: n }, (_, i) => new Date(start.getTime() + i * intervalMinutes * 60_000).toISOString());
  const idx = new Map(times.map((t, i) => [new Date(t).getTime(), i]));
  const zones: Record<string, number[]> = {};
  let peak = 0;
  for (const z of r.aggregations.zones.buckets) {
    const arr = new Array(n).fill(0);
    for (const b of z.t.buckets) {
      const i = idx.get(b.key);
      if (i === undefined) continue;
      arr[i] = floorCount(b.people.value);
      peak = Math.max(peak, arr[i]);
    }
    zones[z.key] = arr;
  }
  return { day, start: start.toISOString(), intervalMinutes, times, zones, peak };
}

/** Distinct planned attendees per session (for crowd labels), optionally like-minded only. */
export async function plannedPerSession(sessionIds: string[], interests: string[] = []): Promise<Record<string, number>> {
  if (!sessionIds.length) return {};
  const filter: any[] = [{ terms: { session_id: sessionIds } }];
  if (interests.length) filter.push({ terms: { interests } });
  const r: any = await es().search({
    index: INDEX.plans, size: 0, query: { bool: { filter } },
    aggs: { s: { terms: { field: "session_id", size: sessionIds.length }, aggs: { people: { cardinality: { field: "attendee_id" } } } } },
  });
  const out: Record<string, number> = {};
  for (const b of r.aggregations.s.buckets) out[b.key] = b.people.value;
  return out;
}
