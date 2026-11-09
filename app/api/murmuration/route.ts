import { z } from "zod";
import { series } from "@/lib/aggregates";
import { DAY, includeSim, json, params, route } from "@/lib/http";
import { parseInterestFilter } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const p = params(req);
  const day = DAY.parse(p.get("day") ?? "2026-11-10");
  const kind = z.enum(["presence", "planned"]).parse(p.get("kind") ?? "presence");
  const interval = z.coerce.number().int().min(5).max(60).parse(p.get("interval") ?? 5);
  const s = await series(kind, day, { interests: parseInterestFilter(p.get("interests")), includeSim: includeSim(req) }, interval);
  return json(s, { headers: { "cache-control": "public, max-age=15" } });
});
