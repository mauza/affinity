// Privacy floor: every interest-derived count below K_FLOOR is reported as
// "a few". Counts are encoded as numbers for compact series: 0 = nobody,
// 1 = "a few" (1-2 people), n >= 3 = n. Real 1s and 2s never leave the server.
import { K_FLOOR, MAX_FILTER_INTERESTS } from "./config";

export const FEW = 1;

export function floorCount(n: number): number {
  if (n <= 0) return 0;
  return n < K_FLOOR ? FEW : n;
}

export function countLabel(level: number): string {
  if (level <= 0) return "";
  return level === FEW ? "a few" : String(level);
}

export class BadRequest extends Error {}

/** An OR of at most three interest IDs; anything longer is rejected. */
export function parseInterestFilter(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
  if (ids.length > MAX_FILTER_INTERESTS) throw new BadRequest(`filter by at most ${MAX_FILTER_INTERESTS} interests`);
  if (ids.some((id) => !/^[a-z0-9][a-z0-9-]{0,80}$/.test(id))) throw new BadRequest("bad interest id");
  return ids;
}
