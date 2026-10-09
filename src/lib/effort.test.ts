import { describe, expect, it } from "vitest";
import { combineTones, effortAdvice, effortTone } from "./effort";

describe("effortTone", () => {
  it("calls a lighter set under-performance and a heavier set growth", () => {
    expect(effortTone(20, 30)).toBe("under");
    expect(effortTone(37.5, 37.5)).toBe("keep");
    expect(effortTone(40, 37.5)).toBe("grow");
  });

  it("treats a first session as maintenance", () => {
    expect(effortTone(20, null)).toBe("keep");
    expect(effortTone(null, 20)).toBe("keep");
  });

  it("lets one soft lift colour the whole day", () => {
    expect(combineTones(["keep", "grow", "under"])).toBe("under");
    expect(combineTones(["keep", "grow"])).toBe("grow");
    expect(effortAdvice("under")).toMatch(/under your last session/i);
  });
});
