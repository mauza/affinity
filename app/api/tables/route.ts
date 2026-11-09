import { z } from "zod";
import { body, DAY, includeSim, json, params, route } from "@/lib/http";
import { ensureAttendeeId } from "@/lib/identity";
import { activeStint } from "@/lib/presence";
import { listTables, setHint } from "@/lib/tables";
import { dayOf } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const p = params(req);
  const day = DAY.parse(p.get("day") ?? dayOf(new Date()));
  const tables = await listTables({ day, activeOnly: p.get("all") !== "1", includeSim: includeSim(req), zone: p.get("zone") ?? undefined });
  // Inactive (dissolved) tables keep their topic and time, not their count.
  return json({ tables: tables.map((t) => ({ ...t, count: t.active ? t.count : 0 })) });
});

/** Anyone checked in to the table's zone can update its meetup hint. */
export const POST = route(async (req) => {
  const { id, hint } = await body(req, z.object({ id: z.string().max(140), hint: z.string().trim().max(80) }));
  const me = await ensureAttendeeId();
  const cur = await activeStint(me);
  const zone = id.split(":")[1];
  if (!cur || cur.stint.zone !== zone) return json({ error: "check in to this zone first" }, 403);
  await setHint(id, hint);
  return json({ ok: true });
});
