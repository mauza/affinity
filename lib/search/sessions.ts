// Session search by meaning: RRF of BM25 (title, abstract, speakers) and
// semantic_text over title + abstract, with day/time/track filters.
import { es, INDEX } from "../es";
import type { SessionDoc } from "../sessions";

export type SessionHit = Omit<SessionDoc, "semantic" | "abstract"> & { abstract: string };

export async function searchSessions(opts: {
  q?: string;
  day?: string;
  interests?: string[];
  from?: string;
  to?: string;
  size?: number;
  includeService?: boolean;
}): Promise<SessionHit[]> {
  const filter: any[] = [];
  if (!opts.includeService) filter.push({ term: { service: false } });
  if (opts.day) filter.push({ term: { day: opts.day } });
  if (opts.from) filter.push({ range: { starts_at: { gte: opts.from } } });
  if (opts.to) filter.push({ range: { ends_at: { lte: opts.to } } });
  const size = opts.size ?? 20;
  const source = { excludes: ["semantic"] };
  const q = opts.q?.trim();
  const retrievers: any[] = [];
  if (q) {
    retrievers.push({ standard: { query: { bool: { must: { multi_match: { query: q, fields: ["title^2", "abstract", "speakers"] } }, filter } } } });
    retrievers.push({ standard: { query: { bool: { must: { semantic: { field: "semantic", query: q } }, filter } } } });
  }
  if (opts.interests?.length) {
    retrievers.push({ standard: { query: { bool: { must: { terms: { interests: opts.interests } }, filter } } } });
  }
  const r: any = retrievers.length > 1
    ? await es().search({ index: INDEX.sessions, size, _source: source, retriever: { rrf: { retrievers, rank_window_size: 100 } } })
    : await es().search({
        index: INDEX.sessions, size, _source: source,
        ...(retrievers.length ? { retriever: retrievers[0] } : { query: { bool: { filter } }, sort: [{ starts_at: "asc" }] }),
      });
  return r.hits.hits.map((h: any) => ({ ...h._source, abstract: (h._source.abstract ?? "").slice(0, 500) }));
}

export async function sessionsByIds(ids: string[]): Promise<Map<string, SessionHit>> {
  if (!ids.length) return new Map();
  const r: any = await es().mget({ index: INDEX.sessions, ids, _source_excludes: ["semantic"] });
  const m = new Map<string, SessionHit>();
  for (const d of r.docs) if (d.found) m.set(d._id, d._source);
  return m;
}
