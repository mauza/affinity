import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("./es", () => ({ es: () => mock, INDEX: { tables: "tables", stints: "stints" } }));
import { listTables } from "./tables";

const now = new Date("2026-11-09T19:00:00Z");
const stored = { id: "2026-11-09:lunch:gitops", day: "2026-11-09", zone: "lunch", topic: "gitops", active: true, count: 12, newcomer_count: 2, sources: ["live", "sim"], hint: "Sim hint" };

describe("current topic tables", () => {
  beforeEach(() => {
    mock.search.mockReset();
    mock.search.mockResolvedValueOnce({ hits: { hits: [{ _source: stored }] } });
  });

  it("dissolves expired tables on read without another check-in", async () => {
    mock.search.mockResolvedValueOnce({ aggregations: { zones: { buckets: [] } } });
    expect(await listTables({}, now)).toEqual([]);
  });

  it("suppresses mixed tables with fewer than three live attendees", async () => {
    mock.search.mockResolvedValueOnce({ aggregations: { zones: { buckets: [{ key: "lunch", topics: { buckets: [{ key: "gitops", people: { value: 2 }, newcomers: { people: { value: 1 } }, sources: { buckets: [{ key: "live" }] }, hinted: { first: { hits: { hits: [] } } } }] } }] } } });
    expect(await listTables({ includeSim: false }, now)).toEqual([]);
    expect(mock.search.mock.calls[1][0].query.bool.filter).toContainEqual({ term: { source: "live" } });
  });

  it("uses current counts and applies the privacy floor to newcomers", async () => {
    mock.search.mockResolvedValueOnce({ aggregations: { zones: { buckets: [{ key: "lunch", topics: { buckets: [{ key: "gitops", people: { value: 4 }, newcomers: { people: { value: 2 } }, sources: { buckets: [{ key: "live" }] }, hinted: { first: { hits: { hits: [{ _source: { hint: "Coffee" } }] } } } }] } }] } } });
    const tables = await listTables({ includeSim: false }, now);
    expect(tables[0]).toMatchObject({ count: 4, newcomer_count: 1, sources: ["live"], hint: "Coffee" });
  });
});
