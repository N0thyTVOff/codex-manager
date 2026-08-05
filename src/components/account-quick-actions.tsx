"use client";

import { useState } from "react";

import type { VaultAccountV1 } from "@/types/vault";

const CHATGPT_URL = "https://chatgpt.com/";
const TWO_FA_LIVE_URL = "https://2fa.live/";

type CopyField = "login" | "password" | "totp";

const fieldLabels: Record<CopyField, string> = {
  login: "Login",
  password: "Mot de passe",
  totp: "Clé 2FA",
};

export function AccountQuickActions({
  account,
  disabled,
  allowUse,
  onUse,
}: {
  account: VaultAccountV1;
  disabled: boolean;
  allowUse: boolean;
  onUse: () => void;
}) {
  const [revealed, setRevealed] = useState<ReadonlySet<CopyField>>(() => new Set());
  const [feedback, setFeedback] = useState("");
  const [confirmTwoFaLive, setConfirmTwoFaLive] = useState(false);

  function toggle(field: CopyField) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  async function copy(field: CopyField, value: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(`${fieldLabels[field]} copié.`);
      return true;
    } catch {
      setFeedback(
        `Copie impossible pour « ${fieldLabels[field]} ». Vous pouvez le révéler puis le copier manuellement.`,
      );
      return false;
    }
  }

  async function copyAndOpenTwoFaLive() {
    if (!account.totpSecret) return;
    const copyAttempt = copy("totp", account.totpSecret);
    openExternal(TWO_FA_LIVE_URL);
    await copyAttempt;
    setConfirmTwoFaLive(false);
  }

  return (
    <div className="account-quick-actions">
      <div className="secret-list" aria-label={`Secrets de ${account.label}`}>
        <SecretRow
          field="login"
          value={account.login}
          revealed={revealed.has("login")}
          disabled={disabled}
          onToggle={toggle}
          onCopy={copy}
        />
        <SecretRow
          field="password"
          value={account.password}
          revealed={revealed.has("password")}
          disabled={disabled}
          onToggle={toggle}
          onCopy={copy}
        />
        {account.totpSecret ? (
          <SecretRow
            field="totp"
            value={account.totpSecret}
            revealed={revealed.has("totp")}
            disabled={disabled}
            onToggle={toggle}
            onCopy={copy}
          />
        ) : null}
      </div>

      <p className="copy-feedback" role="status" aria-live="polite">
        {feedback}
      </p>

      {allowUse ? (
        <button
          className="use-account-button"
          type="button"
          disabled={disabled}
          onClick={() => {
            openExternal(CHATGPT_URL);
            onUse();
          }}
        >
          Utiliser ce compte
        </button>
      ) : null}

      {account.totpProvider === "two_fa_live" && account.totpSecret ? (
        <div className="totp-help">
          <button type="button" disabled={disabled} onClick={() => setConfirmTwoFaLive(true)}>
            Copier et ouvrir 2FA.live
          </button>
          <p>La clé n’est jamais placée dans l’URL ni transmise automatiquement.</p>
        </div>
      ) : null}

      {account.totpProvider === "google_authenticator" && account.totpSecret ? (
        <div className="totp-help">
          <strong>Google Authenticator</strong>
          <p>
            Copiez la clé 2FA, puis dans l’application choisissez « Ajouter un code » et « Saisir
            une clé de configuration ».
          </p>
        </div>
      ) : null}

      {account.totpProvider === "other" && account.totpSecret ? (
        <p className="totp-help">
          Copiez la clé 2FA et ajoutez-la manuellement dans votre application.
        </p>
      ) : null}

      {confirmTwoFaLive ? (
        <div className="two-fa-warning" role="alertdialog" aria-modal="true">
          <strong>Avertissement de confidentialité</strong>
          <p>
            La clé sera copiée dans votre presse-papiers et 2FA.live s’ouvrira sans la recevoir.
            Collez-la uniquement si vous acceptez de la confier à ce service tiers.
          </p>
          <button type="button" onClick={() => void copyAndOpenTwoFaLive()}>
            Continuer vers 2FA.live
          </button>
          <button className="text-button" type="button" onClick={() => setConfirmTwoFaLive(false)}>
            Annuler
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SecretRow({
  field,
  value,
  revealed,
  disabled,
  onToggle,
  onCopy,
}: {
  field: CopyField;
  value: string;
  revealed: boolean;
  disabled: boolean;
  onToggle: (field: CopyField) => void;
  onCopy: (field: CopyField, value: string) => Promise<boolean>;
}) {
  const label = fieldLabels[field];
  return (
    <div className="secret-row">
      <span className="secret-label">{label}</span>
      <code>{revealed ? value : "••••••••••••"}</code>
      <button
        type="button"
        aria-label={`${revealed ? "Masquer" : "Révéler"} : ${label}`}
        aria-pressed={revealed}
        disabled={disabled}
        onClick={() => onToggle(field)}
      >
        {revealed ? "Masquer" : "Révéler"}
      </button>
      <button
        type="button"
        aria-label={`Copier : ${label}`}
        disabled={disabled}
        onClick={() => void onCopy(field, value)}
      >
        Copier
      </button>
    </div>
  );
}

function openExternal(url: string): void {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}
