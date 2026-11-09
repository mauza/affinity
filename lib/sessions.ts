// Turn the raw schedule snapshot into `sessions` docs.
import { loadSchedule, loadSessionTopics, zoneForRoom, type Schedule } from "./data";
import { categoryIndex, type Interest } from "./taxonomy";
import { dayOf, mst } from "./time";

export type SessionDoc = {
  id: string;
  title: string;
  abstract: string;
  when: { gte: string; lt: string };
  starts_at: string;
  ends_at: string;
  day: string;
  room_id: string;
  room: string;
  zone: string | null;
  floor: string | null;
  interests: string[];
  level: string | null;
  speakers: string;
  url: string;
  service: boolean;
  semantic: string;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/div)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// Registration, breaks, coat check and the like: on the map, not in the planner.
const SERVICE_CATEGORIES = new Set(["Registration", "Breaks"]);

export function buildSessions(interests: Interest[], schedule: Schedule = loadSchedule()): SessionDoc[] {
  const aiTopics = loadSessionTopics();
  const known = new Set(interests.map((i) => i.id));
  const rooms = new Map(schedule.rooms.map((r) => [r.id, r.name]));
  const speakers = new Map(schedule.speakers.map((p) => [p.id, p.fullName]));
  const catToInterest = categoryIndex(interests);
  const catName = new Map<number, { group: string; name: string }>();
  for (const g of schedule.categories) for (const i of g.items) catName.set(i.id, { group: g.title, name: i.name });

  return schedule.sessions.map((s) => {
    const zone = zoneForRoom(s.roomId);
    const cats = s.categoryItems.map((c) => catName.get(c)).filter(Boolean) as { group: string; name: string }[];
    const abstract = htmlToText(s.description);
    const speakerNames = s.speakers.map((id) => speakers.get(id)).filter(Boolean).join(", ");
    return {
      id: s.id,
      title: s.title,
      abstract,
      when: { gte: mst(s.startsAt), lt: mst(s.endsAt) },
      starts_at: mst(s.startsAt),
      ends_at: mst(s.endsAt),
      day: dayOf(mst(s.startsAt)),
      room_id: String(s.roomId ?? ""),
      room: rooms.get(s.roomId ?? -1) ?? "",
      zone: zone?.id ?? null,
      floor: zone?.floor ?? null,
      // Schedule categories plus AI-assigned topics (only known taxonomy IDs).
      interests: [
        ...new Set([
          ...(s.categoryItems.map((c) => catToInterest.get(c)).filter(Boolean) as string[]),
          ...(aiTopics[s.id] ?? []).filter((t) => known.has(t)),
        ]),
      ],
      level: cats.find((c) => c.group === "Audience Level")?.name ?? null,
      speakers: speakerNames,
      url: `${schedule.source}?id=${s.id}`,
      service: s.isServiceSession || cats.some((c) => SERVICE_CATEGORIES.has(c.name)) || !s.speakers.length && !abstract,
      semantic: `${s.title}\n${abstract}`.slice(0, 6000),
    };
  });
}
