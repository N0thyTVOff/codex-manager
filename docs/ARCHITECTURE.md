# Architecture

## Objectifs

Codex Manager est un coffre personnel, pas un gestionnaire multi-utilisateur ni un outil de partage
de comptes. Le socle privilégie une surface réduite, une séparation nette des responsabilités et
une absence de confiance dans la base pour la confidentialité des fiches.

## Composants

- **Interface** — App Router Next.js et composants React accessibles.
- **Identité** — Better Auth avec GitHub OAuth ; le profil est rejeté si son identifiant numérique
  ne correspond pas à `AUTHORIZED_GITHUB_USER_ID`.
- **Coffre** — Web Crypto dérive localement une clé et chiffre chaque charge utile en AES-256-GCM.
- **Persistance** — Drizzle ORM et PostgreSQL Neon ; seules les enveloppes chiffrées sont stockées.
- **Livraison** — GitHub Actions valide chaque PR ; Release Please regroupe plusieurs PR ; Vercel
  ne reçoit une production qu'après publication de la release.

## Frontières de confiance

La phrase secrète du coffre et la clé dérivée ne franchissent jamais la frontière du navigateur.
Le serveur connaît l'identité GitHub et manipule des enveloppes chiffrées. PostgreSQL connaît les
identifiants techniques, paramètres KDF non secrets, dates techniques et textes chiffrés.

L'identifiant du record est utilisé comme donnée authentifiée additionnelle : déplacer un texte
chiffré vers une autre fiche invalide son authentification. Un IV de 96 bits est régénéré à chaque
écriture. Le schéma versionne le format afin de permettre une migration explicite.

## Menaces considérées

| Menace                 | Réduction du risque                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| fuite du dépôt         | aucun secret réel versionné, scans locaux et GitHub                                      |
| fuite de la base       | charges utiles chiffrées côté navigateur                                                 |
| connexion d'un tiers   | allowlist sur l'identifiant GitHub immuable                                              |
| altération d'une fiche | authentification AES-GCM et AAD                                                          |
| fuite d'un jeton OAuth | chiffrement Better Auth activé                                                           |
| PR de fork hostile     | permissions en lecture seule, aucun secret, `pull_request_target` métadonnées uniquement |

## Limites assumées

- une compromission du navigateur déverrouillé peut exposer le coffre ;
- une phrase perdue rend les fiches irrécupérables ;
- PBKDF2 est disponible nativement dans les navigateurs mais reste moins résistant qu'Argon2id aux
  attaques fortement parallélisées ; une migration de KDF devra être versionnée et testée ;
- l'application ne vérifie ni ne renouvelle automatiquement les abonnements ChatGPT.

## Dossiers

```text
src/app/           routes et présentation
src/components/    composants d'interface
src/lib/auth/      authentification et autorisation
src/lib/vault/     primitives cryptographiques côté navigateur
src/server/vault/  validation, session et persistance des enveloppes
src/db/            schéma et client PostgreSQL
src/types/         contrats partagés
drizzle/           migrations SQL versionnées
scripts/           contrôles locaux de dépôt
```

## Contrat de persistance du coffre

Les routes `/api/vault/profile` et `/api/vault/records` exigent une session GitHub valide. Elles
n'acceptent aucun `userId` : le propriétaire est toujours déduit de la session. Le navigateur
génère l'UUID de chaque fiche avant chiffrement afin que cet UUID serve d'AAD AES-GCM.

Le profil stocke uniquement les paramètres KDF et une enveloppe de vérification chiffrée. Une
fiche stocke uniquement son UUID, son texte chiffré, son IV, sa version de schéma et sa révision.
Une mise à jour ou suppression fournit la révision lue ; un autre écrivain l'ayant déjà modifiée
provoque une réponse `409`. Toutes les réponses de ces routes portent `Cache-Control: no-store`.
