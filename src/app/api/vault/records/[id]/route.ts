import type { NextRequest } from "next/server";
import { z } from "zod";

import { deleteVaultRecordSchema, updateVaultRecordSchema } from "@/server/vault/contracts";
import { createVaultTransactionPool } from "@/server/vault/database";
import { parseVaultBody, vaultError, vaultJson } from "@/server/vault/responses";
import { getAuthenticatedUserId } from "@/server/vault/session";
import {
  deleteVaultRecordTransaction,
  updateVaultRecordTransaction,
} from "@/server/vault/transaction-store";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getAuthenticatedUserId(request.headers);
    if (!userId) return vaultError(401);
    const body = await parseVaultBody(request, updateVaultRecordSchema);
    if (!body.success) return body.response;
    const id = await parseId(context);
    if (!id) return vaultError(400);

    const pool = createVaultTransactionPool();
    try {
      const result = await updateVaultRecordTransaction(pool, userId, id, body.data);
      if (result.status === "ok") return vaultJson({ record: result.value });
      return vaultError(result.status === "conflict" ? 409 : 404);
    } finally {
      await pool.end();
    }
  } catch {
    return vaultError(500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getAuthenticatedUserId(request.headers);
    if (!userId) return vaultError(401);
    const body = await parseVaultBody(request, deleteVaultRecordSchema, 1_024);
    if (!body.success) return body.response;
    const id = await parseId(context);
    if (!id) return vaultError(400);

    const pool = createVaultTransactionPool();
    try {
      const result = await deleteVaultRecordTransaction(pool, userId, id, body.data);
      if (result.status === "ok") {
        return vaultJson({ deleted: true, profileRevision: result.value.profileRevision });
      }
      return vaultError(result.status === "conflict" ? 409 : 404);
    } finally {
      await pool.end();
    }
  } catch {
    return vaultError(500);
  }
}

async function parseId(context: RouteContext): Promise<string | null> {
  const result = z
    .string()
    .uuid()
    .safeParse((await context.params).id);
  return result.success ? result.data : null;
}
