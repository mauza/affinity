import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadSchedule, loadVenue, zoneForRoom } from "./data";

describe("official venue map calibration", () => {
  const venue = loadVenue();
  it("keeps every activity region inside its floor's calibrated view", () => {
    expect(venue.floors.map(f => f.id)).toEqual(["sp1", "sp2", "sp3", "hy2", "hy3", "hy4", "hy5"]);
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
  it("makes every room labelled on the official map selectable", () => {
    // Room labels on the official PDF (meeting, breakout, lounge and session rooms).
    const rooms = [
      "Hall DE", "Halls A–C", "Halls 1–5", "Grand Ballroom J", "Grand Ballroom H", "Grand Ballroom BDF", "Grand Ballroom GI",
      "Grand Ballroom ACE", "151", ..."ABCDEF".split("").map(l => `150 ${l}`), ..."ABCDEF".split("").map(l => `155 ${l}`),
      "Cloud Native Theater", "Project Pavilion", "Poster Pavilion", "Demo Theater", "Network Nook", "Hyatt Regency Lobby",
      "250 A–C", "250 D–F", "251 A–C", "251 D–F", "252 A", "252 B", "253", "254", "255 A", "255 BC", "255 D", "255 EF",
      "257 A", "257 B", "258", "259", "260 A", "260 B", ..."ABCDEF".split("").map(l => `355 ${l}`),
      "Salt Lake Ballroom A", "Salt Lake Ballroom B", "Salt Lake Ballroom C", "Salt Lake Ballroom DE", "The Nest", "Aspen",
      "Blue Spruce", "Juniper", "Cottonwood", "Park City", "Alta", "Snowbird", "Solitude", "Brighton", "Powder Mountain",
      "Snowbasin", "Woodward", "Deer Valley", "Regency Ballroom A", "Regency Ballroom B", "Regency Ballroom CD", "Traverse",
      "Wasatch", "Broadcast Lounge", "Zion", "Bryce", "Canyonlands", "Arches", "Capitol Reef",
    ];
    const names = venue.zones.map(z => z.name.split(" · ")[0]);
    for (const room of rooms) expect(names, room).toContain(room);
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
