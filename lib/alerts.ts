// Saved alerts are percolator queries ("tell me when 3+ people open for eBPF
// gather at lunch"). Every table create/update is percolated; each match
// writes one notification per alert per table (op_type=create), so an alert
// fires exactly once for a given table.
import { K_FLOOR } from "./config";
import { es, INDEX } from "./es";
import type { Table } from "./tables";

export type Alert = { id?: string; attendee_id: string; topic: string; zone: string | null; min_count: number; created_at: string };

export async function createAlert(a: { attendeeId: string; topic: string; zone?: string | null; minCount?: number }) {
  const min = Math.max(K_FLOOR, Math.min(50, Math.floor(a.minCount ?? K_FLOOR)));
  const filter: any[] = [{ term: { topic: a.topic } }, { term: { active: true } }, { range: { count: { gte: min } } }];
  if (a.zone) filter.push({ term: { zone: a.zone } });
  const doc = {
    attendee_id: a.attendeeId,
    topic: a.topic,
    zone: a.zone ?? null,
    min_count: min,
    query: { bool: { filter } },
    created_at: new Date().toISOString(),
  };
  const r = await es().index({ index: INDEX.alerts, document: doc, refresh: "wait_for" });
  return { id: r._id, ...doc };
}

export async function listAlerts(attendeeId: string) {
  const r = await es().search<any>({
    index: INDEX.alerts, size: 50, query: { term: { attendee_id: attendeeId } }, _source: { excludes: ["query"] },
  });
  return r.hits.hits.map((h) => ({ id: h._id, ...h._source }));
}

export async function deleteAlert(attendeeId: string, id: string) {
  await es().deleteByQuery({
    index: INDEX.alerts,
    query: { bool: { filter: [{ ids: { values: [id] } }, { term: { attendee_id: attendeeId } }] } },
    refresh: true,
  });
}

export async function percolateTable(t: Table) {
  const r = await es().search<any>({
    index: INDEX.alerts,
    size: 500,
    _source: ["attendee_id", "topic"],
    query: { percolate: { field: "query", document: { topic: t.topic, zone: t.zone, count: t.count, active: t.active, day: t.day } } },
  });
  for (const h of r.hits.hits) {
    try {
      await es().create({
        index: INDEX.notifications,
        id: `${h._id}:${t.id}`,
        document: {
          attendee_id: h._source.attendee_id,
          alert_id: h._id,
          table_id: t.id,
          message: JSON.stringify({ topic: t.topic, zone: t.zone, count: t.count, hint: t.hint }),
          read: false,
          created_at: new Date().toISOString(),
        },
        refresh: "wait_for",
      });
    } catch (e: any) {
      if (e?.meta?.statusCode !== 409) throw e;
    }
  }
}

export async function listNotifications(attendeeId: string) {
  const r = await es().search<any>({
    index: INDEX.notifications,
    size: 30,
    query: { term: { attendee_id: attendeeId } },
    sort: [{ created_at: "desc" }],
  });
  return r.hits.hits.map((h) => ({ id: h._id, ...h._source, message: JSON.parse(h._source.message) }));
}

export async function markRead(attendeeId: string) {
  await es().updateByQuery({
    index: INDEX.notifications,
    query: { bool: { filter: [{ term: { attendee_id: attendeeId } }, { term: { read: false } }] } },
    script: { source: "ctx._source.read = true" },
    refresh: true,
    conflicts: "proceed",
  });
}
