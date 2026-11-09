import { describe, expect, it } from "vitest";
import { loadSchedule, loadSessionTopics } from "./data";
import { buildSessions } from "./sessions";
import { buildTaxonomy } from "./taxonomy";

describe("committed session enrichment", () => {
  const schedule = loadSchedule();
  const taxonomy = buildTaxonomy(schedule);
  const known = new Set(taxonomy.map((i) => i.id));
  const topics = loadSessionTopics();
  const sessions = buildSessions(taxonomy, schedule);

  it("covers every non-service session using only real taxonomy IDs", () => {
    for (const s of sessions.filter((s) => !s.service)) {
      expect(topics[s.id]?.length, s.title).toBeGreaterThan(0);
      expect(topics[s.id].length).toBeLessThanOrEqual(4);
      for (const id of topics[s.id]) expect(known.has(id), id).toBe(true);
    }
  });

  it("preserves schedule tags and merges enrichment without duplicates", () => {
    for (const s of sessions) {
      const raw = schedule.sessions.find((r) => r.id === s.id)!;
      for (const i of taxonomy.filter((i) => i.categoryIds.some((id) => raw.categoryItems.includes(id)))) {
        expect(s.interests).toContain(i.id);
      }
      for (const id of topics[s.id] ?? []) expect(s.interests).toContain(id);
      expect(new Set(s.interests).size).toBe(s.interests.length);
    }
  });
});
