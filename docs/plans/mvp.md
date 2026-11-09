# MVP: Affinity, find your pod

Live interest map for KubeCon NA 2026 SLC. The name comes from Kubernetes `podAffinity`: pods with matching labels get scheduled together, and people with matching interests gather together.

Status: proposed. Hackathon is **Mon 2026-11-09**, in person; kickoff 10:00, submission **17:30 MT**, presentations 17:30. No app code before kickoff (rules). KubeCon NA runs Nov 9–12 at Salt Palace + Hyatt Regency, SLC, so the app can serve real attendees Tue–Thu after submission.

## Goal

Live, collective map of where like-minded people gather at KubeCon NA 2026 SLC. Every attendee who shares interests, plans sessions, or checks in improves the map, the planner, and connection suggestions for everyone else.

**Hero moment: the murmuration.** The day replay plus the lobby screen. Press play: the venue heats up through the morning, flows into the Halls A–C lunch, then splits into topic tables. The lobby screen shows the same story live on a hallway TV, with a QR code to join.

## Decisions

- Real data: KubeCon NA 2026 schedule (600 sessions, 37 rooms, Nov 8–12) and the official venue map. Times are in America/Denver (MST, UTC-7).
- Free-form interests: Elasticsearch matches tags live as you type; AI refines the result and proposes new categories; the attendee confirms.
- Crowd-aware AI planner, grounded in the real schedule plus aggregated plans and presence.
- Presence is stored as time-range "stints" in Elasticsearch, not snapshots. Live map, history, and replay all come from the same records. No snapshot CronJob.
- Pop-up topic tables form automatically from shared "open to connect" signals. Shared, never exclusive.
- Percolator-backed alerts, "unusually popular here", and "unexpected overlap" via significant_terms.
- Privacy floor: interest-derived counts below 3 show as "a few". Thresholds apply after filtering.
- Crowd simulator Job: clearly labeled synthetic attendees for the murmuration, cold start, and load.
- Elasticsearch is the only datastore. Kubernetes hosting; public HTTPS ingress `kubecon.mau.guru`.
- Tracks: Elasticsearch (primary), Merge Forward, Radar. Dash0 and Gitar are stretch goals.

## Data sources

- **Schedule:** the official schedule page embeds Sessionize-format JSON in `<script type="application/json" class="sched-data">`. It contains `all.sessions` / `rooms` / `speakers` / `categories`. Sessions have `startsAt`/`endsAt` with no offset (MST), `roomId`, `categoryItems`, and an HTML `description`. 553 of 600 sessions have abstracts.
  - Importer: fetch the page, extract the JSON, and commit a snapshot to `data/kcna26-schedule.json` for reproducible boots. Keep the source URL and session `?id=` deep links. Skip speaker photos.
  - Categories seed the taxonomy: 11 main tracks, co-located/subtopics (Istio Day, KubeVirt Summit, llm-d, BoF…), 104 CNCF projects, and audience level.
  - Meals and breaks: lunch in Salt Palace L1 Halls A–C / 1–5 (Tue 12:50–14:50, Wed 12:20–14:20, Thu 12:20–13:50); Monday lunch is on your own. Coffee breaks are in the same halls.
- **Venue map:** official PDF at `events.linuxfoundation.org/kcna26-venue-map`; expo map at `/kcna26-expo-map`. Trace our own simplified SVG zones from it; don't redistribute the PDF; credit and link the source.
  - Floors: Salt Palace L1 (Hall DE keynote, Grand Ballroom ACE/BDF/GI/H/J, 151, Halls A–C showcase, Halls 1–5 showcase with sub-zones), Salt Palace L2 (250–255 rooms, mezzanine), Hyatt L2 (Salt Lake Ballroom C, DE), Hyatt L4 (Regency A, B, CD). Quiet rooms, prayer room, and meal pickups are marked.
  - `data/zones.json` maps each schedule `roomId` to a zone. Overlapping room names (Regency B-D vs B + CD; "Halls A-C, Halls 1-5" vs showcase sub-zones) map to a parent zone; aggregates roll up through `parent`. Off-Site and Room TBD are excluded from the map.

## Attendee flow

1. Scan the QR code, pick an optional display name, and choose "first KubeCon / came alone" (optional).
2. Type interests in plain language. Chips appear live: Elasticsearch semantic matches against the taxonomy. On pause or submit, AI refines and may propose new categories. Confirm, edit, and choose which are public.
3. Planner: "Plan my Tuesday" or free text ("2h after lunch, want to meet AI infra people"). Each suggestion carries a crowd label and a reason. Accept, swap, or remove.
4. Map: floors as tabs. Modes: **planned**, **here now**, **open to connect**, **murmuration** (replay). Filter by your interests. Never mix modes in one unlabeled count.
5. Check in to a zone. Optionally mark yourself "open to connect about GitOps until 13:30" and add a meetup hint ("by the coffee station"). Move, leave, or renew at any time.
6. Join or follow pop-up tables; set alerts ("tell me when 3+ people open for eBPF gather at lunch").

## Features

### Interests and search
- Taxonomy index seeded from schedule categories (stable IDs, labels, aliases, parent track, description). Sessions are tagged by their schedule categories plus AI-assigned topics.
- Live chips: debounced hybrid query (BM25 on labels/aliases + semantic on descriptions) against `interests`, with no LLM in the typing loop.
- AI refine: structured output mapping to existing IDs first; new categories only when needed; validated, normalized, and deduplicated. Raw text stays private.
- Session search by meaning: hybrid retriever (RRF of BM25 + `semantic_text`) over title and abstract. Filters: day, track, level, floor.
- AI outage: chip search plus manual selection still work.

### Crowd-aware planner
- Candidates come from Elasticsearch hybrid search on the attendee's interests, constrained to the selected day and free time.
- Crowd signals per candidate (aggregations over `plans` and `stints` from attendees who share an interest):
  - "Packed with your people": high like-minded planned count.
  - "Quiet, easier to ask the speaker": low total planned count.
  - "Table forming after": a pop-up table on the same topic is likely at the next meal.
- AI selects and explains using **IDs only**; the server validates IDs, times, and overlaps, and keeps meals free. Manual edits only check that the ID exists.
- Default: app-side LLM tool calling, with Elasticsearch queries as tools. Stretch: Elastic Agent Builder over the same indices if the license and version allow.
- Accepted sessions write `plans` docs with an interest snapshot. These feed the planned-attendance map and other people's crowd labels.

### Map, presence, murmuration
- Responsive SVG per floor; zones are tappable. Heat uses a fixed sequential scale and also shows a number or "a few", so color isn't the only signal.
- Presence stint doc fields: `active: date_range {gte: start, lt: start+30m}`, zone, interest snapshot, open topics, source.
  - Renew extends `lt`. Leave or move sets `lt=now` (move then creates a new stint). Expiry is simply the range end; no cleanup is needed for correctness.
- Here now: `range` query where `active` contains now; per-zone `cardinality(attendee_id)`, filtered by interests.
- Murmuration (replay): one query with `terms(zone)` → `date_histogram(active, 5m, hard_bounds=day)` → `cardinality(attendee)`. Scrub or play with a fixed comparison scale. Arbitrary time resolution, no snapshots.
- Planned mode: the same buckets over `plans` using the session time ranges.
- Freshness: poll every 15s and show "updated Ns ago". No websockets, GPS, Bluetooth, or background tracking.

### Pop-up tables and alerts
- When ≥3 active stints in a zone share an open topic, upsert a `tables` doc (zone+topic+day). It shows on the map and lobby screen: "GitOps · 5 · Halls A–C · by the coffee station". The first person's meetup hint is used; anyone can update it.
- Multiple topics and tables share a zone; nobody owns one. A table dissolves when its count drops below 3, but stays in history.
- Alerts: attendees save conditions as percolator queries in `alerts`. Each `tables` create or update is percolated, and matches write `notifications` (an in-app bell, polled). No push or email.

### Insights (Elasticsearch-native)
- **Unusually popular here:** `significant_terms` of interests for a zone vs. the whole venue in the same window ("Room 255 BC is 4× more into eBPF").
- **Unexpected overlap:** `significant_terms` over attendees who share your interests vs. all attendees gives adjacent interests you didn't pick ("people like you also go to Observability"), then links to sessions or tables on that topic.
- **Trending now:** the last 30 minutes vs. the day so far, shown in the lobby ticker.
- All insights use `min_doc_count` ≥3 and suppress zones under the privacy floor.

### Lobby screen (`/lobby`)
- Full-screen kiosk that auto-cycles: live heatmap (both venues), pop-up tables, trending ticker, a murmuration loop of the day so far, and the join QR.
- Aggregates and table topics only; never names. Readable from 3 m, high contrast, still legible on a projector.

### Merge Forward: inclusion and accessibility
- "First KubeCon / came alone" flag: planner and tables favor small, welcoming tables; "Find a smaller gathering" sorts tables by size ascending.
- List view equivalent of the map (screen readers, small phones); keyboard navigable; no color-only meaning.
- Show quiet rooms, prayer room, and mother's room from the venue map; "quiet here" filter for low-density zones.
- Plain-language onboarding; nothing required except interests.

### Privacy
- Pseudonymous HttpOnly cookie identity; ownership comes from the cookie, never from a client-supplied ID. Optional display name, shown only on tables you joined and only if you opt in.
- k=3 floor on every interest-derived count (live, planned, replay, crowd labels, insights). 1–2 shows as "a few", 0 as empty. Applied to the final filtered number.
- Interest filters are limited to an OR of up to 3 interests, to block narrowing attacks that isolate one person.
- Public APIs return aggregates and explicitly shared table topics only. Raw text, private interests, and per-person histories are never returned or logged.
- "Clear my data" deletes profile, plans, stints, alerts, and notifications. Retention: delete all live data 7 days after the event (2026-11-19) via CronJob.

### Crowd simulator
- `crowd-sim` k8s Job sharing the app's domain module. Personas are generated deterministically from the taxonomy (seeded RNG; mix of tracks, newcomers, open-to-connect rates).
- **Backfill mode:** writes a full simulated day (default Tue Nov 10) of plans, stints, and tables, following the real schedule, meals, and hallway time.
- **Live mode:** real-time or accelerated tempo for the demo and for Radar load. Replicas are scalable.
- Every doc has `source: live|sim`. The UI shows a "includes simulated attendees" badge, with a toggle for live-only. Defaults: demo = live+sim; after the event = live only.

## Architecture and data

- One TypeScript/Next.js app (UI + API routes); SVG map. All model calls go through the home LiteLLM gateway (`http://litellm-proxy.llm-gateway:4000`, OpenAI-compatible), server-side only.
- Embeddings: `qwen3-embedding-0.6b` (1024 dims, cosine, max 2048 tokens/input) served by llama.cpp SYCL on the Intel Arc A770 (`home-k8s/apps/llm-gateway/embed-a770.yaml`). Chat: a LiteLLM chat route (default `gpt-6-luna` for live tag refine, `gpt-6.1-sol` for the planner), configurable by env.
- Elasticsearch: pin the current 9.x. Start a trial license at bootstrap (`_license/start_trial`) for inference, `semantic_text`, RRF, and Agent Builder. Embeddings come through an Elasticsearch inference endpoint (`openai` service, `url` = LiteLLM `/v1/embeddings`, model `qwen3-embedding-0.6b`), so no ML node or ELSER memory is needed.
  - Fallback: the app computes embeddings into `dense_vector`, and RRF fusion happens app-side.
  - Percolator, significant_terms, date_range aggregations, and cardinality all work on the basic license.
- Indices: `interests`, `sessions` (`when` date_range + `semantic_text`), `zones`, `attendees`, `plans` (one doc per attendee-session), `stints`, `tables`, `alerts` (percolator), `notifications`. Explicit mappings; 1 shard, 0 replicas.
- Jobs: bootstrap (mappings, license, inference endpoint, schedule/zones/taxonomy import; idempotent), `crowd-sim`, retention CronJob. No always-on worker; tables are recomputed on write.

## Kubernetes delivery

- Home cluster (k3s) via GitOps in `~/Projects/home-k8s`: `apps/kubecon/` + `argo/apps/kubecon.yaml`, namespace `kubecon`. Sealed secrets for the LiteLLM key and Elasticsearch credentials. App image is built from the public repo and pushed to the cluster registry.
- Elasticsearch: single-node StatefulSet, internal ClusterIP, auth/TLS, 4Gi limit / 2Gi heap (no local ML), pinned image. Use a `local-path` PVC pinned to an amd64 node with headroom (waug01 or waukvm1), not NFS. Check vm.max_map_count first.
- App: Deployment, probes, limits, internal Service. Ingress `kubecon.mau.guru` → app only, with valid TLS: Traefik `websecure` + `letsencrypt-prod` + a headers middleware (same pattern as `apps/web-games/ingress.yaml`). DNS already resolves. Elasticsearch has no ingress.
- Radar connected to the cluster/namespace from the start. Scripted investigation: scale `crowd-sim` live mode → Elasticsearch latency/heap pressure or app readiness flaps → Radar AI investigation → fix (limits, query, bulk batching) → keep the evidence for the demo.
- Verify: HTTPS flow, app ready, Elasticsearch green/yellow as expected, bootstrap and sim Jobs complete, data survives an Elasticsearch pod restart.

## Build order (today, MT)

Rough targets. If a phase overruns, cut from the bottom of the list below.

1. **10:00–11:30 Foundation:** repo, Elasticsearch + app on k8s, ingress + TLS, bootstrap import (schedule snapshot, taxonomy, zones.json + traced SVG for Salt Palace L1).
2. **11:30–13:00 Core loop:** cookie identity, live chips + AI refine, stints (check-in/move/renew/leave), live map with k=3 floor. Verify with two browsers.
3. **13:00–14:15 Hero:** crowd-sim backfill, murmuration query + player, `/lobby` kiosk.
4. **14:15–15:30 Connect + plan:** open-to-connect, pop-up tables, hybrid session search, crowd-aware planner.
5. **15:30–16:30 Depth:** percolator alerts, significant_terms insights, newcomer mode, list view, remaining floors (Salt Palace L2, Hyatt L2/L4), Radar investigation.
6. **16:30–17:15 Freeze:** mobile/desktop pass, README + setup + AI-use disclosure, demo rehearsal, final deploy.

**Cut order if behind:** Agent Builder → Dash0/Gitar → Hyatt floors → alerts/percolator → planned mode → unexpected overlap. Never cut: live map, murmuration, lobby, privacy floor, sim labeling.

**Parallel lanes** (one person each, feature branches + PRs to `main` on github.com/mauza/affinity; one integrator merges and deploys):
- infra (`Dockerfile`, image build; manifests in `home-k8s/apps/kubecon/`)
- data/import + sim (`data/`, `sim/`)
- map/lobby UI (`app/map`, `app/lobby`)
- AI/search (`lib/ai`, `lib/search`)

**Stretch tracks:**
- Dash0: OTel traces/logs/metrics + RUM; SLO "check-in visible on map < 20s".
- Gitar: land features through reviewed PRs with repo rules.

## Demo (5 min)

1. Lobby screen on the projector: live map plus the murmuration of simulated Tuesday ("this is what Tuesday will look like").
2. Judges scan the QR code, type interests in their own words, and see chips appear. They get a crowd-aware plan for Tuesday.
3. Judges check in "open to connect"; a pop-up table forms on the lobby screen and an alert fires on another phone.
4. Insights: "unusually popular here" and "people like you also…".
5. Privacy: k=3 floor, synthetic data labeling, clear my data.
6. Ops: Kubernetes + Radar investigation evidence. Close with: live for real KubeCon attendees Tue–Thu.

## Acceptance

- Two attendees describe related interests differently; both map to a shared category and appear in the right zone/filter (subject to k=3).
- Move, renew, leave, and expiry give correct live counts; replay at any past minute matches the stints; one attendee is never counted twice per zone per bucket.
- Two topics' tables coexist in the Halls A–C lunch zone; a table forms at 3 and dissolves below 3; a matching alert fires exactly once.
- Planner output contains only real session IDs, no overlaps, keeps meals free, uses MST times, and shows crowd labels that respect the floor.
- No public response leaks raw text, private interests, or names of people who didn't opt in; filtered counts below 3 show "a few".
- Sim docs are always labeled; live-only toggle excludes them.
- A judge's check-in shows on the lobby screen within 20s.
- Tests: tag normalization/validation, planner constraints, stint transitions, replay aggregation, k-floor, table thresholds, percolator matching, ownership boundaries. Browser check at desktop and mobile widths, plus the lobby screen at 1080p.

## Deferred

GPS/beacons, chat, contact exchange, accounts/social login, push/email notifications, multi-event support, walking routes, HA Elasticsearch, speaker photos.

## References

- Hackathon: [tracks](https://www.wemakedevs.org/hackathons/cnh), [rules](https://www.wemakedevs.org/hackathons/cnh/rules), [schedule](https://www.wemakedevs.org/hackathons/cnh/schedule).
- KubeCon NA 2026: [schedule](https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/), [venue map PDF](https://events.linuxfoundation.org/kcna26-venue-map), [expo map PDF](https://events.linuxfoundation.org/kcna26-expo-map), [venue/travel](https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/attend/venue-travel/).
- Elasticsearch: [aggregations](https://www.elastic.co/docs/explore-analyze/query-filter/aggregations), [range field types](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/range), [percolator](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/percolator), [semantic_text](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/semantic-text), [production Docker requirements](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/install-elasticsearch-docker-prod).

## Unresolved questions

- Who owns which lane? Assign infra, data/sim, map/lobby, and AI/search to named people before 11:00.
- Should the app get its own LiteLLM key, or the shared master key? There's no key database today, so a dedicated key needs one.
