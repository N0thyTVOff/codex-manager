import { describe, expect, it } from "vitest";

import { decryptVaultPayload, encryptVaultPayload } from "@/lib/vault/crypto";
import { createVaultSetup, rotateVaultLocally, unlockVaultKey } from "@/lib/vault/lifecycle";

describe("cycle de vie du coffre", () => {
  it("initialise puis déverrouille uniquement avec la bonne phrase", async () => {
    const setup = await createVaultSetup("phrase initiale suffisamment longue");
    const profile = { ...setup.profile, revision: 1 };

    await expect(
      unlockVaultKey("phrase initiale suffisamment longue", profile),
    ).resolves.not.toBeNull();
    await expect(
      unlockVaultKey("phrase incorrecte suffisamment longue", profile),
    ).resolves.toBeNull();
    await expect(
      unlockVaultKey("phrase initiale suffisamment longue", {
        ...profile,
        verificationCiphertext: null,
      }),
    ).resolves.toBeNull();
  });

  it("rechiffre toutes les fiches avec une nouvelle clé et de nouveaux IV", async () => {
    const setup = await createVaultSetup("phrase initiale suffisamment longue");
    const profile = { ...setup.profile, revision: 3 };
    const id = "8919b498-c50e-4e63-8c12-71d9bd503b77";
    const original = await encryptVaultPayload(setup.key, { label: "Fixture inactive" }, id);

    const rotation = await rotateVaultLocally(
      "phrase initiale suffisamment longue",
      "nouvelle phrase encore plus longue",
      profile,
      [
        {
          id,
          revision: 2,
          ciphertext: original.ciphertext,
          iv: original.iv,
          schemaVersion: original.version,
        },
      ],
    );

    expect(rotation).not.toBeNull();
    if (!rotation) return;
    expect(rotation.request.records[0]?.iv).not.toBe(original.iv);
    await expect(
      decryptVaultPayload(rotation.key, { version: 1, ...rotation.request.records[0]! }, id),
    ).resolves.toEqual({ label: "Fixture inactive" });
    await expect(
      decryptVaultPayload(setup.key, { version: 1, ...rotation.request.records[0]! }, id),
    ).rejects.toThrow();
  });

  it("annule localement une rotation demandée avec une mauvaise phrase", async () => {
    const setup = await createVaultSetup("phrase initiale suffisamment longue");
    await expect(
      rotateVaultLocally(
        "mauvaise phrase mais suffisamment longue",
        "nouvelle phrase encore plus longue",
        { ...setup.profile, revision: 1 },
        [],
      ),
    ).resolves.toBeNull();
  });
});
