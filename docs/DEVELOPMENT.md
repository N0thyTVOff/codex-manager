# Développement

## Boucle locale

Créez une branche depuis `main`, installez avec `npm ci`, puis lancez `npm run dev`. Avant chaque
PR, exécutez `npm run check` et `npm run audit:prod`.

La version de référence reste Node.js `22.21.1` avec npm `10.9.x` (`.nvmrc`). Le manifeste accepte
aussi Node.js 24 et npm 11 afin que Dependabot puisse résoudre le verrouillage dans son environnement
géré, sans modifier le runtime utilisé par la CI ou Vercel.

## Qualité

Le check agrégateur GitHub nommé exactement `CI` couvre formatage, lint, types, tests avec
couverture, cohérence Drizzle, YAML, liens Markdown, build et audit de production. La Dependency
Review est ajoutée sur les PR. CodeQL s'exécute séparément sans dupliquer une configuration par
défaut GitHub.

## Données de test

Utilisez uniquement les domaines réservés comme `example.test`, des mots de passe explicitement
inactifs et des graines 2FA factices. Une capture, un log ou une fixture ne doit jamais contenir de
donnée issue d'un compte réel.

## Schéma

Modifiez `src/db/schema.ts`, exécutez `npm run db:generate`, relisez le SQL, puis validez avec
`npm run db:check`. La fusion manuelle de la Release PR autorise le workflow protégé à appliquer
les migrations versionnées. Ne lancez jamais `npm run db:migrate` contre la production depuis un
poste local.

Une migration de production doit être additive ou rester compatible avec la version encore en
ligne : si le déploiement échoue après la migration, l'ancienne application doit continuer à
fonctionner.

Si une production échoue après la création de la GitHub Release, le workflow
`Validation de release et production` peut être relancé manuellement avec le tag publié et son SHA.
Il refuse un tag sans GitHub Release correspondante et rejoue toutes les validations avant toute
migration ou promotion Vercel.

## Chiffrement

Toute modification de format doit :

1. augmenter une version explicite ;
2. préserver la lecture des données existantes ou fournir une migration sûre ;
3. tester les altérations, les mauvais contextes et les paramètres affaiblis ;
4. éviter toute journalisation du texte clair, de la phrase ou de la clé.

## Commits et PR

Les titres suivent Conventional Commits et leur sujet commence par une minuscule, par exemple
`feat(vault): ajouter la date de renouvellement`. Les ruptures utilisent `!` ou un pied de commit
`BREAKING CHANGE:`.

La fusion est uniquement en squash. Le titre de la PR devient le commit de `main`.
