import { Pool } from "pg";

export function createTransactionPool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
}
