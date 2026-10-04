import { describe, expect, it } from "vitest";
import { buildHealthContext } from "./health-context";
import { buildSampleState } from "./sample";
import { EMPTY_STATE } from "./store";

describe("buildHealthContext", () => {
  it("summarises the user's own plan, today's food and recent logs", () => {
    const text = buildHealthContext(buildSampleState({ firstName: "Sreeteish", lastName: "" }));
    expect(text).toContain("name Sreeteish");
    expect(text).toMatch(/Plan V\d+ targets per day: \d+ kcal, protein \d+/);
    expect(text).toMatch(/Weight: [\d.]+ kg/);
    expect(text.length).toBeLessThanOrEqual(7_500);
  });

  it("says when there is no plan yet instead of inventing one", () => {
    const text = buildHealthContext({ ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, timezone: "Asia/Kolkata" } });
    expect(text).toContain("hasn't finished onboarding");
    expect(text).toContain("No food logged today yet.");
  });
});
