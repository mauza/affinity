import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ get: vi.fn(), search: vi.fn(), index: vi.fn(), chat: vi.fn() }));
vi.mock("../es", () => ({ es: () => mock, INDEX: { interests: "interests" } }));
vi.mock("../search/interests", () => ({ suggestInterests: vi.fn().mockResolvedValue([]) }));
vi.mock("./llm", () => ({ chatJson: mock.chat }));
import { refineInterests } from "./refine";

describe("proposed interest identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.get.mockResolvedValue({ found: false });
    mock.index.mockResolvedValue({});
  });

  it("does not collapse a distinct topic into a high-scoring semantic neighbor", async () => {
    mock.chat.mockResolvedValue({ matched: [], proposed: [{ label: "Incident response", description: "Responding to production incidents" }] });
    mock.search.mockResolvedValue({ hits: { hits: [{ _score: 0.95, _source: { id: "llm-d", label: "llm-d", kind: "project", aliases: [] } }] } });
    const r = await refineInterests("incident response");
    expect(r.interests[0].id).toBe("incident-response");
    expect(mock.index).toHaveBeenCalledOnce();
  });

  it("reuses a normalized exact alias instead of creating a duplicate", async () => {
    mock.chat.mockResolvedValue({ matched: [], proposed: [{ label: "SRE", description: "Reliability" }] });
    mock.search.mockResolvedValue({ hits: { hits: [{ _source: { id: "operations-performance", label: "Operations + Performance", kind: "track", aliases: ["SRE"], session_count: 93 } }] } });
    const r = await refineInterests("SRE");
    expect(r.interests[0].id).toBe("operations-performance");
    expect(mock.index).not.toHaveBeenCalled();
  });
});
