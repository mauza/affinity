// Elasticsearch-native insights via significant_terms. Every result needs at
// least K_FLOOR people behind it, so nothing here can single anyone out.
import { K_FLOOR } from "./config";
import { es, INDEX } from "./es";
import { addMinutes, dayBounds, dayOf } from "./time";

export type Insight = { interest: string; ratio: number; count: number };

const window = (from: Date, to: Date): any => ({
  range: { active: { gte: from.toISOString(), lte: to.toISOString(), relation: "intersects" } },
});
const simFilter = (includeSim: boolean) => (includeSim ? [] : [{ term: { source: "live" } }]);

function toInsights(agg: any, fgTotal: number, bgTotal: number): Insight[] {
  return (agg.buckets as any[])
    .filter((b) => b.doc_count >= K_FLOOR)
    .map((b) => ({
      interest: b.key,
      count: b.doc_count,
      ratio: Math.round(((b.doc_count / Math.max(1, fgTotal)) / Math.max(1e-9, b.bg_count / Math.max(1, bgTotal))) * 10) / 10,
    }))
    .filter((i) => i.ratio > 1.2)
    .slice(0, 5);
}

/** "Room 255 BC is 4x more into eBPF than the venue right now." */
export async function popularHere(zone: string, now = new Date(), includeSim = true): Promise<Insight[]> {
  const w = window(addMinutes(now, -60), now);
  const r: any = await es().search({
    index: INDEX.stints,
    size: 0,
    track_total_hits: true,
    query: { bool: { filter: [w, ...simFilter(includeSim)] } },
    aggs: {
      here: {
        filter: { term: { zone } },
        aggs: {
          people: { cardinality: { field: "attendee_id" } },
          sig: { significant_terms: { field: "interests", min_doc_count: K_FLOOR, size: 5, background_filter: { bool: { filter: [w, ...simFilter(includeSim)] } } } },
        },
      },
    },
  });
  const here = r.aggregations.here;
  if (here.people.value < K_FLOOR) return [];
  return toInsights(here.sig, here.doc_count, r.hits.total.value);
}

/** "People like you also go to Observability": adjacent interests you didn't pick. */
export async function overlap(mine: string[], includeSim = true): Promise<Insight[]> {
  if (!mine.length) return [];
  const r: any = await es().search({
    index: INDEX.attendees,
    size: 0,
    track_total_hits: true,
    query: { bool: { filter: simFilter(includeSim) } },
    aggs: {
      like: {
        filter: { terms: { interests: mine } },
        aggs: { sig: { significant_terms: { field: "interests", min_doc_count: K_FLOOR, size: 10, exclude: mine } } },
      },
    },
  });
  return toInsights(r.aggregations.like.sig, r.aggregations.like.doc_count, r.hits.total.value);
}

/** Trending: the last 30 minutes vs the day so far. */
export async function trending(now = new Date(), includeSim = true): Promise<Insight[]> {
  const { start } = dayBounds(dayOf(now));
  const recent = window(addMinutes(now, -30), now);
  const r: any = await es().search({
    index: INDEX.stints,
    size: 0,
    track_total_hits: true,
    query: { bool: { filter: [window(start, now), ...simFilter(includeSim)] } },
    aggs: {
      recent: {
        filter: recent,
        aggs: { sig: { significant_terms: { field: "interests", min_doc_count: K_FLOOR, size: 6 } } },
      },
    },
  });
  return toInsights(r.aggregations.recent.sig, r.aggregations.recent.doc_count, r.hits.total.value);
}
