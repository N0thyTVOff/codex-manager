import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountQuickActions } from "@/components/account-quick-actions";
import type { VaultAccountV1 } from "@/types/vault";

const account: VaultAccountV1 = {
  version: 1,
  label: "Compte de démonstration",
  login: "personne@example.test",
  password: "mot-de-passe-inactif",
  notes: "Fixture sans donnée réelle.",
  totpProvider: "two_fa_live",
  totpSecret: "JBSWY3DPEHPK3PXP",
  purchasedOn: "2026-08-05",
  endsOn: "2099-09-05",
  quotaStatus: "available",
  quotaExhaustedAt: null,
  lastUsedAt: null,
  archivedAt: null,
};

describe("actions rapides d’un compte", () => {
  const writeText = vi.fn<(_: string) => Promise<void>>();

  beforeEach(() => {
    vi.restoreAllMocks();
    writeText.mockReset();
    writeText.mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("masque les secrets et les copie séparément", async () => {
    renderActions();

    expect(screen.queryByText(account.login)).not.toBeInTheDocument();
    expect(screen.queryByText(account.password)).not.toBeInTheDocument();
    expect(screen.queryByText(account.totpSecret ?? "")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copier : Login" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(account.login));
    expect(screen.getByRole("status")).toHaveTextContent("Login copié");

    fireEvent.click(screen.getByRole("button", { name: "Copier : Mot de passe" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(account.password));
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("permet de révéler puis de remasquer une valeur", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Révéler : Login" }));
    expect(screen.getByText(account.login)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Masquer : Login" }));
    expect(screen.queryByText(account.login)).not.toBeInTheDocument();
  });

  it("ouvre ChatGPT de façon isolée puis marque le compte en cours", () => {
    const onUse = vi.fn();
    const openedWindow = { opener: window };
    const open = vi.spyOn(window, "open").mockReturnValue(openedWindow as Window);
    renderActions({ onUse });

    fireEvent.click(screen.getByRole("button", { name: "Utiliser ce compte" }));

    expect(open).toHaveBeenCalledWith("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    expect(openedWindow.opener).toBeNull();
    expect(onUse).toHaveBeenCalledOnce();
  });

  it("n’envoie jamais la clé dans l’URL de 2FA.live", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Copier et ouvrir 2FA.live" }));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("service tiers");
    fireEvent.click(screen.getByRole("button", { name: "Continuer vers 2FA.live" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(account.totpSecret));
    expect(open).toHaveBeenCalledWith("https://2fa.live/", "_blank", "noopener,noreferrer");
    expect(JSON.stringify(open.mock.calls)).not.toContain(account.totpSecret);
  });

  it("affiche la procédure manuelle pour Google Authenticator", () => {
    renderActions({
      account: { ...account, totpProvider: "google_authenticator" },
    });

    expect(screen.getByText("Google Authenticator")).toBeInTheDocument();
    expect(screen.getByText(/Saisir une clé de configuration/u)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ouvrir 2FA\.live/iu })).not.toBeInTheDocument();
  });

  it("signale un échec de copie sans jamais transmettre la clé", async () => {
    writeText.mockRejectedValueOnce(new Error("clipboard unavailable"));
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Copier et ouvrir 2FA.live" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuer vers 2FA.live" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copie impossible"));
    expect(open).toHaveBeenCalledWith("https://2fa.live/", "_blank", "noopener,noreferrer");
    expect(JSON.stringify(open.mock.calls)).not.toContain(account.totpSecret);
  });
});

function renderActions({
  account: accountValue = account,
  onUse = vi.fn(),
}: {
  account?: VaultAccountV1;
  onUse?: () => void;
} = {}) {
  render(<AccountQuickActions account={accountValue} disabled={false} allowUse onUse={onUse} />);
}
