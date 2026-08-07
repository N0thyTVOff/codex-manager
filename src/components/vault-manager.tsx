"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { AccountDashboard } from "@/components/account-dashboard";
import { VaultBackupPanel } from "@/components/vault-backup-panel";
import { authClient } from "@/lib/auth/client";
import type { DecryptedVaultAccount } from "@/lib/vault/accounts";
import {
  createVaultSetup,
  decryptVaultAccounts,
  rotateVaultLocally,
  unlockVaultKey,
} from "@/lib/vault/lifecycle";
import type { VaultProfileEnvelope, VaultRecordEnvelope } from "@/lib/vault/lifecycle";

const profileSchema = z.strictObject({
  kdfAlgorithm: z.literal("PBKDF2-SHA-256"),
  kdfIterations: z.number().int().positive(),
  kdfVersion: z.literal(1),
  salt: z.string(),
  verificationCiphertext: z.string().nullable(),
  verificationIv: z.string().nullable(),
  schemaVersion: z.literal(1),
  revision: z.number().int().positive(),
});
const profileResponseSchema = z.strictObject({ profile: profileSchema.nullable() });
const recordSchema = z.object({
  id: z.string().uuid(),
  ciphertext: z.string(),
  iv: z.string(),
  schemaVersion: z.literal(1),
  revision: z.number().int().positive(),
});
const recordsResponseSchema = z.strictObject({ records: z.array(recordSchema) });
const rotationResponseSchema = z.strictObject({ profileRevision: z.number().int().positive() });

type VaultPhase = "loading" | "setup" | "locked" | "unlocked" | "error";

export function VaultManager() {
  const router = useRouter();
  const [phase, setPhase] = useState<VaultPhase>("loading");
  const [profile, setProfile] = useState<VaultProfileEnvelope | null>(null);
  const [records, setRecords] = useState<ReadonlyArray<VaultRecordEnvelope>>([]);
  const [accounts, setAccounts] = useState<ReadonlyArray<DecryptedVaultAccount>>([]);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [rotationOpen, setRotationOpen] = useState(false);
  const rotationAllowed = useRef(false);

  useEffect(() => {
    let active = true;
    void readProfile()
      .then((nextProfile) => {
        if (!active) return;
        setProfile(nextProfile);
        setPhase(nextProfile ? "locked" : "setup");
      })
      .catch(() => {
        if (active) setPhase("error");
      });
    return () => {
      active = false;
    };
  }, []);

  function lockVault() {
    rotationAllowed.current = false;
    setVaultKey(null);
    setRecords([]);
    setAccounts([]);
    setRotationOpen(false);
    setPhase(profile ? "locked" : "setup");
  }

  async function signOut() {
    lockVault();
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  if (phase === "loading") {
    return <VaultStatus title="Lecture du profil chiffré…" detail="Aucun secret n’est chargé." />;
  }
  if (phase === "error") {
    return (
      <VaultStatus
        title="Le coffre ne peut pas être chargé."
        detail="Réessayez plus tard. Aucun détail sensible n’a été affiché."
      />
    );
  }
  if (phase === "setup") {
    return (
      <SetupVault
        onReady={(nextProfile, key) => {
          setProfile(nextProfile);
          setVaultKey(key);
          setAccounts([]);
          setPhase("unlocked");
        }}
      />
    );
  }
  if (phase === "locked" && profile) {
    return (
      <UnlockVault
        profile={profile}
        onUnlocked={(key, nextRecords, nextAccounts) => {
          setVaultKey(key);
          setRecords(nextRecords);
          setAccounts(nextAccounts);
          setPhase("unlocked");
        }}
        onSignOut={signOut}
      />
    );
  }

  return (
    <div className="vault-open-layout">
      <section className="vault-panel vault-open-header" aria-labelledby="open-vault-title">
        <div className="vault-state-line">
          <span className="status-dot">Déverrouillé</span>
          <span>
            {records.length} fiche{records.length === 1 ? "" : "s"} chiffrée
            {records.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="eyebrow">Clé locale active</p>
        <h1 id="open-vault-title">Le coffre est ouvert.</h1>
        <p className="vault-copy">
          La clé existe uniquement dans la mémoire de cet onglet. Les comptes sont déchiffrés ici,
          puis rechiffrés avant chaque écriture.
        </p>
        <div className="vault-actions">
          <button className="primary-button" type="button" onClick={lockVault}>
            Verrouiller maintenant
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              rotationAllowed.current = true;
              setRotationOpen(true);
            }}
          >
            Changer la phrase secrète
          </button>
          <button className="text-button" type="button" onClick={signOut}>
            Se déconnecter
          </button>
        </div>
      </section>
      {profile && vaultKey ? (
        <>
          <AccountDashboard
            profileRevision={profile.revision}
            vaultKey={vaultKey}
            records={records}
            accounts={accounts}
            onChanged={(profileRevision, nextRecords, nextAccounts) => {
              setProfile({ ...profile, revision: profileRevision });
              setRecords(nextRecords);
              setAccounts(nextAccounts);
            }}
          />
          <VaultBackupPanel
            profile={profile}
            records={records}
            onRestored={(nextProfile, nextRecords, nextAccounts, key) => {
              setProfile(nextProfile);
              setRecords(nextRecords);
              setAccounts(nextAccounts);
              setVaultKey(key);
            }}
          />
        </>
      ) : null}
      {rotationOpen && profile && vaultKey ? (
        <RotateVault
          profile={profile}
          onCancel={() => {
            rotationAllowed.current = false;
            setRotationOpen(false);
          }}
          onRotated={(nextProfile, nextRecords, key) => {
            if (!rotationAllowed.current) return;
            rotationAllowed.current = false;
            setProfile(nextProfile);
            setRecords(nextRecords);
            setVaultKey(key);
            setRotationOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function SetupVault({
  onReady,
}: {
  onReady: (profile: VaultProfileEnvelope, key: CryptoKey) => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateNewPassphrase(passphrase, confirmation);
    if (validation) return setError(validation);
    setPending(true);
    setError(null);
    try {
      const setup = await createVaultSetup(passphrase);
      const response = await fetch("/api/vault/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup.profile),
      });
      if (!response.ok) throw new Error("setup_failed");
      const parsed = profileResponseSchema.parse(await response.json());
      if (!parsed.profile) throw new Error("missing_profile");
      setPassphrase("");
      setConfirmation("");
      onReady(parsed.profile, setup.key);
    } catch {
      setError("Initialisation impossible. Recharge la page avant de réessayer.");
    } finally {
      setPending(false);
    }
  }

  return (
    <VaultForm
      id="setup-vault-title"
      eyebrow="Première ouverture"
      title="Crée la phrase secrète du coffre."
      detail="Au moins 16 caractères. Elle ne sera ni envoyée au serveur, ni enregistrée par l’application. Sa perte rendra les fiches irrécupérables."
      onSubmit={submit}
      pending={pending}
      error={error}
    >
      <SecretField
        id="new-passphrase"
        label="Phrase secrète"
        value={passphrase}
        onChange={setPassphrase}
        autoFocus
      />
      <SecretField
        id="confirm-passphrase"
        label="Confirmer la phrase"
        value={confirmation}
        onChange={setConfirmation}
      />
    </VaultForm>
  );
}

function UnlockVault({
  profile,
  onUnlocked,
  onSignOut,
}: {
  profile: VaultProfileEnvelope;
  onUnlocked: (
    key: CryptoKey,
    records: ReadonlyArray<VaultRecordEnvelope>,
    accounts: ReadonlyArray<DecryptedVaultAccount>,
  ) => void;
  onSignOut: () => Promise<void>;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passphrase.length < 16) return setError("La phrase doit contenir au moins 16 caractères.");
    setPending(true);
    setError(null);
    try {
      const key = await unlockVaultKey(passphrase, profile);
      if (!key) {
        setError("Phrase secrète incorrecte ou profil incompatible.");
        return;
      }
      const nextRecords = await readRecords();
      const nextAccounts = await decryptVaultAccounts(key, nextRecords);
      setPassphrase("");
      onUnlocked(key, nextRecords, nextAccounts);
    } catch {
      setError("Déverrouillage impossible. Réessaie sans recharger de donnée sensible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <VaultForm
      id="unlock-vault-title"
      eyebrow="Coffre verrouillé"
      title="Déverrouille ce coffre localement."
      detail="La vérification est effectuée dans ce navigateur. La phrase et la clé dérivée ne sont jamais envoyées à l’API."
      onSubmit={submit}
      pending={pending}
      error={error}
    >
      <SecretField
        id="unlock-passphrase"
        label="Phrase secrète"
        value={passphrase}
        onChange={setPassphrase}
        autoFocus
      />
      <button className="text-button" type="button" onClick={() => void onSignOut()}>
        Se déconnecter
      </button>
    </VaultForm>
  );
}

function RotateVault({
  profile,
  onCancel,
  onRotated,
}: {
  profile: VaultProfileEnvelope;
  onCancel: () => void;
  onRotated: (
    profile: VaultProfileEnvelope,
    records: ReadonlyArray<VaultRecordEnvelope>,
    key: CryptoKey,
  ) => void;
}) {
  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [nextPassphrase, setNextPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateNewPassphrase(nextPassphrase, confirmation);
    if (validation) return setError(validation);
    if (currentPassphrase === nextPassphrase) {
      return setError("Choisis une nouvelle phrase différente de l’ancienne.");
    }
    setPending(true);
    setError(null);
    try {
      const [freshProfile, freshRecords] = await Promise.all([readProfile(), readRecords()]);
      if (!freshProfile || freshProfile.revision !== profile.revision) {
        setError("Le coffre a changé dans un autre onglet. Verrouille-le puis recharge la page.");
        return;
      }
      const rotation = await rotateVaultLocally(
        currentPassphrase,
        nextPassphrase,
        freshProfile,
        freshRecords,
      );
      if (!rotation) {
        setError("La phrase actuelle est incorrecte.");
        return;
      }
      const response = await fetch("/api/vault/rekey", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rotation.request),
      });
      if (response.status === 409) {
        setError("Conflit détecté : aucune donnée n’a été modifiée. Recharge le coffre.");
        return;
      }
      if (!response.ok) throw new Error("rotation_failed");
      const result = rotationResponseSchema.parse(await response.json());
      const nextProfile: VaultProfileEnvelope = {
        ...rotation.request.profile,
        revision: result.profileRevision,
      };
      const nextRecords = rotation.request.records.map((record) => ({
        ...record,
        revision: record.revision + 1,
      }));
      setCurrentPassphrase("");
      setNextPassphrase("");
      setConfirmation("");
      onRotated(nextProfile, nextRecords, rotation.key);
    } catch {
      setError("Rotation impossible. Le coffre existant reste inchangé.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rotation-card">
      <VaultForm
        id="rotate-vault-title"
        eyebrow="Rotation atomique"
        title="Changer la phrase secrète"
        detail="Toutes les fiches seront déchiffrées puis rechiffrées localement avec un nouveau sel et de nouveaux IV. Un conflit annule toute l’opération."
        onSubmit={submit}
        pending={pending}
        error={error}
        submitLabel="Rechiffrer tout le coffre"
      >
        <SecretField
          id="current-passphrase"
          label="Phrase actuelle"
          value={currentPassphrase}
          onChange={setCurrentPassphrase}
          autoFocus
        />
        <SecretField
          id="rotated-passphrase"
          label="Nouvelle phrase"
          value={nextPassphrase}
          onChange={setNextPassphrase}
        />
        <SecretField
          id="rotated-confirmation"
          label="Confirmer la nouvelle phrase"
          value={confirmation}
          onChange={setConfirmation}
        />
        <button className="text-button" type="button" onClick={onCancel} disabled={pending}>
          Annuler
        </button>
      </VaultForm>
    </div>
  );
}

function VaultForm({
  id,
  eyebrow,
  title,
  detail,
  children,
  onSubmit,
  pending,
  error,
  submitLabel = "Continuer",
}: {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  children: React.ReactNode;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  error: string | null;
  submitLabel?: string;
}) {
  return (
    <section className="vault-panel" aria-labelledby={id}>
      <p className="eyebrow">{eyebrow}</p>
      <h1 id={id}>{title}</h1>
      <p className="vault-copy">{detail}</p>
      <form className="vault-form" onSubmit={onSubmit}>
        {children}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Traitement local…" : submitLabel}
        </button>
      </form>
    </section>
  );
}

function SecretField({
  id,
  label,
  value,
  onChange,
  autoFocus = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="secret-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={16}
        maxLength={512}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        required
      />
    </label>
  );
}

function VaultStatus({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="vault-panel" aria-live="polite">
      <p className="eyebrow">Coffre personnel</p>
      <h1>{title}</h1>
      <p className="vault-copy">{detail}</p>
    </section>
  );
}

function validateNewPassphrase(passphrase: string, confirmation: string): string | null {
  if (passphrase.length < 16) return "La phrase doit contenir au moins 16 caractères.";
  if (passphrase !== confirmation) return "Les deux phrases ne correspondent pas.";
  return null;
}

async function readProfile(): Promise<VaultProfileEnvelope | null> {
  const response = await fetch("/api/vault/profile", { cache: "no-store" });
  if (!response.ok) throw new Error("profile_unavailable");
  return profileResponseSchema.parse(await response.json()).profile;
}

async function readRecords(): Promise<ReadonlyArray<VaultRecordEnvelope>> {
  const response = await fetch("/api/vault/records", { cache: "no-store" });
  if (!response.ok) throw new Error("records_unavailable");
  return recordsResponseSchema.parse(await response.json()).records;
}
