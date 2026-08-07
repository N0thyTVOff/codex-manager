# Installation

## Prérequis

- Git ;
- Node.js `22.21.x` et npm `10.9.x` ;
- une base PostgreSQL de développement distincte de la production ;
- une application OAuth GitHub pour les tests de connexion.

## Installation locale

```bash
git clone https://github.com/N0thyTVOff/codex-manager.git
cd codex-manager
npm ci
cp .env.example .env.local
```

Sous PowerShell, remplacez la dernière commande par :

```powershell
Copy-Item .env.example .env.local
```

Complétez `.env.local` sur votre machine. Ce fichier est ignoré par Git.

## Variables d'environnement

| Variable                    | Portée     | Description                                       |
| --------------------------- | ---------- | ------------------------------------------------- |
| `DATABASE_URL`              | serveur    | URL PostgreSQL Neon, différente par environnement |
| `BETTER_AUTH_SECRET`        | serveur    | secret aléatoire d'au moins 32 octets             |
| `BETTER_AUTH_URL`           | serveur    | URL canonique de l'application                    |
| `NEXT_PUBLIC_APP_URL`       | navigateur | URL publique canonique, non secrète               |
| `GITHUB_CLIENT_ID`          | serveur    | identifiant de l'application OAuth GitHub         |
| `GITHUB_CLIENT_SECRET`      | serveur    | secret OAuth GitHub                               |
| `AUTHORIZED_GITHUB_USER_ID` | serveur    | identifiant numérique GitHub autorisé             |

Ne réutilisez pas les mêmes secrets entre développement et production. Ne placez jamais la phrase
du coffre dans une variable d'environnement : elle doit rester uniquement dans le navigateur.

`AUTHORIZED_GITHUB_USER_ID` est un identifiant numérique public, pas un nom de compte. Une erreur
sur cette valeur refuse la connexion attendue ou autorise une identité différente : vérifiez-la
avant tout déploiement.

## OAuth GitHub

Créez une application OAuth sous votre compte GitHub avec le callback local
`http://localhost:3000/api/auth/callback/github`. Pour la production, utilisez le domaine HTTPS
`https://codex-manager-n0thy.vercel.app/api/auth/callback/github`. GitHub OAuth n'accepte qu'un
callback principal par application : utilisez deux applications distinctes et enregistrez leurs
secrets directement dans `.env.local` et Vercel, jamais dans le dépôt ou une discussion.

## Base de données

Pour une première installation locale, pointez `DATABASE_URL` vers une base dédiée puis appliquez
les migrations versionnées :

```bash
npm run db:migrate
```

N'utilisez jamais cette commande localement avec l'URL Neon de production.

Après une modification du schéma :

```bash
npm run db:generate
```

Relisez la migration générée. La CI vérifie les migrations hors ligne sans contacter Neon. Après
fusion manuelle d'une Release PR, le workflow de production applique les migrations versionnées
avant de déployer ; elles doivent donc rester additives ou rétrocompatibles.

## Vercel

Le projet `n0thy/codex-manager` n'est pas connecté pour un déploiement automatique de `main`.
Ajoutez manuellement dans l'environnement GitHub `production` :

- le secret `VERCEL_TOKEN` ;
- les variables non secrètes `VERCEL_ORG_ID` et `VERCEL_PROJECT_ID`.

Ajoutez au niveau du dépôt le secret `RELEASE_PLEASE_TOKEN` : un fine-grained personal access token
limité à `N0thyTVOff/codex-manager`, avec `Contents`, `Issues` et `Pull requests` en lecture et
écriture. Donnez-lui une expiration et planifiez sa rotation. Cette solution évite d'activer
l'autorisation globale combinée permettant aux workflows de créer et d'approuver des PR.

La Release PR créée avec ce jeton déclenche normalement sa CI. Le workflow `CI` conserve aussi
`workflow_dispatch` afin de pouvoir attacher manuellement le check à la branche Release Please si
GitHub ne l'a pas lancé automatiquement.

Ajoutez dans l'environnement Production de Vercel les variables applicatives du tableau précédent.
Les previews sont désactivées. Release Please appelle `.github/workflows/production.yml` uniquement
après avoir créé une GitHub Release réelle. Le workflow construit, migre, déploie sans alias,
contrôle `/api/health`, puis promeut le déploiement validé.

## Vérification locale

1. lancez `npm run dev` ;
2. ouvrez `http://localhost:3000` ;
3. connectez-vous avec l'application OAuth de développement ;
4. initialisez un coffre avec des données exclusivement factices ;
5. vérifiez `http://localhost:3000/api/health` ;
6. verrouillez puis déverrouillez le coffre avant de tester une mutation.

Le point de santé ne vérifie pas PostgreSQL ou OAuth. Une validation complète exige le parcours de
connexion et une lecture/écriture de coffre de test.

## Validation

```bash
npm run check
npm run audit:prod
```

Les procédures de release, de reprise et de contrôle post-production figurent dans
[docs/OPERATIONS.md](docs/OPERATIONS.md).
