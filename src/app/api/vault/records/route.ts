import type { NextRequest } from "next/server";

import { createVaultRecordSchema } from "@/server/vault/contracts";
import { createVaultDatabase } from "@/server/vault/database";
import { parseVaultBody, vaultError, vaultJson } from "@/server/vault/responses";
import { getAuthenticatedUserId } from "@/server/vault/session";
import { createVaultRecord, listVaultRecords, readVaultProfile } from "@/server/vault/store";

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

    const database = createVaultDatabase();
    if (!(await readVaultProfile(database, userId))) return vaultError(409);

    const result = await createVaultRecord(database, userId, body.data);
    if (result.status === "ok") return vaultJson({ record: result.value }, 201);
    return result.status === "limit_reached" ? vaultError(413) : vaultError(409);
  } catch {
    return vaultError(500);
  }
}
