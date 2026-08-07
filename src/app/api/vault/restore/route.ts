import type { NextRequest } from "next/server";

import { MAX_RESTORE_BODY_BYTES, restoreVaultSchema } from "@/server/vault/contracts";
import { createVaultTransactionPool } from "@/server/vault/database";
import { parseVaultBody, vaultError, vaultJson } from "@/server/vault/responses";
import { getAuthenticatedUserId } from "@/server/vault/session";
import { replaceVaultTransaction } from "@/server/vault/transaction-store";

export async function PUT(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request.headers);
    if (!userId) return vaultError(401);
    const body = await parseVaultBody(request, restoreVaultSchema, MAX_RESTORE_BODY_BYTES);
    if (!body.success) return body.response;

    const pool = createVaultTransactionPool();
    try {
      const result = await replaceVaultTransaction(pool, userId, body.data);
      if (result.status === "ok") return vaultJson(result.value);
      return vaultError(result.status === "conflict" ? 409 : 404);
    } finally {
      await pool.end();
    }
  } catch {
    return vaultError(500);
  }
}
