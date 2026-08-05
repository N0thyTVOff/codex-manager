import { describe, expect, it, vi } from "vitest";

const { getAuthenticatedUserId, createVaultTransactionPool } = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue(null),
  createVaultTransactionPool: vi.fn(),
}));

vi.mock("@/server/vault/session", () => ({ getAuthenticatedUserId }));
vi.mock("@/server/vault/database", () => ({ createVaultTransactionPool }));

import { PUT } from "@/app/api/vault/rekey/route";

describe("API de rotation du coffre", () => {
  it("refuse une rotation sans session avant de lire le corps ou la base", async () => {
    const response = await PUT(
      new Request("https://example.test/api/vault/rekey", {
        method: "PUT",
        body: "contenu non analysé",
      }) as Parameters<typeof PUT>[0],
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createVaultTransactionPool).not.toHaveBeenCalled();
  });
});
