import { listNotifications, markRead } from "@/lib/alerts";
import { json, route } from "@/lib/http";
import { currentAttendeeId } from "@/lib/identity";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const id = await currentAttendeeId();
  return json({ notifications: id ? await listNotifications(id) : [] });
});

export const POST = route(async () => {
  const id = await currentAttendeeId();
  if (id) await markRead(id);
  return json({ ok: true });
});
