// Pop-up topic tables: whenever 3+ people checked in to the same zone are
// open to connect about the same topic, a table exists. Nobody owns it, many
// topics can share a zone, and it dissolves below 3 (staying in history).
// Recomputed on every stint write for the zones involved.
import { K_FLOOR } from "./config";
import { es, INDEX } from "./es";
import { percolateTable } from "./alerts";
import { activeAt } from "./presence";
import { dayOf } from "./time";
import { floorCount } from "./privacy";

export type Table = {
  id: string;
  day: string;
  zone: string;
  topic: string;
  count: number;
  newcomer_count: number;
  active: boolean;
  hint: string | null;
  first_seen: string;
  last_seen: string;
  sources: string[];
};

export const tableId = (day: string, zone: string, topic: string) => `${day}:${zone}:${topic}`;

export async function recomputeTables(zone: string, now = new Date()): Promise<Table[]> {
  const day = dayOf(now);
  const r: any = await es().search({
    index: INDEX.stints,
    size: 0,
    query: { bool: { filter: [{ term: { zone } }, activeAt("active", now), { exists: { field: "open_topics" } }] } },
    aggs: {
      topics: {
        terms: { field: "open_topics", size: 50 },
        aggs: {
          people: { cardinality: { field: "attendee_id" } },
          newcomers: { filter: { term: { newcomer: true } }, aggs: { people: { cardinality: { field: "attendee_id" } } } },
          sources: { terms: { field: "source", size: 2 } },
          hinted: {
            filter: { exists: { field: "hint" } },
            aggs: { first: { top_hits: { size: 1, sort: [{ created_at: "asc" }], _source: ["hint"] } } },
          },
        },
      },
    },
  });
  const existing = await es().search<Table>({
    index: INDEX.tables,
    size: 100,
    query: { bool: { filter: [{ term: { zone } }, { term: { day } }] } },
  });
  const prev = new Map(existing.hits.hits.map((h) => [h._source!.topic, h._source!]));
  const changed: Table[] = [];
  const seen = new Set<string>();

  for (const b of r.aggregations.topics.buckets) {
    const topic = b.key as string;
    const count = b.people.value as number;
    seen.add(topic);
    const old = prev.get(topic);
    const active = count >= K_FLOOR;
    if (!active && !old?.active) continue;
    const hintHit = b.hinted.first.hits.hits[0]?._source?.hint ?? null;
    const t: Table = {
      id: tableId(day, zone, topic),
      day,
      zone,
      topic,
      count,
      newcomer_count: b.newcomers.people.value,
      active,
      hint: old?.hint ?? hintHit,
      first_seen: old?.first_seen ?? now.toISOString(),
      last_seen: now.toISOString(),
      sources: b.sources.buckets.map((s: any) => s.key),
    };
    if (old && old.active === t.active && old.count === t.count && old.hint === t.hint) continue;
    changed.push(t);
  }
  for (const [topic, old] of prev) {
    if (!seen.has(topic) && old.active) changed.push({ ...old, active: false, count: 0, last_seen: now.toISOString() });
  }
  if (!changed.length) return [];
  await es().bulk({
    refresh: "wait_for",
    operations: changed.flatMap((t) => [{ index: { _index: INDEX.tables, _id: t.id } }, t]),
  });
  for (const t of changed) if (t.active) await percolateTable(t);
  return changed;
}

export async function setHint(id: string, hint: string) {
  await es().update({ index: INDEX.tables, id, doc: { hint: hint.slice(0, 80) || null }, refresh: "wait_for" });
}

export async function listTables(opts: { day?: string; activeOnly?: boolean; includeSim?: boolean; zone?: string }, now = new Date()) {
  const filter: any[] = [];
  if (opts.day) filter.push({ term: { day: opts.day } });
  if (opts.activeOnly !== false) filter.push({ term: { active: true } });
  if (opts.zone) filter.push({ term: { zone: opts.zone } });
  if (opts.includeSim === false) filter.push({ term: { sources: "live" } });
  const r = await es().search<Table>({
    index: INDEX.tables,
    size: 200,
    query: { bool: { filter } },
    sort: [{ active: "desc" }, { count: "desc" }, { last_seen: "desc" }],
  });
  const stored = r.hits.hits.map((h) => h._source!);
  if (!stored.length) return [];
  // Stored tables are discovery records. Recount active stints on read so
  // leases expire without a worker, and live-only never includes sim counts.
  const presence: any = await es().search({
    index: INDEX.stints, size: 0,
    query: { bool: { filter: [
      activeAt("active", now),
      { terms: { zone: [...new Set(stored.map((t) => t.zone))] } },
      { exists: { field: "open_topics" } },
      ...(opts.includeSim === false ? [{ term: { source: "live" } }] : []),
    ] } },
    aggs: { zones: { terms: { field: "zone", size: 200 }, aggs: {
      topics: { terms: { field: "open_topics", size: 200 }, aggs: {
        people: { cardinality: { field: "attendee_id" } },
        newcomers: { filter: { term: { newcomer: true } }, aggs: { people: { cardinality: { field: "attendee_id" } } } },
        sources: { terms: { field: "source", size: 2 } },
        hinted: { filter: { exists: { field: "hint" } }, aggs: {
          first: { top_hits: { size: 1, sort: [{ created_at: "asc" }], _source: ["hint"] } },
        } },
      } },
    } } },
  });
  const current = new Map<string, any>();
  for (const z of presence.aggregations.zones.buckets) {
    for (const topic of z.topics.buckets) current.set(`${z.key}:${topic.key}`, topic);
  }
  return stored.map((t) => {
    const bucket = t.day === dayOf(now) ? current.get(`${t.zone}:${t.topic}`) : undefined;
    const count = bucket?.people.value ?? 0;
    const active = count >= K_FLOOR;
    return {
      ...t, active, count: active ? floorCount(count) : 0,
      newcomer_count: active ? floorCount(bucket.newcomers.people.value) : 0,
      sources: bucket?.sources.buckets.map((s: any) => s.key) ?? [],
      hint: (opts.includeSim === false ? null : t.hint) ?? bucket?.hinted.first.hits.hits[0]?._source?.hint ?? null,
    };
  }).filter((t) => opts.activeOnly === false || t.active)
    .sort((a, b) => b.count - a.count);
}
