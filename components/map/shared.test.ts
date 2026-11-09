import { describe, expect, it } from "vitest";
import { clock, colors, countLabel, heat } from "./shared";

describe("map presentation", () => {
  it("never displays a single attendee or a pair as an exact count", () => {
    expect([0, 1, 2, 3, 30].map(countLabel)).toEqual(["0", "a few", "a few", "3", "30"]);
  });
  it("keeps the replay comparison scale fixed at the supplied peak", () => {
    expect(heat(0, 100)).toBe(colors[0]);
    expect(heat(25, 100)).toBe(colors[1]);
    expect(heat(50, 100)).toBe(colors[2]);
    expect(heat(100, 100)).toBe(colors[4]);
    expect(heat(1000, 100)).toBe(colors[4]);
  });
  it("formats venue clocks in MST across UTC day boundaries", () => {
    expect(clock("2026-11-11T01:55:00Z")).toBe("18:55");
  });
});
