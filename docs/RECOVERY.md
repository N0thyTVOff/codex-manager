# Récupération et continuité

## Principe essentiel

Codex Manager ne possède aucune clé maître ni procédure de réinitialisation. Sans la phrase
secrète correspondant aux enveloppes, les fiches sont irrécupérables. Cette propriété protège le
coffre en cas de fuite de la base, mais impose une sauvegarde indépendante de la phrase.

## Préparation recommandée

- conserver la phrase dans un gestionnaire de mots de passe reconnu ;
- exporter régulièrement un JSON chiffré, notamment avant une rotation ou une modification
  importante ;
- stocker au moins une copie du JSON hors de l'appareil principal ;
- noter quelle phrase protège chaque génération de sauvegarde sans inclure la phrase dans le nom
  du fichier ;
- tester périodiquement la lecture du fichier sur l'application, sans confirmer le remplacement.

Le JSON reste une cible d'attaque hors ligne contre sa phrase. Ne le publiez jamais dans GitHub, un
ticket, une messagerie ou un stockage non maîtrisé.

## Scénarios

### Phrase oubliée, coffre encore ouvert

N'actualisez pas la page. Exportez immédiatement le JSON chiffré, puis utilisez **Changer la phrase
secrète** si vous connaissez encore la phrase actuelle. Si vous ne la connaissez plus, la clé en
mémoire permet l'usage de l'onglet mais pas une rotation : copiez temporairement les informations
nécessaires vers un emplacement sûr avant de fermer l'onglet.

### Phrase oubliée, coffre verrouillé

Essayez uniquement les phrases sauvegardées dans votre gestionnaire. Ni GitHub, ni Vercel, ni Neon,
ni le mainteneur ne peuvent déchiffrer ou réinitialiser le coffre. Sans phrase valide ou sauvegarde
associée à une phrase connue, aucune récupération n'est possible.

### Données supprimées ou coffre endommagé

1. arrêtez les modifications dans tous les onglets ;
2. choisissez la sauvegarde chiffrée saine la plus récente ;
3. vérifiez que sa phrase est disponible ;
4. suivez la restauration complète du [guide utilisateur](USER_GUIDE.md#sauvegarder-et-restaurer) ;
5. contrôlez les fiches et exportez une nouvelle sauvegarde.

La restauration est transactionnelle : un échec ou un conflit conserve le coffre précédent.

### Secret de compte exposé

Changez d'abord le secret chez le fournisseur concerné, puis mettez la fiche à jour. Révoquez les
sessions et régénérez la 2FA si nécessaire. Considérez toute sauvegarde contenant l'ancien secret
comme sensible, même si elle reste chiffrée.

### Compte GitHub autorisé indisponible

L'authentification et le chiffrement sont deux barrières distinctes. Récupérez d'abord le compte
GitHub par les canaux GitHub. Modifier `AUTHORIZED_GITHUB_USER_ID` change l'identité autorisée et
nécessite une décision d'exploitation explicite ; cela ne déchiffre ni ne transfère le coffre.

### Incident de production

Ne lancez jamais de migration manuelle improvisée. Suivez le runbook
[OPERATIONS.md](OPERATIONS.md), vérifiez la GitHub Release et le SHA concernés, puis utilisez le
chemin de reprise contrôlé du workflow de production.

## Ce que les sauvegardes ne couvrent pas

- la session GitHub et les jetons OAuth ;
- l'identité autorisée ;
- les paramètres Vercel, GitHub ou Neon ;
- les secrets d'infrastructure ;
- une phrase secrète oubliée ;
- les changements postérieurs à l'export.
