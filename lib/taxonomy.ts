// Interest taxonomy seeded from the schedule's categories: the main tracks,
// co-located events, a few formats people seek out, and the 104 CNCF projects.
// IDs are stable slugs so plans, stints and alerts survive re-imports.
import { loadSessionTopics, type Schedule } from "./data";

export type InterestKind = "track" | "event" | "format" | "project" | "custom";
export type Interest = {
  id: string;
  label: string;
  aliases: string[];
  kind: InterestKind;
  parent?: string;
  description: string;
  categoryIds: number[];
};

export function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}+ -]/gu, "")
    .replace(/\+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");
}

const TRACK_HINTS: Record<string, string[]> = {
  "ai-inference-agentic": ["AI", "LLM", "inference", "agents", "GPU", "MLOps", "model serving"],
  "application-development-delivery": ["CI/CD", "GitOps", "app delivery", "developer workflow"],
  "cloud-native-experience": ["community", "career", "end user stories"],
  "cloud-native-novice": ["beginner", "getting started", "new to Kubernetes"],
  connectivity: ["networking", "service mesh", "eBPF", "gateway API", "DNS"],
  "data-processing-storage": ["storage", "databases", "stateful workloads", "data pipelines"],
  "emerging-advanced": ["WebAssembly", "edge", "research", "new projects"],
  observability: ["monitoring", "tracing", "logging", "metrics", "OpenTelemetry", "SRE"],
  "operations-performance": ["SRE", "scaling", "cost", "reliability", "performance tuning", "multi-cluster"],
  "platform-engineering": ["internal developer platform", "IDP", "DevEx", "golden paths", "self-service"],
  security: ["supply chain", "policy", "zero trust", "SBOM", "runtime security", "identity"],
  "inclusion-accessibility": ["diversity", "inclusion", "accessibility", "DEI"],
};

const TRACK_SORT_MAX = 11;
const EXTRA_TRACKS = new Set(["Inclusion + Accessibility"]);
const FORMATS = new Set(["Maintainer Track", "📚 Tutorials", "🚨 Contribfest", "⚡ Lightning Talks"]);
const EVENTS = new Set([
  "EnvoyCon", "Istio Day", "Cloud Native University", "KyvernoCon",
  "KubeVirt Summit", "Kubeflow Summit", "llm-d", "BoF",
]);

const clean = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();

export function buildTaxonomy(schedule: Schedule): Interest[] {
  const byId = new Map<string, Interest>();
  const add = (name: string, kind: InterestKind, categoryId: number) => {
    const label = clean(name);
    const id = slug(label);
    const existing = byId.get(id);
    if (existing) {
      existing.categoryIds.push(categoryId);
      return;
    }
    byId.set(id, {
      id,
      label,
      aliases: TRACK_HINTS[id] ?? [],
      kind,
      description: "",
      categoryIds: [categoryId],
    });
  };
  for (const group of schedule.categories) {
    for (const item of group.items) {
      if (group.title === "All Sessions" || group.title === "SubTopic") {
        if (item.sort <= TRACK_SORT_MAX && group.title === "All Sessions") add(item.name, "track", item.id);
        else if (EXTRA_TRACKS.has(item.name)) add(item.name, "track", item.id);
        else if (FORMATS.has(item.name)) add(item.name, "format", item.id);
        else if (EVENTS.has(item.name)) add(item.name, "event", item.id);
        else if (group.title === "SubTopic" && byId.has(slug(clean(item.name)))) add(item.name, "track", item.id);
      } else if (group.title === "CNCF Projects") {
        add(item.name, "project", item.id);
      }
    }
  }
  // Ground each interest's description in real session titles so semantic
  // matching knows what "Cilium" or "Platform Engineering" means here.
  const titles = new Map<string, string[]>();
  const catToInterest = categoryIndex([...byId.values()]);
  const aiTopics = loadSessionTopics();
  for (const s of schedule.sessions) {
    const ids = new Set([...s.categoryItems.map((c) => catToInterest.get(c)), ...(aiTopics[s.id] ?? [])]);
    for (const id of ids) {
      if (!id || !byId.has(id)) continue;
      const list = titles.get(id) ?? [];
      if (list.length < 6) list.push(s.title);
      titles.set(id, list);
    }
  }
  for (const i of byId.values()) {
    const kindLabel = { track: "KubeCon track", event: "co-located event", format: "session format", project: "CNCF project or Kubernetes SIG", custom: "topic" }[i.kind];
    const t = titles.get(i.id) ?? [];
    i.description = `${i.label}: ${kindLabel}.${i.aliases.length ? ` Covers ${i.aliases.join(", ")}.` : ""}${t.length ? ` Sessions: ${t.join("; ")}.` : ""}`;
  }
  return [...byId.values()];
}

export function categoryIndex(interests: Interest[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const i of interests) for (const c of i.categoryIds) m.set(c, i.id);
  return m;
}
