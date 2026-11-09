import { NextResponse } from "next/server";
import { z } from "zod";
import { BadRequest } from "./privacy";

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === "number" ? { status: init } : init);

type Handler = (req: Request) => Promise<Response>;

/** Uniform errors: 400 for validation, 500 (logged, no details) otherwise. */
export function route(fn: Handler): Handler {
  return async (req) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof BadRequest) return json({ error: e.message }, 400);
      if (e instanceof z.ZodError) return json({ error: "invalid request", issues: e.issues.map((i) => i.message) }, 400);
      console.error(req.method, new URL(req.url).pathname, (e as any)?.meta?.body ?? e);
      return json({ error: "internal error" }, 500);
    }
  };
}

export const params = (req: Request) => new URL(req.url).searchParams;
/** Simulated attendees are included unless ?live=1. */
export const includeSim = (req: Request) => params(req).get("live") !== "1";
export const body = async <T>(req: Request, schema: z.ZodType<T>): Promise<T> => schema.parse(await req.json().catch(() => ({})));
export const DAY = z.string().regex(/^2026-11-(0[89]|1[0-2])$/);
export const INTEREST_ID = z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/);
