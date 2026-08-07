import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedUserId, createVaultTransactionPool, replaceVaultTransaction, poolEnd } =
  vi.hoisted(() => ({
    getAuthenticatedUserId: vi.fn(),
    createVaultTransactionPool: vi.fn(),
    replaceVaultTransaction: vi.fn(),
    poolEnd: vi.fn(),
  }));

vi.mock("@/server/vault/session", () => ({ getAuthenticatedUserId }));
vi.mock("@/server/vault/database", () => ({ createVaultTransactionPool }));
vi.mock("@/server/vault/transaction-store", () => ({ replaceVaultTransaction }));

import { PUT } from "@/app/api/vault/restore/route";

const body = {
  profileRevision: 4,
  backup: {
    format: "codex-manager-vault-backup",
    version: 1,
    profile: {
      kdfAlgorithm: "PBKDF2-SHA-256",
      kdfIterations: 600_000,
      kdfVersion: 1,
      salt: "A".repeat(22),
      verificationCiphertext: "B".repeat(22),
      verificationIv: "C".repeat(16),
      schemaVersion: 1,
    },
    records: [],
  },
};

describe("API de restauration du coffre", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getAuthenticatedUserId.mockReset();
    createVaultTransactionPool.mockReset();
    replaceVaultTransaction.mockReset();
    poolEnd.mockReset();
    createVaultTransactionPool.mockReturnValue({ end: poolEnd });
  });

  it("refuse une restauration sans session avant de lire le corps ou la base", async () => {
    getAuthenticatedUserId.mockResolvedValue(null);
    const response = await PUT(request("contenu non analysé"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createVaultTransactionPool).not.toHaveBeenCalled();
  });

  it("ignore tout propriétaire fourni par le client", async () => {
    getAuthenticatedUserId.mockResolvedValue("owner-from-session");
    const response = await PUT(request(JSON.stringify({ ...body, userId: "attacker" })));

    expect(response.status).toBe(400);
    expect(replaceVaultTransaction).not.toHaveBeenCalled();
  });

  it("retourne un conflit générique sans remplacer partiellement le coffre", async () => {
    getAuthenticatedUserId.mockResolvedValue("owner-from-session");
    replaceVaultTransaction.mockResolvedValue({ status: "conflict" });
    const response = await PUT(request(JSON.stringify(body)));

    expect(response.status).toBe(409);
    expect(replaceVaultTransaction).toHaveBeenCalledWith(
      expect.anything(),
      "owner-from-session",
      body,
    );
    expect(poolEnd).toHaveBeenCalledOnce();
  });
});

function request(value: string) {
  return new Request("https://example.test/api/vault/restore", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: value,
  }) as Parameters<typeof PUT>[0];
}
