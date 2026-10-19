import { describe, expect, it } from "vitest";
import { assertResetPage, maskEmail, resetBlocker } from "./password-reset";

const open = {
  arrivedAt: "2026-10-19T00:00:00.000Z",
  usedAt: null,
  expiresAt: "2026-10-19T00:20:00.000Z",
  attempts: 0,
};

describe("password reset gate", () => {
  const now = new Date("2026-10-19T00:05:00.000Z");

  it("allows a code only after the reset page has been opened", () => {
    expect(resetBlocker(open, now)).toBeNull();
    expect(resetBlocker({ ...open, arrivedAt: null }, now)).toMatch(/reset page/);
  });

  it("rejects a used, expired, or over-tried code", () => {
    expect(resetBlocker({ ...open, usedAt: open.arrivedAt }, now)).toMatch(/already been used/);
    expect(resetBlocker({ ...open, expiresAt: "2026-10-19T00:04:00.000Z" }, now)).toMatch(/expired/);
    expect(resetBlocker({ ...open, attempts: 5 }, now)).toMatch(/Too many/);
  });

  it("accepts the code only from the reset page", () => {
    expect(assertResetPage("/reset")).toBeNull();
    expect(assertResetPage("/signin")).toMatch(/reset page/);
    expect(assertResetPage(undefined)).toMatch(/reset page/);
  });

  it("hides most of the recovery address", () => {
    expect(maskEmail("alex@example.com")).toBe("a•••@example.com");
  });
});
