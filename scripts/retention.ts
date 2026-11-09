// Retention: 7 days after the event (2026-11-19) delete all attendee data.
// Run daily by a CronJob; a no-op before the cutoff.
import { es, INDEX } from "@/lib/es";

const CUTOFF = new Date("2026-11-19T00:00:00-07:00");

async function main() {
  if (Date.now() < CUTOFF.getTime() && !process.env.FORCE_RETENTION) {
    console.log("before retention cutoff", CUTOFF.toISOString(), "- nothing to do");
    return;
  }
  const r = await es().deleteByQuery({
    index: [INDEX.attendees, INDEX.plans, INDEX.stints, INDEX.tables, INDEX.alerts, INDEX.notifications],
    query: { match_all: {} },
    refresh: true,
    conflicts: "proceed",
  });
  console.log("deleted", r.deleted, "docs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
