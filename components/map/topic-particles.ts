export type ReplayTopic = { id: string; label: string; color: string };
export type ZoneTopics = Record<string, Record<string, number[]>>;
export type TopicParticle = { topic: string; slot: number; x: number; y: number; radius: number };

const slotsPerTopic = 320;
const hash = (value: string) => {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  result = Math.imul(result ^ result >>> 16, 0x85ebca6b);
  result = Math.imul(result ^ result >>> 13, 0xc2b2ae35);
  result ^= result >>> 16;
  return result >>> 0;
};

// One fixed scale for the whole replay, so seeking and changing floors never rescale a crowd.
export function topicParticleWeight(zones: ZoneTopics = {}) {
  let peak = 0;
  for (const topics of Object.values(zones)) for (const values of Object.values(topics)) {
    for (const value of values) if (value >= 3) peak = Math.max(peak, value);
  }
  return Math.max(1, Math.ceil(peak / slotsPerTopic));
}

export function particleFill(count: number, slot: number, weight: number) {
  // Both privacy-floor encodings use the same separate, non-countable cloud glyph.
  return count < 3 ? 0 : Math.min(1, Math.max(0, count / Math.max(1, weight) - slot));
}

export function roomParticles(zone: string, rect: number[], topics: Record<string, number[]> = {}, weight = 1): TopicParticle[] {
  const slots = Object.entries(topics).sort(([a], [b]) => a.localeCompare(b)).flatMap(([topic, values]) => {
    const peak = values.reduce((a, b) => Math.max(a, b), 0);
    return Array.from({ length: peak > 0 ? Math.max(1, Math.min(slotsPerTopic, Math.ceil(peak / weight))) : 0 }, (_, slot) => ({ topic, slot }));
  });
  if (!slots.length) return [];
  const [x, y, width, height] = rect;
  const margin = Math.min(width, height) * .07;
  const w = width - margin * 2, h = height - margin * 2;
  let columns = Math.max(1, Math.ceil(Math.sqrt(slots.length * w / h / .7)));
  let rows = Math.max(1, Math.ceil(slots.length / columns / .7));
  let cells: { column: number; row: number }[] = [];
  for (;;) {
    cells = [];
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const px = (column + .5) / columns, py = (row + .5) / rows;
      // Leave the center clear for the official room label.
      if (px > .2 && px < .8 && py > .34 && py < .66) continue;
      cells.push({ column, row });
    }
    if (cells.length >= slots.length) break;
    if (w / columns > h / rows) columns++; else rows++;
  }
  cells.sort((a, b) => hash(`${zone}:${a.column}:${a.row}`) - hash(`${zone}:${b.column}:${b.row}`));
  const dx = w / columns, dy = h / rows;
  const radius = Math.min(4.2, margin * .9, Math.max(1.4, Math.min(dx, dy) * .31));
  return slots.map((slot, i) => {
    const cell = cells[i], seed = hash(`${zone}:${slot.topic}:${slot.slot}`);
    let px = x + margin + (cell.column + .5 + ((seed % 101) / 100 - .5) * .55) * dx;
    let py = y + margin + (cell.row + .5 + ((seed % 97) / 96 - .5) * .55) * dy;
    const edge = radius * 1.05, left = x + width * .2, right = x + width * .8;
    const top = y + height * .34, bottom = y + height * .66;
    if (px + edge > left && px - edge < right && py + edge > top && py - edge < bottom) {
      const exits = [{ x: left - edge, y: py, distance: px - left + edge }, { x: right + edge, y: py, distance: right - px + edge },
        { x: px, y: top - edge, distance: py - top + edge }, { x: px, y: bottom + edge, distance: bottom - py + edge }];
      const nearest = exits.reduce((a, b) => a.distance < b.distance ? a : b);
      px = nearest.x; py = nearest.y;
    }
    return { ...slot, x: px, y: py, radius };
  });
}
