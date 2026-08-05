import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedUserId, createVaultDatabase } = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  createVaultDatabase: vi.fn(),
}));

vi.mock("@/server/vault/session", () => ({ getAuthenticatedUserId }));
vi.mock("@/server/vault/database", () => ({ createVaultDatabase }));

import { GET, POST } from "@/app/api/vault/profile/route";

describe("API du profil de coffre", () => {
  beforeEach(() => {
    getAuthenticatedUserId.mockReset();
    createVaultDatabase.mockReset();
    getAuthenticatedUserId.mockResolvedValue(null);
  });

  it("refuse la lecture sans session et interdit le cache", async () => {
    const response = await GET(
      new Request("https://example.test/api/vault/profile") as Parameters<typeof GET>[0],
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createVaultDatabase).not.toHaveBeenCalled();
  });

  it("authentifie avant de lire un corps invalide", async () => {
    const response = await POST(
      new Request("https://example.test/api/vault/profile", {
        method: "POST",
        body: "donnée qui ne doit pas être analysée",
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(401);
    expect(createVaultDatabase).not.toHaveBeenCalled();
  });
});
