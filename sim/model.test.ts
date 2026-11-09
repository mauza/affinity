import { describe, expect, it } from "vitest";
import { personas, rng, selectPlans, timeline } from "./model";
import { at, dayOf } from "../lib/time";
import { loadVenue } from "../lib/data";
import { conferenceTopics } from "../lib/replay-topics";
const day = "2026-11-10";
describe("crowd model", () => {
  it("reproduces seeded personas with unique taxonomy interests", () => {
    expect(personas(42, 20)).toEqual(personas(42, 20));
    expect(personas(43, 20)).not.toEqual(personas(42, 20));
    for (const p of personas(42, 100)) {
      expect(new Set(p.interests).size).toBe(p.interests.length);
      expect(p.interests.length).toBeGreaterThanOrEqual(2);
      expect(p.interests.length).toBeLessThanOrEqual(5);
      expect(p.interests.every(id => conferenceTopics().some(t => t.id === id))).toBe(true);
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
  it("makes Monday intermittent, grounded in Hyatt lightning talks, and clear at lunch", () => {
    const monday = "2026-11-09";
    const people = personas(42, 160);
    const all = people.map(p => {
      const r = rng(42 + Number(p.id.split("-").at(-1)) * 7919);
      const plans = selectPlans(p, monday, r);
      return timeline(p, monday, plans, r);
    });
    const stints = all.flat();
    expect(stints.length).toBeGreaterThan(160);
    expect(stints.filter(s => s.floor.startsWith("hy")).length / stints.length).toBeGreaterThan(0.6);
    expect(stints.some(s => s.zone === "regency-cd")).toBe(true);
    expect(stints.some(s => s.zone === "hall-de")).toBe(false);
    expect(stints.filter(s => s.zone === "regency-cd" && +new Date(s.active.gte) <= +at(monday, "12:50") && +new Date(s.active.lt) > +at(monday, "12:50"))).toHaveLength(0);
    expect(all.filter(visits => visits.some((s, i) => i > 0 && +new Date(s.active.gte) - +new Date(visits[i - 1].active.lt) >= 15 * 60000)).length).toBeGreaterThan(40);
    for (const visits of all) for (const [i, s] of visits.entries()) {
      expect(dayOf(s.active.gte)).toBe(monday);
      expect(+new Date(s.active.lt)).toBeGreaterThan(+new Date(s.active.gte));
      expect(loadVenue().zones.some(z => z.id === s.zone)).toBe(true);
      if (i) expect(+new Date(s.active.gte)).toBeGreaterThanOrEqual(+new Date(visits[i - 1].active.lt));
    }
  });
});
