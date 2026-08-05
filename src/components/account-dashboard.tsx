"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { AccountForm } from "@/components/account-form";
import { AccountQuickActions } from "@/components/account-quick-actions";
import {
  isAccountExpired,
  localDate,
  markAccountInUse,
  markQuotaExhausted,
  normalizeQuota,
  partitionAndSortAccounts,
  quotaAvailableAt,
  renewAccount,
} from "@/lib/vault/accounts";
import type { DecryptedVaultAccount } from "@/lib/vault/accounts";
import { encryptVaultAccount } from "@/lib/vault/lifecycle";
import type { VaultRecordEnvelope } from "@/lib/vault/lifecycle";
import type { VaultAccountV1 } from "@/types/vault";

const storedRecordSchema = z.object({
  id: z.string().uuid(),
  ciphertext: z.string(),
  iv: z.string(),
  schemaVersion: z.literal(1),
  revision: z.number().int().positive(),
  profileRevision: z.number().int().positive(),
});
const recordResponseSchema = z.strictObject({ record: storedRecordSchema });
const deleteResponseSchema = z.strictObject({
  deleted: z.literal(true),
  profileRevision: z.number().int().positive(),
});

type Editor = { mode: "create" } | { mode: "edit"; record: DecryptedVaultAccount } | null;
type View = "active" | "archived";

export function AccountDashboard({
  profileRevision,
  vaultKey,
  records,
  accounts,
  onChanged,
}: {
  profileRevision: number;
  vaultKey: CryptoKey;
  records: ReadonlyArray<VaultRecordEnvelope>;
  accounts: ReadonlyArray<DecryptedVaultAccount>;
  onChanged: (
    profileRevision: number,
    records: ReadonlyArray<VaultRecordEnvelope>,
    accounts: ReadonlyArray<DecryptedVaultAccount>,
  ) => void;
}) {
  const [view, setView] = useState<View>("active");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [renewing, setRenewing] = useState<DecryptedVaultAccount | null>(null);
  const [renewalDate, setRenewalDate] = useState(() => localDate());
  const [deleting, setDeleting] = useState<DecryptedVaultAccount | null>(null);

  useEffect(() => {
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const deadlines = accounts
      .map(({ account }) => quotaAvailableAt(account)?.getTime())
      .filter((value): value is number => typeof value === "number" && value > now.getTime());
    const nextDeadline = Math.min(nextMidnight.getTime(), ...deadlines);
    const timeout = window.setTimeout(
      () => setNow(new Date()),
      Math.min(Math.max(nextDeadline - Date.now() + 25, 25), 2_147_483_647),
    );
    return () => window.clearTimeout(timeout);
  }, [accounts, now]);

  const partition = useMemo(
    () => partitionAndSortAccounts(accounts, now, localDate(now)),
    [accounts, now],
  );
  const visible = filterAccounts(view === "active" ? partition.active : partition.archived, query);

  async function createAccount(account: VaultAccountV1): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const envelope = await encryptVaultAccount(vaultKey, id, account);
      const response = await fetch("/api/vault/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...envelope, profileRevision }),
      });
      const stored = await parseRecordMutation(response);
      if (!stored) return;
      onChanged(
        stored.profileRevision,
        [...records, toEnvelope(stored)],
        [...accounts, { id, revision: stored.revision, account }],
      );
      setEditor(null);
    } catch {
      setError("Ajout impossible. Aucune donnée en clair n’a été envoyée.");
    } finally {
      setPending(false);
    }
  }

  async function updateAccount(
    record: DecryptedVaultAccount,
    account: VaultAccountV1,
  ): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const envelope = await encryptVaultAccount(vaultKey, record.id, account);
      const response = await fetch(`/api/vault/records/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...envelope,
          revision: record.revision,
          profileRevision,
        }),
      });
      const stored = await parseRecordMutation(response);
      if (!stored) return false;
      onChanged(
        stored.profileRevision,
        records.map((item) => (item.id === record.id ? toEnvelope(stored) : item)),
        accounts.map((item) =>
          item.id === record.id ? { id: record.id, revision: stored.revision, account } : item,
        ),
      );
      return true;
    } catch {
      setError("Enregistrement impossible. La fiche existante reste inchangée.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function deleteAccount(record: DecryptedVaultAccount): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/vault/records/${record.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: record.revision, profileRevision }),
      });
      if (response.status === 409) return setConflict();
      if (!response.ok) return setError("Suppression impossible. Aucune donnée n’a été modifiée.");
      const result = deleteResponseSchema.parse(await response.json());
      onChanged(
        result.profileRevision,
        records.filter(({ id }) => id !== record.id),
        accounts.filter(({ id }) => id !== record.id),
      );
      setDeleting(null);
    } catch {
      setError("Suppression impossible. Aucune donnée n’a été modifiée.");
    } finally {
      setPending(false);
    }
  }

  async function parseRecordMutation(
    response: Response,
  ): Promise<z.infer<typeof storedRecordSchema> | null> {
    if (response.status === 409) {
      setConflict();
      return null;
    }
    if (!response.ok) {
      setError("Enregistrement impossible. La fiche existante reste inchangée.");
      return null;
    }
    try {
      return recordResponseSchema.parse(await response.json()).record;
    } catch {
      setError("Réponse invalide. Recharge le coffre avant toute nouvelle modification.");
      return null;
    }
  }

  function setConflict() {
    setError("Conflit détecté avec un autre onglet. Verrouille puis recharge le coffre.");
  }

  async function applyUpdate(
    record: DecryptedVaultAccount,
    account: VaultAccountV1,
    closeEditor = false,
  ) {
    if (await updateAccount(record, account)) {
      if (closeEditor) setEditor(null);
      setRenewing(null);
    }
  }

  return (
    <section className="accounts-section" aria-labelledby="accounts-title">
      <div className="accounts-toolbar">
        <div>
          <p className="eyebrow">Inventaire chiffré</p>
          <h2 id="accounts-title">Comptes ChatGPT Plus</h2>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => setEditor({ mode: "create" })}
        >
          Ajouter un compte
        </button>
      </div>

      <div className="account-filters">
        <div className="view-tabs" role="tablist" aria-label="Vues du coffre">
          <button
            type="button"
            role="tab"
            aria-selected={view === "active"}
            onClick={() => setView("active")}
          >
            Actifs <span>{partition.active.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "archived"}
            onClick={() => setView("archived")}
          >
            Archives <span>{partition.archived.length}</span>
          </button>
        </div>
        <label className="account-search" htmlFor="account-search">
          <span>Rechercher localement</span>
          <input
            id="account-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Libellé ou login"
            autoComplete="off"
          />
        </label>
      </div>

      {error ? (
        <p className="form-error account-global-error" role="alert">
          {error}
        </p>
      ) : null}

      {editor ? (
        <AccountForm
          key={editor.mode === "edit" ? editor.record.id : "create"}
          initial={editor.mode === "edit" ? editor.record.account : null}
          pending={pending}
          onCancel={() => setEditor(null)}
          onSubmit={async (account) => {
            if (editor.mode === "create") await createAccount(account);
            else await applyUpdate(editor.record, account, true);
          }}
        />
      ) : null}

      {renewing ? (
        <form
          className="inline-confirmation"
          onSubmit={(event) => {
            event.preventDefault();
            void applyUpdate(renewing, renewAccount(renewing.account, renewalDate));
          }}
        >
          <strong>Renouveler « {renewing.account.label} »</strong>
          <label htmlFor="renewal-date">Nouvelle date d’achat</label>
          <input
            id="renewal-date"
            type="date"
            value={renewalDate}
            onChange={(event) => setRenewalDate(event.target.value)}
            required
          />
          <button className="secondary-button" type="submit" disabled={pending}>
            Confirmer le renouvellement
          </button>
          <button className="text-button" type="button" onClick={() => setRenewing(null)}>
            Annuler
          </button>
        </form>
      ) : null}

      {deleting ? (
        <div
          className="inline-confirmation danger-confirmation"
          role="alertdialog"
          aria-modal="true"
        >
          <strong>Supprimer définitivement « {deleting.account.label} » ?</strong>
          <p>Cette action retire l’enveloppe chiffrée et ne peut pas être annulée.</p>
          <button
            className="danger-button"
            type="button"
            onClick={() => void deleteAccount(deleting)}
            disabled={pending}
          >
            Supprimer définitivement
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => setDeleting(null)}
            disabled={pending}
          >
            Conserver la fiche
          </button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="accounts-empty">
          <strong>
            {query
              ? "Aucun résultat."
              : view === "active"
                ? "Aucun compte actif."
                : "Aucune archive."}
          </strong>
          <p>
            Les filtres et le tri sont calculés uniquement sur les données déchiffrées dans cet
            onglet.
          </p>
        </div>
      ) : (
        <div className="account-grid">
          {visible.map((record) => (
            <AccountCard
              key={record.id}
              record={record}
              now={now}
              archivedView={view === "archived"}
              pending={pending}
              onEdit={() => setEditor({ mode: "edit", record })}
              onRenew={() => {
                setRenewalDate(localDate());
                setRenewing(record);
              }}
              onArchive={() =>
                void applyUpdate(record, {
                  ...record.account,
                  archivedAt: new Date().toISOString(),
                })
              }
              onRestore={() => void applyUpdate(record, { ...record.account, archivedAt: null })}
              onAvailable={() =>
                void applyUpdate(record, {
                  ...record.account,
                  quotaStatus: "available",
                  quotaExhaustedAt: null,
                })
              }
              onInUse={() => void applyUpdate(record, markAccountInUse(record.account, new Date()))}
              onExhausted={() =>
                void applyUpdate(record, markQuotaExhausted(record.account, new Date()))
              }
              onDelete={() => setDeleting(record)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AccountCard({
  record,
  now,
  archivedView,
  pending,
  onEdit,
  onRenew,
  onArchive,
  onRestore,
  onAvailable,
  onInUse,
  onExhausted,
  onDelete,
}: {
  record: DecryptedVaultAccount;
  now: Date;
  archivedView: boolean;
  pending: boolean;
  onEdit: () => void;
  onRenew: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onAvailable: () => void;
  onInUse: () => void;
  onExhausted: () => void;
  onDelete: () => void;
}) {
  const account = normalizeQuota(record.account, now);
  const expired = isAccountExpired(account, localDate(now));
  const availableAt = quotaAvailableAt(account);
  const status = expired
    ? "Expiré"
    : account.archivedAt
      ? "Archivé"
      : account.quotaStatus === "in_use"
        ? "En cours"
        : account.quotaStatus === "exhausted"
          ? "Épuisé"
          : "Disponible";

  return (
    <article className="account-card">
      <div className="account-card-heading">
        <div>
          <span className={`account-status status-${account.quotaStatus}`}>{status}</span>
          <h3>{account.label}</h3>
        </div>
      </div>
      <AccountQuickActions
        account={account}
        disabled={pending}
        allowUse={!archivedView && !expired}
        onUse={onInUse}
      />
      <dl className="account-dates">
        <div>
          <dt>Début</dt>
          <dd>{formatDate(account.purchasedOn)}</dd>
        </div>
        <div>
          <dt>Fin inclusive</dt>
          <dd>{formatDate(account.endsOn)}</dd>
        </div>
      </dl>
      {availableAt ? (
        <p className="quota-reset">Quota disponible le {formatInstant(availableAt)}</p>
      ) : null}
      <div className="account-card-actions">
        <button type="button" onClick={onEdit} disabled={pending}>
          Modifier
        </button>
        <button type="button" onClick={onRenew} disabled={pending}>
          Renouveler
        </button>
        {!archivedView ? (
          <>
            {account.quotaStatus !== "exhausted" ? (
              <button type="button" onClick={onExhausted} disabled={pending}>
                Quota épuisé
              </button>
            ) : null}
            {account.quotaStatus !== "available" ? (
              <button type="button" onClick={onAvailable} disabled={pending}>
                Rendre disponible
              </button>
            ) : null}
            <button type="button" onClick={onArchive} disabled={pending}>
              Archiver
            </button>
          </>
        ) : account.archivedAt && !expired ? (
          <button type="button" onClick={onRestore} disabled={pending}>
            Restaurer
          </button>
        ) : null}
        <button className="danger-link" type="button" onClick={onDelete} disabled={pending}>
          Supprimer
        </button>
      </div>
    </article>
  );
}

function filterAccounts(
  records: ReadonlyArray<DecryptedVaultAccount>,
  query: string,
): DecryptedVaultAccount[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
  if (!normalizedQuery) return [...records];
  return records.filter(({ account }) =>
    [account.label, account.login, account.notes].some((value) =>
      value.toLocaleLowerCase("fr-FR").includes(normalizedQuery),
    ),
  );
}

function toEnvelope(record: z.infer<typeof storedRecordSchema>): VaultRecordEnvelope {
  return {
    id: record.id,
    ciphertext: record.ciphertext,
    iv: record.iv,
    schemaVersion: record.schemaVersion,
    revision: record.revision,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function formatInstant(value: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
