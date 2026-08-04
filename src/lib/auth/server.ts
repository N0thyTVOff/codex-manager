import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { authSchema } from "@/db/schema";
import { createDatabase } from "@/db/client";
import { assertAuthorizedGitHubProfile } from "@/lib/auth/authorization";
import { getServerEnv } from "@/lib/env";

export function createAuth() {
  const env = getServerEnv();
  const database = createDatabase(env.DATABASE_URL);

  return betterAuth({
    appName: "Codex Manager",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: authSchema,
    }),
    account: {
      encryptOAuthTokens: true,
      accountLinking: { enabled: false },
    },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        mapProfileToUser(profile) {
          assertAuthorizedGitHubProfile(profile, env.AUTHORIZED_GITHUB_USER_ID);
          return {};
        },
      },
    },
    trustedOrigins: [env.BETTER_AUTH_URL],
  });
}
