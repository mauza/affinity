import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadSchedule, loadVenue, zoneForRoom } from "./data";

describe("official venue map calibration", () => {
  const venue = loadVenue();
  it("keeps every activity region inside its floor's calibrated view", () => {
    expect(venue.floors).toHaveLength(4);
    for (const zone of venue.zones) {
      const floor = venue.floors.find(f => f.id === zone.floor)!;
      expect(floor, zone.id).toBeDefined();
      const [x,y,w,h] = zone.rect, [left,top,width,height] = floor.viewBox;
      expect(x, zone.id).toBeGreaterThanOrEqual(left);
      expect(y, zone.id).toBeGreaterThanOrEqual(top);
      expect(x+w, zone.id).toBeLessThanOrEqual(left+width);
      expect(y+h, zone.id).toBeLessThanOrEqual(top+height);
      expect(w*h, zone.id).toBeGreaterThan(0);
    }
  });
  it("preserves schedule room coverage after replacing schematic coordinates", () => {
    for (const room of loadSchedule().rooms) {
      if (venue.excludedRoomIds.includes(room.id)) continue;
      expect(zoneForRoom(room.id), room.name).toBeDefined();
    }
  });
  it("ships the attributed vector backdrop used by every floor", () => {
    for (const floor of venue.floors) {
      expect(floor.background?.href).toBe("/maps/kubecon-na-2026.svg");
    }
    const artwork = readFileSync("public/maps/kubecon-na-2026.svg", "utf8");
    expect(artwork).toContain('viewBox="0 0 8503.94 6912"');
    expect(artwork).not.toMatch(/<script\b/i);
    expect(venue.source).toContain("The Linux Foundation");
  });
});
