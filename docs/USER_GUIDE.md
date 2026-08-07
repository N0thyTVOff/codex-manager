# Guide utilisateur

## À quoi sert Codex Manager ?

Codex Manager est un inventaire personnel pour organiser des comptes ChatGPT Plus utilisés avec
Codex. Il centralise les échéances, l'état hebdomadaire des quotas et les identifiants chiffrés. Il
ne partage pas les comptes, ne se connecte pas automatiquement à ChatGPT et n'appelle aucune API
OpenAI.

## Première ouverture

1. Connectez-vous avec le compte GitHub autorisé.
2. Créez une phrase secrète d'au moins 16 caractères, longue et unique.
3. Enregistrez cette phrase dans un gestionnaire de mots de passe reconnu.
4. Ajoutez votre première fiche depuis **Ajouter un compte**.

La phrase reste dans la mémoire de l'onglet. Elle disparaît au rechargement, à la fermeture, à la
déconnexion ou avec **Verrouiller maintenant**. Elle n'est pas récupérable par le serveur.

## Gérer une fiche

Une fiche contient un libellé, un login, un mot de passe, des notes facultatives, une configuration
2FA, une date d'achat, une date de fin et l'état du quota. Ces champs sont chiffrés dans le
navigateur avant leur envoi.

- **Ajouter / Modifier** — enregistre une nouvelle enveloppe chiffrée.
- **Renouveler** — remplace la date d'achat et recalcule par défaut un mois calendaire.
- **Archiver / Restaurer** — retire une fiche active sans la supprimer définitivement.
- **Supprimer** — efface définitivement l'enveloppe après confirmation.

La date de fin est inclusive. Une fiche terminant le 7 septembre reste active ce jour-là et passe
dans les archives le 8 septembre selon la date locale du navigateur.

## Quotas et ordre des comptes

- **Disponible** — le compte peut être utilisé ; les échéances les plus proches apparaissent en
  premier.
- **Utiliser ce compte** — passe le compte à **En cours** et ouvre `https://chatgpt.com/` dans un
  nouvel onglet isolé.
- **Quota épuisé** — démarre une période locale de 168 heures exactement.
- **Rendre disponible** — permet une correction manuelle de l'état.

Le compteur n'interroge pas ChatGPT : il dépend uniquement de l'action manuelle **Quota épuisé**.
Plusieurs comptes peuvent rester simultanément en cours.

## Copier les secrets et utiliser la 2FA

Le login, le mot de passe et la clé 2FA sont masqués par défaut. Chaque valeur dispose de ses
propres commandes **Révéler** et **Copier**.

- **2FA.live** — après un avertissement, la clé est copiée et le site s'ouvre sans recevoir la clé
  dans son URL. Vous choisissez ensuite si vous souhaitez la coller dans ce service tiers.
- **Google Authenticator** — copiez la clé puis utilisez **Ajouter un code** et **Saisir une clé de
  configuration** dans l'application mobile.
- **Autre fournisseur** — copiez la clé et suivez sa procédure manuelle.

Le presse-papiers appartient au système : effacez-le après usage sur un poste partagé et ne copiez
jamais un secret pendant un partage d'écran.

## Sauvegarder et restaurer

**Exporter le JSON chiffré** télécharge un fichier versionné qui contient le profil cryptographique
et les enveloppes chiffrées. Il ne contient ni session, ni identité GitHub, ni fiche en clair.

Pour restaurer :

1. sélectionnez le fichier JSON ;
2. saisissez la phrase qui était active lors de cet export ;
3. lisez l'avertissement et confirmez le remplacement complet ;
4. attendez la validation locale et la transaction serveur.

Une sauvegarde antérieure à un changement de phrase reste liée à l'ancienne phrase. La restauration
remplace toutes les fiches actuelles et la phrase de la sauvegarde devient la phrase active.
Consultez [RECOVERY.md](RECOVERY.md) avant une opération de récupération.

## Changer la phrase secrète

La rotation demande la phrase actuelle et une nouvelle phrase. Toutes les fiches sont déchiffrées
puis rechiffrées dans le navigateur avec un nouveau sel et de nouveaux IV. Le serveur applique le
nouveau profil et toutes les enveloppes dans une transaction unique. Un conflit laisse l'ancien
coffre intact.

Créez une nouvelle sauvegarde après une rotation et conservez l'ancienne uniquement si sa phrase
reste disponible.

## Limites connues

- aucune récupération d'une phrase perdue ;
- aucun verrouillage automatique après inactivité ;
- aucun fonctionnement hors ligne garanti ;
- aucun remplissage automatique de ChatGPT ;
- aucune détection réelle des quotas ou des paiements ;
- aucune annulation ou gestion automatique d'abonnement ;
- aucune notification e-mail ou push ;
- un navigateur compromis pendant le déverrouillage peut lire les données en mémoire ;
- 2FA.live est un service tiers auquel la clé n'est jamais transmise automatiquement.

## Problèmes courants

| Symptôme                             | Action sûre                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| phrase refusée                       | vérifier la phrase et le fichier concernés ; ne pas multiplier les essais publics |
| conflit avec un autre onglet         | verrouiller, fermer les autres onglets, recharger puis recommencer                |
| copie impossible                     | révéler temporairement la valeur et la copier manuellement                        |
| compte passé trop tôt dans l'archive | vérifier la date et le fuseau du système                                          |
| sauvegarde incompatible              | conserver le fichier intact et vérifier sa version sans le modifier               |
| connexion GitHub refusée             | vérifier que le compte correspond à l'identifiant autorisé                        |
