import { z } from "zod";
import { clearData, getProfile, saveProfile } from "@/lib/attendees";
import { body, INTEREST_ID, json, route } from "@/lib/http";
import { clearAttendeeCookie, currentAttendeeId, ensureAttendeeId } from "@/lib/identity";
import { interestsByIds } from "@/lib/search/interests";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const id = await currentAttendeeId();
  const p = id ? await getProfile(id) : null;
  if (!p) return json({ profile: null });
  const labels = await interestsByIds(p.interests);
  const { raw_text: _raw, ...pub } = p;
  return json({ profile: { ...pub, interestLabels: Object.fromEntries([...labels].map(([k, v]) => [k, v.label])) } });
});

const Profile = z.object({
  display_name: z.string().trim().max(40).nullable().optional(),
  public_name: z.boolean().optional(),
  newcomer: z.boolean().optional(),
  interests: z.array(INTEREST_ID).max(15).optional(),
  public_interests: z.array(INTEREST_ID).max(15).optional(),
  raw_text: z.string().max(1000).optional(),
});

export const PUT = route(async (req) => {
  const input = await body(req, Profile);
  const id = await ensureAttendeeId();
  if (input.interests) {
    const known = await interestsByIds(input.interests);
    input.interests = input.interests.filter((i) => known.has(i));
  }
  const p = await saveProfile(id, input);
  const { raw_text: _raw, ...pub } = p;
  return json({ profile: pub });
});

export const DELETE = route(async () => {
  const id = await currentAttendeeId();
  if (id) await clearData(id);
  await clearAttendeeCookie();
  return json({ ok: true });
});
