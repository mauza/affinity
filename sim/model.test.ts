import { describe, expect, it } from "vitest";
import { personas, rng, selectPlans, timeline } from "./model";
import { at, dayOf } from "../lib/time";
import { loadVenue } from "../lib/data";
const day = "2026-11-10";
describe("crowd model", () => {
  it("reproduces seeded personas with unique taxonomy interests", () => {
    expect(personas(42, 20)).toEqual(personas(42, 20));
    expect(personas(43, 20)).not.toEqual(personas(42, 20));
    for (const p of personas(42, 100)) {
      expect(new Set(p.interests).size).toBe(p.interests.length);
      expect(p.interests.length).toBeGreaterThanOrEqual(2);
      expect(p.interests.length).toBeLessThanOrEqual(5);
    }
  });
  it("selects matching, non-overlapping sessions outside meals", () => {
    const meal = loadVenue().meals.find((m) => m.day === day)!;
    for (const p of personas(42, 30)) {
      const plans = selectPlans(p, day, rng(42));
      expect(plans.length).toBeGreaterThanOrEqual(4);
      expect(plans.length).toBeLessThanOrEqual(7);
      plans.forEach((s, i) => {
        expect(s.service).toBe(false);
        expect(s.interests.some((t) => p.interests.includes(t))).toBe(true);
        expect(
          +new Date(s.ends_at) <= +at(day, meal.start) ||
            +new Date(s.starts_at) >= +at(day, meal.end),
        ).toBe(true);
        if (i)
          expect(+new Date(plans[i - 1].ends_at)).toBeLessThanOrEqual(
            +new Date(s.starts_at),
          );
      });
    }
  });
  it("keeps timelines contiguous, positive and within the requested day", () => {
    for (const p of personas(42, 30)) {
      const r = rng(42),
        stints = timeline(p, day, selectPlans(p, day, r), r);
      stints.forEach((s, i) => {
        expect(dayOf(s.active.gte)).toBe(day);
        expect(dayOf(s.active.lt)).toBe(day);
        expect(+new Date(s.active.lt)).toBeGreaterThan(+new Date(s.active.gte));
        if (i) expect(stints[i - 1].active.lt).toBe(s.active.gte);
        expect(s.source).toBe("sim");
        expect(s.open_topics.every((t) => p.interests.includes(t))).toBe(true);
      });
    }
  });
});
