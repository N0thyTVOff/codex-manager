"use client";

import { useState } from "react";

import { addCalendarMonth, localDate, vaultAccountSchema } from "@/lib/vault/accounts";
import type { TotpProvider, VaultAccountV1 } from "@/types/vault";

export function AccountForm({
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: VaultAccountV1 | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (account: VaultAccountV1) => Promise<void>;
}) {
  const today = localDate();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [login, setLogin] = useState(initial?.login ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [totpProvider, setTotpProvider] = useState<TotpProvider>(initial?.totpProvider ?? "none");
  const [totpSecret, setTotpSecret] = useState(initial?.totpSecret ?? "");
  const [purchasedOn, setPurchasedOn] = useState(initial?.purchasedOn ?? today);
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? addCalendarMonth(today));
  const [endTouched, setEndTouched] = useState(Boolean(initial));
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = vaultAccountSchema.safeParse({
      version: 1,
      label,
      login,
      password,
      notes,
      totpProvider,
      totpSecret: totpProvider === "none" ? null : totpSecret.trim() || null,
      purchasedOn,
      endsOn,
      quotaStatus: initial?.quotaStatus ?? "available",
      quotaExhaustedAt: initial?.quotaExhaustedAt ?? null,
      lastUsedAt: initial?.lastUsedAt ?? null,
      archivedAt: initial?.archivedAt ?? null,
    });
    if (!result.success) {
      setError("Vérifie les champs, les dates et la configuration 2FA.");
      return;
    }
    setError(null);
    await onSubmit(result.data);
  }

  return (
    <section className="account-editor" aria-labelledby="account-editor-title">
      <div>
        <p className="eyebrow">{initial ? "Modification" : "Nouveau compte"}</p>
        <h2 id="account-editor-title">
          {initial ? "Modifier la fiche" : "Ajouter une fiche chiffrée"}
        </h2>
      </div>
      <form className="account-form" onSubmit={submit}>
        <AccountField label="Libellé" htmlFor="account-label">
          <input
            id="account-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={100}
            autoFocus
            required
          />
        </AccountField>
        <AccountField label="Login" htmlFor="account-login">
          <input
            id="account-login"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            maxLength={320}
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </AccountField>
        <AccountField label="Mot de passe" htmlFor="account-password">
          <input
            id="account-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={4_096}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </AccountField>
        <div className="account-form-row">
          <AccountField label="Date d’achat / début" htmlFor="account-start">
            <input
              id="account-start"
              type="date"
              value={purchasedOn}
              onChange={(event) => {
                const nextDate = event.target.value;
                setPurchasedOn(nextDate);
                if (!endTouched) {
                  try {
                    setEndsOn(addCalendarMonth(nextDate));
                  } catch {
                    // Le navigateur peut émettre un état transitoire vide pendant la saisie.
                  }
                }
              }}
              required
            />
          </AccountField>
          <AccountField label="Fin inclusive" htmlFor="account-end">
            <input
              id="account-end"
              type="date"
              value={endsOn}
              onChange={(event) => {
                setEndsOn(event.target.value);
                setEndTouched(true);
              }}
              min={purchasedOn}
              required
            />
          </AccountField>
        </div>
        <AccountField label="Fournisseur 2FA" htmlFor="account-totp-provider">
          <select
            id="account-totp-provider"
            value={totpProvider}
            onChange={(event) => {
              const provider = event.target.value as TotpProvider;
              setTotpProvider(provider);
              if (provider === "none") setTotpSecret("");
            }}
          >
            <option value="none">Aucun</option>
            <option value="two_fa_live">2FA.live</option>
            <option value="google_authenticator">Google Authenticator</option>
            <option value="other">Autre</option>
          </select>
        </AccountField>
        {totpProvider !== "none" ? (
          <AccountField label="Clé 2FA" htmlFor="account-totp-secret">
            <input
              id="account-totp-secret"
              type="password"
              value={totpSecret}
              onChange={(event) => setTotpSecret(event.target.value)}
              maxLength={512}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </AccountField>
        ) : null}
        <AccountField label="Notes privées" htmlFor="account-notes">
          <textarea
            id="account-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={10_000}
            rows={4}
          />
        </AccountField>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Chiffrement…" : initial ? "Enregistrer" : "Ajouter le compte"}
          </button>
          <button className="text-button" type="button" onClick={onCancel} disabled={pending}>
            Annuler
          </button>
        </div>
      </form>
    </section>
  );
}

function AccountField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label className="account-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}
