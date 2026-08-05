import { createDatabase } from "@/db/client";
import { createTransactionPool } from "@/db/transaction";
import { getServerEnv } from "@/lib/env";

export function createVaultDatabase() {
  return createDatabase(getServerEnv().DATABASE_URL);
}

export function createVaultTransactionPool() {
  return createTransactionPool(getServerEnv().DATABASE_URL);
}
