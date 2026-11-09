import { z } from "zod";
import { getProfile } from "@/lib/attendees";
import { body, DAY, json, route } from "@/lib/http";
import { ensureAttendeeId } from "@/lib/identity";
import { planDay } from "@/lib/ai/planner";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const { day, text } = await body(req, z.object({ day: DAY, text: z.string().max(500).optional() }));
  const id = await ensureAttendeeId();
  const p = await getProfile(id);
  return json(await planDay({ day, text, interests: p?.interests ?? [], newcomer: p?.newcomer ?? false }));
});
