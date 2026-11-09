import { series } from "../lib/aggregates";
import { es, INDEX } from "../lib/es";
import { at } from "../lib/time";

async function main() {
  const day = process.env.SIM_DAY ?? "2026-11-10";
  const replay = await series("presence", day, {
    interests: [],
    includeSim: true,
  });
  const samples = Object.fromEntries(
    ["09:15", "11:00", "13:30", "16:00"].map((time) => {
      const i = replay.times.indexOf(at(day, time).toISOString());
      return [
        time,
        Object.fromEntries(
          Object.entries(replay.zones)
            .map(([zone, values]) => [zone, values[i]])
            .filter(([, n]) => Number(n) > 0)
            .sort((a, b) => Number(b[1]) - Number(a[1])),
        ),
      ];
    }),
  );
  const tables = await es().search({
    index: INDEX.tables,
    size: 200,
    query: {
      bool: { filter: [{ term: { day } }, { term: { sources: "sim" } }] },
    },
  });
  const plans: any = await es().search({
    index: INDEX.plans,
    size: 0,
    query: {
      bool: { filter: [{ term: { day } }, { term: { source: "sim" } }] },
    },
    aggs: { sessions: { terms: { field: "session_id", size: 1000 } } },
  });
  console.log(
    JSON.stringify(
      {
        day,
        peak: replay.peak,
        samples,
        tables: tables.hits.hits.map((h) => h._source),
        plansPerSession: plans.aggregations.sessions.buckets,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
