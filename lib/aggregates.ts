// Map numbers. Every count is distinct attendees (cardinality) per zone, and
// passes through floorCount() so filtered counts below 3 read "a few".
import type { estypes } from "@elastic/elasticsearch";
import { es, INDEX } from "./es";
import { floorCount } from "./privacy";
import { activeAt } from "./presence";
import { conferenceTopics, type ReplayTopic } from "./replay-topics";
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

export type Series = {
  day: string;
  start: string;
  intervalMinutes: number;
  times: string[];
  zones: Record<string, number[]>;
  peak: number;
  topics: ReplayTopic[];
  zoneTopics: Record<string, Record<string, number[]>>;
};

const SERIES_ZONE_LIMIT = 200;
// Stay below Elasticsearch's default search.max_buckets (65,536), including
// zone buckets, time buckets and every named topic filter bucket.
const SERIES_BUCKET_BUDGET = 60_000;
const SERIES_CONCURRENCY = 3;

/**
 * A stint counts in every time bucket it overlaps. Named topic filters let
 * attendees with several interests count once in each matching topic, while
 * cardinality deduplicates repeated check-ins within each zone/time/topic.
 */
export async function series(kind: "presence" | "planned", day: string, f: Filters, intervalMinutes = 5): Promise<Series> {
  const { start, end } = dayBounds(day);
  const field = kind === "planned" ? "when" : "active";
  const index = kind === "planned" ? INDEX.plans : INDEX.stints;
  const topics = kind === "presence" ? conferenceTopics() : [];
  const step = intervalMinutes * 60_000;
  const n = Math.ceil((end.getTime() - start.getTime()) / step);
  const times = Array.from({ length: n }, (_, i) => new Date(start.getTime() + i * step).toISOString());
  const idx = new Map(times.map((t, i) => [new Date(t).getTime(), i]));
  const zones: Record<string, number[]> = {};
  const zoneTopics: Series["zoneTopics"] = {};
  const people = { cardinality: { field: "attendee_id", precision_threshold: 3000 } };
  const topicAggs: Record<string, estypes.AggregationsAggregationContainer> = topics.length ? {
    topics: {
      filters: { filters: Object.fromEntries(topics.map(({ id }) => [id, { term: { interests: id } }])) },
      aggs: { people },
    },
  } : {};
  const chunkSize = Math.max(1, Math.floor((SERIES_BUCKET_BUDGET - SERIES_ZONE_LIMIT) / (SERIES_ZONE_LIMIT * (1 + topics.length))));
  const chunks = Array.from({ length: Math.ceil(n / chunkSize) }, (_, i) => i * chunkSize);
  let peak = 0;

  for (let batch = 0; batch < chunks.length; batch += SERIES_CONCURRENCY) {
    const results = await Promise.all(chunks.slice(batch, batch + SERIES_CONCURRENCY).map(async (from) => {
      const to = Math.min(from + chunkSize, n);
      const chunkStart = times[from];
      const chunkEnd = new Date(Math.min(start.getTime() + to * step, end.getTime())).toISOString();
      const r: any = await es().search({
        index,
        size: 0,
        query: {
          bool: {
            filter: [
              { range: { [field]: { gte: chunkStart, lt: chunkEnd, relation: "intersects" } } },
              ...filters(f),
            ],
          },
        },
        aggs: {
          zones: {
            terms: { field: "zone", size: SERIES_ZONE_LIMIT },
            aggs: {
              t: {
                date_histogram: {
                  field,
                  fixed_interval: `${intervalMinutes}m`,
                  // Keep every allowed interval aligned with local midnight.
                  offset: `${start.getTime() % step}ms`,
                  hard_bounds: { min: chunkStart, max: new Date(new Date(chunkEnd).getTime() - 1).toISOString() },
                  min_doc_count: 0,
                },
                aggs: { people, ...topicAggs },
              },
            },
          },
        },
      });
      return { from, to, aggregations: r.aggregations };
    }));

    for (const { from, to, aggregations } of results) {
      for (const z of aggregations.zones.buckets) {
        const arr = zones[z.key] ??= new Array(n).fill(0);
        if (topics.length) zoneTopics[z.key] ??= Object.fromEntries(topics.map(({ id }) => [id, new Array(n).fill(0)]));
        for (const b of z.t.buckets) {
          const i = idx.get(b.key);
          if (i === undefined || i < from || i >= to) continue;
          arr[i] = floorCount(b.people.value);
          peak = Math.max(peak, arr[i]);
          for (const { id } of topics) zoneTopics[z.key][id][i] = floorCount(b.topics.buckets[id]?.people.value ?? 0);
        }
      }
    }
  }
  return { day, start: start.toISOString(), intervalMinutes, times, zones, peak, topics, zoneTopics };
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
