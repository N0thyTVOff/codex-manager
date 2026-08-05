import {
  createVaultSalt,
  createVaultVerification,
  decryptVaultPayload,
  deriveVaultKey,
  encryptVaultPayload,
  verifyVaultKey,
} from "@/lib/vault/crypto";
import { vaultAccountSchema } from "@/lib/vault/accounts";
import type { DecryptedVaultAccount } from "@/lib/vault/accounts";
import { VAULT_ENCRYPTION_VERSION, VAULT_KDF_ITERATIONS } from "@/types/vault";
import type { VaultAccountV1 } from "@/types/vault";

export interface VaultProfileEnvelope {
  readonly kdfAlgorithm: "PBKDF2-SHA-256";
  readonly kdfIterations: number;
  readonly kdfVersion: 1;
  readonly salt: string;
  readonly verificationCiphertext: string | null;
  readonly verificationIv: string | null;
  readonly schemaVersion: 1;
  readonly revision: number;
}

export interface VaultRecordEnvelope {
  readonly id: string;
  readonly ciphertext: string;
  readonly iv: string;
  readonly schemaVersion: 1;
  readonly revision: number;
}

export interface VaultSetup {
  readonly key: CryptoKey;
  readonly profile: Omit<
    VaultProfileEnvelope,
    "revision" | "verificationCiphertext" | "verificationIv"
  > & {
    readonly verificationCiphertext: string;
    readonly verificationIv: string;
  };
}

export interface VaultRotation {
  readonly key: CryptoKey;
  readonly request: {
    readonly profile: Omit<VaultProfileEnvelope, "verificationCiphertext" | "verificationIv"> & {
      readonly verificationCiphertext: string;
      readonly verificationIv: string;
    };
    readonly records: ReadonlyArray<VaultRecordEnvelope>;
  };
}

export async function createVaultSetup(passphrase: string): Promise<VaultSetup> {
  const salt = createVaultSalt();
  const key = await deriveVaultKey(passphrase, salt);
  const verification = await createVaultVerification(key);

  return {
    key,
    profile: {
      kdfAlgorithm: "PBKDF2-SHA-256",
      kdfIterations: VAULT_KDF_ITERATIONS,
      kdfVersion: 1,
      salt,
      verificationCiphertext: verification.ciphertext,
      verificationIv: verification.iv,
      schemaVersion: VAULT_ENCRYPTION_VERSION,
    },
  };
}

export async function unlockVaultKey(
  passphrase: string,
  profile: VaultProfileEnvelope,
): Promise<CryptoKey | null> {
  if (
    profile.kdfAlgorithm !== "PBKDF2-SHA-256" ||
    profile.kdfVersion !== 1 ||
    profile.schemaVersion !== VAULT_ENCRYPTION_VERSION ||
    !profile.verificationCiphertext ||
    !profile.verificationIv
  ) {
    return null;
  }

  const key = await deriveVaultKey(passphrase, profile.salt, profile.kdfIterations);
  const valid = await verifyVaultKey(key, {
    version: VAULT_ENCRYPTION_VERSION,
    ciphertext: profile.verificationCiphertext,
    iv: profile.verificationIv,
  });
  return valid ? key : null;
}

export async function rotateVaultLocally(
  currentPassphrase: string,
  nextPassphrase: string,
  profile: VaultProfileEnvelope,
  records: ReadonlyArray<VaultRecordEnvelope>,
): Promise<VaultRotation | null> {
  const currentKey = await unlockVaultKey(currentPassphrase, profile);
  if (!currentKey) return null;

  const plaintextRecords = await Promise.all(
    records.map(async (record) => ({
      id: record.id,
      revision: record.revision,
      value: await decryptVaultPayload<unknown>(
        currentKey,
        { version: record.schemaVersion, ciphertext: record.ciphertext, iv: record.iv },
        record.id,
      ),
    })),
  );
  const nextSetup = await createVaultSetup(nextPassphrase);
  const rotatedRecords = await Promise.all(
    plaintextRecords.map(async (record) => {
      const envelope = await encryptVaultPayload(nextSetup.key, record.value, record.id);
      return {
        id: record.id,
        revision: record.revision,
        ciphertext: envelope.ciphertext,
        iv: envelope.iv,
        schemaVersion: envelope.version,
      };
    }),
  );

  return {
    key: nextSetup.key,
    request: {
      profile: { ...nextSetup.profile, revision: profile.revision },
      records: rotatedRecords,
    },
  };
}

export async function decryptVaultAccounts(
  key: CryptoKey,
  records: ReadonlyArray<VaultRecordEnvelope>,
): Promise<DecryptedVaultAccount[]> {
  return Promise.all(
    records.map(async (record) => ({
      id: record.id,
      revision: record.revision,
      account: vaultAccountSchema.parse(
        await decryptVaultPayload<unknown>(
          key,
          { version: record.schemaVersion, ciphertext: record.ciphertext, iv: record.iv },
          record.id,
        ),
      ),
    })),
  );
}

export async function encryptVaultAccount(
  key: CryptoKey,
  id: string,
  account: VaultAccountV1,
): Promise<Omit<VaultRecordEnvelope, "id" | "revision">> {
  const validated = vaultAccountSchema.parse(account);
  const envelope = await encryptVaultPayload(key, validated, id);
  return {
    ciphertext: envelope.ciphertext,
    iv: envelope.iv,
    schemaVersion: envelope.version,
  };
}
