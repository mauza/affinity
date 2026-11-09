// Crowd-aware planner. Elasticsearch finds candidates (hybrid search on the
// attendee's interests and request), aggregations add crowd signals, the LLM
// picks and explains using IDs only, and the server enforces the rules:
// real IDs, the chosen day, no overlaps, meals kept free.
import { config, K_FLOOR } from "../config";
import { loadVenue } from "../data";
import { plannedPerSession } from "../aggregates";
import { listTables } from "../tables";
import { searchSessions, type SessionHit } from "../search/sessions";
import { interestsByIds } from "../search/interests";
import { at, clockOf } from "../time";
import { chatJson } from "./llm";

export type CrowdLabel = "packed" | "quiet" | "table-after";
export type PlanItem = SessionHit & { reason: string; crowd: CrowdLabel[]; likeMinded: number; planned: number };
export type PlanResult = { day: string; items: PlanItem[]; summary: string; usedAi: boolean };

type Window = { start: number; end: number };
const overlaps = (a: Window, b: Window) => a.start < b.end && b.start < a.end;
const win = (s: { starts_at: string; ends_at: string }): Window => ({ start: Date.parse(s.starts_at), end: Date.parse(s.ends_at) });

export function mealWindows(day: string): Window[] {
  return loadVenue().meals.filter((m) => m.day === day).map((m) => ({ start: at(day, m.start).getTime(), end: at(day, m.end).getTime() }));
}

/** Server-side rules: keep order of preference, drop overlaps and meal clashes. */
export function enforce<T extends { id: string; day: string; starts_at: string; ends_at: string }>(picks: T[], day: string, max = 8): T[] {
  const meals = mealWindows(day);
  const kept: T[] = [];
  for (const p of picks) {
    if (p.day !== day) continue;
    const w = win(p);
    if (meals.some((m) => overlaps(m, w))) continue;
    if (kept.some((k) => overlaps(win(k), w))) continue;
    kept.push(p);
    if (kept.length >= max) break;
  }
  return kept.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["picks", "summary"],
  properties: {
    summary: { type: "string" },
    picks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "reason"],
        properties: { id: { type: "string" }, reason: { type: "string" } },
      },
    },
  },
};

export async function planDay(opts: { day: string; text?: string; interests: string[]; newcomer: boolean }): Promise<PlanResult> {
  const labels = await interestsByIds(opts.interests);
  const interestText = [...labels.values()].map((l) => l.label).join(", ");
  const candidates = await searchSessions({
    q: [opts.text, interestText].filter(Boolean).join(". ") || undefined,
    interests: opts.interests,
    day: opts.day,
    size: 40,
  });
  const ids = candidates.map((c) => c.id);
  const [total, like, tables] = await Promise.all([
    plannedPerSession(ids),
    plannedPerSession(ids, opts.interests),
    listTables({ day: opts.day }),
  ]);
  const tableTopics = new Set(tables.map((t) => t.topic));
  const crowdOf = (s: SessionHit): CrowdLabel[] => {
    const out: CrowdLabel[] = [];
    if ((like[s.id] ?? 0) >= K_FLOOR) out.push("packed");
    if ((total[s.id] ?? 0) < K_FLOOR) out.push("quiet");
    if (s.interests.some((i) => tableTopics.has(i) && opts.interests.includes(i))) out.push("table-after");
    return out;
  };
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const build = (id: string, reason: string): PlanItem | null => {
    const s = byId.get(id);
    if (!s) return null;
    const lm = like[s.id] ?? 0;
    return { ...s, reason: reason.slice(0, 200), crowd: crowdOf(s), likeMinded: lm >= K_FLOOR ? lm : 0, planned: (total[s.id] ?? 0) >= K_FLOOR ? total[s.id] : 0 };
  };

  try {
    const meals = loadVenue().meals.filter((m) => m.day === opts.day);
    const ai = await chatJson<{ picks: { id: string; reason: string }[]; summary: string }>({
      model: config.planModel,
      name: "plan",
      schema: SCHEMA,
      timeoutMs: 45_000,
      system:
        "You plan one day at KubeCon NA 2026 (times are MST). Pick 4-7 sessions from the candidates only, by ID, " +
        "with no time overlaps, leaving meal windows free and some hallway time. Respect the attendee's request. " +
        "Use crowd signals: 'likeMinded' = people with shared interests planning to attend; 'planned' = everyone; " +
        (opts.newcomer ? "This is their first KubeCon: favor beginner-friendly and smaller, welcoming sessions. " : "") +
        "Each reason is one short sentence addressed to the attendee. The summary is one sentence. " +
        "Never mention numbers of people, counts, or that counts are zero.",
      user: JSON.stringify({
        day: opts.day,
        request: opts.text ?? "",
        interests: interestText,
        meals: meals.map((m) => `${m.start}-${m.end} lunch`),
        candidates: candidates.map((c) => ({
          id: c.id, title: c.title, time: `${clockOf(c.starts_at)}-${clockOf(c.ends_at)}`, level: c.level,
          topics: c.interests.slice(0, 5), likeMinded: like[c.id] ?? 0, planned: total[c.id] ?? 0,
          abstract: c.abstract.slice(0, 240),
        })),
      }),
    });
    const items = enforce(ai.picks.map((p) => build(p.id, p.reason)).filter(Boolean) as PlanItem[], opts.day);
    if (items.length) return { day: opts.day, items, summary: ai.summary.slice(0, 300), usedAi: true };
  } catch (e) {
    console.warn("planner fallback:", (e as Error).message);
  }
  const items = enforce(candidates.map((c) => build(c.id, "Matches your interests.")!), opts.day, 6);
  return { day: opts.day, items, summary: "Top matches for your interests.", usedAi: false };
}
