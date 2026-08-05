import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createVaultSetup, rotateVaultLocally, unlockVaultKey, replace, refresh, signOut } =
  vi.hoisted(() => ({
    createVaultSetup: vi.fn(),
    rotateVaultLocally: vi.fn(),
    unlockVaultKey: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    signOut: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signOut } }));
vi.mock("@/lib/vault/lifecycle", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/vault/lifecycle")>();
  return { ...original, createVaultSetup, rotateVaultLocally, unlockVaultKey };
});

import { VaultManager } from "@/components/vault-manager";

const key = {} as CryptoKey;
const profile = {
  kdfAlgorithm: "PBKDF2-SHA-256",
  kdfIterations: 600_000,
  kdfVersion: 1,
  salt: "A".repeat(22),
  verificationCiphertext: "B".repeat(22),
  verificationIv: "C".repeat(16),
  schemaVersion: 1,
  revision: 1,
} as const;

describe("gestionnaire du coffre", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createVaultSetup.mockReset();
    rotateVaultLocally.mockReset();
    unlockVaultKey.mockReset();
    replace.mockReset();
    refresh.mockReset();
    signOut.mockReset();
  });

  it("initialise un coffre vide puis conserve la clé uniquement dans le composant", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ profile: null }))
      .mockResolvedValueOnce(jsonResponse({ profile }, 201));
    createVaultSetup.mockResolvedValue({ key, profile: { ...profile, revision: undefined } });

    render(<VaultManager />);
    expect(await screen.findByRole("heading", { name: /Crée la phrase secrète/u })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Phrase secrète"), {
      target: { value: "phrase de test suffisamment longue" },
    });
    fireEvent.change(screen.getByLabelText("Confirmer la phrase"), {
      target: { value: "phrase de test suffisamment longue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));

    expect(await screen.findByRole("heading", { name: "Le coffre est ouvert." })).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/vault/profile",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("déverrouille puis oublie la clé lors du verrouillage manuel", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ profile }))
      .mockResolvedValueOnce(jsonResponse({ records: [] }));
    unlockVaultKey.mockResolvedValue(key);

    render(<VaultManager />);
    expect(await screen.findByRole("heading", { name: /Déverrouille ce coffre/u })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Phrase secrète"), {
      target: { value: "phrase de test suffisamment longue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    expect(await screen.findByRole("heading", { name: "Le coffre est ouvert." })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Verrouiller maintenant" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Déverrouille ce coffre/u })).toBeVisible();
    });
    expect(
      screen.queryByRole("heading", { name: "Le coffre est ouvert." }),
    ).not.toBeInTheDocument();
  });

  it("applique une rotation complète puis conserve uniquement la nouvelle clé", async () => {
    const nextKey = {} as CryptoKey;
    const rotatedProfile = { ...profile, salt: "D".repeat(22) };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ profile }))
      .mockResolvedValueOnce(jsonResponse({ records: [] }))
      .mockResolvedValueOnce(jsonResponse({ profile }))
      .mockResolvedValueOnce(jsonResponse({ records: [] }))
      .mockResolvedValueOnce(jsonResponse({ profileRevision: 2 }));
    unlockVaultKey.mockResolvedValue(key);
    rotateVaultLocally.mockResolvedValue({
      key: nextKey,
      request: { profile: rotatedProfile, records: [] },
    });

    render(<VaultManager />);
    await screen.findByRole("heading", { name: /Déverrouille ce coffre/u });
    fireEvent.change(screen.getByLabelText("Phrase secrète"), {
      target: { value: "phrase de test suffisamment longue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    await screen.findByRole("heading", { name: "Le coffre est ouvert." });
    fireEvent.click(screen.getByRole("button", { name: "Changer la phrase secrète" }));

    fireEvent.change(screen.getByLabelText("Phrase actuelle"), {
      target: { value: "phrase de test suffisamment longue" },
    });
    fireEvent.change(screen.getByLabelText("Nouvelle phrase"), {
      target: { value: "nouvelle phrase suffisamment longue" },
    });
    fireEvent.change(screen.getByLabelText("Confirmer la nouvelle phrase"), {
      target: { value: "nouvelle phrase suffisamment longue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rechiffrer tout le coffre" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Changer la phrase secrète" }),
      ).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/vault/rekey",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
