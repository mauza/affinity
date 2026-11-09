# Crowd simulator

Run the bundled Job with `node dist/sim/crowd-sim.cjs` in the app image (working directory `/app`, including `data/`). Use the app's `ES_URL`, `ES_USERNAME` and secret-backed `ES_PASSWORD`.

| Variable | Default | Meaning |
| --- | --- | --- |
| SIM_MODE | backfill | `preview` (no ES), `backfill`, `live`, or `reset` |
| SIM_DAY | 2026-11-10 | Schedule day in MST |
| SIM_PEOPLE | 160 Monday; 600 otherwise | Total persona population across all shards |
| SIM_SEED | 42 | Reproducible population; use a separate seed for independent runs |
| SIM_SPEED | 1 | Live schedule clock multiplier; writes use actual wall time |
| SIM_SHARDS | 1 | Live replica count |
| SIM_SHARD | 0 | Live replica index; fallback JOB_COMPLETION_INDEX, then numeric HOSTNAME suffix, modulo shard count |
| SIM_TABLES | 0 | Set to `1` to recompute historical tables during backfill; can notify subscribers |
| ES_INDEX_PREFIX | empty | Optional separate Elasticsearch index namespace, e.g. `affinity-replay-qa-` |

Backfill replaces simulated plans/stints/sim-only tables for the selected day, then upserts the shared simulated profiles. It preserves other days' profiles and history, all live data, and mixed tables. Do not run it concurrently with live simulators. The explicit `reset` mode removes simulated data across all days. Backfill does not recompute tables or notify subscribers unless `SIM_TABLES=1` is explicitly set; normal live check-ins still recompute tables.

Live starts at the current MST clock time on SIM_DAY, progresses through the schedule at SIM_SPEED, and continues running after the venue closes. SIGTERM/SIGINT stops further actions; existing 30-minute stints expire naturally. Presence writes use the shared check-in/renew/leave code, including table recomputation. Use a distinct seed from a backfill to avoid sharing attendee IDs. The simulator bulk-writes profiles with the same mapped fields as saveProfile, avoiding a refresh per attendee.

Local usage: `SIM_MODE=backfill pnpm sim`; `SIM_MODE=live SIM_DAY=2026-11-09 SIM_SEED=43 SIM_SPEED=10 pnpm sim`. Credentials must already be exported. `pnpm exec tsx sim/verify.ts` prints replay samples, table history and per-session planned counts; SIM_DAY selects the day. Logs and verification contain synthetic aggregates only.

## Monday and Tuesday replay

Open `/map?mode=murmuration`. The standalone `/demo` film is retired. The same Elasticsearch stint history drives people badges and topic circles; nothing is generated only for the animation. One attendee can contribute several topic check-ins. All counts pass the privacy floor; small groups use the same ambiguous “a few” glyph. A full circle represents the labeled number of topic check-ins, with smaller circles for a remainder when a larger population requires scaling.

Synthetic profiles use only the 12 official conference track categories, with their actual labels. No fictional demo topics or AI-created categories are added. Other attendee interests and free-form onboarding remain available independently.

- **Monday Nov 9:** 160 attendees by default, intermittent visits and gaps. Most visit real project lightning talks in Hyatt L4 Regency B–D, 09:30–16:35, with coffee/lunch gaps; a smaller group visits scheduled co-located events. There is no invented Monday Hall DE keynote or expo crowd.
- **Tuesday Nov 10:** 600 attendees by default. Staggered arrivals, the actual morning Hall DE keynote block, matching scheduled sessions, staggered lunch visits, shared spaces, and departures. Presence is synthetic, not observed attendance or a forecast.

Schedule evidence: [official conference schedule](https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/) and [Monday project lightning talks](https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/features-add-ons/project-engagement/). Times are MST.

Preview either day's document totals without connecting to Elasticsearch:

```sh
SIM_MODE=preview SIM_DAY=2026-11-09 pnpm sim
SIM_MODE=preview SIM_DAY=2026-11-10 pnpm sim
```

For an isolated rehearsal, export `ES_INDEX_PREFIX=affinity-replay-qa-` alongside the normal ES environment, then run `pnpm bootstrap`. The prefix applies to every index, including profiles and metadata. Seed Tuesday and Monday in either order:

```sh
SIM_MODE=backfill SIM_DAY=2026-11-10 pnpm sim
SIM_MODE=backfill SIM_DAY=2026-11-09 pnpm sim
```

Start the app with the same prefix. Leave it empty only when intentionally targeting the live event's datastore. Never run broad reset as part of a replay refresh.
