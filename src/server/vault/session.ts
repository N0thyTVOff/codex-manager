import { createAuth } from "@/lib/auth/server";

export async function getAuthenticatedUserId(headers: Headers): Promise<string | null> {
  const session = await createAuth().api.getSession({ headers });
  return session?.user.id ?? null;
}
