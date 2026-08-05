import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { encryptVaultAccount } = vi.hoisted(() => ({ encryptVaultAccount: vi.fn() }));
vi.mock("@/lib/vault/lifecycle", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/vault/lifecycle")>();
  return { ...original, encryptVaultAccount };
});

import { AccountDashboard } from "@/components/account-dashboard";
import type { DecryptedVaultAccount } from "@/lib/vault/accounts";
import type { VaultRecordEnvelope } from "@/lib/vault/lifecycle";
import type { VaultAccountV1 } from "@/types/vault";

const key = {} as CryptoKey;
const id = "8919b498-c50e-4e63-8c12-71d9bd503b77";
const envelope = { ciphertext: "A".repeat(22), iv: "A".repeat(16), schemaVersion: 1 as const };
const account: VaultAccountV1 = {
  version: 1,
  label: "Compte de test",
  login: "personne@example.test",
  password: "mot-de-passe-inactif",
  notes: "Fixture sans donnée réelle.",
  totpProvider: "none",
  totpSecret: null,
  purchasedOn: "2026-08-05",
  endsOn: "2099-09-05",
  quotaStatus: "available",
  quotaExhaustedAt: null,
  lastUsedAt: null,
  archivedAt: null,
};

describe("tableau de bord des comptes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    encryptVaultAccount.mockReset();
    encryptVaultAccount.mockResolvedValue(envelope);
  });

  it("chiffre une nouvelle fiche avant de l'envoyer", async () => {
    const onChanged = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { id: string };
      return jsonResponse({
        record: { id: body.id, ...envelope, revision: 1, profileRevision: 2 },
      });
    });

    render(
      <AccountDashboard
        profileRevision={1}
        vaultKey={key}
        records={[]}
        accounts={[]}
        onChanged={onChanged}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un compte" }));
    fireEvent.change(screen.getByLabelText("Libellé"), { target: { value: "Nouveau compte" } });
    fireEvent.change(screen.getByLabelText("Login"), {
      target: { value: "nouveau@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "mot-de-passe-inactif" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter le compte" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(encryptVaultAccount).toHaveBeenCalledWith(
      key,
      expect.any(String),
      expect.objectContaining({ label: "Nouveau compte", login: "nouveau@example.test" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vault/records",
      expect.objectContaining({ method: "POST" }),
    );
    const requestBody = String(fetchMock.mock.calls[0]?.[1]?.body);
    expect(requestBody).not.toContain("nouveau@example.test");
    expect(requestBody).not.toContain("mot-de-passe-inactif");
  });

  it("exige une confirmation avant la suppression définitive", async () => {
    const onChanged = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ deleted: true, profileRevision: 2 }));
    renderDashboard(onChanged);

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Supprimer définitivement");
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(2, [], []));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/vault/records/${id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("archive une fiche par une écriture chiffrée", async () => {
    const onChanged = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ record: { id, ...envelope, revision: 2, profileRevision: 2 } }),
    );
    renderDashboard(onChanged);

    fireEvent.click(screen.getByRole("button", { name: "Archiver" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(encryptVaultAccount).toHaveBeenCalledWith(
      key,
      id,
      expect.objectContaining({ archivedAt: expect.any(String) }),
    );
  });

  it("restaure une archive manuelle encore valide", async () => {
    const onChanged = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ record: { id, ...envelope, revision: 2, profileRevision: 2 } }),
    );
    renderDashboard(onChanged, { ...account, archivedAt: "2026-08-05T10:00:00.000Z" });
    fireEvent.click(screen.getByRole("tab", { name: /Archives/u }));
    fireEvent.click(screen.getByRole("button", { name: "Restaurer" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(encryptVaultAccount).toHaveBeenCalledWith(
      key,
      id,
      expect.objectContaining({ archivedAt: null }),
    );
  });
});

function renderDashboard(
  onChanged: (
    profileRevision: number,
    records: ReadonlyArray<VaultRecordEnvelope>,
    accounts: ReadonlyArray<DecryptedVaultAccount>,
  ) => void,
  accountValue = account,
) {
  const record: VaultRecordEnvelope = { id, revision: 1, ...envelope };
  const decrypted: DecryptedVaultAccount = { id, revision: 1, account: accountValue };
  render(
    <AccountDashboard
      profileRevision={1}
      vaultKey={key}
      records={[record]}
      accounts={[decrypted]}
      onChanged={onChanged}
    />,
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
