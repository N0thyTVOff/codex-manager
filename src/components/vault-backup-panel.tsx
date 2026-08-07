"use client";

import { useState } from "react";
import { z } from "zod";

import type { DecryptedVaultAccount } from "@/lib/vault/accounts";
import {
  createVaultBackup,
  MAX_BACKUP_FILE_BYTES,
  parseVaultBackup,
  unlockVaultBackup,
  type VaultBackupV1,
} from "@/lib/vault/backup";
import type { VaultProfileEnvelope, VaultRecordEnvelope } from "@/lib/vault/lifecycle";

const restoreResponseSchema = z.strictObject({
  profileRevision: z.number().int().positive(),
});

export function VaultBackupPanel({
  profile,
  records,
  onRestored,
}: {
  profile: VaultProfileEnvelope;
  records: ReadonlyArray<VaultRecordEnvelope>;
  onRestored: (
    profile: VaultProfileEnvelope,
    records: ReadonlyArray<VaultRecordEnvelope>,
    accounts: ReadonlyArray<DecryptedVaultAccount>,
    key: CryptoKey,
  ) => void;
}) {
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [backup, setBackup] = useState<VaultBackupV1 | null>(null);
  const [fileName, setFileName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function exportBackup() {
    setError(null);
    setNotice(null);
    try {
      const serialized = `${JSON.stringify(createVaultBackup(profile, records), null, 2)}\n`;
      downloadJson(serialized, "codex-manager-backup-v1.json");
      setNotice(
        "Sauvegarde chiffrée téléchargée. Conservez-la avec la phrase secrète qui était active au moment de l’export.",
      );
    } catch {
      setError("Export impossible. Verrouillez puis rechargez le coffre avant de réessayer.");
    }
  }

  async function selectFile(file: File | undefined) {
    setBackup(null);
    setFileName("");
    setPassphrase("");
    setConfirmed(false);
    setError(null);
    setNotice(null);
    if (!file) return;
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setError("Ce fichier dépasse la taille maximale autorisée.");
      return;
    }
    try {
      const parsed = parseVaultBackup(await file.text());
      setBackup(parsed);
      setFileName(file.name);
    } catch {
      setError("Fichier de sauvegarde invalide ou incompatible.");
    }
  }

  async function restoreBackup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!backup || !confirmed) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const unlocked = await unlockVaultBackup(passphrase, backup);
      if (!unlocked) {
        setError("Phrase incorrecte ou sauvegarde altérée.");
        return;
      }
      const response = await fetch("/api/vault/restore", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileRevision: profile.revision, backup }),
      });
      if (response.status === 409) {
        setError(
          "Conflit détecté : le coffre n’a pas été remplacé. Verrouillez-le puis rechargez.",
        );
        return;
      }
      if (!response.ok) throw new Error("restore_failed");
      const result = restoreResponseSchema.parse(await response.json());
      const nextProfile: VaultProfileEnvelope = {
        ...backup.profile,
        revision: result.profileRevision,
      };
      const nextRecords: VaultRecordEnvelope[] = backup.records.map((record) => ({
        ...record,
        revision: 1,
      }));
      setPassphrase("");
      setBackup(null);
      setFileName("");
      setConfirmed(false);
      setRestoreOpen(false);
      onRestored(nextProfile, nextRecords, unlocked.accounts, unlocked.key);
    } catch {
      setError("Restauration impossible. Le coffre existant reste inchangé.");
    } finally {
      setPending(false);
    }
  }

  function toggleRestore() {
    setRestoreOpen((open) => !open);
    setBackup(null);
    setFileName("");
    setPassphrase("");
    setConfirmed(false);
    setError(null);
    setNotice(null);
  }

  return (
    <section className="backup-panel" aria-labelledby="backup-title">
      <div>
        <p className="eyebrow">Portabilité chiffrée</p>
        <h2 id="backup-title">Sauvegarder le coffre</h2>
        <p className="vault-copy">
          Le fichier contient uniquement le profil cryptographique et les enveloppes chiffrées. Il
          ne contient ni session, ni identité GitHub, ni donnée de compte en clair.
        </p>
      </div>
      <div className="backup-actions">
        <button className="secondary-button" type="button" onClick={exportBackup}>
          Exporter le JSON chiffré
        </button>
        <button className="text-button" type="button" onClick={toggleRestore}>
          {restoreOpen ? "Annuler la restauration" : "Restaurer une sauvegarde"}
        </button>
      </div>

      {notice ? (
        <p className="form-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {restoreOpen ? (
        <form className="restore-form" onSubmit={restoreBackup}>
          <div className="restore-warning">
            <strong>Remplacement complet et irréversible</strong>
            <p>
              Toutes les fiches actuelles seront remplacées dans une transaction unique. La phrase
              demandée est celle de la sauvegarde, qui deviendra aussi la phrase active du coffre.
            </p>
          </div>
          <label className="account-field" htmlFor="backup-file">
            Fichier JSON chiffré
            <input
              id="backup-file"
              type="file"
              accept=".json,application/json"
              onChange={(event) => void selectFile(event.target.files?.[0])}
              disabled={pending}
              required
            />
          </label>
          {backup ? (
            <p className="selected-backup">
              <strong>{fileName}</strong> — {backup.records.length} fiche
              {backup.records.length === 1 ? "" : "s"} chiffrée
              {backup.records.length === 1 ? "" : "s"}
            </p>
          ) : null}
          <label className="secret-field" htmlFor="backup-passphrase">
            <span>Phrase secrète de cette sauvegarde</span>
            <input
              id="backup-passphrase"
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              minLength={16}
              maxLength={512}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={pending || !backup}
              required
            />
          </label>
          <label className="restore-confirmation">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={pending || !backup}
              required
            />
            Je confirme le remplacement complet de mon coffre actuel.
          </label>
          <button
            className="danger-button"
            type="submit"
            disabled={pending || !backup || !confirmed}
          >
            {pending ? "Validation locale…" : "Remplacer le coffre"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function downloadJson(value: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
