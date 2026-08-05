import { and, count, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { vaultProfile, vaultRecord } from "@/db/schema";
import type {
  CreateVaultRecordInput,
  InitializeVaultProfileInput,
  UpdateVaultRecordInput,
} from "@/server/vault/contracts";
import { MAX_RECORDS_PER_USER } from "@/server/vault/contracts";

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

export async function createVaultRecord(
  database: Database,
  userId: string,
  input: CreateVaultRecordInput,
): Promise<VaultMutationResult<Awaited<ReturnType<typeof listVaultRecords>>[number]>> {
  const [recordCount] = await database
    .select({ total: count() })
    .from(vaultRecord)
    .where(eq(vaultRecord.userId, userId));

  if ((recordCount?.total ?? 0) >= MAX_RECORDS_PER_USER) {
    return { status: "limit_reached" };
  }

  const [record] = await database
    .insert(vaultRecord)
    .values({ userId, ...input })
    .onConflictDoNothing({ target: vaultRecord.id })
    .returning({
      id: vaultRecord.id,
      ciphertext: vaultRecord.ciphertext,
      iv: vaultRecord.iv,
      schemaVersion: vaultRecord.schemaVersion,
      revision: vaultRecord.revision,
      createdAt: vaultRecord.createdAt,
      updatedAt: vaultRecord.updatedAt,
    });

  return record ? { status: "ok", value: record } : { status: "conflict" };
}

export async function updateVaultRecord(
  database: Database,
  userId: string,
  id: string,
  input: UpdateVaultRecordInput,
): Promise<VaultMutationResult<Awaited<ReturnType<typeof listVaultRecords>>[number]>> {
  const [record] = await database
    .update(vaultRecord)
    .set({
      ciphertext: input.ciphertext,
      iv: input.iv,
      schemaVersion: input.schemaVersion,
      revision: input.revision + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(vaultRecord.id, id),
        eq(vaultRecord.userId, userId),
        eq(vaultRecord.revision, input.revision),
      ),
    )
    .returning({
      id: vaultRecord.id,
      ciphertext: vaultRecord.ciphertext,
      iv: vaultRecord.iv,
      schemaVersion: vaultRecord.schemaVersion,
      revision: vaultRecord.revision,
      createdAt: vaultRecord.createdAt,
      updatedAt: vaultRecord.updatedAt,
    });

  if (record) return { status: "ok", value: record };
  return (await ownsVaultRecord(database, userId, id))
    ? { status: "conflict" }
    : { status: "not_found" };
}

export async function deleteVaultRecord(
  database: Database,
  userId: string,
  id: string,
  revision: number,
): Promise<VaultMutationResult<{ id: string }>> {
  const [record] = await database
    .delete(vaultRecord)
    .where(
      and(
        eq(vaultRecord.id, id),
        eq(vaultRecord.userId, userId),
        eq(vaultRecord.revision, revision),
      ),
    )
    .returning({ id: vaultRecord.id });

  if (record) return { status: "ok", value: record };
  return (await ownsVaultRecord(database, userId, id))
    ? { status: "conflict" }
    : { status: "not_found" };
}

async function ownsVaultRecord(database: Database, userId: string, id: string): Promise<boolean> {
  const [record] = await database
    .select({ id: vaultRecord.id })
    .from(vaultRecord)
    .where(and(eq(vaultRecord.id, id), eq(vaultRecord.userId, userId)))
    .limit(1);
  return Boolean(record);
}
