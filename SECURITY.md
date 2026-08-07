# Politique de sécurité

## Signaler une vulnérabilité

N'ouvrez pas d'issue publique. Utilisez le
[signalement privé GitHub](https://github.com/N0thyTVOff/codex-manager/security/advisories/new) en
indiquant l'impact, les conditions de reproduction et une proposition de correction si disponible.
Ne joignez aucune donnée réelle issue d'un coffre.

Un premier accusé de réception est visé sous sept jours. La publication coordonnée intervient
seulement après disponibilité et validation d'une correction.

## Versions prises en charge

Avant la première release stable, seule la branche `main` et la dernière version publiée reçoivent
les correctifs de sécurité.

| Version                | Prise en charge |
| ---------------------- | --------------- |
| dernière release `0.x` | oui             |
| branche `main`         | oui             |
| versions antérieures   | non             |

## Modèle de sécurité

- les fiches sont chiffrées dans le navigateur avec AES-256-GCM ;
- la clé est dérivée de la phrase locale par PBKDF2-SHA-256 ;
- l'UUID de la fiche sert de donnée authentifiée additionnelle ;
- le serveur stocke les paramètres KDF non secrets et les enveloppes chiffrées ;
- l'identité GitHub autorisée est vérifiée avec son identifiant numérique ;
- les mutations et restaurations utilisent des révisions et des transactions PostgreSQL.

Le chiffrement côté client ne protège pas contre un navigateur, une extension ou un système
compromis pendant que le coffre est ouvert. Il ne remplace pas la sécurité du compte GitHub, de
Vercel, de Neon ou de l'appareil.

## Récupération

Il n'existe aucune porte dérobée ni réinitialisation de phrase. Une phrase perdue rend les
enveloppes correspondantes irrécupérables. Les exports JSON restent liés à la phrase active au
moment de leur création et doivent être conservés hors du dépôt. Voir
[docs/RECOVERY.md](docs/RECOVERY.md).

## Responsabilités utilisateur

- utilisez une phrase de coffre longue, unique et sauvegardée dans un gestionnaire reconnu ;
- révoquez immédiatement tout secret exposé ;
- ne partagez pas vos comptes OpenAI ni les accès à Codex Manager ;
- verrouillez votre session et maintenez navigateur et système à jour.
- effacez le presse-papiers après avoir copié un secret sur un poste partagé ;
- conservez les sauvegardes JSON chiffrées séparément de leur phrase ;
- n'envoyez jamais une graine 2FA à 2FA.live par une URL ou un outil automatique.
