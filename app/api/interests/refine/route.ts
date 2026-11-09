import { z } from "zod";
import { body, json, route } from "@/lib/http";
import { refineInterests } from "@/lib/ai/refine";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const { text } = await body(req, z.object({ text: z.string().min(2).max(1000) }));
  return json(await refineInterests(text));
});
