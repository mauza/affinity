// Idempotent bootstrap, run as a Kubernetes Job (and locally via
// `pnpm bootstrap`): license, inference endpoint, index mappings, then the
// schedule/zones/taxonomy import. Re-imports only when the data changed.
import { createHash } from "node:crypto";
import { config } from "@/lib/config";
import { es, INDEX } from "@/lib/es";
import { MAPPINGS, SETTINGS } from "@/lib/indices";
import { loadSchedule, loadVenue } from "@/lib/data";
import { buildTaxonomy } from "@/lib/taxonomy";
import { buildSessions } from "@/lib/sessions";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function waitForEs() {
  for (let i = 0; i < 90; i++) {
    try {
      const h = await es().cluster.health({ wait_for_status: "yellow", timeout: "5s" });
      log("es", h.status);
      return;
    } catch (e) {
      log("waiting for elasticsearch:", (e as Error).message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error("elasticsearch not reachable");
}

async function ensureLicense() {
  const { license } = await es().license.get();
  if (license.type === "basic") {
    const r = await es().license.postStartTrial({ acknowledge: true });
    log("trial license:", r.trial_was_started ? "started" : r.error_message);
  } else log("license:", license.type, license.status);
}

async function ensureInference() {
  const id = config.inferenceId;
  try {
    await es().inference.get({ inference_id: id, task_type: "text_embedding" });
    log("inference endpoint exists:", id);
    return;
  } catch {
    /* create below */
  }
  await es().inference.put({
    task_type: "text_embedding",
    inference_id: id,
    inference_config: {
      service: "openai",
      service_settings: {
        // llama.cpp ignores the key; ES requires one.
        api_key: "unused",
        model_id: config.embedModel,
        url: `${config.esEmbedUrl}/embeddings`,
        similarity: "cosine",
        rate_limit: { requests_per_minute: 60000 },
      },
    } as any,
  });
  log("inference endpoint created:", id);
}

async function ensureIndices() {
  for (const [index, properties] of Object.entries(MAPPINGS)) {
    if (await es().indices.exists({ index })) {
      await es().indices.putMapping({ index, properties });
    } else {
      await es().indices.create({ index, settings: SETTINGS, mappings: { dynamic: "strict", properties } });
      log("created index", index);
    }
  }
}

async function bulk(index: string, docs: { id: string; doc: object }[]) {
  for (let i = 0; i < docs.length; i += 100) {
    const chunk = docs.slice(i, i + 100);
    const r = await es().bulk({
      refresh: false,
      operations: chunk.flatMap(({ id, doc }) => [{ index: { _index: index, _id: id } }, doc]),
    });
    if (r.errors) {
      const first = r.items.find((it) => it.index?.error)?.index?.error;
      throw new Error(`bulk ${index} failed: ${JSON.stringify(first)}`);
    }
  }
  await es().indices.refresh({ index });
  log(`indexed ${docs.length} into ${index}`);
}

async function importData() {
  const schedule = loadSchedule();
  const venue = loadVenue();
  const hash = createHash("sha256")
    .update(JSON.stringify([schedule.fetchedAt, schedule.sessions.length, venue, buildTaxonomy(schedule).length, 2]))
    .digest("hex");
  const meta = await es().get({ index: INDEX.meta, id: "import" }, { ignore: [404] });
  if ((meta as any).found && (meta as any)._source?.value?.hash === hash && !process.env.FORCE_IMPORT) {
    log("data unchanged, skipping import");
    return;
  }
  const interests = buildTaxonomy(schedule);
  const sessions = buildSessions(interests, schedule);
  const counts = new Map<string, number>();
  for (const s of sessions) for (const i of s.interests) counts.set(i, (counts.get(i) ?? 0) + 1);

  await bulk(INDEX.zones, venue.zones.map((z) => ({
    id: z.id,
    doc: { id: z.id, name: z.name, floor: z.floor, kind: z.kind, parent: z.parent ?? null, room_ids: z.roomIds.map(String) },
  })));
  await bulk(INDEX.interests, interests.map((i) => ({
    id: i.id,
    doc: {
      id: i.id, label: i.label, label_kw: i.label, aliases: i.aliases, kind: i.kind, parent: i.parent ?? null,
      description: i.description, semantic: `${i.label}. ${i.aliases.join(", ")}. ${i.description}`,
      session_count: counts.get(i.id) ?? 0, created_at: new Date().toISOString(),
    },
  })));
  await bulk(INDEX.sessions, sessions.map((s) => ({ id: s.id, doc: s })));
  await es().index({ index: INDEX.meta, id: "import", document: { key: "import", value: { hash, at: new Date().toISOString() } }, refresh: true });
}

async function main() {
  await waitForEs();
  await ensureLicense();
  await ensureInference();
  await ensureIndices();
  await importData();
  log("bootstrap done");
}

main().catch((e) => {
  console.error(e?.meta?.body ? JSON.stringify(e.meta.body) : e);
  process.exit(1);
});
