export const VAULT_ENCRYPTION_VERSION = 1 as const;
export const VAULT_KDF_ITERATIONS = 600_000;

export type TotpProvider = "none" | "two_fa_live" | "google_authenticator" | "other";
export type QuotaStatus = "available" | "in_use" | "exhausted";

export interface VaultAccountV1 {
  readonly version: 1;
  readonly label: string;
  readonly login: string;
  readonly password: string;
  readonly notes: string;
  readonly totpProvider: TotpProvider;
  readonly totpSecret: string | null;
  readonly purchasedOn: string;
  readonly endsOn: string;
  readonly quotaStatus: QuotaStatus;
  readonly quotaExhaustedAt: string | null;
  readonly lastUsedAt: string | null;
  readonly archivedAt: string | null;
}

export interface EncryptedVaultPayload {
  readonly version: typeof VAULT_ENCRYPTION_VERSION;
  readonly ciphertext: string;
  readonly iv: string;
}
