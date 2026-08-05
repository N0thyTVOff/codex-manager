import { createDatabase } from "@/db/client";
import { getServerEnv } from "@/lib/env";

export function createVaultDatabase() {
  return createDatabase(getServerEnv().DATABASE_URL);
}
