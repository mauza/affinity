import { describe, expect, it } from "vitest";
import { particleFill, roomParticles, topicParticleWeight } from "./topic-particles";

describe("topic replay particles", () => {
  it("never turns a privacy floor into one or two countable circles", () => {
    for (const n of [0, 1, 2]) for (const slot of [0, 1, 2]) expect(particleFill(n, slot, 1)).toBe(0);
    expect([0, 1, 2, 3].map(slot => particleFill(3, slot, 1))).toEqual([1, 1, 1, 0]);
  });
  it("uses one stable, bounded scale across times and rooms", () => {
    const weight = topicParticleWeight({ a: { t: [1, 4, 8000] }, b: { t: [24, 0, 3] } });
    expect(weight).toBe(25);
    expect(particleFill(30, 0, weight)).toBe(1);
    expect(particleFill(30, 1, weight)).toBeCloseTo(.2);
    expect(particleFill(30, 2, weight)).toBe(0);
    expect(roomParticles("a", [0, 0, 100, 80], { t: [1, 4, 8000] }, weight)).toHaveLength(320);
  });
  it("keeps deterministic circles and few glyphs inside even narrow rooms, away from center labels", () => {
    const topics = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`topic-${i}`, [24]]));
    for (const rect of [[10, 20, 100, 80], [9, 8, 7, 40], [0, 0, 22, 16]]) {
      const particles = roomParticles("room", rect, topics);
      expect(particles).toEqual(roomParticles("room", rect, topics));
      expect(particles).toHaveLength(288);
      const [x, y, w, h] = rect;
      for (const p of particles) {
        // The fixed few glyph extends slightly beyond the radius of a full circle.
        expect(p.x - p.radius * 1.05).toBeGreaterThanOrEqual(x);
        expect(p.x + p.radius * 1.05).toBeLessThanOrEqual(x + w);
        expect(p.y - p.radius * 1.05).toBeGreaterThanOrEqual(y);
        expect(p.y + p.radius * 1.05).toBeLessThanOrEqual(y + h);
        expect(p.x + p.radius > x + w * .25 && p.x - p.radius < x + w * .75 && p.y + p.radius > y + h * .4 && p.y - p.radius < y + h * .6).toBe(false);
      }
    }
  });
});
