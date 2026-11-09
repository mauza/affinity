import { describe, expect, it } from "vitest";
import { BadRequest, countLabel, FEW, floorCount, parseInterestFilter } from "./privacy";

describe("k=3 floor", () => {
  it("hides 1 and 2 as 'a few'", () => {
    expect(floorCount(0)).toBe(0);
    expect(floorCount(1)).toBe(FEW);
    expect(floorCount(2)).toBe(FEW);
    expect(floorCount(3)).toBe(3);
    expect(floorCount(42)).toBe(42);
    expect(countLabel(floorCount(2))).toBe("a few");
    expect(countLabel(0)).toBe("");
  });
});

describe("interest filter", () => {
  it("allows an OR of up to 3 interests", () => {
    expect(parseInterestFilter("argo, cilium,argo")).toEqual(["argo", "cilium"]);
    expect(parseInterestFilter(null)).toEqual([]);
  });
  it("rejects narrowing filters and junk", () => {
    expect(() => parseInterestFilter("a,b,c,d")).toThrow(BadRequest);
    expect(() => parseInterestFilter("ARGO")).toThrow(BadRequest);
  });
});
