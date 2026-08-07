# Consignes pour les agents

## Architecture

Application web Next.js 16 avec App Router et TypeScript strict. L'interface se trouve dans
`src/app/` et `src/components/`, les règles d'authentification dans `src/lib/auth/`, le chiffrement
client dans `src/lib/vault/`, et PostgreSQL/Drizzle dans `src/db/`. Les migrations SQL versionnées
sont dans `drizzle/`. Le build `.next/`, la couverture et les variables réelles ne sont jamais
versionnés.

## Validation obligatoire

```bash
npm ci
npm run check
npm run audit:prod
```

Après une modification des workflows, formulaires ou documents, vérifier aussi
`npm run check:yaml` et `npm run check:links`.

## Conventions

- interface et documentation en français ; code et identifiants techniques en anglais ;
- TypeScript strict, composants accessibles et erreurs sans donnée sensible ;
- Conventional Commits, sujet commençant par une minuscule ;
- dépendances exactes et aucune abstraction sans besoin concret ;
- toute correction ou logique nouvelle reçoit un test proportionné ;
- aucune donnée réelle dans les fixtures, captures, logs ou exemples.

## Fichiers sensibles

- `src/lib/vault/crypto.ts` et `src/db/schema.ts` : préserver le format chiffré et sa migration ;
- `src/lib/vault/backup.ts` et `/api/vault/restore` : préserver le format versionné, la validation
  locale et le remplacement transactionnel ;
- `src/lib/auth/` : préserver la restriction à l'identifiant GitHub autorisé ;
- `.github/workflows/production.yml` : conserver release → validation → production ;
- `.github/workflows/release-please.yml` et fichiers Release Please : ne pas publier par PR ;
- `LICENSE` : texte officiel AGPL-3.0 intact ;
- `NOTICE` : copyright et URL du dépôt officiel ;
- `.env.example` : documentation publique uniquement, jamais de valeur réelle ;
- `CODEOWNERS` et protections GitHub : gouvernance de `@N0thyTVOff`.

## Invariants et tests

- les mots de passe, graines 2FA, codes de récupération et notes privées sont chiffrés dans le
  navigateur avant tout envoi ; la phrase du coffre ne quitte jamais le navigateur ;
- un IV AES-GCM unique est généré pour chaque écriture et l'identifiant du record sert d'AAD ;
- aucune donnée secrète en clair dans la base, les journaux, GitHub ou Vercel ;
- aucune connexion à une base de production depuis les tests ou la CI ;
- couverture minimale de 90 % sur la logique cryptographique ;
- toute évolution de schéma produit une migration Drizzle relue et testée hors ligne ;
- une restauration valide et déchiffre toutes les fiches localement avant de remplacer le coffre
  dans une transaction unique ;
- aucune API OpenAI ni automatisation de connexion aux comptes ChatGPT sans décision explicite ;
- aucun partage de compte : le produit reste un inventaire personnel.

## Autorisation requise

Ne jamais rendre le dépôt public, ajouter un collaborateur, fusionner une PR ou une Release PR,
créer/supprimer une release, déployer, modifier les secrets ou environnements de production,
réécrire l'historique, affaiblir le chiffrement ou réduire une protection sans autorisation
explicite de N0thyTVOff. Le check agrégateur requis reste nommé exactement `CI`. Les actions
GitHub tierces restent épinglées par SHA complet.
