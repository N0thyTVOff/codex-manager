import { describe, expect, it } from "vitest";

import {
  createVaultSalt,
  createVaultVerification,
  decryptVaultPayload,
  deriveVaultKey,
  encryptVaultPayload,
  verifyVaultKey,
} from "./crypto";

const secret = {
  label: "Compte principal",
  login: "utilisateur@example.test",
  password: "mot-de-passe-de-test",
  totpSecret: "CLE-DE-TEST-INACTIVE",
  subscriptionEndsOn: "2026-09-24",
  tokenResetOn: null,
  notes: "Fixture sans donnée réelle.",
};

describe("coffre chiffré", () => {
  it("chiffre puis déchiffre une fiche avec son identifiant comme contexte", async () => {
    const key = await deriveVaultKey(
      "phrase secrète de test suffisamment longue",
      createVaultSalt(),
    );
    const payload = await encryptVaultPayload(key, secret, "record-1");

    expect(payload.ciphertext).not.toContain(secret.password);
    await expect(decryptVaultPayload<typeof secret>(key, payload, "record-1")).resolves.toEqual(
      secret,
    );
  });

  it("refuse une phrase secrète trop courte", async () => {
    await expect(deriveVaultKey("trop courte", createVaultSalt())).rejects.toThrow(
      /16 caractères/u,
    );
  });

  it("refuse un paramètre de dérivation affaibli", async () => {
    await expect(
      deriveVaultKey("phrase secrète de test suffisamment longue", createVaultSalt(), 10),
    ).rejects.toThrow(/insuffisant/u);
  });

  it("détecte un mauvais contexte ou une altération", async () => {
    const key = await deriveVaultKey(
      "phrase secrète de test suffisamment longue",
      createVaultSalt(),
    );
    const payload = await encryptVaultPayload(key, secret, "record-1");

    await expect(decryptVaultPayload(key, payload, "record-2")).rejects.toThrow();
    await expect(
      decryptVaultPayload(key, { ...payload, version: 2 as 1 }, "record-1"),
    ).rejects.toThrow(/Version/u);
  });

  it("valide localement la phrase correcte et refuse une autre clé", async () => {
    const salt = createVaultSalt();
    const key = await deriveVaultKey("phrase secrète correcte suffisamment longue", salt);
    const otherKey = await deriveVaultKey("phrase secrète incorrecte mais assez longue", salt);
    const verification = await createVaultVerification(key);

    await expect(verifyVaultKey(key, verification)).resolves.toBe(true);
    await expect(verifyVaultKey(otherKey, verification)).resolves.toBe(false);
  });

  it("génère un nouvel IV pour chaque enveloppe de vérification", async () => {
    const key = await deriveVaultKey(
      "phrase secrète de test suffisamment longue",
      createVaultSalt(),
    );
    const first = await createVaultVerification(key);
    const second = await createVaultVerification(key);

    expect(first.iv).not.toBe(second.iv);
  });
});
