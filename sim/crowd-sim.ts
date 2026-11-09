import { es, INDEX } from "../lib/es";
import { loadVenue } from "../lib/data";
import { at, dayBounds } from "../lib/time";
import { checkIn, renew, leave } from "../lib/presence";
import { recomputeTables } from "../lib/tables";
import { personas, rng, selectPlans, timeline } from "./model";

function integer(name: string, fallback: number, min = 0) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min)
    throw new Error(`invalid ${name}`);
  return value;
}
async function bulk(operations: object[]) {
  for (let i = 0; i < operations.length; i += 1000) {
    const result = await es().bulk({
      operations: operations.slice(i, i + 1000),
    });
    if (result.errors)
      throw new Error(
        `bulk failed: ${JSON.stringify(result.items.filter((i) => i.index?.error).slice(0, 3))}`,
      );
  }
}
export async function reset(day?: string) {
  const bounds = day ? dayBounds(day) : undefined;
  for (const index of [
    INDEX.plans,
    INDEX.stints,
    INDEX.attendees,
    INDEX.tables,
  ]) {
    const filter: any[] =
      index === INDEX.tables
        ? [{ term: { sources: "sim" } }]
        : [{ term: { source: "sim" } }];
    if ((day && index === INDEX.plans) || (day && index === INDEX.tables))
      filter.push({ term: { day } });
    if (bounds && index === INDEX.stints)
      filter.push({
        range: {
          active: {
            gte: bounds.start.toISOString(),
            lt: bounds.end.toISOString(),
            relation: "intersects",
          },
        },
      });
    await es().deleteByQuery({
      index,
      conflicts: "proceed",
      refresh: true,
      query: {
        bool: {
          filter,
          must_not:
            index === INDEX.tables ? [{ term: { sources: "live" } }] : [],
        },
      },
    });
  }
  if (!day)
    await es().deleteByQuery({
      index: [INDEX.alerts, INDEX.notifications],
      conflicts: "proceed",
      refresh: true,
      query: { prefix: { attendee_id: "sim-" } },
    });
}
async function main() {
  const started = Date.now(),
    mode = process.env.SIM_MODE ?? "backfill",
    day = process.env.SIM_DAY ?? "2026-11-10";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(+at(day, "00:00")))
    throw new Error("invalid SIM_DAY");
  if (mode === "reset") {
    await reset();
    console.log("reset complete (sim only)");
    return;
  }
  if (!["backfill", "live"].includes(mode)) throw new Error("invalid SIM_MODE");
  const seed = integer("SIM_SEED", 42),
    people = personas(seed, integer("SIM_PEOPLE", 600, 1));
  const shards = integer("SIM_SHARDS", 1, 1);
  const suffix =
    process.env.JOB_COMPLETION_INDEX ??
    process.env.HOSTNAME?.match(/-(\d+)$/)?.[1];
  const shard = integer("SIM_SHARD", suffix ? Number(suffix) % shards : 0);
  if (shard >= shards)
    throw new Error("SIM_SHARD must be less than SIM_SHARDS");
  const owned =
    mode === "live" ? people.filter((_, n) => n % shards === shard) : people;
  if (mode === "backfill") await reset(day);
  const now = new Date().toISOString();
  await bulk(
    owned.flatMap((p) => [
      { index: { _index: INDEX.attendees, _id: p.id } },
      {
        id: p.id,
        display_name: p.publicName
          ? `Sim attendee ${p.id.split("-").at(-1)}`
          : null,
        public_name: p.publicName,
        newcomer: p.newcomer,
        interests: p.interests,
        public_interests: p.publicName ? p.interests.slice(0, 2) : [],
        source: "sim",
        created_at: now,
        updated_at: now,
      },
    ]),
  );
  const schedules = owned.map((p) => {
    const r = rng(seed + Number(p.id.split("-").at(-1)) * 7919);
    const plans = selectPlans(p, day, r);
    return { p, plans, stints: timeline(p, day, plans, r) };
  });
  if (mode === "backfill") {
    for (const { p, plans, stints } of schedules)
      await bulk([
        ...plans.flatMap((s) => [
          { index: { _index: INDEX.plans, _id: `${p.id}:${s.id}` } },
          {
            attendee_id: p.id,
            session_id: s.id,
            when: s.when,
            day,
            zone: s.zone,
            interests: p.interests,
            newcomer: p.newcomer,
            source: "sim",
            created_at: now,
          },
        ]),
        ...stints.flatMap((s, n) => [
          { index: { _index: INDEX.stints, _id: `${p.id}:${day}:${n}` } },
          s,
        ]),
      ]);
    await es().indices.refresh({
      index: [INDEX.attendees, INDEX.plans, INDEX.stints],
    });
    const meal = loadVenue().meals.find((m) => m.day === day);
    const zones = [
      "halls-15",
      "cosmic-canyon",
      "alpine-overlook",
      "honeycomb-hub",
      ...(meal ? [meal.zone] : []),
    ];
    for (let t = +at(day, "09:30"); t <= +at(day, "19:00"); t += 10 * 60000) {
      await Promise.all(
        zones.map((zone) => recomputeTables(zone, new Date(t))),
      );
    }
    console.log(
      JSON.stringify({
        mode,
        day,
        people: owned.length,
        plans: schedules.reduce((n, s) => n + s.plans.length, 0),
        stints: schedules.reduce((n, s) => n + s.stints.length, 0),
        seconds: (Date.now() - started) / 1000,
      }),
    );
    return;
  }
  const speed = Number(process.env.SIM_SPEED ?? 1);
  if (!Number.isFinite(speed) || speed <= 0)
    throw new Error("invalid SIM_SPEED");
  let stopping = false,
    moves = 0,
    renewals = 0,
    departures = 0;
  const stop = () => {
    stopping = true;
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  // Start at the actual wall clock, accelerate only schedule progression. Writes always use wall time.
  const wallStart = Date.now(),
    scheduleStart = +at(
      day,
      new Date(wallStart - 7 * 3600000).toISOString().slice(11, 16),
    );
  const state = schedules.map((s, n) => ({
    ...s,
    next: wallStart + (n % 20) * 1000,
    zone: "",
    finished: false,
  }));
  let logged = 0;
  while (!stopping) {
    const wall = Date.now(),
      simulated = scheduleStart + (wall - wallStart) * speed;
    let acted = 0;
    for (const s of state) {
      if (stopping) break;
      if (s.finished || s.next > wall) continue;
      if (acted++ === 5) break;
      const stint = s.stints.find(
        (t) =>
          +new Date(t.active.gte) <= simulated &&
          +new Date(t.active.lt) > simulated,
      );
      if (stint) {
        if (s.zone === stint.zone) {
          await renew(s.p.id, new Date());
          renewals++;
        } else {
          await checkIn({
            attendeeId: s.p.id,
            zone: stint.zone,
            openTopics: stint.open_topics,
            hint: stint.hint,
            now: new Date(),
            source: "sim",
            interests: s.p.interests,
            newcomer: s.p.newcomer,
          });
          s.zone = stint.zone;
          moves++;
        }
      } else if (s.zone) {
        await leave(s.p.id, new Date());
        s.zone = "";
        departures++;
      }
      if (simulated >= +new Date(s.stints.at(-1)!.active.lt)) s.finished = true;
      s.next = Date.now() + ((5 + (moves % 11)) * 60000) / speed;
    }
    if (wall - logged >= 60000) {
      console.log(
        JSON.stringify({
          mode,
          shard,
          people: owned.length,
          moves,
          renewals,
          departures,
        }),
      );
      logged = wall;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.log(
    JSON.stringify({ mode, stopped: true, moves, renewals, departures }),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
