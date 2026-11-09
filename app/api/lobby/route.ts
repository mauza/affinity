import { snapshot } from "@/lib/aggregates";
import { includeSim, json, route } from "@/lib/http";
import { trending } from "@/lib/insights";
import { listTables } from "@/lib/tables";
import { dayOf } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Everything the hallway screen needs in one poll. Aggregates and topics only, never names. */
export const GET = route(async (req) => {
  const now = new Date();
  const f = { interests: [], includeSim: includeSim(req) };
  const [counts, open, tables, trend] = await Promise.all([
    snapshot("now", f, now),
    snapshot("open", f, now),
    listTables({ day: dayOf(now), includeSim: f.includeSim }),
    trending(now, f.includeSim),
  ]);
  return json({
    at: now.toISOString(),
    counts,
    open,
    tables: tables.map(({ id, zone, topic, count, newcomer_count, hint, sources }) => ({ id, zone, topic, count, newcomer_count, hint, sources })),
    trending: trend,
  });
});
