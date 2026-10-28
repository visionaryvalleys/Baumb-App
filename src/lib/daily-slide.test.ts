import { describe, expect, it } from "vitest";
import { dailySlideDue } from "./daily-slide";

describe("dailySlideDue", () => {
  it("shows on the first open of a day and stays away after it is slid", () => {
    expect(dailySlideDue(null, "2026-10-28")).toBe(true);
    expect(dailySlideDue("2026-10-27", "2026-10-28")).toBe(true);
    expect(dailySlideDue("2026-10-28", "2026-10-28")).toBe(false);
  });
});
