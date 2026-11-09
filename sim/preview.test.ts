import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("previews either replay day without contacting Elasticsearch", () => {
  for (const day of ["2026-11-09", "2026-11-10"]) {
    const output = execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "sim/crowd-sim.ts"], { encoding: "utf8", env: { ...process.env, ES_URL: "http://127.0.0.1:1", SIM_MODE: "preview", SIM_DAY: day, SIM_PEOPLE: "8" } });
    const result = JSON.parse(output.trim());
    expect(result).toMatchObject({ mode: "preview", day, people: 8 });
    expect(result.stints).toBeGreaterThan(8);
    expect(result.topics.length).toBeLessThanOrEqual(12);
  }
});
