import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createAuth } from "@/lib/auth/server";
import { VaultManager } from "@/components/vault-manager";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const session = await createAuth().api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/");
  }

  return (
    <main className="vault-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Codex Manager, accueil">
          <span className="brand-mark" aria-hidden="true">
            CM
          </span>
          <span>Codex Manager</span>
        </Link>
        <span className="version-pill">coffre chiffré</span>
      </header>
      <VaultManager />
    </main>
  );
}
