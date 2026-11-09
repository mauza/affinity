import { es, INDEX } from "./es";

export type Profile = {
  id: string;
  display_name: string | null;
  public_name: boolean;
  newcomer: boolean;
  interests: string[];
  public_interests: string[];
  raw_text?: string;
  source: "live" | "sim";
  created_at: string;
  updated_at: string;
};

export async function getProfile(id: string): Promise<Profile | null> {
  const r: any = await es().get({ index: INDEX.attendees, id }, { ignore: [404] });
  return r.found ? (r._source as Profile) : null;
}

export async function saveProfile(
  id: string,
  p: Partial<Pick<Profile, "display_name" | "public_name" | "newcomer" | "interests" | "public_interests" | "raw_text">>,
  source: "live" | "sim" = "live",
): Promise<Profile> {
  const now = new Date().toISOString();
  const prev = await getProfile(id);
  const interests = p.interests ?? prev?.interests ?? [];
  const next: Profile = {
    id,
    display_name: p.display_name !== undefined ? p.display_name : prev?.display_name ?? null,
    public_name: p.public_name ?? prev?.public_name ?? false,
    newcomer: p.newcomer ?? prev?.newcomer ?? false,
    interests,
    // Public interests must be a subset of confirmed interests.
    public_interests: (p.public_interests ?? prev?.public_interests ?? []).filter((i) => interests.includes(i)),
    raw_text: p.raw_text ?? prev?.raw_text ?? "",
    source,
    created_at: prev?.created_at ?? now,
    updated_at: now,
  };
  await es().index({ index: INDEX.attendees, id, document: next, refresh: "wait_for" });
  return next;
}

/** "Clear my data": profile, plans, stints, alerts and notifications. */
export async function clearData(id: string) {
  await es().delete({ index: INDEX.attendees, id, refresh: true }, { ignore: [404] });
  await es().deleteByQuery({
    index: [INDEX.plans, INDEX.stints, INDEX.alerts, INDEX.notifications],
    query: { term: { attendee_id: id } },
    refresh: true,
    conflicts: "proceed",
  });
}
