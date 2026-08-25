# Maintenance de ShenPulse

## Principe

Une fonctionnalité possède un seul emplacement de référence. Les autres couches
consomment son contrat ; elles ne le recopient pas. Le catalogue des overlays est
le premier domaine appliquant cette règle de bout en bout.

## Carte des couches

| Couche | Responsabilité | Ne doit pas contenir |
|---|---|---|
| `src/main` | services locaux, persistance, sécurité, IPC | rendu HTML ou métadonnées dupliquées |
| `src/shared` | contrats indépendants de l'interface | accès DOM ou état Electron |
| `src/renderer/app` | pages, formulaires et commandes utilisateur | règles serveur ou secrets |
| `resources/overlays/catalog` | un manifeste autonome par overlay | manipulation du DOM ou logique serveur |
| `resources/overlays/overlay-catalog.js` | agrégation, URLs et routage communs | informations propres à un widget |
| `resources/overlays/runtime` | comportement des sources navigateur | décisions commerciales dupliquées |
| `tests` | contrats et parcours observables | dépendance à un ancien fichier monolithique |

## Procédure de modification

1. Identifier le domaine propriétaire de la donnée ou du comportement.
2. Modifier son contrat une seule fois.
3. Ajouter un test reproduisant le besoin ou la régression.
4. Exécuter `npm run verify`.
5. Exécuter `npm run games:build` lorsqu'un fichier de jeu est concerné.

Pour les overlays, suivre le guide détaillé dans
`resources/overlays/runtime/README.md`.

## Garde-fous

- renderer : 800 lignes maximum par module JavaScript ;
- manifeste overlay : 250 lignes maximum ;
- runtime overlay : 800 lignes maximum ;
- styles renderer : 1 200 lignes maximum ;
- styles overlay : 1 200 lignes maximum ;
- aucune nouvelle matrice de routes ou de droits overlay hors du catalogue ;
- toute nouvelle interaction globale passe par un groupe du dispatcher ;
- les tests DOM sont utilisés pour les comportements visuels critiques.

Ces limites sont testées automatiquement. Si un fichier atteint sa limite, il
faut créer une nouvelle frontière fonctionnelle plutôt qu'augmenter le seuil.
