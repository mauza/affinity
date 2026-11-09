import { z } from "zod";
import { getProfile } from "@/lib/attendees";
import { includeSim, json, params, route } from "@/lib/http";
import { currentAttendeeId } from "@/lib/identity";
import { overlap, popularHere, trending } from "@/lib/insights";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const p = params(req);
  const kind = z.enum(["zone", "overlap", "trending"]).parse(p.get("kind") ?? "trending");
  const sim = includeSim(req);
  if (kind === "zone") return json({ insights: await popularHere(z.string().max(40).parse(p.get("zone")), new Date(), sim) });
  if (kind === "overlap") {
    const id = await currentAttendeeId();
    const prof = id ? await getProfile(id) : null;
    return json({ insights: await overlap(prof?.interests ?? [], sim) });
  }
  return json({ insights: await trending(new Date(), sim) });
});
