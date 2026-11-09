import { describe, expect, it } from "vitest";
import { enforce } from "./planner";

const s = (id: string, start: string, end: string, day = "2026-11-10") => ({
  id, day, starts_at: `${day}T${start}:00-07:00`, ends_at: `${day}T${end}:00-07:00`,
});

describe("planner constraints", () => {
  it("drops overlaps, meal clashes and other days, keeping preference order", () => {
    const picks = [
      s("a", "11:00", "11:30"),
      s("b", "11:15", "11:45"), // overlaps a
      s("c", "13:00", "13:30"), // Tuesday lunch 12:50-14:50
      s("d", "15:00", "15:30"),
      s("e", "09:00", "09:30", "2026-11-11"),
      s("f", "12:20", "12:50"), // ends exactly when lunch starts
    ];
    expect(enforce(picks, "2026-11-10").map((p) => p.id)).toEqual(["a", "f", "d"]);
  });
  it("caps the number of sessions", () => {
    const many = Array.from({ length: 12 }, (_, i) => s(`x${i}`, `${String(8 + i).padStart(2, "0")}:00`, `${String(8 + i).padStart(2, "0")}:30`));
    expect(enforce(many, "2026-11-10", 5)).toHaveLength(5);
  });
});
