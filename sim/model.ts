import { loadSchedule, loadVenue, zoneById } from "../lib/data";
import { buildTaxonomy } from "../lib/taxonomy";
import { buildSessions, type SessionDoc } from "../lib/sessions";
import { at } from "../lib/time";
import type { Stint } from "../lib/presence";
import { conferenceTopics } from "../lib/replay-topics";

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Persona = {
  id: string;
  interests: string[];
  newcomer: boolean;
  publicName: boolean;
  openness: number;
};
export const taxonomy = () => buildTaxonomy(loadSchedule());
export const sessions = () => buildSessions(taxonomy());
export function personas(seed: number, count: number): Persona[] {
  const r = rng(seed),
    tax = conferenceTopics(),
    all = sessions();
  const tracks = tax;
  const trackIds = new Set(tracks.map(i => i.id));
  const weighted = tracks.flatMap(
    (i) =>
      Array(
        [
          "ai-inference-agentic",
          "platform-engineering",
          "security",
          "observability",
        ].includes(i.id)
          ? 5
          : 1,
      ).fill(i.id) as string[],
  );
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  return Array.from({ length: count }, (_, n) => {
    const track = pick(weighted),
      interests = new Set([
        track,
        pick([
          "ai-inference-agentic",
          "platform-engineering",
          "security",
          "observability",
        ]),
      ]),
      target = 2 + Math.floor(r() * 4);
    const correlated = [
      ...new Set(
        all
          .filter((s) => s.interests.includes(track))
          .flatMap((s) => s.interests.filter(id => trackIds.has(id))),
      ),
    ];
    while (interests.size < target)
      interests.add(
        r() < 0.7 && correlated.length > 1 ? pick(correlated) : pick(tax).id,
      );
    return {
      id: `sim-${seed}-${n}`,
      interests: [...interests],
      newcomer: r() < 0.2,
      publicName: r() < 0.15,
      openness: 0.3 + r() * 0.6,
    };
  });
}
export function selectPlans(
  p: Persona,
  day: string,
  r: () => number,
): SessionDoc[] {
  if (day === "2026-11-09") return mondayPlans(p, r);
  const meal = loadVenue().meals.find((m) => m.day === day);
  const overlaps = (a: number, b: number, c: number, d: number) =>
    a < d && c < b;
  const candidates = sessions().filter(
    (s) =>
      s.day === day &&
      !s.service &&
      s.zone &&
      s.zone !== "hall-de" &&
      s.interests.some((i) => p.interests.includes(i)) &&
      (!meal ||
        !overlaps(
          +new Date(s.starts_at),
          +new Date(s.ends_at),
          +at(day, meal.start),
          +at(day, meal.end),
        )),
  );
  const ranked = candidates
    .map((s) => ({ s, rank: r() }))
    .sort((a, b) => a.s.ends_at.localeCompare(b.s.ends_at) || b.rank - a.rank);
  const chosen: SessionDoc[] = [],
    target = 4 + Math.floor(r() * 4);
  for (const { s } of ranked) {
    if (chosen.length === target) break;
    if (
      !chosen.some((c) =>
        overlaps(
          +new Date(s.starts_at),
          +new Date(s.ends_at),
          +new Date(c.starts_at),
          +new Date(c.ends_at),
        ),
      )
    )
      chosen.push(s);
  }
  return chosen.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
export function timeline(
  p: Persona,
  day: string,
  plans: SessionDoc[],
  r: () => number,
): Stint[] {
  if (day === "2026-11-09") return mondayTimeline(p, plans, r);
  const start = +at(day, "08:00") + Math.floor(r() * 90) * 60000,
    end = +at(day, "17:00") + Math.floor(r() * 120) * 60000;
  const meal = loadVenue().meals.find((m) => m.day === day);
  const appointments = plans
    .filter(() => r() > 0.12)
    .map((s) => ({
      start: +new Date(s.starts_at),
      end: +new Date(s.ends_at),
      zone: s.zone!,
    }));
  const keynote = sessions().filter(
    (s) =>
      s.day === day &&
      s.zone === "hall-de" &&
      +new Date(s.starts_at) < +at(day, "12:00"),
  );
  if (keynote.length)
    appointments.unshift({
      start: Math.min(...keynote.map((s) => +new Date(s.starts_at))) + Math.floor(r() * 12) * 60000,
      end: Math.max(...keynote.map((s) => +new Date(s.ends_at))) - Math.floor(r() * 8) * 60000,
      zone: "hall-de",
    });
  if (meal) {
    const arrival = +at(day, meal.start) + Math.floor(r() * 75) * 60000;
    appointments.push({ start: arrival, end: Math.min(+at(day, meal.end), arrival + (25 + Math.floor(r() * 25)) * 60000), zone: meal.zone });
  }
  const boundaries = new Set([start, end]);
  for (let t = start; t < end; t += 15 * 60000) boundaries.add(t);
  for (const a of appointments) {
    if (a.start > start && a.start < end) boundaries.add(a.start);
    if (a.end > start && a.end < end) boundaries.add(a.end);
  }
  const times = [...boundaries].sort((a, b) => a - b),
    out: Stint[] = [];
  const halls = [
    "halls-15",
    "cosmic-canyon",
    "alpine-overlook",
    "honeycomb-hub",
    "lower-concourse",
    "upper-concourse",
  ];
  for (let i = 0; i < times.length - 1; i++) {
    const t = times[i],
      appointment = appointments.find((a) => a.start <= t && a.end > t);
    const zone =
      i === 0
        ? r() < 0.5
          ? "main-entrance"
          : "lower-concourse"
        : (appointment?.zone ??
          (r() < 0.025
            ? "quiet-260a"
            : halls[Math.floor(r() * halls.length)]));
    const social = !appointment || zone === "halls-ac";
    const open =
      social && r() < p.openness
        ? p.interests.slice(0, 1 + Math.floor(r() * 2))
        : [];
    out.push({
      attendee_id: p.id,
      zone,
      floor: zoneById(zone)!.floor,
      active: {
        gte: new Date(t).toISOString(),
        lt: new Date(times[i + 1]).toISOString(),
      },
      interests: p.interests,
      open_topics: open,
      hint: open.length
        ? r() < 0.5
          ? "by the coffee station"
          : "near the GitOps sign"
        : null,
      newcomer: p.newcomer,
      source: "sim",
      created_at: new Date(t).toISOString(),
    });
  }
  return out;
}

// Monday is a collection of shorter visits rather than a full conference day.
// The real project lightning schedule supplies the talk times and coffee/lunch gaps.
function mondayPlans(p: Persona, r: () => number): SessionDoc[] {
  const all = sessions().filter(s => s.day === "2026-11-09" && s.zone && !s.service);
  const projectIds = new Set(loadSchedule().sessions.filter(s => s.categoryItems.includes(496288) && s.speakers.length).map(s => s.id));
  const talks = all.filter(s => projectIds.has(s.id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const events = all.filter(s => !projectIds.has(s.id) && s.zone !== "regency-cd" && s.interests.some(id => p.interests.includes(id)));
  if (events.length && r() < 0.22) return [events[Math.floor(r() * events.length)]];
  const blocks: SessionDoc[][] = [];
  for (const talk of talks) {
    const block = blocks.at(-1);
    if (!block || +new Date(talk.starts_at) - +new Date(block.at(-1)!.ends_at) > 10 * 60000) blocks.push([talk]);
    else block.push(talk);
  }
  const selected: SessionDoc[] = [];
  for (const block of blocks) {
    if (selected.length && r() < 0.72) continue;
    const count = 2 + Math.floor(r() * 4);
    const start = Math.floor(r() * Math.max(1, block.length - count + 1));
    selected.push(...block.slice(start, start + count));
  }
  return selected;
}

function mondayTimeline(p: Persona, plans: SessionDoc[], r: () => number): Stint[] {
  const out: Stint[] = [];
  function add(zone: string, start: number, end: number, social = false) {
    start = Math.max(start, out.length ? +new Date(out.at(-1)!.active.lt) : 0);
    if (end <= start) return;
    const open = social && r() < p.openness ? p.interests.slice(0, 1 + Math.floor(r() * 2)) : [];
    out.push({ attendee_id: p.id, zone, floor: zoneById(zone)!.floor, active: { gte: new Date(start).toISOString(), lt: new Date(end).toISOString() }, interests: p.interests, open_topics: open, hint: open.length ? "Synthetic conversation by the coffee station" : null, newcomer: p.newcomer, source: "sim", created_at: new Date(start).toISOString() });
  }
  for (const plan of plans) {
    const start = +new Date(plan.starts_at), end = +new Date(plan.ends_at);
    const foyer = plan.floor?.startsWith("hy") ? "hyatt-lobby" : "main-entrance";
    const visitStart = end - start > 60 * 60000 ? start + Math.floor(r() * Math.max(1, (end - start) / 60000 - 60)) * 60000 : start + Math.floor(r() * 2) * 30000;
    const visitEnd = Math.min(end, visitStart + (25 + Math.floor(r() * 30)) * 60000);
    if (!out.length || visitStart - +new Date(out.at(-1)!.active.lt) > 10 * 60000) add(foyer, visitStart - (4 + Math.floor(r() * 5)) * 60000, visitStart, true);
    add(plan.zone!, visitStart, visitEnd);
  }
  return out;
}
