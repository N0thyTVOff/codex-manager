import { z } from "zod";

export const MAX_ENCRYPTED_PAYLOAD_LENGTH = 32_768;
export const MAX_RECORDS_PER_USER = 100;
export const MAX_REKEY_BODY_BYTES = 4_000_000;

const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/u, "Encodage invalide.");
const iv = base64Url.length(16);
const ciphertext = base64Url.min(22).max(MAX_ENCRYPTED_PAYLOAD_LENGTH);

const profileEnvelopeSchema = z.strictObject({
  kdfAlgorithm: z.literal("PBKDF2-SHA-256"),
  kdfIterations: z.number().int().min(600_000).max(2_000_000),
  kdfVersion: z.literal(1),
  salt: base64Url.min(22).max(64),
  verificationCiphertext: ciphertext,
  verificationIv: iv,
  schemaVersion: z.literal(1),
});

const recordEnvelopeSchema = z.strictObject({
  id: z.string().uuid(),
  ciphertext,
  iv,
  schemaVersion: z.literal(1),
});

export const initializeVaultProfileSchema = profileEnvelopeSchema;

export const createVaultRecordSchema = recordEnvelopeSchema.extend({
  profileRevision: z.number().int().positive(),
});

export const updateVaultRecordSchema = recordEnvelopeSchema.omit({ id: true }).extend({
  revision: z.number().int().positive(),
  profileRevision: z.number().int().positive(),
});

export const deleteVaultRecordSchema = z.strictObject({
  revision: z.number().int().positive(),
  profileRevision: z.number().int().positive(),
});

export const rotateVaultSchema = z.strictObject({
  profile: profileEnvelopeSchema.extend({
    revision: z.number().int().positive(),
  }),
  records: z
    .array(recordEnvelopeSchema.extend({ revision: z.number().int().positive() }))
    .max(MAX_RECORDS_PER_USER),
});

export type InitializeVaultProfileInput = z.infer<typeof initializeVaultProfileSchema>;
export type CreateVaultRecordInput = z.infer<typeof createVaultRecordSchema>;
export type UpdateVaultRecordInput = z.infer<typeof updateVaultRecordSchema>;
export type DeleteVaultRecordInput = z.infer<typeof deleteVaultRecordSchema>;
export type RotateVaultInput = z.infer<typeof rotateVaultSchema>;
