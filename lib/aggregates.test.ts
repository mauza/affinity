import { beforeEach, describe, expect, it, vi } from "vitest";
import { series } from "./aggregates";
import { conferenceTopics } from "./replay-topics";
import { dayBounds } from "./time";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("./es", () => ({ es: () => ({ search }), INDEX: { stints: "stints", plans: "plans" } }));
vi.mock("./presence", () => ({ activeAt: vi.fn() }));

const DAY = "2026-11-10";
const { start, end } = dayBounds(DAY);
const topics = conferenceTopics();
const [first, second] = topics;
const empty = () => ({ aggregations: { zones: { buckets: [] } } });

function bucket(key: number, people: number, topicCounts: Record<string, number>) {
  return {
    key,
    // Raw document counts can exceed distinct attendees and must never be used.
    doc_count: 100,
    people: { value: people },
    topics: { buckets: Object.fromEntries(Object.entries(topicCounts).map(([id, value]) => [id, { doc_count: 100, people: { value } }])) },
  };
}

beforeEach(() => {
  search.mockReset();
  search.mockImplementation(empty);
});

describe("murmuration series", () => {
  it("floors distinct attendee counts and zero-pads every canonical topic on the shared time grid", async () => {
    search.mockImplementation((request) => {
      const min = request.aggs.zones.aggs.t.date_histogram.hard_bounds.min;
      if (min === start.toISOString()) return {
        hits: { hits: [{ _id: "private-attendee", _source: { raw_text: "private words", name: "Private Name" } }] },
        aggregations: { zones: { buckets: [{
          key: "room-a",
          t: { buckets: [
            bucket(start.getTime(), 2, { [first.id]: 2, [second.id]: 1, "private-custom": 20 }),
            bucket(start.getTime() + 10 * 60_000, 7, { [first.id]: 3, [second.id]: 4 }),
            bucket(new Date(request.aggs.zones.aggs.t.date_histogram.hard_bounds.max).getTime() + 1, 50, { [first.id]: 50 }),
            bucket(end.getTime(), 50, { [first.id]: 50 }),
          ] },
        }] } },
      };
      const max = new Date(request.aggs.zones.aggs.t.date_histogram.hard_bounds.max).getTime();
      if (max === end.getTime() - 1) return {
        aggregations: { zones: { buckets: [
          { key: "room-b", t: { buckets: [bucket(end.getTime() - 5 * 60_000, 1, { [first.id]: 1 })] } },
          { key: "room-a", t: { buckets: [bucket(end.getTime() - 5 * 60_000, 3, { [first.id]: 2 })] } },
        ] } },
      };
      return empty();
    });

    const result = await series("presence", DAY, { interests: [], includeSim: true });

    expect(result).toMatchObject({ day: DAY, start: start.toISOString(), intervalMinutes: 5, peak: 7, topics });
    expect(result.times).toHaveLength(288);
    expect(result.times.at(-1)).toBe(new Date(end.getTime() - 5 * 60_000).toISOString());
    expect(result.zones["room-a"].slice(0, 4)).toEqual([1, 0, 7, 0]);
    expect(result.zones["room-a"].at(-1)).toBe(3);
    expect(result.zones["room-b"].at(-1)).toBe(1);
    expect(result.zoneTopics["room-a"][first.id].slice(0, 4)).toEqual([1, 0, 3, 0]);
    expect(result.zoneTopics["room-a"][second.id].slice(0, 4)).toEqual([1, 0, 4, 0]);
    expect(result.zoneTopics["room-a"][first.id].at(-1)).toBe(1);
    expect(result.zoneTopics["room-b"][first.id].at(-1)).toBe(1);
    for (const zone of Object.keys(result.zones)) {
      expect(Object.keys(result.zoneTopics[zone])).toEqual(topics.map(({ id }) => id));
      for (const counts of Object.values(result.zoneTopics[zone])) {
        expect(counts).toHaveLength(result.times.length);
        expect(counts).not.toContain(2);
      }
    }
    expect(result.zoneTopics["room-a"][topics[2].id].every((n) => n === 0)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/private-attendee|private words|Private Name|private-custom/);
  });

  it("uses independent interest filters and attendee cardinality beneath each zone and time bucket", async () => {
    await series("presence", DAY, { interests: [first.id, second.id], includeSim: false });

    for (const [request] of search.mock.calls) {
      expect(request.index).toBe("stints");
      expect(request.size).toBe(0);
      expect(request.query.bool.filter).toEqual(expect.arrayContaining([
        { terms: { interests: [first.id, second.id] } },
        { term: { source: "live" } },
      ]));
      const histogram = request.aggs.zones.aggs.t;
      expect(histogram.aggs.people.cardinality).toMatchObject({ field: "attendee_id" });
      expect(histogram.aggs.topics.filters.filters).toEqual(Object.fromEntries(topics.map(({ id }) => [id, { term: { interests: id } }])));
      expect(histogram.aggs.topics.aggs.people.cardinality).toMatchObject({ field: "attendee_id" });
      expect(JSON.stringify(request)).not.toMatch(/raw_text|open_topics|attendees/);
    }
  });

  it("bounds requests below the bucket limit and partitions the half-open MST day without gaps", async () => {
    await series("presence", DAY, { interests: [], includeSim: true });

    const requests = search.mock.calls.map(([request]) => request);
    expect(requests.length).toBeGreaterThan(1);
    expect(requests.length).toBeLessThanOrEqual(14);
    let next = start.getTime();
    for (const request of requests) {
      const zone = request.aggs.zones;
      const histogram = zone.aggs.t;
      const bounds = histogram.date_histogram.hard_bounds;
      const min = new Date(bounds.min).getTime();
      const max = new Date(bounds.max).getTime();
      const timeBuckets = Math.ceil((max + 1 - min) / (5 * 60_000));
      const topicBuckets = Object.keys(histogram.aggs.topics.filters.filters).length;
      // Include parent zone/time buckets, and allow every requested zone.
      expect(zone.terms.size * (1 + timeBuckets * (1 + topicBuckets))).toBeLessThanOrEqual(60_000);
      expect(98 * (1 + timeBuckets * (1 + topicBuckets))).toBeLessThan(65_536);
      expect(min).toBe(next);
      expect(request.query.bool.filter).toEqual([
        { range: { active: { gte: bounds.min, lt: new Date(max + 1).toISOString(), relation: "intersects" } } },
      ]);
      next = max + 1;
    }
    expect(next).toBe(end.getTime());
  });

  it("aligns non-divisor intervals to midnight and preserves the final partial bucket", async () => {
    const result = await series("presence", DAY, { interests: [], includeSim: true }, 22);

    expect(result.times).toHaveLength(66);
    expect(result.times[0]).toBe(start.toISOString());
    expect(result.times.at(-1)).toBe(new Date(start.getTime() + 65 * 22 * 60_000).toISOString());
    expect(new Date(result.times.at(-1)!).getTime()).toBeLessThan(end.getTime());
    for (const [request] of search.mock.calls) {
      expect(request.aggs.zones.aggs.t.date_histogram.offset).toBe(`${start.getTime() % (22 * 60_000)}ms`);
    }
    expect(search.mock.calls.at(-1)![0].aggs.zones.aggs.t.date_histogram.hard_bounds.max).toBe(new Date(end.getTime() - 1).toISOString());
  });

  it("keeps planned replay on its own range field without fetching topic metadata", async () => {
    search.mockResolvedValue({ aggregations: { zones: { buckets: [{
      key: "room-a", t: { buckets: [{ key: start.getTime(), people: { value: 2 } }] },
    }] } } });

    const result = await series("planned", DAY, { interests: [first.id], includeSim: false });

    expect(search).toHaveBeenCalledTimes(1);
    const request = search.mock.calls[0][0];
    expect(request.index).toBe("plans");
    expect(request.query.bool.filter).toEqual([
      { range: { when: { gte: start.toISOString(), lt: end.toISOString(), relation: "intersects" } } },
      { terms: { interests: [first.id] } },
      { term: { source: "live" } },
    ]);
    expect(request.aggs.zones.aggs.t.aggs.topics).toBeUndefined();
    expect(result.zones["room-a"][0]).toBe(1);
    expect(result.topics).toEqual([]);
    expect(result.zoneTopics).toEqual({});
    expect(result.peak).toBe(1);
  });
});
