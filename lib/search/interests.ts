// Live interest chips: hybrid (BM25 prefix + semantic) over the taxonomy,
// fused with RRF. No LLM in the typing loop.
import { es, INDEX } from "../es";

export type InterestHit = { id: string; label: string; kind: string; sessions: number };

const lexical = (q: string): any => ({
  multi_match: {
    query: q,
    type: "bool_prefix",
    fields: ["label^3", "label._2gram", "label._3gram", "aliases^2", "description"],
  },
});

export async function suggestInterests(q: string, size = 8): Promise<InterestHit[]> {
  q = q.trim().slice(0, 300);
  if (!q) return [];
  const source = ["id", "label", "kind", "session_count"];
  const r: any =
    q.length < 3
      ? await es().search({ index: INDEX.interests, size, _source: source, query: lexical(q) })
      : await es().search({
          index: INDEX.interests,
          size,
          _source: source,
          retriever: {
            rrf: {
              retrievers: [
                { standard: { query: lexical(q) } },
                { standard: { query: { semantic: { field: "semantic", query: q } } } },
              ],
              rank_window_size: 50,
            },
          },
        });
  return r.hits.hits.map((h: any) => ({ id: h._source.id, label: h._source.label, kind: h._source.kind, sessions: h._source.session_count ?? 0 }));
}

export async function interestsByIds(ids: string[]): Promise<Map<string, InterestHit>> {
  if (!ids.length) return new Map();
  const r: any = await es().mget({ index: INDEX.interests, ids, _source: ["id", "label", "kind", "session_count"] });
  const m = new Map<string, InterestHit>();
  for (const d of r.docs) if (d.found) m.set(d._id, { id: d._id, label: d._source.label, kind: d._source.kind, sessions: d._source.session_count ?? 0 });
  return m;
}

export async function allInterests(): Promise<InterestHit[]> {
  const r: any = await es().search({
    index: INDEX.interests, size: 1000, _source: ["id", "label", "kind", "session_count"], sort: [{ session_count: "desc" }],
  });
  return r.hits.hits.map((h: any) => ({ id: h._source.id, label: h._source.label, kind: h._source.kind, sessions: h._source.session_count ?? 0 }));
}
