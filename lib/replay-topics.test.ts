import { describe, expect, it } from "vitest";
import { loadSchedule } from "./data";
import { conferenceTopics } from "./replay-topics";
import { buildTaxonomy } from "./taxonomy";

describe("conference replay topics", () => {
  it("publishes only the twelve official main tracks with distinct stable colors", () => {
    const topics = conferenceTopics();
    const tracks = buildTaxonomy(loadSchedule()).filter((interest) => interest.kind === "track");

    expect(topics).toHaveLength(12);
    expect(topics.map(({ id }) => id).sort()).toEqual(tracks.map(({ id }) => id).sort());
    expect(topics.find(({ id }) => id === "inclusion-accessibility")).toBeDefined();
    expect(new Set(topics.map(({ color }) => color)).size).toBe(topics.length);
    for (const topic of topics) {
      expect(Object.keys(topic).sort()).toEqual(["color", "id", "label"]);
      expect(topic.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(topic.label).toBe(tracks.find(({ id }) => id === topic.id)?.label);
    }
    expect(conferenceTopics()).toEqual(topics);
  });
});
