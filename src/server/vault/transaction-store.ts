import type { Pool, PoolClient, QueryResultRow } from "pg";

import type {
  CreateVaultRecordInput,
  DeleteVaultRecordInput,
  RotateVaultInput,
  UpdateVaultRecordInput,
} from "@/server/vault/contracts";
import { MAX_RECORDS_PER_USER } from "@/server/vault/contracts";
import type { VaultMutationResult } from "@/server/vault/store";

interface StoredVaultRecord extends QueryResultRow {
  id: string;
  ciphertext: string;
  iv: string;
  schemaVersion: number;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

type TransactionOutcome<T> = { commit: boolean; result: T };

export async function createVaultRecordTransaction(
  pool: Pool,
  userId: string,
  input: CreateVaultRecordInput,
): Promise<VaultMutationResult<StoredVaultRecord & { profileRevision: number }>> {
  return runTransaction<VaultMutationResult<StoredVaultRecord & { profileRevision: number }>>(
    pool,
    async (client) => {
      const profileRevision = await lockProfile(client, userId);
      if (profileRevision === null) return rollback({ status: "not_found" });
      if (profileRevision !== input.profileRevision) return rollback({ status: "conflict" });

      const count = await client.query<{ total: string }>(
        "SELECT count(*) AS total FROM vault_record WHERE user_id = $1",
        [userId],
      );
      if (Number(count.rows[0]?.total ?? 0) >= MAX_RECORDS_PER_USER) {
        return rollback({ status: "limit_reached" });
      }

      const inserted = await client.query<StoredVaultRecord>(
        `INSERT INTO vault_record (id, user_id, ciphertext, iv, schema_version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, ciphertext, iv, schema_version AS "schemaVersion", revision,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
        [input.id, userId, input.ciphertext, input.iv, input.schemaVersion],
      );
      const record = inserted.rows[0];
      if (!record) return rollback({ status: "conflict" });

      const nextProfileRevision = await incrementProfileRevision(client, userId, profileRevision);
      return commit({
        status: "ok",
        value: { ...record, profileRevision: nextProfileRevision },
      });
    },
  );
}

export async function updateVaultRecordTransaction(
  pool: Pool,
  userId: string,
  id: string,
  input: UpdateVaultRecordInput,
): Promise<VaultMutationResult<StoredVaultRecord & { profileRevision: number }>> {
  return runTransaction<VaultMutationResult<StoredVaultRecord & { profileRevision: number }>>(
    pool,
    async (client) => {
      const profileRevision = await lockProfile(client, userId);
      if (profileRevision === null) return rollback({ status: "not_found" });
      if (profileRevision !== input.profileRevision) return rollback({ status: "conflict" });

      const updated = await client.query<StoredVaultRecord>(
        `UPDATE vault_record
       SET ciphertext = $1, iv = $2, schema_version = $3,
           revision = revision + 1, updated_at = now()
       WHERE id = $4 AND user_id = $5 AND revision = $6
       RETURNING id, ciphertext, iv, schema_version AS "schemaVersion", revision,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
        [input.ciphertext, input.iv, input.schemaVersion, id, userId, input.revision],
      );
      const record = updated.rows[0];
      if (!record) {
        return rollback(
          (await ownsVaultRecord(client, userId, id))
            ? { status: "conflict" }
            : { status: "not_found" },
        );
      }

      const nextProfileRevision = await incrementProfileRevision(client, userId, profileRevision);
      return commit({
        status: "ok",
        value: { ...record, profileRevision: nextProfileRevision },
      });
    },
  );
}

export async function deleteVaultRecordTransaction(
  pool: Pool,
  userId: string,
  id: string,
  input: DeleteVaultRecordInput,
): Promise<VaultMutationResult<{ id: string; profileRevision: number }>> {
  return runTransaction<VaultMutationResult<{ id: string; profileRevision: number }>>(
    pool,
    async (client) => {
      const profileRevision = await lockProfile(client, userId);
      if (profileRevision === null) return rollback({ status: "not_found" });
      if (profileRevision !== input.profileRevision) return rollback({ status: "conflict" });

      const deleted = await client.query<{ id: string }>(
        `DELETE FROM vault_record
       WHERE id = $1 AND user_id = $2 AND revision = $3
       RETURNING id`,
        [id, userId, input.revision],
      );
      const record = deleted.rows[0];
      if (!record) {
        return rollback(
          (await ownsVaultRecord(client, userId, id))
            ? { status: "conflict" }
            : { status: "not_found" },
        );
      }

      const nextProfileRevision = await incrementProfileRevision(client, userId, profileRevision);
      return commit({
        status: "ok",
        value: { id: record.id, profileRevision: nextProfileRevision },
      });
    },
  );
}

export async function rotateVaultTransaction(
  pool: Pool,
  userId: string,
  input: RotateVaultInput,
): Promise<VaultMutationResult<{ profileRevision: number }>> {
  return runTransaction<VaultMutationResult<{ profileRevision: number }>>(pool, async (client) => {
    const profileRevision = await lockProfile(client, userId);
    if (profileRevision === null) return rollback({ status: "not_found" });
    if (profileRevision !== input.profile.revision) return rollback({ status: "conflict" });

    const stored = await client.query<{ id: string; revision: number }>(
      `SELECT id, revision FROM vault_record
       WHERE user_id = $1
       ORDER BY id
       FOR UPDATE`,
      [userId],
    );
    if (!hasExactRecordRevisions(stored.rows, input.records)) {
      return rollback({ status: "conflict" });
    }

    if (input.records.length > 0) {
      const updated = await client.query(
        `UPDATE vault_record AS record
         SET ciphertext = incoming.ciphertext,
             iv = incoming.iv,
             schema_version = incoming.schema_version,
             revision = record.revision + 1,
             updated_at = now()
         FROM jsonb_to_recordset($1::jsonb)
           AS incoming(id uuid, ciphertext text, iv varchar, schema_version integer, revision integer)
         WHERE record.user_id = $2
           AND record.id = incoming.id
           AND record.revision = incoming.revision`,
        [
          JSON.stringify(
            input.records.map((record) => ({
              id: record.id,
              ciphertext: record.ciphertext,
              iv: record.iv,
              schema_version: record.schemaVersion,
              revision: record.revision,
            })),
          ),
          userId,
        ],
      );
      if (updated.rowCount !== input.records.length) return rollback({ status: "conflict" });
    }

    const profile = input.profile;
    const updatedProfile = await client.query<{ revision: number }>(
      `UPDATE vault_profile
       SET kdf_algorithm = $1, kdf_iterations = $2, kdf_version = $3, salt = $4,
           verification_ciphertext = $5, verification_iv = $6, schema_version = $7,
           revision = revision + 1, updated_at = now()
       WHERE user_id = $8 AND revision = $9
       RETURNING revision`,
      [
        profile.kdfAlgorithm,
        profile.kdfIterations,
        profile.kdfVersion,
        profile.salt,
        profile.verificationCiphertext,
        profile.verificationIv,
        profile.schemaVersion,
        userId,
        profileRevision,
      ],
    );
    const nextRevision = updatedProfile.rows[0]?.revision;
    return nextRevision
      ? commit({ status: "ok", value: { profileRevision: nextRevision } })
      : rollback({ status: "conflict" });
  });
}

async function runTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<TransactionOutcome<T>>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const outcome = await operation(client);
    await client.query(outcome.commit ? "COMMIT" : "ROLLBACK");
    return outcome.result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function lockProfile(client: PoolClient, userId: string): Promise<number | null> {
  const result = await client.query<{ revision: number }>(
    "SELECT revision FROM vault_profile WHERE user_id = $1 FOR UPDATE",
    [userId],
  );
  return result.rows[0]?.revision ?? null;
}

async function incrementProfileRevision(
  client: PoolClient,
  userId: string,
  revision: number,
): Promise<number> {
  const result = await client.query<{ revision: number }>(
    `UPDATE vault_profile
     SET revision = revision + 1, updated_at = now()
     WHERE user_id = $1 AND revision = $2
     RETURNING revision`,
    [userId, revision],
  );
  const nextRevision = result.rows[0]?.revision;
  if (!nextRevision) throw new Error("Vault profile revision invariant failed.");
  return nextRevision;
}

async function ownsVaultRecord(client: PoolClient, userId: string, id: string): Promise<boolean> {
  const result = await client.query("SELECT 1 FROM vault_record WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  return result.rowCount === 1;
}

function hasExactRecordRevisions(
  stored: ReadonlyArray<{ id: string; revision: number }>,
  incoming: ReadonlyArray<{ id: string; revision: number }>,
): boolean {
  if (stored.length !== incoming.length) return false;
  const revisions = new Map(incoming.map((record) => [record.id, record.revision]));
  return (
    revisions.size === incoming.length &&
    stored.every((record) => revisions.get(record.id) === record.revision)
  );
}

function commit<T>(result: T): TransactionOutcome<T> {
  return { commit: true, result };
}

function rollback<T>(result: T): TransactionOutcome<T> {
  return { commit: false, result };
}
