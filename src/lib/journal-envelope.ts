/** Ciphertext saved in place of the account document. The key never leaves the device. */
export interface JournalEnvelope {
  baumbEnc: 1;
  kdf: "argon2id";
  salt: string;
  t: number;
  m: number;
  p: number;
  nonce: string;
  ciphertext: string;
}

export function isJournalEnvelope(value: unknown): value is JournalEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<JournalEnvelope>;
  return v.baumbEnc === 1 && v.kdf === "argon2id" && typeof v.salt === "string" && typeof v.nonce === "string" && typeof v.ciphertext === "string" && typeof v.t === "number" && typeof v.m === "number" && typeof v.p === "number";
}
