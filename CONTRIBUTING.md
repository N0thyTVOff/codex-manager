# Contribuer

Les retours et issues publiques sont bienvenus. La politique de gouvernance actuelle réserve la
réalisation et la fusion des pull requests à `@N0thyTVOff`.

Un dépôt public ne peut pas empêcher techniquement une proposition de PR depuis un fork. Cette PR
n'accorde toutefois aucun droit de pousser dans le dépôt, de fusionner, de lire les secrets ou
d'accéder aux environnements. L'exécution des workflows de forks doit être approuvée par le
mainteneur.

## Signaler un problème

Utilisez le formulaire approprié et recherchez d'abord les doublons. Ne publiez jamais de mot de
passe, clé 2FA, token, donnée personnelle ou détail exploitable d'une vulnérabilité. Les failles se
signalent via [GitHub Security Advisories](https://github.com/N0thyTVOff/codex-manager/security/advisories/new).

## Cycle de contribution du mainteneur

1. créer une issue lorsque le changement mérite une discussion ;
2. créer une branche courte depuis `main` ;
3. écrire le changement et les tests proportionnés ;
4. exécuter `npm run check` et `npm run audit:prod` ;
5. ouvrir une PR au titre Conventional Commits ;
6. attendre `CI`, résoudre les conversations et fusionner en squash.

## Une release pour plusieurs PR

Release Please conserve une seule PR `chore(main): release X.Y.Z`. Chaque PR fonctionnelle reste
indépendante ; les fusions suivantes mettent à jour cette même Release PR. Le workflow créé par
`GITHUB_TOKEN` ne déclenchant pas toujours les autres workflows, lancez manuellement `CI` sur la
branche de la Release PR si le check manque.

Ne fermez ni ne fusionnez automatiquement cette PR. Sa fusion manuelle par le mainteneur est
l'autorisation explicite de créer le tag et la GitHub Release. Ce n'est qu'après la publication de
cette release que les validations du tag puis le déploiement Vercel peuvent démarrer.
