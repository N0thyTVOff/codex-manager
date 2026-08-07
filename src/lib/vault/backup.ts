import { z } from "zod";

import type { DecryptedVaultAccount } from "@/lib/vault/accounts";
import {
  decryptVaultAccounts,
  unlockVaultKey,
  type VaultProfileEnvelope,
  type VaultRecordEnvelope,
} from "@/lib/vault/lifecycle";

export const VAULT_BACKUP_FORMAT = "codex-manager-vault-backup" as const;
export const VAULT_BACKUP_VERSION = 1 as const;
export const MAX_BACKUP_RECORDS = 100;
export const MAX_BACKUP_FILE_BYTES = 4_000_000;
const MAX_ENCRYPTED_PAYLOAD_LENGTH = 32_768;

const base64UrlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/u);
const encryptedValueSchema = base64UrlSchema.min(22).max(MAX_ENCRYPTED_PAYLOAD_LENGTH);

export const backupProfileSchema = z.strictObject({
  kdfAlgorithm: z.literal("PBKDF2-SHA-256"),
  kdfIterations: z.number().int().min(600_000).max(2_000_000),
  kdfVersion: z.literal(1),
  salt: base64UrlSchema.min(22).max(64),
  verificationCiphertext: encryptedValueSchema,
  verificationIv: base64UrlSchema.length(16),
  schemaVersion: z.literal(1),
});

export const backupRecordSchema = z.strictObject({
  id: z.string().uuid(),
  ciphertext: encryptedValueSchema,
  iv: base64UrlSchema.length(16),
  schemaVersion: z.literal(1),
});

export const vaultBackupSchema = z
  .strictObject({
    format: z.literal(VAULT_BACKUP_FORMAT),
    version: z.literal(VAULT_BACKUP_VERSION),
    profile: backupProfileSchema,
    records: z.array(backupRecordSchema).max(MAX_BACKUP_RECORDS),
  })
  .superRefine((backup, context) => {
    const ids = new Set<string>();
    for (const [index, record] of backup.records.entries()) {
      if (ids.has(record.id)) {
        context.addIssue({
          code: "custom",
          message: "Identifiant de fiche dupliqué.",
          path: ["records", index, "id"],
        });
      }
      ids.add(record.id);
    }
  });

export type VaultBackupV1 = z.infer<typeof vaultBackupSchema>;

export function createVaultBackup(
  profile: VaultProfileEnvelope,
  records: ReadonlyArray<VaultRecordEnvelope>,
): VaultBackupV1 {
  return vaultBackupSchema.parse({
    format: VAULT_BACKUP_FORMAT,
    version: VAULT_BACKUP_VERSION,
    profile: {
      kdfAlgorithm: profile.kdfAlgorithm,
      kdfIterations: profile.kdfIterations,
      kdfVersion: profile.kdfVersion,
      salt: profile.salt,
      verificationCiphertext: profile.verificationCiphertext,
      verificationIv: profile.verificationIv,
      schemaVersion: profile.schemaVersion,
    },
    records: records.map(({ id, ciphertext, iv, schemaVersion }) => ({
      id,
      ciphertext,
      iv,
      schemaVersion,
    })),
  });
}

export function parseVaultBackup(value: string): VaultBackupV1 {
  if (new TextEncoder().encode(value).byteLength > MAX_BACKUP_FILE_BYTES) {
    throw new Error("backup_too_large");
  }
  return vaultBackupSchema.parse(JSON.parse(value) as unknown);
}

export async function unlockVaultBackup(
  passphrase: string,
  backup: VaultBackupV1,
): Promise<{
  key: CryptoKey;
  accounts: ReadonlyArray<DecryptedVaultAccount>;
} | null> {
  const profile: VaultProfileEnvelope = { ...backup.profile, revision: 1 };
  const key = await unlockVaultKey(passphrase, profile);
  if (!key) return null;
  const records: VaultRecordEnvelope[] = backup.records.map((record) => ({
    ...record,
    revision: 1,
  }));
  return { key, accounts: await decryptVaultAccounts(key, records) };
}
