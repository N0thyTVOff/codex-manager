import { VAULT_ENCRYPTION_VERSION, VAULT_KDF_ITERATIONS } from "@/types/vault";
import type { EncryptedVaultPayload } from "@/types/vault";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder(undefined, { fatal: true });

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function createVaultSalt(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveVaultKey(
  passphrase: string,
  salt: string,
  iterations = VAULT_KDF_ITERATIONS,
): Promise<CryptoKey> {
  if (passphrase.length < 16) {
    throw new Error("La phrase secrète doit contenir au moins 16 caractères.");
  }
  if (!Number.isSafeInteger(iterations) || iterations < VAULT_KDF_ITERATIONS) {
    throw new Error("Le paramètre de dérivation est insuffisant.");
  }

  const material = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64Url(salt),
      iterations,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVaultPayload(
  key: CryptoKey,
  value: unknown,
  recordId: string,
): Promise<EncryptedVaultPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: textEncoder.encode(recordId),
      tagLength: 128,
    },
    key,
    plaintext,
  );

  return {
    version: VAULT_ENCRYPTION_VERSION,
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
    iv: toBase64Url(iv),
  };
}

export async function decryptVaultPayload<T>(
  key: CryptoKey,
  payload: EncryptedVaultPayload,
  recordId: string,
): Promise<T> {
  if (payload.version !== VAULT_ENCRYPTION_VERSION) {
    throw new Error("Version de chiffrement non prise en charge.");
  }

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64Url(payload.iv),
      additionalData: textEncoder.encode(recordId),
      tagLength: 128,
    },
    key,
    fromBase64Url(payload.ciphertext),
  );

  return JSON.parse(textDecoder.decode(plaintext)) as T;
}
