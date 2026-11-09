// Fetch the official KubeCon NA 2026 schedule page, extract the embedded
// Sessionize-format JSON, and write a trimmed snapshot to data/ so boots are
// reproducible. Run with `pnpm import-schedule`; commit the result.
import { writeFileSync } from "node:fs";

const SOURCE = "https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/";

type Raw = {
  sessions: any[];
  rooms: { id: number; name: string }[];
  categories: { id: number; title: string; items: { id: number; name: string; sort: number }[] }[];
  speakers: any[];
};

async function main() {
  const html = await (await fetch(SOURCE, { headers: { "user-agent": "affinity-schedule-import" } })).text();
  const m = html.match(/<script type="application\/json" class="sched-data">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("sched-data script tag not found");
  const all: Raw = JSON.parse(m[1]).all;
  const snapshot = {
    source: SOURCE,
    fetchedAt: new Date().toISOString(),
    timeZone: "America/Denver",
    sessions: all.sessions.map((s) => ({
      id: String(s.id),
      title: s.title,
      description: s.description ?? "",
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      roomId: s.roomId,
      categoryItems: s.categoryItems ?? [],
      speakers: s.speakers ?? [],
      isServiceSession: !!s.isServiceSession,
      isPlenumSession: !!s.isPlenumSession,
    })),
    rooms: all.rooms.map((r) => ({ id: r.id, name: r.name })),
    categories: all.categories.map((c) => ({
      id: c.id,
      title: c.title,
      items: c.items.map((i) => ({ id: i.id, name: i.name, sort: i.sort })),
    })),
    // Names only; no photos or bios.
    speakers: all.speakers.map((p) => ({ id: p.id, fullName: p.fullName, tagLine: p.tagLine ?? "" })),
  };
  writeFileSync("data/kcna26-schedule.json", JSON.stringify(snapshot, null, 1) + "\n");
  console.log(`sessions=${snapshot.sessions.length} rooms=${snapshot.rooms.length} speakers=${snapshot.speakers.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
