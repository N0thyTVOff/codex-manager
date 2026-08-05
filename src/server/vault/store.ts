import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { vaultProfile, vaultRecord } from "@/db/schema";
import type { InitializeVaultProfileInput } from "@/server/vault/contracts";

export type VaultMutationResult<T> =
  | { status: "ok"; value: T }
  | { status: "conflict" }
  | { status: "not_found" }
  | { status: "limit_reached" };

export async function readVaultProfile(database: Database, userId: string) {
  const [profile] = await database
    .select({
      kdfAlgorithm: vaultProfile.kdfAlgorithm,
      kdfIterations: vaultProfile.kdfIterations,
      kdfVersion: vaultProfile.kdfVersion,
      salt: vaultProfile.salt,
      verificationCiphertext: vaultProfile.verificationCiphertext,
      verificationIv: vaultProfile.verificationIv,
      schemaVersion: vaultProfile.schemaVersion,
      revision: vaultProfile.revision,
    })
    .from(vaultProfile)
    .where(eq(vaultProfile.userId, userId))
    .limit(1);

  return profile ?? null;
}

export async function initializeVaultProfile(
  database: Database,
  userId: string,
  input: InitializeVaultProfileInput,
): Promise<VaultMutationResult<NonNullable<Awaited<ReturnType<typeof readVaultProfile>>>>> {
  const [profile] = await database
    .insert(vaultProfile)
    .values({ userId, ...input })
    .onConflictDoNothing({ target: vaultProfile.userId })
    .returning({
      kdfAlgorithm: vaultProfile.kdfAlgorithm,
      kdfIterations: vaultProfile.kdfIterations,
      kdfVersion: vaultProfile.kdfVersion,
      salt: vaultProfile.salt,
      verificationCiphertext: vaultProfile.verificationCiphertext,
      verificationIv: vaultProfile.verificationIv,
      schemaVersion: vaultProfile.schemaVersion,
      revision: vaultProfile.revision,
    });

  return profile ? { status: "ok", value: profile } : { status: "conflict" };
}

export async function listVaultRecords(database: Database, userId: string) {
  return database
    .select({
      id: vaultRecord.id,
      ciphertext: vaultRecord.ciphertext,
      iv: vaultRecord.iv,
      schemaVersion: vaultRecord.schemaVersion,
      revision: vaultRecord.revision,
      createdAt: vaultRecord.createdAt,
      updatedAt: vaultRecord.updatedAt,
    })
    .from(vaultRecord)
    .where(eq(vaultRecord.userId, userId))
    .orderBy(vaultRecord.createdAt);
}
