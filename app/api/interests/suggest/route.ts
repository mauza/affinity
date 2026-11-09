import { json, params, route } from "@/lib/http";
import { suggestInterests } from "@/lib/search/interests";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => json({ interests: await suggestInterests(params(req).get("q") ?? "", 8) }));
