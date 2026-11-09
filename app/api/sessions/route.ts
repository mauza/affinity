import { DAY, json, params, route } from "@/lib/http";
import { parseInterestFilter } from "@/lib/privacy";
import { searchSessions } from "@/lib/search/sessions";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const p = params(req);
  const day = p.get("day") ? DAY.parse(p.get("day")) : undefined;
  const sessions = await searchSessions({
    q: p.get("q")?.slice(0, 300) ?? undefined,
    day,
    interests: parseInterestFilter(p.get("interests")),
    size: 30,
  });
  return json({ sessions });
});
