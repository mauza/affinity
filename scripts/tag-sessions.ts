// One-off enrichment: the schedule tags only ~250 of 600 sessions with a topic
// track. Ask the LLM to tag every non-service session with taxonomy IDs and
// commit the result (data/session-topics.json) so boots stay deterministic.
// Run: LLM_URL=... LLM_API_KEY=... pnpm tsx scripts/tag-sessions.ts
import { writeFileSync } from "node:fs";
import { config } from "@/lib/config";
import { loadSchedule } from "@/lib/data";
import { chatJson } from "@/lib/ai/llm";
import { buildTaxonomy } from "@/lib/taxonomy";
import { buildSessions } from "@/lib/sessions";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sessions"],
  properties: {
    sessions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "topics"],
        properties: { id: { type: "string" }, topics: { type: "array", items: { type: "string" } } },
      },
    },
  },
};

async function main() {
  const schedule = loadSchedule();
  const interests = buildTaxonomy(schedule).filter((i) => i.kind !== "format");
  const valid = new Set(interests.map((i) => i.id));
  const sessions = buildSessions(buildTaxonomy(schedule), schedule).filter((s) => !s.service);
  const out: Record<string, string[]> = {};
  const batches: (typeof sessions)[] = [];
  for (let i = 0; i < sessions.length; i += 20) batches.push(sessions.slice(i, i + 20));
  let done = 0;
  const work = async (batch: typeof sessions) => {
    const r = await chatJson<{ sessions: { id: string; topics: string[] }[] }>({
      model: config.refineModel,
      name: "session_topics",
      schema: SCHEMA,
      timeoutMs: 90_000,
      system:
        "Tag KubeCon sessions with 1-4 topic IDs from the taxonomy that an attendee interested in that topic would want to see. " +
        "Prefer specific CNCF projects actually discussed, plus the best-fitting track. Only use IDs from the taxonomy. " +
        "Sponsor booth/demo sessions get the topics they demo. Return every session ID given.",
      user: JSON.stringify({
        taxonomy: interests.map((i) => `${i.id}: ${i.label}`),
        sessions: batch.map((s) => ({ id: s.id, title: s.title, abstract: s.abstract.slice(0, 600) })),
      }),
    });
    for (const s of r.sessions) {
      if (!batch.some((b) => b.id === s.id)) continue;
      out[s.id] = [...new Set(s.topics.filter((t) => valid.has(t)))].slice(0, 4);
    }
    console.log(`batch done (${++done}/${batches.length})`);
  };
  const queue = [...batches];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const b = queue.shift()!;
      try {
        await work(b);
      } catch (e) {
        console.warn("retrying batch:", (e as Error).message);
        await work(b).catch((e2) => console.error("batch failed:", (e2 as Error).message));
      }
    }
  }));
  const missing = sessions.filter((s) => !out[s.id]?.length);
  if (missing.length) throw new Error(`Missing topics for ${missing.length} sessions; keeping the existing snapshot`);
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync("data/session-topics.json", JSON.stringify({ model: config.refineModel, generatedAt: new Date().toISOString(), topics: sorted }, null, 1) + "\n");
  console.log(`tagged ${Object.keys(out).length}/${sessions.length} sessions`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
