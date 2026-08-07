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
Chaque mutation fournit la révision globale du profil et, pour une fiche existante, la révision de
cette fiche. Un autre écrivain ayant modifié l'une d'elles provoque une réponse `409`. Toutes les
réponses de ces routes portent `Cache-Control: no-store`.

Le déverrouillage et la vérification de phrase sont exécutés dans le navigateur à partir d'une
enveloppe sentinelle. La clé `CryptoKey` reste uniquement dans l'état React de l'onglet et disparaît
au rechargement, à la déconnexion ou au verrouillage manuel. Aucun stockage web ne la reçoit.

La rotation lit puis déchiffre localement toutes les fiches, génère un nouveau sel et un IV neuf par
enveloppe, puis appelle `/api/vault/rekey`. Toutes les mutations verrouillent la révision globale du
profil dans une transaction PostgreSQL. Une révision de profil ou de fiche inattendue entraîne un
rollback complet et une réponse `409` : l'ancien coffre reste alors intégralement utilisable.

## Cycle de vie des comptes

Une charge utile `VaultAccountV1` contient le libellé, les identifiants, la configuration 2FA, les
notes, les dates d'abonnement, l'état du quota et l'archivage. La base ne peut distinguer aucun de
ces champs : l'UUID technique, l'IV, les versions et le texte AES-GCM sont les seules données reçues
par l'API.

La date de fin est inclusive et reste une date calendaire sans fuseau. Le navigateur classe la
fiche dans les archives à partir du lendemain local. Un quota épuisé porte un instant ISO chiffré ;
son état effectif redevient disponible lorsque l'horloge atteint exactement cet instant plus 168
heures. Le prochain changement est programmé dans l'onglet, sans tâche serveur et sans dévoiler une
date métier à PostgreSQL.

Les actions rapides manipulent exclusivement les valeurs déjà déchiffrées en mémoire. Le
presse-papiers n'est sollicité qu'après une action explicite et les secrets restent masqués par
défaut. Les ouvertures de ChatGPT et de 2FA.live utilisent une URL constante dans un nouvel onglet
isolé avec `noopener` et `noreferrer`. En particulier, la graine TOTP n'est jamais ajoutée à une URL,
envoyée à l'API ou transmise automatiquement au service tiers. Google Authenticator suit une
procédure de saisie manuelle.

## Sauvegarde et restauration

Le format `codex-manager-vault-backup` version 1 contient le profil cryptographique nécessaire à la
dérivation de clé et la liste des enveloppes chiffrées. Les révisions serveur, sessions et attributs
d'identité n'en font pas partie. Les charges utiles ne sont pas rechiffrées à l'export : une
sauvegarde reste ainsi liée à la phrase et au sel actifs lors de sa création, y compris après une
rotation ultérieure du coffre en ligne.

À l'import, le navigateur applique un schéma strict, limite la taille et le nombre de fiches,
vérifie l'enveloppe sentinelle puis déchiffre et valide chaque `VaultAccountV1`. L'API n'est appelée
qu'après cette validation locale et une confirmation explicite. Le serveur déduit le propriétaire
de la session, verrouille la révision courante, supprime les anciennes fiches, insère les nouvelles
et remplace le profil dans une transaction PostgreSQL unique. Toute révision inattendue, collision
d'UUID ou erreur provoque un rollback complet.
