import type { NextRequest } from "next/server";

import { initializeVaultProfileSchema } from "@/server/vault/contracts";
import { createVaultDatabase } from "@/server/vault/database";
import { parseVaultBody, vaultError, vaultJson } from "@/server/vault/responses";
import { getAuthenticatedUserId } from "@/server/vault/session";
import { initializeVaultProfile, readVaultProfile } from "@/server/vault/store";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request.headers);
    if (!userId) return vaultError(401);

    return vaultJson({ profile: await readVaultProfile(createVaultDatabase(), userId) });
  } catch {
    return vaultError(500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request.headers);
    if (!userId) return vaultError(401);
    const body = await parseVaultBody(request, initializeVaultProfileSchema);
    if (!body.success) return body.response;

    const result = await initializeVaultProfile(createVaultDatabase(), userId, body.data);
    return result.status === "ok" ? vaultJson({ profile: result.value }, 201) : vaultError(409);
  } catch {
    return vaultError(500);
  }
}
