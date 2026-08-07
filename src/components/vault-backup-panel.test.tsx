import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { unlockVaultBackup } = vi.hoisted(() => ({ unlockVaultBackup: vi.fn() }));
vi.mock("@/lib/vault/backup", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/vault/backup")>();
  return { ...original, unlockVaultBackup };
});

import { VaultBackupPanel } from "@/components/vault-backup-panel";
import type { VaultProfileEnvelope, VaultRecordEnvelope } from "@/lib/vault/lifecycle";

const key = {} as CryptoKey;
const id = "8919b498-c50e-4e63-8c12-71d9bd503b77";
const profile: VaultProfileEnvelope = {
  kdfAlgorithm: "PBKDF2-SHA-256",
  kdfIterations: 600_000,
  kdfVersion: 1,
  salt: "A".repeat(22),
  verificationCiphertext: "B".repeat(22),
  verificationIv: "C".repeat(16),
  schemaVersion: 1,
  revision: 7,
};
const record: VaultRecordEnvelope = {
  id,
  ciphertext: "D".repeat(22),
  iv: "E".repeat(16),
  schemaVersion: 1,
  revision: 3,
};
const backup = {
  format: "codex-manager-vault-backup",
  version: 1,
  profile: {
    kdfAlgorithm: "PBKDF2-SHA-256",
    kdfIterations: 600_000,
    kdfVersion: 1,
    salt: "F".repeat(22),
    verificationCiphertext: "G".repeat(22),
    verificationIv: "H".repeat(16),
    schemaVersion: 1,
  },
  records: [{ id, ciphertext: "I".repeat(22), iv: "J".repeat(16), schemaVersion: 1 }],
} as const;

describe("panneau de sauvegarde", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    unlockVaultBackup.mockReset();
    unlockVaultBackup.mockResolvedValue({ key, accounts: [] });
  });

  it("télécharge un JSON chiffré sans révision serveur", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:backup");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Exporter le JSON chiffré" }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:backup");
    expect(screen.getByRole("status")).toHaveTextContent("phrase secrète qui était active");
  });

  it("valide localement puis restaure après une confirmation explicite", async () => {
    const onRestored = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ profileRevision: 8 }));
    renderPanel(onRestored);
    fireEvent.click(screen.getByRole("button", { name: "Restaurer une sauvegarde" }));
    await chooseBackupFile();
    fireEvent.change(screen.getByLabelText("Phrase secrète de cette sauvegarde"), {
      target: { value: "phrase de sauvegarde suffisamment longue" },
    });
    const submit = screen.getByRole("button", { name: "Remplacer le coffre" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Je confirme le remplacement complet/u }));
    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
    expect(unlockVaultBackup).toHaveBeenCalledWith(
      "phrase de sauvegarde suffisamment longue",
      backup,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vault/restore",
      expect.objectContaining({ method: "PUT" }),
    );
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(request).toEqual({ profileRevision: 7, backup });
    expect(JSON.stringify(request)).not.toContain("phrase de sauvegarde suffisamment longue");
  });

  it("n’appelle pas l’API lorsque la phrase ou l’intégrité est invalide", async () => {
    unlockVaultBackup.mockResolvedValue(null);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Restaurer une sauvegarde" }));
    await chooseBackupFile();
    fireEvent.change(screen.getByLabelText("Phrase secrète de cette sauvegarde"), {
      target: { value: "mauvaise phrase suffisamment longue" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Je confirme le remplacement complet/u }));
    fireEvent.submit(screen.getByRole("button", { name: "Remplacer le coffre" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Phrase incorrecte");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("oublie la phrase et le fichier lorsque la restauration est annulée", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Restaurer une sauvegarde" }));
    await chooseBackupFile();
    fireEvent.change(screen.getByLabelText("Phrase secrète de cette sauvegarde"), {
      target: { value: "phrase temporaire suffisamment longue" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Annuler la restauration" }));
    fireEvent.click(screen.getByRole("button", { name: "Restaurer une sauvegarde" }));

    expect(screen.getByLabelText("Phrase secrète de cette sauvegarde")).toHaveValue("");
    expect(screen.getByLabelText("Phrase secrète de cette sauvegarde")).toBeDisabled();
    expect(screen.queryByText(/backup\.json/u)).not.toBeInTheDocument();
  });
});

function renderPanel(onRestored = vi.fn()) {
  render(<VaultBackupPanel profile={profile} records={[record]} onRestored={onRestored} />);
}

async function chooseBackupFile() {
  const file = new File([JSON.stringify(backup)], "backup.json", { type: "application/json" });
  Object.defineProperty(file, "text", {
    configurable: true,
    value: vi.fn().mockResolvedValue(JSON.stringify(backup)),
  });
  fireEvent.change(screen.getByLabelText("Fichier JSON chiffré"), {
    target: { files: [file] },
  });
  await screen.findByText(/backup\.json/u);
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
