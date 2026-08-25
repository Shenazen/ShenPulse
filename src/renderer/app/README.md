# Architecture du renderer

Le renderer ShenPulse utilise des scripts classiques chargés explicitement par
`src/renderer/index.html`. Ce choix conserve le comportement Electron existant
sans introduire de bundler dans l'application principale, tout en donnant une
frontière claire à chaque domaine.

## Règles de dépendance

L'ordre des balises `script` dans `index.html` est un contrat :

1. les catalogues sans état (`visibility-catalog`, `overlay-catalog`) ;
2. `core/bootstrap.js`, qui déclare les références DOM et l'état d'interface ;
3. les utilitaires et pages dans `core/` et `features/` ;
4. les éditeurs dans `editors/` ;
5. les commandes dans `actions/` ;
6. les écouteurs et le démarrage dans `core/events/`.

Un module de fonctionnalité peut lire l'état partagé du bootstrap et appeler les
utilitaires chargés avant lui. Il ne doit pas :

- redéclarer le catalogue ou les droits d'un autre domaine ;
- démarrer un service au chargement ;
- ajouter directement un nouvel écouteur global si une délégation existe déjà ;
- dépasser 800 lignes. Le test `overlay-catalog.test.js` fait respecter cette
  dernière limite.

## Répertoires

- `core/` : démarrage, navigation, rendu racine, synchronisation et événements ;
- `features/` : une page ou une capacité utilisateur par fichier ;
- `features/media/` : sélecteurs cadeaux, médiathèque et intégration Spotify ;
- `features/overlays/` : présentation des overlays uniquement. `catalog.js`
  construit les URL et diffère les sources OBS, `placeholders.js` dessine les
  aperçus instantanés avec les médias embarqués, `cards.js` assemble les cartes
  et `editor.js` gère leur configuration ;
- `features/games/` : accès, paramètres par jeu, sources et export des overlays ;
- `editors/` : formulaires réutilisables ;
- `actions/handlers/` : commandes regroupées par domaine ;
- `actions/dispatcher.js` : précontrôles et routage, sans logique métier.

Pour ajouter une commande, l'implémenter dans le groupe approprié sous
`actions/handlers/` et ajouter son identifiant au `Set` placé en tête du même
fichier. Ne pas agrandir `handleAction`.

## Styles

`styles.css` est uniquement le point d'entrée de la cascade. Les feuilles sous
`styles/` sont chargées dans un ordre explicite et limitées à 1 200 lignes. Une
modification d'overlay doit aller dans `styles/overlay-catalog.css` ou dans une
feuille plus précise, jamais dans les fondations globales sans nécessité.

## Tests de sources

`tests/helpers/source-bundles.js` relit les scripts et imports CSS dans l'ordre
réel des pages. Les tests peuvent donc inspecter une fonction sans dépendre du
nombre de fichiers. Les nouveaux tests doivent néanmoins préférer les contrats
exécutables et les tests DOM aux recherches par expression régulière.
