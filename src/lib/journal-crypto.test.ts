import { describe, expect, it } from "vitest";
import { createJournalKey, encryptJournal, JOURNAL_KDF, openJournal } from "./journal-crypto";
import type { AppState } from "./types";

const FAST = { t: 1, m: 32, p: 1, dkLen: 32 };

describe("journal encryption", () => {
  it("round-trips the account document and rejects a wrong passphrase", async () => {
    await createJournalKey("correct horse battery", FAST);
    const envelope = await encryptJournal({ schemaVersion: 2, onboarded: true } as AppState);
    expect(envelope.baumbEnc).toBe(1);
    expect(envelope.ciphertext).not.toContain("onboarded");
    const opened = await openJournal(envelope, "correct horse battery");
    expect(opened.onboarded).toBe(true);
    await expect(openJournal(envelope, "wrong passphrase")).rejects.toThrow(/did not open/);
  });

  it("uses the production cost only as the default", () => {
    expect(JOURNAL_KDF.m).toBeGreaterThanOrEqual(19_000);
    expect(JOURNAL_KDF.dkLen).toBe(32);
  });
});
