import { describe, expect, it } from "vitest";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "./auth-validation";

describe("auth validation", () => {
  it("normalizes and validates email", () => {
    expect(normalizeEmail("  Alex@Example.COM ")).toBe("alex@example.com");
    expect(validateEmail("alex@example.com")).toBeNull();
    expect(validateEmail("alex@example")).not.toBeNull();
    expect(validateEmail("")).not.toBeNull();
  });

  it("requires a reasonable password", () => {
    expect(validatePassword("short1")).not.toBeNull();
    expect(validatePassword("longenough")).not.toBeNull();
    expect(validatePassword("longenough1")).toBeNull();
  });

  it("requires a name", () => {
    expect(validateName("   ")).not.toBeNull();
    expect(validateName("Alex")).toBeNull();
  });
});
