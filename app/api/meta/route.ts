import { loadVenue } from "@/lib/data";
import { json } from "@/lib/http";
import { EVENT_DAYS, dayOf } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  const v = loadVenue();
  return json({
    source: v.source,
    floors: v.floors,
    zones: v.zones.map(({ roomIds: _r, ...z }) => z),
    facilities: v.facilities,
    meals: v.meals,
    days: EVENT_DAYS,
    today: dayOf(new Date()),
    now: new Date().toISOString(),
  });
}
