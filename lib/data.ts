// Static event data committed to the repo: the schedule snapshot and the
// traced venue zones. Loaded once per process.
import { readFileSync } from "node:fs";
import path from "node:path";

export type Zone = {
  id: string;
  name: string;
  floor: string;
  kind: "session" | "meal" | "expo" | "lounge" | "hallway" | "quiet";
  rect: [number, number, number, number];
  roomIds: number[];
  parent?: string;
  note?: string;
};
export type Floor = { id: string; name: string; venue: string; viewBox: [number, number, number, number]; background?: { href: string; width: number; height: number; clip?: string } };
export type Venue = {
  source: string;
  floors: Floor[];
  zones: Zone[];
  facilities: { name: string; where: string; zone?: string }[];
  meals: { day: string; start: string; end: string; zone: string }[];
  excludedRoomIds: number[];
};
export type RawSession = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  roomId: number | null;
  categoryItems: number[];
  speakers: string[];
  isServiceSession: boolean;
  isPlenumSession: boolean;
};
export type Schedule = {
  source: string;
  fetchedAt: string;
  sessions: RawSession[];
  rooms: { id: number; name: string }[];
  categories: { id: number; title: string; items: { id: number; name: string; sort: number }[] }[];
  speakers: { id: string; fullName: string; tagLine: string }[];
};

const dataDir = () => path.join(process.env.AFFINITY_DATA_DIR ?? process.cwd(), "data");
let venue: Venue | undefined;
let schedule: Schedule | undefined;

export function loadVenue(): Venue {
  // Calibration changes should be visible without restarting the dev server.
  if (process.env.NODE_ENV === "development") return JSON.parse(readFileSync(path.join(dataDir(), "zones.json"), "utf8"));
  venue ??= JSON.parse(readFileSync(path.join(dataDir(), "zones.json"), "utf8"));
  return venue!;
}

export function loadSchedule(): Schedule {
  schedule ??= JSON.parse(readFileSync(path.join(dataDir(), "kcna26-schedule.json"), "utf8"));
  return schedule!;
}

let sessionTopics: Record<string, string[]> | undefined;

/** AI-assigned topic IDs per session (scripts/tag-sessions.ts); empty if absent. */
export function loadSessionTopics(): Record<string, string[]> {
  if (!sessionTopics) {
    try {
      sessionTopics = JSON.parse(readFileSync(path.join(dataDir(), "session-topics.json"), "utf8")).topics;
    } catch {
      sessionTopics = {};
    }
  }
  return sessionTopics!;
}

export function zoneById(id: string): Zone | undefined {
  return loadVenue().zones.find((z) => z.id === id);
}

export function zoneForRoom(roomId: number | null): Zone | undefined {
  if (roomId == null) return undefined;
  return loadVenue().zones.find((z) => z.roomIds.includes(roomId));
}
