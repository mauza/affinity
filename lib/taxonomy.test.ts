import { describe, expect, it } from "vitest";
import { slug } from "./taxonomy";
import { normalizeLabel, phrases } from "./ai/refine";
import { htmlToText } from "./sessions";
import { clockOf, dayOf, mst } from "./time";

describe("tags", () => {
  it("slugs category names into stable IDs", () => {
    expect(slug("AI Inference + Agentic")).toBe("ai-inference-agentic");
    expect(slug("cri-o")).toBe("cri-o");
    expect(slug("Data Processing + Storage")).toBe("data-processing-storage");
  });
  it("normalizes AI-proposed labels", () => {
    expect(normalizeLabel("  Platform   <b>teams</b> ")).toBe("Platform bteams/b");
    expect(normalizeLabel("!!")).toBeNull();
    expect(normalizeLabel("x".repeat(80))).toHaveLength(40);
  });
  it("splits free text into phrases", () => {
    expect(phrases("GitOps, eBPF and LLM inference")).toEqual(["GitOps", "eBPF", "LLM inference"]);
  });
});

describe("schedule parsing", () => {
  it("strips HTML from abstracts", () => {
    expect(htmlToText("<p>Hello &amp; welcome</p><p>Line&#39;s two</p>")).toBe("Hello & welcome\nLine's two");
  });
  it("treats schedule times as MST", () => {
    expect(mst("2026-11-10T09:00:00")).toBe("2026-11-10T09:00:00-07:00");
    expect(dayOf("2026-11-11T05:30:00Z")).toBe("2026-11-10");
    expect(clockOf("2026-11-10T16:00:00Z")).toBe("09:00");
  });
});
