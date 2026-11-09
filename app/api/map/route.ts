import { z } from "zod";
import { snapshot } from "@/lib/aggregates";
import { includeSim, json, params, route } from "@/lib/http";
import { parseInterestFilter } from "@/lib/privacy";

export const dynamic = "force-dynamic";

/** Per-zone counts: 0 = nobody, 1 = "a few", n >= 3 = n. */
export const GET = route(async (req) => {
  const p = params(req);
  const mode = z.enum(["now", "open", "planned"]).parse(p.get("mode") ?? "now");
  const atParam = p.get("at");
  const at = atParam ? new Date(z.iso.datetime({ offset: true }).parse(atParam)) : new Date();
  const counts = await snapshot(mode, { interests: parseInterestFilter(p.get("interests")), includeSim: includeSim(req) }, at);
  return json({ mode, at: at.toISOString(), counts });
});
