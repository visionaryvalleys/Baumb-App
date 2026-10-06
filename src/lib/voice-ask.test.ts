import { describe, expect, it } from "vitest";
import { EMPTY_STATE } from "./store";
import { answerFromJournal, isVoiceQuestion } from "./voice-ask";

describe("voice questions", () => {
  it("treats questions as questions and logs as logs", () => {
    expect(isVoiceQuestion("How much protein do I have left?")).toBe(true);
    expect(isVoiceQuestion("what's today's workout")).toBe(true);
    expect(isVoiceQuestion("3 idli and I ran 5 km")).toBe(false);
  });

  it("reads an empty day from the journal", () => {
    expect(answerFromJournal("how much protein is left", EMPTY_STATE, "2026-10-06")).toBe("No protein logged today.");
    expect(answerFromJournal("what workout is today", EMPTY_STATE, "2026-10-06")).toBe("Rest day.");
    expect(answerFromJournal("bench 60 kg for 5", EMPTY_STATE, "2026-10-06")).toBeNull();
  });
});
