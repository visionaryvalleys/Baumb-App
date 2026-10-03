import { describe, expect, it } from "vitest";
import { calculateTrendSeries, calculateWeightTrend, linearRegression } from "./trend";
import { linearWeights } from "./test-helpers";

describe("linearRegression", () => {
  it("recovers an exact slope", () => {
    const r = linearRegression([0, 1, 2, 3].map((x) => ({ x, y: 10 - 0.5 * x })))!;
    expect(r.slopePerDay).toBeCloseTo(-0.5);
    expect(r.standardError).toBeCloseTo(0);
  });
  it("needs two distinct points", () => {
    expect(linearRegression([{ x: 1, y: 1 }])).toBeNull();
  });
});

describe("weight trend", () => {
  it("smooths daily noise", () => {
    const noisy = linearWeights("2026-03-01", 14, 80, 0).map((w, i) => ({ ...w, weightKg: 80 + (i % 2 ? 0.8 : -0.8) }));
    const series = calculateTrendSeries(noisy);
    const last = series.at(-1)!;
    expect(Math.abs(last.trendKg - 80)).toBeLessThan(0.8);
  });

  it("measures 7/14/30-day rates", () => {
    const weights = linearWeights("2026-03-01", 30, 85, -0.5);
    for (const window of [7, 14, 30]) {
      const t = calculateWeightTrend(weights, window, "2026-03-30");
      expect(t.sufficient).toBe(true);
      expect(t.ratePerWeekKg).toBeCloseTo(-0.5, 2);
    }
  });

  it("is marked insufficient with sparse data", () => {
    const weights = linearWeights("2026-03-28", 3, 85, -0.5);
    const t = calculateWeightTrend(weights, 30, "2026-03-30");
    expect(t.sufficient).toBe(false);
  });

  it("ignores data after asOf", () => {
    const weights = linearWeights("2026-03-01", 30, 85, -0.5);
    expect(calculateWeightTrend(weights, 7, "2026-03-10").latestKg).toBeCloseTo(85 - (0.5 / 7) * 9, 1);
  });
});
