import { z } from "zod";

export const MAX_ENCRYPTED_PAYLOAD_LENGTH = 131_072;
export const MAX_RECORDS_PER_USER = 500;

const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/u, "Encodage invalide.");
const iv = base64Url.length(16);
const ciphertext = base64Url.min(22).max(MAX_ENCRYPTED_PAYLOAD_LENGTH);

export const initializeVaultProfileSchema = z.strictObject({
  kdfAlgorithm: z.literal("PBKDF2-SHA-256"),
  kdfIterations: z.number().int().min(600_000).max(2_000_000),
  kdfVersion: z.literal(1),
  salt: base64Url.min(22).max(64),
  verificationCiphertext: ciphertext,
  verificationIv: iv,
  schemaVersion: z.literal(1),
});

export const createVaultRecordSchema = z.strictObject({
  id: z.string().uuid(),
  ciphertext,
  iv,
  schemaVersion: z.literal(1),
});

export const updateVaultRecordSchema = z.strictObject({
  ciphertext,
  iv,
  schemaVersion: z.literal(1),
  revision: z.number().int().positive(),
});

export const deleteVaultRecordSchema = z.strictObject({
  revision: z.number().int().positive(),
});

export type InitializeVaultProfileInput = z.infer<typeof initializeVaultProfileSchema>;
export type CreateVaultRecordInput = z.infer<typeof createVaultRecordSchema>;
export type UpdateVaultRecordInput = z.infer<typeof updateVaultRecordSchema>;
