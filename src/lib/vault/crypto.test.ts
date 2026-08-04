import { describe, expect, it } from "vitest";

import type { VaultSecret } from "@/types/vault";
import {
  createVaultSalt,
  decryptVaultPayload,
  deriveVaultKey,
  encryptVaultPayload,
} from "./crypto";

const secret: VaultSecret = {
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
    await expect(decryptVaultPayload<VaultSecret>(key, payload, "record-1")).resolves.toEqual(
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
});
