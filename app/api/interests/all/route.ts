import { json, route } from "@/lib/http";
import { allInterests } from "@/lib/search/interests";

export const dynamic = "force-dynamic";

export const GET = route(async () => json({ interests: await allInterests() }, { headers: { "cache-control": "public, max-age=60" } }));
