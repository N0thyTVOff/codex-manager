import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { user } from "@/db/schema";
import {
  createVaultRecord,
  deleteVaultRecord,
  initializeVaultProfile,
  listVaultRecords,
  updateVaultRecord,
} from "@/server/vault/store";

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

    expect((await createVaultRecord(database, ownerId, { id: recordId, ...envelope })).status).toBe(
      "ok",
    );
    expect(await listVaultRecords(database, otherId)).toEqual([]);

    expect(
      (await updateVaultRecord(database, ownerId, recordId, { ...envelope, revision: 2 })).status,
    ).toBe("conflict");
    expect(
      (await updateVaultRecord(database, otherId, recordId, { ...envelope, revision: 1 })).status,
    ).toBe("not_found");

    const updated = await updateVaultRecord(database, ownerId, recordId, {
      ...envelope,
      ciphertext: "B".repeat(22),
      revision: 1,
    });
    expect(updated.status).toBe("ok");
    if (updated.status === "ok") expect(updated.value.revision).toBe(2);

    expect((await deleteVaultRecord(database, ownerId, recordId, 1)).status).toBe("conflict");
    expect((await deleteVaultRecord(database, ownerId, recordId, 2)).status).toBe("ok");
  });
});
