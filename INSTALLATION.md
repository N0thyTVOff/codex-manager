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

## OAuth GitHub

Créez une application OAuth sous votre compte GitHub avec le callback local
`http://localhost:3000/api/auth/callback/github`. Pour la production, utilisez le domaine HTTPS
`https://codex-manager-n0thy.vercel.app/api/auth/callback/github`. GitHub OAuth n'accepte qu'un
callback principal par application : utilisez deux applications distinctes et enregistrez leurs
secrets directement dans `.env.local` et Vercel, jamais dans le dépôt ou une discussion.

## Base de données

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

Comme la Release PR créée par ce jeton ne doit dépendre d'aucun événement implicite, le workflow
Release Please lance explicitement `CI` par `workflow_dispatch` sur sa branche avec le
`GITHUB_TOKEN` éphémère. La permission `actions: write` reste limitée à ce job.

Ajoutez dans l'environnement Production de Vercel les variables applicatives du tableau précédent.
Les previews sont désactivées. Release Please appelle `.github/workflows/production.yml` uniquement
après avoir créé une GitHub Release réelle. Le workflow construit, migre, déploie sans alias,
contrôle `/api/health`, puis promeut le déploiement validé.

## Validation

```bash
npm run check
npm run audit:prod
```
