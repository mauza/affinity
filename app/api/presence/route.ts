import { z } from "zod";
import { body, INTEREST_ID, json, route } from "@/lib/http";
import { currentAttendeeId, ensureAttendeeId } from "@/lib/identity";
import { activeStint, checkIn, leave, renew } from "@/lib/presence";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const id = await currentAttendeeId();
  const cur = id ? await activeStint(id) : null;
  return json({ stint: cur?.stint ?? null });
});

const Action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("checkin"),
    zone: z.string().max(40),
    openTopics: z.array(INTEREST_ID).max(3).optional(),
    hint: z.string().trim().max(80).optional(),
  }),
  z.object({ action: z.literal("renew") }),
  z.object({ action: z.literal("leave") }),
]);

export const POST = route(async (req) => {
  const a = await body(req, Action);
  const id = await ensureAttendeeId();
  if (a.action === "checkin") return json({ stint: await checkIn({ attendeeId: id, zone: a.zone, openTopics: a.openTopics, hint: a.hint }) });
  if (a.action === "renew") return json({ stint: await renew(id) });
  await leave(id);
  return json({ stint: null });
});
