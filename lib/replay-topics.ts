import { loadSchedule } from "./data";
import { buildTaxonomy } from "./taxonomy";

export type ReplayTopic = { id: string; label: string; color: string };

const COLORS = [
  "#38bdf8", "#f59e0b", "#f472b6", "#a3e635",
  "#2dd4bf", "#a78bfa", "#fb7185", "#22d3ee",
  "#facc15", "#818cf8", "#f87171", "#e879f9",
];

/** Only official main tracks belong in the public replay legend. */
export function conferenceTopics(): ReplayTopic[] {
  return buildTaxonomy(loadSchedule())
    .filter((interest) => interest.kind === "track")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, label }, i) => ({ id, label, color: COLORS[i % COLORS.length] }));
}
