import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { user, vaultRecord } from "@/db/schema";
import { initializeVaultProfile, listVaultRecords, readVaultProfile } from "@/server/vault/store";
import {
  createVaultRecordTransaction,
  deleteVaultRecordTransaction,
  replaceVaultTransaction,
  rotateVaultTransaction,
  updateVaultRecordTransaction,
} from "@/server/vault/transaction-store";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const isSafeTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.includes("test");
})();
const run = isSafeTestDatabase ? describe : describe.skip;

run("persistance PostgreSQL du coffre", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const database = drizzle(pool, { schema }) as unknown as Database;
  const ownerId = `test-owner-${randomUUID()}`;
  const otherId = `test-other-${randomUUID()}`;
  const recordId = randomUUID();
  const envelope = {
    ciphertext: "A".repeat(22),
    iv: "A".repeat(16),
    schemaVersion: 1 as const,
  };

  beforeAll(async () => {
    await database.insert(user).values([
      { id: ownerId, name: "Owner", email: `${ownerId}@example.test` },
      { id: otherId, name: "Other", email: `${otherId}@example.test` },
    ]);
  });

  afterAll(async () => {
    await database.delete(user).where(inArray(user.id, [ownerId, otherId]));
    await pool.end();
  });

  it("isole le propriétaire et détecte les conflits de révision", async () => {
    const profileInput = {
      kdfAlgorithm: "PBKDF2-SHA-256" as const,
      kdfIterations: 600_000,
      kdfVersion: 1 as const,
      salt: "A".repeat(22),
      verificationCiphertext: envelope.ciphertext,
      verificationIv: envelope.iv,
      schemaVersion: 1 as const,
    };
    expect((await initializeVaultProfile(database, ownerId, profileInput)).status).toBe("ok");
    expect((await initializeVaultProfile(database, ownerId, profileInput)).status).toBe("conflict");

    expect(
      (
        await createVaultRecordTransaction(pool, ownerId, {
          id: recordId,
          ...envelope,
          profileRevision: 1,
        })
      ).status,
    ).toBe("ok");
    expect(await listVaultRecords(database, otherId)).toEqual([]);

    expect(
      (
        await rotateVaultTransaction(pool, ownerId, {
          profile: { ...profileInput, revision: 1 },
          records: [{ id: recordId, ...envelope, revision: 1 }],
        })
      ).status,
    ).toBe("conflict");
    expect(
      (
        await rotateVaultTransaction(pool, ownerId, {
          profile: { ...profileInput, salt: "B".repeat(22), revision: 2 },
          records: [{ id: recordId, ...envelope, revision: 2 }],
        })
      ).status,
    ).toBe("conflict");

    const rotated = await rotateVaultTransaction(pool, ownerId, {
      profile: { ...profileInput, salt: "B".repeat(22), revision: 2 },
      records: [{ id: recordId, ...envelope, ciphertext: "B".repeat(22), revision: 1 }],
    });
    expect(rotated).toEqual({ status: "ok", value: { profileRevision: 3 } });
    expect((await readVaultProfile(database, ownerId))?.salt).toBe("B".repeat(22));
    expect((await listVaultRecords(database, ownerId))[0]).toMatchObject({
      ciphertext: "B".repeat(22),
      revision: 2,
    });

    expect(
      (
        await updateVaultRecordTransaction(pool, ownerId, recordId, {
          ...envelope,
          revision: 2,
          profileRevision: 2,
        })
      ).status,
    ).toBe("conflict");
    expect(
      (
        await updateVaultRecordTransaction(pool, otherId, recordId, {
          ...envelope,
          revision: 2,
          profileRevision: 1,
        })
      ).status,
    ).toBe("not_found");

    const updated = await updateVaultRecordTransaction(pool, ownerId, recordId, {
      ...envelope,
      ciphertext: "C".repeat(22),
      revision: 2,
      profileRevision: 3,
    });
    expect(updated.status).toBe("ok");
    if (updated.status === "ok") {
      expect(updated.value.revision).toBe(3);
      expect(updated.value.profileRevision).toBe(4);
    }

    expect(
      (
        await deleteVaultRecordTransaction(pool, ownerId, recordId, {
          revision: 2,
          profileRevision: 4,
        })
      ).status,
    ).toBe("conflict");
    expect(
      await deleteVaultRecordTransaction(pool, ownerId, recordId, {
        revision: 3,
        profileRevision: 4,
      }),
    ).toEqual({ status: "ok", value: { id: recordId, profileRevision: 5 } });

    const obsoleteId = randomUUID();
    expect(
      (
        await createVaultRecordTransaction(pool, ownerId, {
          id: obsoleteId,
          ...envelope,
          profileRevision: 5,
        })
      ).status,
    ).toBe("ok");
    const restoredId = randomUUID();
    const backup = {
      format: "codex-manager-vault-backup" as const,
      version: 1 as const,
      profile: {
        ...profileInput,
        salt: "D".repeat(22),
      },
      records: [{ id: restoredId, ...envelope, ciphertext: "D".repeat(22) }],
    };
    expect(await replaceVaultTransaction(pool, ownerId, { profileRevision: 6, backup })).toEqual({
      status: "ok",
      value: { profileRevision: 7 },
    });
    expect(await listVaultRecords(database, ownerId)).toEqual([
      expect.objectContaining({ id: restoredId, ciphertext: "D".repeat(22), revision: 1 }),
    ]);
    expect((await readVaultProfile(database, ownerId))?.salt).toBe("D".repeat(22));

    expect(await replaceVaultTransaction(pool, ownerId, { profileRevision: 6, backup })).toEqual({
      status: "conflict",
    });
    expect(await listVaultRecords(database, ownerId)).toEqual([
      expect.objectContaining({ id: restoredId, ciphertext: "D".repeat(22) }),
    ]);

    const foreignId = randomUUID();
    await database.insert(vaultRecord).values({
      id: foreignId,
      userId: otherId,
      ...envelope,
    });
    const collidingBackup = {
      ...backup,
      records: [{ id: foreignId, ...envelope, ciphertext: "E".repeat(22) }],
    };
    expect(
      await replaceVaultTransaction(pool, ownerId, {
        profileRevision: 7,
        backup: collidingBackup,
      }),
    ).toEqual({ status: "conflict" });
    expect(await listVaultRecords(database, ownerId)).toEqual([
      expect.objectContaining({ id: restoredId, ciphertext: "D".repeat(22) }),
    ]);
  });
});
