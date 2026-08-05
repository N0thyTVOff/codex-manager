import type { NextRequest } from "next/server";

import { createVaultRecordSchema } from "@/server/vault/contracts";
import { createVaultDatabase, createVaultTransactionPool } from "@/server/vault/database";
import { parseVaultBody, vaultError, vaultJson } from "@/server/vault/responses";
import { getAuthenticatedUserId } from "@/server/vault/session";
import { createVaultRecordTransaction } from "@/server/vault/transaction-store";
import { listVaultRecords } from "@/server/vault/store";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request.headers);
    if (!userId) return vaultError(401);

    return vaultJson({ records: await listVaultRecords(createVaultDatabase(), userId) });
  } catch {
    return vaultError(500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request.headers);
    if (!userId) return vaultError(401);
    const body = await parseVaultBody(request, createVaultRecordSchema);
    if (!body.success) return body.response;

    const pool = createVaultTransactionPool();
    try {
      const result = await createVaultRecordTransaction(pool, userId, body.data);
      if (result.status === "ok") return vaultJson({ record: result.value }, 201);
      if (result.status === "limit_reached") return vaultError(413);
      return vaultError(result.status === "not_found" ? 404 : 409);
    } finally {
      await pool.end();
    }
  } catch {
    return vaultError(500);
  }
}
