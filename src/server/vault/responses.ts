import { NextResponse } from "next/server";
import type { ZodType } from "zod";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
} as const;

export function vaultJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

export function vaultError(status: 400 | 401 | 404 | 409 | 413 | 500): NextResponse {
  const messages = {
    400: "Requête invalide.",
    401: "Authentification requise.",
    404: "Ressource introuvable.",
    409: "La ressource a été modifiée. Rechargez le coffre.",
    413: "Requête trop volumineuse.",
    500: "Une erreur interne est survenue.",
  } as const;

  return vaultJson({ error: messages[status] }, status);
}

export async function parseVaultBody<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes = 150_000,
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { success: false, response: vaultError(413) };
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) {
      return { success: false, response: vaultError(413) };
    }
    const result = schema.safeParse(JSON.parse(raw));
    return result.success
      ? { success: true, data: result.data }
      : { success: false, response: vaultError(400) };
  } catch {
    return { success: false, response: vaultError(400) };
  }
}
