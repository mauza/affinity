import { z } from "zod";
import { createAlert, deleteAlert, listAlerts } from "@/lib/alerts";
import { body, INTEREST_ID, json, params, route } from "@/lib/http";
import { currentAttendeeId, ensureAttendeeId } from "@/lib/identity";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const id = await currentAttendeeId();
  return json({ alerts: id ? await listAlerts(id) : [] });
});

export const POST = route(async (req) => {
  const a = await body(req, z.object({ topic: INTEREST_ID, zone: z.string().max(40).nullable().optional(), minCount: z.number().int().min(3).max(50).optional() }));
  const id = await ensureAttendeeId();
  if ((await listAlerts(id)).length >= 10) return json({ error: "at most 10 alerts" }, 400);
  return json({ alert: await createAlert({ attendeeId: id, ...a }) });
});

export const DELETE = route(async (req) => {
  const id = await currentAttendeeId();
  const alertId = z.string().max(64).parse(params(req).get("id"));
  if (id) await deleteAlert(id, alertId);
  return json({ ok: true });
});
