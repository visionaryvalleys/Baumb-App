import { describe, expect, it } from "vitest";
import { confirmPassword, normalizeEmail, safeNextPath, validateEmail, validateName, validatePassword } from "./auth-validation";

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

  it("asks for the password a second time before it is saved", () => {
    expect(confirmPassword("longenough1", "")).toBe("Confirm your password.");
    expect(confirmPassword("longenough1", "longenough2")).toBe("Those passwords don't match.");
    expect(confirmPassword("longenough1", "longenough1")).toBeNull();
  });

  it("keeps post-login paths on this site", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/signin")).toBe("/dashboard");
    expect(safeNextPath("/nutrition")).toBe("/nutrition");
  });

  it("requires a name", () => {
    expect(validateName("   ")).not.toBeNull();
    expect(validateName("Alex")).toBeNull();
  });
});
