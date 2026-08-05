import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseVaultBody, vaultError } from "@/server/vault/responses";

describe("réponses du coffre", () => {
  it("désactive toujours le cache", () => {
    const response = vaultError(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("rejette les corps invalides ou trop volumineux sans reprendre leur contenu", async () => {
    const schema = z.strictObject({ value: z.string().max(4) });
    const invalid = await parseVaultBody(
      new Request("https://example.test", { method: "POST", body: "{secret" }),
      schema,
    );
    const oversized = await parseVaultBody(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({ value: "secret" }),
      }),
      schema,
      5,
    );

    expect(invalid.success).toBe(false);
    expect(oversized.success).toBe(false);
    if (!invalid.success)
      await expect(invalid.response.json()).resolves.toEqual({ error: "Requête invalide." });
  });
});
