import { describe, expect, it } from "vitest";

import {
  addCalendarMonth,
  isAccountExpired,
  localDate,
  markAccountInUse,
  markQuotaExhausted,
  normalizeQuota,
  partitionAndSortAccounts,
  quotaAvailableAt,
  renewAccount,
  vaultAccountSchema,
} from "@/lib/vault/accounts";
import type { DecryptedVaultAccount } from "@/lib/vault/accounts";
import type { VaultAccountV1 } from "@/types/vault";

const baseAccount: VaultAccountV1 = {
  version: 1,
  label: "Compte de test",
  login: "personne@example.test",
  password: "mot-de-passe-inactif",
  notes: "Fixture sans donnée réelle.",
  totpProvider: "none",
  totpSecret: null,
  purchasedOn: "2026-08-05",
  endsOn: "2026-09-05",
  quotaStatus: "available",
  quotaExhaustedAt: null,
  lastUsedAt: null,
  archivedAt: null,
};

describe("cycle de vie des comptes", () => {
  it("ajoute un mois calendaire en ajustant les fins de mois et années bissextiles", () => {
    expect(addCalendarMonth("2026-01-31")).toBe("2026-02-28");
    expect(addCalendarMonth("2028-01-31")).toBe("2028-02-29");
    expect(addCalendarMonth("2026-12-31")).toBe("2027-01-31");
    expect(() => addCalendarMonth("2026-02-30")).toThrow(/Date invalide/u);
  });

  it("considère la date de fin comme inclusive", () => {
    expect(isAccountExpired(baseAccount, "2026-09-05")).toBe(false);
    expect(isAccountExpired(baseAccount, "2026-09-06")).toBe(true);
  });

  it("réinitialise un quota exactement après 168 heures", () => {
    const exhausted = markQuotaExhausted(baseAccount, new Date("2026-08-05T10:00:00.000Z"));
    expect(quotaAvailableAt(exhausted)?.toISOString()).toBe("2026-08-12T10:00:00.000Z");
    expect(normalizeQuota(exhausted, new Date("2026-08-12T09:59:59.999Z")).quotaStatus).toBe(
      "exhausted",
    );
    expect(normalizeQuota(exhausted, new Date("2026-08-12T10:00:00.000Z"))).toMatchObject({
      quotaStatus: "available",
      quotaExhaustedAt: null,
    });
    expect(normalizeQuota(baseAccount, new Date())).toBe(baseAccount);
    expect(quotaAvailableAt(baseAccount)).toBeNull();
  });

  it("renouvelle un compte et enregistre son utilisation", () => {
    const renewed = renewAccount(
      { ...baseAccount, archivedAt: "2026-08-06T00:00:00.000Z" },
      "2026-09-30",
    );
    expect(renewed).toMatchObject({
      purchasedOn: "2026-09-30",
      endsOn: "2026-10-30",
      quotaStatus: "available",
      archivedAt: null,
    });
    expect(markAccountInUse(renewed, new Date("2026-09-30T12:00:00.000Z"))).toMatchObject({
      quotaStatus: "in_use",
      lastUsedAt: "2026-09-30T12:00:00.000Z",
    });
  });

  it("trie en cours, disponibles puis épuisés et sépare les archives", () => {
    const now = new Date("2026-08-05T12:00:00.000Z");
    const records: DecryptedVaultAccount[] = [
      record("available-late", { ...baseAccount, label: "Disponible tard", endsOn: "2026-09-05" }),
      record("exhausted", markQuotaExhausted(baseAccount, new Date("2026-08-04T00:00:00.000Z"))),
      record(
        "exhausted-late",
        markQuotaExhausted(baseAccount, new Date("2026-08-04T01:00:00.000Z")),
      ),
      record("available-early", { ...baseAccount, label: "Disponible tôt", endsOn: "2026-08-20" }),
      record("in-use", markAccountInUse(baseAccount, now)),
      record("expired", { ...baseAccount, endsOn: "2026-08-04" }),
      record("archived", { ...baseAccount, archivedAt: "2026-08-05T11:00:00.000Z" }),
    ];

    const result = partitionAndSortAccounts(records, now, "2026-08-05");
    expect(result.active.map(({ id }) => id)).toEqual([
      "in-use",
      "available-early",
      "available-late",
      "exhausted",
      "exhausted-late",
    ]);
    expect(result.archived.map(({ id }) => id).sort()).toEqual(["archived", "expired"]);
  });

  it("refuse les incohérences de dates, quota et 2FA", () => {
    expect(vaultAccountSchema.safeParse(baseAccount).success).toBe(true);
    expect(vaultAccountSchema.safeParse({ ...baseAccount, endsOn: "2026-08-04" }).success).toBe(
      false,
    );
    expect(vaultAccountSchema.safeParse({ ...baseAccount, quotaStatus: "exhausted" }).success).toBe(
      false,
    );
    expect(
      vaultAccountSchema.safeParse({
        ...baseAccount,
        quotaExhaustedAt: "2026-08-05T10:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(vaultAccountSchema.safeParse({ ...baseAccount, totpSecret: "FAUSSE-CLE" }).success).toBe(
      false,
    );
    expect(
      vaultAccountSchema.safeParse({
        ...baseAccount,
        totpProvider: "two_fa_live",
        totpSecret: "FAUSSE-CLE-INACTIVE",
      }).success,
    ).toBe(true);
    expect(
      vaultAccountSchema.safeParse({ ...baseAccount, purchasedOn: "date-invalide" }).success,
    ).toBe(false);
    expect(
      vaultAccountSchema.safeParse({ ...baseAccount, purchasedOn: "0000-01-01" }).success,
    ).toBe(false);
    expect(localDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });
});

function record(id: string, account: VaultAccountV1): DecryptedVaultAccount {
  return { id, revision: 1, account };
}
