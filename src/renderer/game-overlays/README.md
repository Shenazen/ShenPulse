# Exports d’overlays de jeux

Ces sources remplacent le générateur monolithique historique sans changer ses
quatre fonctions publiques, exposées dans le navigateur par `ShenPulseGameOverlay`.

## Organisation et dépendances

- `index.mjs` : façade publique, uniquement les quatre exports historiques.
- `render.mjs` : orchestration des deux rendus et de leurs téléchargements PNG.
- `model.mjs` : préparation des interactions, regroupement des actions et badges.
- `effects.mjs` : interprétation des commandes et des préréglages de jeux.
- `gifts.mjs` : alias, identités et normalisation des cadeaux.
- `constants.mjs` : dimensions, polices et chemins des ressources.
- `assets.mjs` : chargement des images, cache partagé, police et export du Canvas.
- `canvas.mjs` : primitives géométriques, couleurs, images et texte.
- `layout.mjs` : disposition des deux modèles et des colonnes de victoires.
- `badges.mjs` : visuels des cadeaux, likes, follows et autres déclencheurs.
- `icons.mjs` : icônes et variantes procédurales des effets de jeu.

Les imports nommés rendent les dépendances explicites. Les modules ne démarrent
aucun transport LIVE et ne chargent aucune image avant une demande d’export.
Le cache d’images et le chargement de la police sont partagés entre les appels.

## Génération reproductible

Exécuter `npm run overlays:build` après une modification. Le script
`scripts/build-game-overlays.js` utilise esbuild déjà installé et produit
`../game-overlay-generator.js`, un bundle IIFE compatible avec les scripts
classiques d’Electron. Ne jamais modifier ce fichier généré à la main.

Le même workflow régénère les fichiers de compatibilité des anciens loaders
OBS : `resources/overlays/runtime/widgets.js` et `wheel-match.js`. Les nouvelles
sources utilisent les petits moteurs de `runtime/widgets/` ; les anciens chemins
restent disponibles. Aucun protocole, droit d’accès ou déploiement public ne
change avec ce découpage.

## Contrats conservés

`renderMinecraftBedrockOverlay` et `renderMinecraftStyledOverlay` renvoient un
Canvas de 1080 × 1920. Les fonctions de téléchargement correspondantes exportent
un PNG et conservent le nom de fichier demandé. Les deux modèles, couleurs de
fond, cartes, regroupements, images des cadeaux, commandes et colonnes WINS sont
inchangés. Les fonctions internes ne deviennent pas des API publiques.

L’extraction a été faite depuis le bundle ShenPulse réellement utilisé, pas
depuis le projet historique voisin : les améliorations locales sont conservées.

## Vérification sans régression

`tests/game-overlay-architecture.test.js` vérifie que le bundle livré correspond
exactement aux sources et aux options de génération. Quatre traces Canvas
capturées avant le découpage contrôlent les coordonnées, couleurs, textes et
ressources des deux moteurs et de leurs deux modèles. Les téléchargements,
le cache partagé et le refus d’une liste vide sont également testés.

Ces traces déterministes complètent les tests des règles et des sélecteurs ;
elles ne remplacent pas un contrôle visuel lorsqu’un design change volontairement.
