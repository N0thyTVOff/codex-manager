import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // La génération et la vérification restent hors ligne ; cette URL n'est jamais utilisée en CI.
    url: process.env["DATABASE_URL"] ?? "postgresql://local:local@localhost:5432/codex_manager",
  },
  strict: true,
  verbose: true,
});
