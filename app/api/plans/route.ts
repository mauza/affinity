import { z } from "zod";
import { getProfile } from "@/lib/attendees";
import { body, DAY, json, params, route } from "@/lib/http";
import { currentAttendeeId, ensureAttendeeId } from "@/lib/identity";
import { addPlans, myPlans, removePlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const id = await currentAttendeeId();
  const day = params(req).get("day");
  return json({ sessions: id ? await myPlans(id, day ? DAY.parse(day) : undefined) : [] });
});

export const POST = route(async (req) => {
  const { sessionIds } = await body(req, z.object({ sessionIds: z.array(z.string().regex(/^\d{1,12}$/)).min(1).max(30) }));
  const id = await ensureAttendeeId();
  const p = await getProfile(id);
  const added = await addPlans(id, sessionIds, { interests: p?.interests ?? [], newcomer: p?.newcomer ?? false });
  return json({ added });
});

export const DELETE = route(async (req) => {
  const id = await currentAttendeeId();
  const session = z.string().regex(/^\d{1,12}$/).parse(params(req).get("session"));
  if (id) await removePlan(id, session);
  return json({ ok: true });
});
