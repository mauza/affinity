# Crowd simulator

Run the bundled Job with `node dist/sim/crowd-sim.cjs` in the app image (working directory `/app`, including `data/`). Use the app's `ES_URL`, `ES_USERNAME` and secret-backed `ES_PASSWORD`.

| Variable | Default | Meaning |
| --- | --- | --- |
| SIM_MODE | backfill | `backfill`, `live`, or `reset` |
| SIM_DAY | 2026-11-10 | Schedule day in MST |
| SIM_PEOPLE | 600 | Total persona population across all shards |
| SIM_SEED | 42 | Reproducible population; use a separate seed for independent runs |
| SIM_SPEED | 1 | Live schedule clock multiplier; writes use actual wall time |
| SIM_SHARDS | 1 | Live replica count |
| SIM_SHARD | 0 | Live replica index; fallback JOB_COMPLETION_INDEX, then numeric HOSTNAME suffix, modulo shard count |

Backfill replaces simulated plans/stints/tables for the selected day and all simulated profiles. Do not run it concurrently with live simulators. Reset removes simulated profiles, plans and stints across all days, sim-only tables, and alerts/notifications owned by `sim-` attendee IDs. Tables use the existing `sources` array mapping, not an additional `source` field; mixed live/sim tables are preserved by cleanup. The shared table recomputation path can update mixed tables and notify existing subscribers.

Live starts at the current MST clock time on SIM_DAY, progresses through the schedule at SIM_SPEED, and continues running after the venue closes. SIGTERM/SIGINT stops further actions; existing 30-minute stints expire naturally. Presence writes use the shared check-in/renew/leave code, including table recomputation. Use a distinct seed from a backfill to avoid sharing attendee IDs. The simulator bulk-writes profiles with the same mapped fields as saveProfile, avoiding a refresh per attendee.

Local usage: `SIM_MODE=backfill pnpm sim`; `SIM_MODE=live SIM_DAY=2026-11-09 SIM_SEED=43 SIM_SPEED=10 pnpm sim`. Credentials must already be exported. `pnpm exec tsx sim/verify.ts` prints replay samples, table history and per-session planned counts; SIM_DAY selects the day. Logs and verification contain synthetic aggregates only.

Backfill writes explicit contiguous [start,end) ranges. Each attendee arrives 08:00–09:30, joins the morning Hall D–E block, mostly follows their accepted matching sessions, spends the meal window in Halls A–C, and leaves 17:00–19:00. Ten-minute table recomputation retains each topic's final state (usually dissolved); history is not a sequence of table snapshots. The replay itself uses the complete stint ranges.
