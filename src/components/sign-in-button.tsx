"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";

export function SignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setError(null);
    setPending(true);
    const result = await authClient.signIn.social({ provider: "github", callbackURL: "/coffre" });
    if (result.error) {
      setError("Connexion indisponible. Vérifiez la configuration du serveur.");
      setPending(false);
    }
  }

  return (
    <div className="sign-in-group">
      <button className="primary-button" type="button" onClick={signIn} disabled={pending}>
        {pending ? "Connexion…" : "Ouvrir avec GitHub"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
