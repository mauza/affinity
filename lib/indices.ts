// Explicit mappings for every index. Single node: 1 shard, 0 replicas.
import type { estypes } from "@elastic/elasticsearch";
import { config } from "./config";
import { INDEX } from "./es";

type Props = Record<string, estypes.MappingProperty>;
const kw = { type: "keyword" } as const;
const date = { type: "date" } as const;
const bool = { type: "boolean" } as const;
const int = { type: "integer" } as const;
const stored = { type: "keyword", index: false, doc_values: false } as const;
const semantic = () => ({ type: "semantic_text", inference_id: config.inferenceId }) as estypes.MappingProperty;

export const MAPPINGS: Record<string, Props> = {
  [INDEX.interests]: {
    id: kw,
    label: { type: "search_as_you_type" },
    label_kw: kw,
    aliases: { type: "text" },
    kind: kw,
    parent: kw,
    description: { type: "text" },
    semantic: semantic(),
    session_count: int,
    created_at: date,
  },
  [INDEX.sessions]: {
    id: kw,
    title: { type: "text" },
    abstract: { type: "text" },
    when: { type: "date_range" },
    starts_at: date,
    ends_at: date,
    day: kw,
    room_id: kw,
    room: kw,
    zone: kw,
    floor: kw,
    interests: kw,
    level: kw,
    speakers: { type: "text" },
    url: stored,
    service: bool,
    semantic: semantic(),
  },
  [INDEX.zones]: { id: kw, name: { type: "text", fields: { kw } }, floor: kw, kind: kw, parent: kw, room_ids: kw },
  [INDEX.attendees]: {
    id: kw,
    display_name: stored,
    public_name: bool,
    newcomer: bool,
    interests: kw,
    public_interests: kw,
    // Raw free text stays private: stored, never indexed or returned.
    raw_text: { type: "text", index: false },
    source: kw,
    created_at: date,
    updated_at: date,
  },
  [INDEX.plans]: {
    attendee_id: kw, session_id: kw, when: { type: "date_range" }, day: kw, zone: kw,
    interests: kw, newcomer: bool, source: kw, created_at: date,
  },
  [INDEX.stints]: {
    attendee_id: kw, zone: kw, floor: kw, active: { type: "date_range" }, interests: kw,
    open_topics: kw, hint: { type: "keyword", ignore_above: 100 }, newcomer: bool, source: kw, created_at: date,
  },
  [INDEX.tables]: {
    id: kw, day: kw, zone: kw, topic: kw, count: int, newcomer_count: int, active: bool,
    hint: stored, first_seen: date, last_seen: date, sources: kw,
  },
  [INDEX.alerts]: {
    attendee_id: kw, topic: kw, zone: kw, min_count: int, query: { type: "percolator" }, created_at: date,
    // Fields of the `tables` docs the percolator queries run against.
    day: kw, count: int, active: bool,
  },
  [INDEX.notifications]: {
    attendee_id: kw, alert_id: kw, table_id: kw, message: stored, read: bool, created_at: date,
  },
  [INDEX.meta]: { key: kw, value: { type: "object", enabled: false } },
};

export const SETTINGS: estypes.IndicesIndexSettings = { number_of_shards: 1, number_of_replicas: 0 };
