<div align="center">

# Codex Manager

**Un coffre personnel chiffré pour organiser ses comptes ChatGPT Plus utilisés avec Codex.**

[![CI](https://github.com/N0thyTVOff/codex-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/N0thyTVOff/codex-manager/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/N0thyTVOff/codex-manager?display_name=tag&sort=semver)](https://github.com/N0thyTVOff/codex-manager/releases)
[![Licence AGPL-3.0](https://img.shields.io/github/license/N0thyTVOff/codex-manager)](LICENSE)
[![Issues](https://img.shields.io/github/issues/N0thyTVOff/codex-manager)](https://github.com/N0thyTVOff/codex-manager/issues)

</div>

## Pourquoi ce projet ?

Codex Manager remplace un bloc-notes contenant des informations sensibles par une application
structurée, personnelle et auditable. Le dépôt fournit aujourd'hui le socle technique `0.1.0` :
interface de démarrage, authentification GitHub réservée au propriétaire, schéma PostgreSQL et
primitives de chiffrement côté navigateur.

> [!IMPORTANT]
> Les écrans de gestion complète des fiches ne sont pas encore disponibles. Le projet ne partage
> pas de comptes et n'automatise pas la connexion à ChatGPT. Chaque compte OpenAI reste destiné à
> la personne qui l'a créé, conformément à la
> [politique officielle de partage des comptes](https://help.openai.com/en/articles/10471989-openai-account-sharing-policy).

## Sécurité par conception

- le compte GitHub autorisé est contrôlé avec son identifiant numérique immuable ;
- la phrase secrète du coffre reste dans le navigateur et n'est ni envoyée ni stockée ;
- PBKDF2-SHA-256 dérive une clé AES-256-GCM avec au moins 600 000 itérations ;
- chaque écriture utilise un IV aléatoire unique et un contexte authentifié ;
- PostgreSQL reçoit les fiches sous forme chiffrée uniquement ;
- Better Auth chiffre les jetons OAuth avant leur stockage ;
- les workflows n'accèdent jamais à la base de production ni aux secrets des forks.

Une phrase secrète perdue ne peut pas être récupérée. Les sauvegardes de données ne remplacent
donc pas une sauvegarde sûre de cette phrase dans un gestionnaire de mots de passe reconnu.

## Démarrage rapide

Prérequis : Node.js `22.21.x`, npm `10.9.x` et une base PostgreSQL de développement.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Renseignez localement les variables décrites dans [`.env.example`](.env.example), puis ouvrez
`http://localhost:3000`. Ne communiquez jamais leur valeur dans une issue, une PR ou un chat.

Le guide détaillé se trouve dans [INSTALLATION.md](INSTALLATION.md).

## Captures

Les captures du coffre seront ajoutées dans [docs/images/](docs/images/README.md) lorsque les écrans
de gestion seront réellement développés. Elles utiliseront exclusivement des données factices.

## Commandes utiles

| Commande                | Rôle                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `npm run dev`           | lancer le serveur local                                         |
| `npm run check`         | format, lint, types, tests, schéma, YAML, liens et build        |
| `npm run test:coverage` | exécuter les tests avec seuils de couverture                    |
| `npm run db:generate`   | générer une migration après modification du schéma              |
| `npm run db:migrate`    | appliquer les migrations à l'environnement explicitement choisi |
| `npm run audit:prod`    | auditer les dépendances utilisées en production                 |
| `npm run build`         | produire le build reproductible                                 |

## Architecture

```text
Navigateur ── GitHub OAuth ──► application Next.js sur Vercel
    │                                  │
    └─ chiffrement/déchiffrement       └─ données chiffrées ──► PostgreSQL
       avec la phrase locale                  (Neon)
```

La description complète et les décisions de sécurité figurent dans
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Le fonctionnement quotidien est documenté dans
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Contributions

Les issues publiques sont bienvenues. Pour préserver la gouvernance choisie, les PR sont réalisées
et fusionnées uniquement par `@N0thyTVOff`. Une PR externe depuis un fork reste techniquement
possible sur un dépôt public, mais elle ne donne aucun droit d'écriture, de fusion ou d'accès aux
secrets. Consultez [CONTRIBUTING.md](CONTRIBUTING.md).

## Releases groupées

Chaque changement est fusionné séparément. Release Please maintient ensuite **une seule Release
PR** `chore(main): release X.Y.Z`, mise à jour au fil des fusions. Tant que le mainteneur ne fusionne
pas manuellement cette PR, aucun tag, aucune GitHub Release et aucun déploiement de production ne
sont créés. Sa fusion constitue l'autorisation de publier ; Release Please crée alors la release,
revalide son tag et appelle le job Vercel protégé dans le même flux GitHub Actions.

## Déploiement

La cible est `https://codex-manager-n0thy.vercel.app` avec PostgreSQL Neon en région Francfort. Les
déploiements Git Vercel sont désactivés. Le workflow crée un déploiement isolé après la GitHub
Release, vérifie `/api/health`, puis le promeut seulement si ce contrôle réussit. Les paramètres
requis sont listés dans [INSTALLATION.md](INSTALLATION.md), sans aucune valeur réelle.

## Sécurité et licence

Signalez une vulnérabilité via le
[canal privé GitHub](https://github.com/N0thyTVOff/codex-manager/security/advisories/new), jamais
dans une issue publique. Voir [SECURITY.md](SECURITY.md).

Codex Manager est distribué sous [GNU AGPL-3.0](LICENSE). Le copyright et l'URL du dépôt officiel
sont conservés dans [NOTICE](NOTICE).
