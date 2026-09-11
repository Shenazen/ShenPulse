# Maintenir un overlay

`resources/overlays/catalog/` contient la source de vérité de chaque widget.
`resources/overlays/overlay-catalog.js` assemble ces manifestes pour Electron,
le serveur local, le relais public et les pages OBS / TikTok LIVE Studio.

## Modifier un overlay existant

Commencer par le fichier du widget sous `catalog/` (par exemple
`catalog/like-goal.js`). Il regroupe :

- `definition` : nom, description, catégorie, taille, droit Pro et route ;
- `defaults` : valeurs initiales de ce seul overlay ;
- `settings` : paramètres présentés par l'éditeur ;
- `parameters` : noms transmis à la source publique.

Les emplacements suivants ne changent que si le comportement ou le rendu le
demande réellement :

- formulaire Electron : `src/renderer/app/features/overlays/fields.js` ou
  `editor.js` ;
- comportement du widget : le fichier ciblé sous `runtime/` ;
- apparence du widget : la feuille ciblée sous `styles/`.

Une modification d'information ou de route ne doit donc pas nécessiter de
toucher au serveur. Celui-ci appelle directement `buildUrls`, `viewRequiresPro`
et `acceptsChannel` du catalogue.

## Ajouter un overlay

1. Copier un manifeste proche sous `catalog/` et y déclarer la fiche, les
   valeurs par défaut et les paramètres du nouvel overlay.
2. Charger ce manifeste avant `overlay-catalog.js` dans les deux fichiers
   `resources/overlays/index.html` et `src/renderer/index.html`, puis l'ajouter
   aux imports CommonJS de l'agrégateur.
3. Ajouter sa section HTML dans `index.html`.
4. Placer son comportement dans le module runtime le plus proche, ou créer un
   nouveau module chargé avant `runtime/transport.js`.
5. Ajouter ses styles dans une feuille dédiée importée par `overlay.css`.
6. Ajouter au minimum un test de contrat dans `overlay-catalog.test.js` et un
   test DOM si le widget modifie l'interface.

## Modules runtime

- `configuration.js` : paramètres, état commun et configuration à chaud ;
- `wheel-match.js` : roue, classements et lecteur Match ;
- `alerts-feed.js` : alertes, audio, objectifs et flux ;
- `widgets.js` : Coin Jar, timers, compteurs et animation de roue ;
- `transport.js` : canaux, SSE, messages d'aperçu et relais Firebase.
- `dependencies.js` : chargement à la demande des bibliothèques lourdes ; le
  lecteur Lottie reste limité à la source Alertes qui sait l'utiliser.

Les cartes de la galerie utilisent `preview=static` ou `preview=animated`.
Elles ne doivent jamais ouvrir le flux SSE, le relais Firebase ou charger
l'état complet : leurs données arrivent dans l'URL puis par `postMessage`.
Le renderer ne crée la source réelle que lorsque sa carte approche de la zone
visible, avec un aperçu léger affiché immédiatement pendant ce court chargement.

`transport.js` ne connaît pas les matrices de routage : elles appartiennent au
catalogue. Les cartes Match utilisent une source HTTPS courte `/m/<compte>/<canal>`.
Le site public ne contient aucune vidéo : il reçoit les événements via le relais,
puis demande au serveur ShenPulse local un ticket vidéo opaque et temporaire.
Le canal Match est isolé des autres overlays et l'abonnement Pro est revérifié
aussi bien par le relais que par le serveur local.
