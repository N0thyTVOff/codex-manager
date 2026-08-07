import { describe, expect, it } from "vitest";

import {
  createVaultBackup,
  MAX_BACKUP_FILE_BYTES,
  parseVaultBackup,
  unlockVaultBackup,
} from "@/lib/vault/backup";
import { createVaultSetup, encryptVaultAccount } from "@/lib/vault/lifecycle";
import type { VaultAccountV1 } from "@/types/vault";

const account: VaultAccountV1 = {
  version: 1,
  label: "Compte de sauvegarde",
  login: "sauvegarde@example.test",
  password: "mot-de-passe-inactif",
  notes: "Fixture sans donnée réelle.",
  totpProvider: "other",
  totpSecret: "JBSWY3DPEHPK3PXP",
  purchasedOn: "2026-08-07",
  endsOn: "2026-09-07",
  quotaStatus: "available",
  quotaExhaustedAt: null,
  lastUsedAt: null,
  archivedAt: null,
};

describe("sauvegardes chiffrées", () => {
  it("exporte uniquement le profil cryptographique et les enveloppes", async () => {
    const setup = await createVaultSetup("ancienne phrase suffisamment longue");
    const id = "8919b498-c50e-4e63-8c12-71d9bd503b77";
    const envelope = await encryptVaultAccount(setup.key, id, account);
    const backup = createVaultBackup({ ...setup.profile, revision: 8 }, [
      { id, revision: 4, ...envelope },
    ]);
    const serialized = JSON.stringify(backup);

    expect(serialized).not.toContain(account.login);
    expect(serialized).not.toContain(account.password);
    expect(serialized).not.toContain(account.notes);
    expect(serialized).not.toContain(account.totpSecret!);
    expect(serialized).not.toContain("revision");
    expect(serialized).not.toContain("userId");
    expect(serialized).not.toContain("session");
    expect(serialized).not.toContain("github");
  });

  it("reste déverrouillable uniquement avec la phrase active lors de l’export", async () => {
    const setup = await createVaultSetup("ancienne phrase suffisamment longue");
    const id = "8919b498-c50e-4e63-8c12-71d9bd503b77";
    const envelope = await encryptVaultAccount(setup.key, id, account);
    const backup = createVaultBackup({ ...setup.profile, revision: 1 }, [
      { id, revision: 1, ...envelope },
    ]);

    await expect(
      unlockVaultBackup("ancienne phrase suffisamment longue", backup),
    ).resolves.toMatchObject({ accounts: [{ id, account }] });
    await expect(
      unlockVaultBackup("nouvelle phrase suffisamment longue", backup),
    ).resolves.toBeNull();
  });

  it("détecte une enveloppe altérée pendant la validation locale", async () => {
    const setup = await createVaultSetup("phrase de sauvegarde suffisamment longue");
    const id = "8919b498-c50e-4e63-8c12-71d9bd503b77";
    const envelope = await encryptVaultAccount(setup.key, id, account);
    const backup = createVaultBackup({ ...setup.profile, revision: 1 }, [
      { id, revision: 1, ...envelope },
    ]);
    const first = backup.records[0]!;
    const replacement = first.ciphertext.endsWith("A") ? "B" : "A";
    const altered = {
      ...backup,
      records: [{ ...first, ciphertext: `${first.ciphertext.slice(0, -1)}${replacement}` }],
    };

    await expect(
      unlockVaultBackup("phrase de sauvegarde suffisamment longue", altered),
    ).rejects.toThrow();
  });

  it("refuse les champs inattendus, les UUID dupliqués et les fichiers trop grands", () => {
    const envelope = {
      id: "8919b498-c50e-4e63-8c12-71d9bd503b77",
      ciphertext: "A".repeat(22),
      iv: "A".repeat(16),
      schemaVersion: 1,
    };
    const value = {
      format: "codex-manager-vault-backup",
      version: 1,
      profile: {
        kdfAlgorithm: "PBKDF2-SHA-256",
        kdfIterations: 600_000,
        kdfVersion: 1,
        salt: "A".repeat(22),
        verificationCiphertext: "A".repeat(22),
        verificationIv: "A".repeat(16),
        schemaVersion: 1,
      },
      records: [envelope, envelope],
    };

    expect(() => parseVaultBackup(JSON.stringify(value))).toThrow();
    expect(() =>
      parseVaultBackup(JSON.stringify({ ...value, records: [], userId: "interdit" })),
    ).toThrow();
    expect(() => parseVaultBackup("x".repeat(MAX_BACKUP_FILE_BYTES + 1))).toThrow();
  });
});
