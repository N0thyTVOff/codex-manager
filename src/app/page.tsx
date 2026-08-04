import { SignInButton } from "@/components/sign-in-button";

const safeguards = [
  [
    "Accès personnel",
    "Seul le compte GitHub N0thyTVOff est autorisé par son identifiant immuable.",
  ],
  ["Chiffrement local", "Le navigateur chiffre chaque fiche avant qu'elle ne quitte l'appareil."],
  [
    "Zéro secret dans Git",
    "Le dépôt public contient le code et les contrôles, jamais vos données.",
  ],
] as const;

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#accueil" aria-label="Codex Manager, accueil">
          <span className="brand-mark" aria-hidden="true">
            CM
          </span>
          <span>Codex Manager</span>
        </a>
        <span className="version-pill">socle v0.1.0</span>
      </header>

      <section className="hero" id="accueil">
        <div className="hero-copy">
          <p className="eyebrow">Votre inventaire Codex, enfin structuré</p>
          <h1>
            Des comptes organisés.
            <br />
            Des secrets qui restent secrets.
          </h1>
          <p className="hero-lead">
            Suivez les échéances et les réinitialisations de vos comptes ChatGPT Plus dans un coffre
            personnel conçu pour remplacer les notes en clair.
          </p>
          <SignInButton />
          <p className="hero-note">
            Aucune donnée de démonstration réelle. Aucun partage de compte.
          </p>
        </div>

        <div className="vault-preview" aria-label="Aperçu conceptuel d'une fiche chiffrée">
          <div className="preview-topline">
            <span>Fiche chiffrée</span>
            <span className="status-dot">protégée</span>
          </div>
          <div className="account-orb" aria-hidden="true">
            01
          </div>
          <div className="preview-lines">
            <div>
              <span>Identifiant</span>
              <strong>••••••••••••</strong>
            </div>
            <div>
              <span>Mot de passe</span>
              <strong>••••••••••••</strong>
            </div>
            <div>
              <span>Clé 2FA</span>
              <strong>•••• •••• ••••</strong>
            </div>
          </div>
          <div className="date-grid">
            <div>
              <span>Fin d&apos;abonnement</span>
              <strong>24 sept.</strong>
            </div>
            <div>
              <span>Prochaine action</span>
              <strong>08 août</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="safeguards" aria-labelledby="security-title">
        <div>
          <p className="eyebrow">Architecture de confiance</p>
          <h2 id="security-title">La base voit du chiffre, pas vos identifiants.</h2>
        </div>
        <div className="safeguard-grid">
          {safeguards.map(([title, description], index) => (
            <article key={title}>
              <span className="card-index">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>Codex Manager</span>
        <span>AGPL-3.0 · usage personnel</span>
      </footer>
    </main>
  );
}
