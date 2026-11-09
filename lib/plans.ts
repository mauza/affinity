// Accepted sessions become `plans` docs (one per attendee+session) with an
// interest snapshot; they drive planned mode and other people's crowd labels.
import { es, INDEX } from "./es";
import { sessionsByIds } from "./search/sessions";

export async function addPlans(
  attendeeId: string,
  sessionIds: string[],
  snapshot: { interests: string[]; newcomer: boolean },
  source: "live" | "sim" = "live",
) {
  const sessions = await sessionsByIds([...new Set(sessionIds)].slice(0, 30));
  const ops = [...sessions.values()].flatMap((s) => [
    { index: { _index: INDEX.plans, _id: `${attendeeId}:${s.id}` } },
    {
      attendee_id: attendeeId, session_id: s.id, when: s.when, day: s.day, zone: s.zone,
      interests: snapshot.interests, newcomer: snapshot.newcomer, source, created_at: new Date().toISOString(),
    },
  ]);
  if (ops.length) await es().bulk({ operations: ops, refresh: "wait_for" });
  return sessions.size;
}

export async function myPlans(attendeeId: string, day?: string) {
  const filter: any[] = [{ term: { attendee_id: attendeeId } }];
  if (day) filter.push({ term: { day } });
  const r: any = await es().search({ index: INDEX.plans, size: 100, query: { bool: { filter } }, _source: ["session_id"] });
  const ids = r.hits.hits.map((h: any) => h._source.session_id);
  const sessions = await sessionsByIds(ids);
  return [...sessions.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function removePlan(attendeeId: string, sessionId: string) {
  await es().delete({ index: INDEX.plans, id: `${attendeeId}:${sessionId}`, refresh: "wait_for" }, { ignore: [404] });
}
