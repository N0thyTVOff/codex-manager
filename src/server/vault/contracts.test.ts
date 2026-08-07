import { describe, expect, it } from "vitest";

import {
  createVaultRecordSchema,
  initializeVaultProfileSchema,
  restoreVaultSchema,
  updateVaultRecordSchema,
} from "@/server/vault/contracts";

const envelope = {
  ciphertext: "A".repeat(22),
  iv: "A".repeat(16),
  schemaVersion: 1 as const,
};

describe("contrats du coffre", () => {
  it("accepte uniquement un profil cryptographique complet", () => {
    expect(
      initializeVaultProfileSchema.safeParse({
        kdfAlgorithm: "PBKDF2-SHA-256",
        kdfIterations: 600_000,
        kdfVersion: 1,
        salt: "A".repeat(22),
        verificationCiphertext: envelope.ciphertext,
        verificationIv: envelope.iv,
        schemaVersion: 1,
      }).success,
    ).toBe(true);
  });

  it("refuse un userId et les champs inconnus", () => {
    expect(
      createVaultRecordSchema.safeParse({
        id: "8919b498-c50e-4e63-8c12-71d9bd503b77",
        userId: "utilisateur-imposé",
        ...envelope,
      }).success,
    ).toBe(false);
  });

  it("exige un UUID client et une révision positive", () => {
    expect(createVaultRecordSchema.safeParse({ id: "record-1", ...envelope }).success).toBe(false);
    expect(
      updateVaultRecordSchema.safeParse({ ...envelope, revision: 0, profileRevision: 1 }).success,
    ).toBe(false);
    expect(
      updateVaultRecordSchema.safeParse({ ...envelope, revision: 1, profileRevision: 1 }).success,
    ).toBe(true);
  });

  it("valide une restauration versionnée sans accepter d’identité", () => {
    const backup = {
      format: "codex-manager-vault-backup",
      version: 1,
      profile: {
        kdfAlgorithm: "PBKDF2-SHA-256",
        kdfIterations: 600_000,
        kdfVersion: 1,
        salt: "A".repeat(22),
        verificationCiphertext: envelope.ciphertext,
        verificationIv: envelope.iv,
        schemaVersion: 1,
      },
      records: [],
    };
    expect(restoreVaultSchema.safeParse({ profileRevision: 2, backup }).success).toBe(true);
    expect(
      restoreVaultSchema.safeParse({ profileRevision: 2, backup, userId: "interdit" }).success,
    ).toBe(false);
  });
});
