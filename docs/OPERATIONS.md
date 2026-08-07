# Exploitation

## Environnements

| Environnement | Base                       | OAuth                           | Déploiement                 |
| ------------- | -------------------------- | ------------------------------- | --------------------------- |
| développement | PostgreSQL dédié hors prod | application GitHub OAuth locale | `npm run dev`               |
| production    | branche Neon Production    | application GitHub OAuth dédiée | Vercel après GitHub Release |
| CI            | PostgreSQL jetable         | aucune connexion utilisateur    | aucun déploiement           |

Ne copiez jamais une URL de base, un jeton ou un secret dans un journal, une issue ou une PR.

## Contrôles avant fusion

```bash
npm ci
npm run check
npm run audit:prod
```

Le check requis est exactement `CI`. Il agrège formatage, lint, types, couverture, schéma, YAML,
liens, build, audit, Dependency Review et test PostgreSQL isolé. CodeQL reste un contrôle séparé.

## Chaîne Release PR vers production

1. chaque changement fonctionnel est fusionné séparément dans `main` ;
2. Release Please crée ou actualise une seule PR `chore(main): release X.Y.Z` ;
3. aucune release ni production n'est créée tant que cette PR reste ouverte ;
4. le mainteneur vérifie son changelog, sa version et le check `CI` ;
5. sa fusion manuelle autorise la création du tag et de la GitHub Release ;
6. le même workflow transmet le tag et son SHA immuable au workflow de production ;
7. le tag est revalidé avec `npm run check` et `npm run audit:prod` ;
8. Vercel construit l'artefact, les migrations versionnées sont appliquées, puis un déploiement sans
   domaine est créé ;
9. `/api/health` est vérifié sur ce déploiement isolé ;
10. le domaine de production n'est promu que si tous les contrôles réussissent.

Ne fusionnez jamais automatiquement la Release PR. Les fusions ordinaires dans `main` ne doivent
pas déclencher Vercel directement.

## CI absente sur la Release PR

Les événements produits par un jeton GitHub peuvent ne pas déclencher un autre workflow. Si le
check `CI` manque sur la branche Release Please, lancez manuellement le workflow **CI** avec
`workflow_dispatch` sur cette branche. N'affaiblissez pas la protection de `main` et n'exigez jamais
un check inexistant.

## Reprendre une production échouée

Le workflow **Validation de release et production** possède un déclenchement manuel réservé à une
GitHub Release existante. Fournissez le tag publié et son SHA exact. Le workflow vérifie leur
correspondance avant toute migration ou opération Vercel.

- si la validation du tag échoue, corrigez le code dans une nouvelle PR puis publiez une nouvelle
  release ;
- si le build échoue avant migration, aucun déploiement n'est promu ;
- si la migration échoue, aucun déploiement n'est promu ;
- si le contrôle de santé échoue, l'ancien domaine de production reste en place ;
- une migration inverse destructive n'est jamais automatisée.

## Contrôles après publication

- vérifier que la GitHub Release pointe vers le tag attendu ;
- vérifier un seul déploiement Vercel de production pour cette release ;
- appeler `https://codex-manager-n0thy.vercel.app/api/health` et contrôler `status: "ok"` ainsi que
  la version ;
- tester la connexion du compte GitHub autorisé et le refus d'un autre compte ;
- déverrouiller un coffre de test, sans utiliser de donnée réelle dans les captures ou journaux ;
- surveiller les alertes GitHub Security et Dependabot.

Le point de santé confirme que l'application répond et expose sa version. Il ne valide pas à lui
seul la connexion PostgreSQL, OAuth ou le déchiffrement d'un coffre.

## Rotation des secrets d'infrastructure

Les valeurs sont modifiées uniquement dans leur gestionnaire d'origine, jamais dans Git :

- `VERCEL_TOKEN` dans l'environnement GitHub `production` ;
- `RELEASE_PLEASE_TOKEN` dans les secrets du dépôt ;
- `DATABASE_URL`, `BETTER_AUTH_SECRET` et `GITHUB_CLIENT_SECRET` dans Vercel ;
- les identifiants non secrets dans les variables GitHub ou Vercel correspondantes.

Planifiez la rotation, vérifiez les effets sur les sessions OAuth et réalisez-la hors d'une Release
PR en cours. Une rotation d'infrastructure ne remplace pas la rotation de la phrase du coffre.

## Sauvegarde d'exploitation

Les sauvegardes Neon protègent la disponibilité de la base, mais ne remplacent pas l'export JSON
chiffré utilisateur. Inversement, le JSON ne contient ni sessions, ni configuration OAuth, ni
secrets de déploiement. Les deux niveaux doivent être gérés séparément.
