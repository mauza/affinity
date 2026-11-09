import { es } from "@/lib/es";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const h = await es().cluster.health({ timeout: "2s" });
    return json({ ok: h.status !== "red", es: h.status });
  } catch {
    return json({ ok: false }, 503);
  }
}
