import { describe, expect, it } from "vitest";
import { canSeePost, postProblem, quarterOf, reelSecondsOk } from "./gallery";

const now = new Date("2026-10-10T00:00:00Z");

describe("gallery visibility", () => {
  it("shows a post to its author and to followers only", () => {
    expect(canSeePost("a", "a", false)).toBe(true);
    expect(canSeePost("b", "a", true)).toBe(true);
    expect(canSeePost("b", "a", false)).toBe(false);
  });

  it("maps October to Q4 and accepts a 30–90 second reel", () => {
    expect(quarterOf(now)).toBe(4);
    expect(reelSecondsOk(30)).toBe(true);
    expect(reelSecondsOk(90)).toBe(true);
    expect(reelSecondsOk(29)).toBe(false);
    expect(reelSecondsOk(91)).toBe(false);
  });

  it("requires a photo for a quarter and a timed video for a reel", () => {
    expect(postProblem({ kind: "daily", caption: "", hasFile: false, fileType: "", bytes: 0, durationSec: null, quarter: null, year: null, now })).toMatch(/photo or a few words/);
    expect(postProblem({ kind: "daily", caption: "Pulled up today", hasFile: false, fileType: "", bytes: 0, durationSec: null, quarter: null, year: null, now })).toBeNull();
    expect(postProblem({ kind: "quarter", caption: "", hasFile: true, fileType: "image/jpeg", bytes: 1000, durationSec: null, quarter: 4, year: 2026, now })).toBeNull();
    expect(postProblem({ kind: "quarter", caption: "", hasFile: false, fileType: "", bytes: 0, durationSec: null, quarter: 4, year: 2026, now })).toMatch(/photo/);
    expect(postProblem({ kind: "reel", caption: "", hasFile: true, fileType: "video/mp4", bytes: 1000, durationSec: 45, quarter: null, year: null, now })).toBeNull();
    expect(postProblem({ kind: "reel", caption: "", hasFile: true, fileType: "video/mp4", bytes: 1000, durationSec: 10, quarter: null, year: null, now })).toMatch(/30 and 90/);
  });
});
