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
stable suivi de `/api/auth/callback/github`. Enregistrez le secret directement dans Vercel, jamais
dans le dépôt ou une discussion.

## Base de données

Après configuration de `DATABASE_URL` :

```bash
npm run db:generate
```

Relisez la migration générée. Son application à une base hébergée relève d'une opération séparée
et n'est jamais exécutée par la CI. Les tests et le build ne contactent aucune base distante.

## Vercel

Le projet n'est pas connecté pour un déploiement automatique de `main`. Ajoutez manuellement dans
l'environnement GitHub `production` :

- `VERCEL_TOKEN` ;
- `VERCEL_ORG_ID` ;
- `VERCEL_PROJECT_ID`.

Ajoutez dans l'environnement Production de Vercel les variables applicatives du tableau précédent.
Les previews peuvent être configurées plus tard, sans secrets de production et après approbation
des workflows provenant de forks. Le workflow `.github/workflows/production.yml` ne s'exécute que
sur une GitHub Release publiée.

## Validation

```bash
npm run check
npm run audit:prod
```
