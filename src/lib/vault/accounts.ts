import { z } from "zod";

import type { VaultAccountV1 } from "@/types/vault";

export const QUOTA_RESET_HOURS = 168;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const dateOnly = z.string().regex(datePattern).refine(isValidDateOnly, "Date invalide.");
const instant = z.iso.datetime({ offset: true });

export const vaultAccountSchema = z
  .strictObject({
    version: z.literal(1),
    label: z.string().trim().min(1).max(100),
    login: z.string().trim().min(1).max(320),
    password: z.string().min(1).max(4_096),
    notes: z.string().max(10_000),
    totpProvider: z.enum(["none", "two_fa_live", "google_authenticator", "other"]),
    totpSecret: z.string().trim().min(1).max(512).nullable(),
    purchasedOn: dateOnly,
    endsOn: dateOnly,
    quotaStatus: z.enum(["available", "in_use", "exhausted"]),
    quotaExhaustedAt: instant.nullable(),
    lastUsedAt: instant.nullable(),
    archivedAt: instant.nullable(),
  })
  .superRefine((account, context) => {
    if (account.endsOn < account.purchasedOn) {
      context.addIssue({ code: "custom", path: ["endsOn"], message: "Fin antérieure au début." });
    }
    if (account.quotaStatus === "exhausted" && !account.quotaExhaustedAt) {
      context.addIssue({
        code: "custom",
        path: ["quotaExhaustedAt"],
        message: "Date d'épuisement requise.",
      });
    }
    if (account.quotaStatus !== "exhausted" && account.quotaExhaustedAt) {
      context.addIssue({
        code: "custom",
        path: ["quotaExhaustedAt"],
        message: "Date d'épuisement inattendue.",
      });
    }
    if (account.totpProvider === "none" && account.totpSecret) {
      context.addIssue({
        code: "custom",
        path: ["totpSecret"],
        message: "Clé 2FA inattendue.",
      });
    }
  });

export interface DecryptedVaultAccount {
  readonly id: string;
  readonly revision: number;
  readonly account: VaultAccountV1;
}

export function addCalendarMonth(date: string): string {
  const { year, month, day } = parseDateOnly(date);
  const targetMonth = month === 12 ? 1 : month + 1;
  const targetYear = month === 12 ? year + 1 : year;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return formatDateOnly(targetYear, targetMonth, Math.min(day, lastDay));
}

export function isAccountExpired(account: VaultAccountV1, today: string): boolean {
  parseDateOnly(today);
  return account.endsOn < today;
}

export function normalizeQuota(account: VaultAccountV1, now: Date): VaultAccountV1 {
  if (account.quotaStatus !== "exhausted" || !account.quotaExhaustedAt) return account;
  const availableAt = quotaAvailableAt(account);
  return availableAt && now.getTime() >= availableAt.getTime()
    ? { ...account, quotaStatus: "available", quotaExhaustedAt: null }
    : account;
}

export function quotaAvailableAt(account: VaultAccountV1): Date | null {
  if (account.quotaStatus !== "exhausted" || !account.quotaExhaustedAt) return null;
  return new Date(
    new Date(account.quotaExhaustedAt).getTime() + QUOTA_RESET_HOURS * 60 * 60 * 1_000,
  );
}

export function markAccountInUse(account: VaultAccountV1, now: Date): VaultAccountV1 {
  return {
    ...account,
    quotaStatus: "in_use",
    quotaExhaustedAt: null,
    lastUsedAt: now.toISOString(),
  };
}

export function markQuotaExhausted(account: VaultAccountV1, now: Date): VaultAccountV1 {
  return { ...account, quotaStatus: "exhausted", quotaExhaustedAt: now.toISOString() };
}

export function renewAccount(account: VaultAccountV1, purchasedOn: string): VaultAccountV1 {
  parseDateOnly(purchasedOn);
  return {
    ...account,
    purchasedOn,
    endsOn: addCalendarMonth(purchasedOn),
    quotaStatus: "available",
    quotaExhaustedAt: null,
    archivedAt: null,
  };
}

export function partitionAndSortAccounts(
  records: ReadonlyArray<DecryptedVaultAccount>,
  now: Date,
  today = localDate(now),
): { active: DecryptedVaultAccount[]; archived: DecryptedVaultAccount[] } {
  const normalized = records.map((record) => ({
    ...record,
    account: normalizeQuota(record.account, now),
  }));
  const active = normalized.filter(
    ({ account }) => !account.archivedAt && !isAccountExpired(account, today),
  );
  const archived = normalized.filter(
    ({ account }) => Boolean(account.archivedAt) || isAccountExpired(account, today),
  );

  active.sort(compareActiveAccounts);
  archived.sort((left, right) => right.account.endsOn.localeCompare(left.account.endsOn));
  return { active, archived };
}

export function localDate(date = new Date()): string {
  return formatDateOnly(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function compareActiveAccounts(left: DecryptedVaultAccount, right: DecryptedVaultAccount): number {
  const rank = { in_use: 0, available: 1, exhausted: 2 } as const;
  const statusDifference = rank[left.account.quotaStatus] - rank[right.account.quotaStatus];
  if (statusDifference !== 0) return statusDifference;
  if (left.account.quotaStatus === "exhausted" && right.account.quotaStatus === "exhausted") {
    const leftAvailableAt = quotaAvailableAt(left.account)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightAvailableAt = quotaAvailableAt(right.account)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (leftAvailableAt !== rightAvailableAt) return leftAvailableAt - rightAvailableAt;
  }
  const endDifference = left.account.endsOn.localeCompare(right.account.endsOn);
  return endDifference !== 0
    ? endDifference
    : left.account.label.localeCompare(right.account.label);
}

function isValidDateOnly(value: string): boolean {
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

function parseDateOnly(value: string): { year: number; month: number; day: number } {
  if (!datePattern.test(value)) throw new Error("Date invalide.");
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Date invalide.");
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Date invalide.");
  }
  return { year, month, day };
}

function formatDateOnly(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
