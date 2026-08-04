import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createAuth } from "@/lib/auth/server";

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
        <span className="version-pill">socle v0.1.0</span>
      </header>

      <section className="vault-placeholder" aria-labelledby="vault-title">
        <p className="eyebrow">Session GitHub validée</p>
        <h1 id="vault-title">Le coffre est prêt à être construit.</h1>
        <p>
          Cette page protégée confirme l&apos;authentification du propriétaire. Les fiches chiffrées
          arriveront dans la version fonctionnelle suivante.
        </p>
        <Link className="secondary-link" href="/">
          Revenir à l&apos;accueil
        </Link>
      </section>
    </main>
  );
}
