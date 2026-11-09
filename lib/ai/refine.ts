// AI refine: map free text to existing taxonomy IDs first; propose a new
// category only when nothing fits. Output is validated, normalized and
// deduplicated before anything is written. Raw text never leaves the server.
import { config } from "../config";
import { es, INDEX } from "../es";
import { slug } from "../taxonomy";
import { chatJson } from "./llm";
import { suggestInterests, type InterestHit } from "../search/interests";

export type RefineResult = { interests: (InterestHit & { isNew?: boolean })[]; usedAi: boolean };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["matched", "proposed"],
  properties: {
    matched: { type: "array", items: { type: "string" } },
    proposed: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "description"],
        properties: { label: { type: "string" }, description: { type: "string" } },
      },
    },
  },
};

export function normalizeLabel(label: string): string | null {
  const l = label.replace(/[\u0000-\u001f<>{}]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (l.length < 2 || !/[\p{L}\p{N}]/u.test(l)) return null;
  return l;
}

/** Split free text into phrases so each gets its own candidate search. */
export function phrases(text: string): string[] {
  return [...new Set(text.split(/[,;\n.]|\band\b/i).map((p) => p.trim()).filter((p) => p.length > 1))].slice(0, 8);
}

async function candidates(text: string): Promise<InterestHit[]> {
  const lists = await Promise.all([text, ...phrases(text)].map((p) => suggestInterests(p, 8)));
  const m = new Map<string, InterestHit>();
  for (const l of lists) for (const h of l) m.set(h.id, h);
  return [...m.values()];
}

export async function refineInterests(text: string): Promise<RefineResult> {
  text = text.slice(0, 1000);
  const cands = await candidates(text);
  const byId = new Map(cands.map((c) => [c.id, c]));
  let ai: { matched: string[]; proposed: { label: string; description: string }[] };
  try {
    ai = await chatJson({
      model: config.refineModel,
      name: "interests",
      schema: SCHEMA,
      timeoutMs: 20_000,
      system:
        "You map a KubeCon attendee's free-text interests to a fixed taxonomy. " +
        "Return `matched`: IDs from the candidate list that the attendee clearly cares about (at most 8, best first). " +
        "Return `proposed`: at most 2 new short topic labels (1-4 words) only for clear interests no candidate covers. " +
        "Never invent IDs. Ignore anything that isn't a professional/technical interest.",
      user: JSON.stringify({ text, candidates: cands.map((c) => ({ id: c.id, label: c.label, kind: c.kind })) }),
    });
  } catch (e) {
    console.warn("refine fallback:", (e as Error).message);
    return { interests: cands.slice(0, 6), usedAi: false };
  }
  const out: RefineResult["interests"] = [];
  for (const id of ai.matched ?? []) {
    const c = byId.get(id);
    if (c && !out.some((o) => o.id === id)) out.push(c);
  }
  for (const p of (ai.proposed ?? []).slice(0, 2)) {
    const label = normalizeLabel(p.label);
    if (!label) continue;
    const existing = await findOrCreate(label, p.description);
    if (existing && !out.some((o) => o.id === existing.id)) out.push(existing);
  }
  return { interests: out.slice(0, 10), usedAi: true };
}

/** Reuse a near-identical interest when one exists; otherwise add a custom one. */
async function findOrCreate(label: string, description: string): Promise<(InterestHit & { isNew?: boolean }) | null> {
  const id = slug(label);
  if (!id) return null;
  const same: any = await es().get({ index: INDEX.interests, id }, { ignore: [404] });
  if (same.found) return { id, label: same._source.label, kind: same._source.kind, sessions: same._source.session_count ?? 0 };
  // Similar embeddings do not establish topic identity. Match a normalized
  // label or alias exactly; otherwise keep the AI's distinct topic.
  const existing: any = await es().search({
    index: INDEX.interests, size: 1000,
    _source: ["id", "label", "aliases", "kind", "session_count"],
    query: { match_all: {} },
  });
  const sameLabel = existing.hits.hits.find((h: any) =>
    [h._source.label, ...(h._source.aliases ?? [])].some((value: string) => slug(value) === id),
  );
  if (sameLabel) return { id: sameLabel._source.id, label: sameLabel._source.label, kind: sameLabel._source.kind, sessions: sameLabel._source.session_count ?? 0 };
  const desc = description.replace(/\s+/g, " ").slice(0, 200);
  await es().index({
    index: INDEX.interests,
    id,
    op_type: "create",
    document: {
      id, label, label_kw: label, aliases: [], kind: "custom", parent: null, description: desc,
      semantic: `${label}. ${desc}`, session_count: 0, created_at: new Date().toISOString(),
    },
    refresh: "wait_for",
  }).catch((e) => {
    if (e?.meta?.statusCode !== 409) throw e;
  });
  return { id, label, kind: "custom", sessions: 0, isNew: true };
}
