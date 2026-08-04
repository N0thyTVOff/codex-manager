export const VAULT_ENCRYPTION_VERSION = 1 as const;
export const VAULT_KDF_ITERATIONS = 600_000;

export interface VaultSecret {
  readonly label: string;
  readonly login: string;
  readonly password: string;
  readonly totpSecret: string;
  readonly subscriptionEndsOn: string | null;
  readonly tokenResetOn: string | null;
  readonly notes: string;
}

export interface EncryptedVaultPayload {
  readonly version: typeof VAULT_ENCRYPTION_VERSION;
  readonly ciphertext: string;
  readonly iv: string;
}
