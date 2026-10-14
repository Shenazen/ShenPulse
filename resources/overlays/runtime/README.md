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
5. Ajouter ses styles dans une feuille dédiée chargée directement par
   `index.html`, puis conserver son import dans `overlay.css` pour le point
   d'entrée de compatibilité et les tests agrégés.
6. Ajouter au minimum un test de contrat dans `overlay-catalog.test.js` et un
   test DOM si le widget modifie l'interface.

## Modules runtime

- `configuration.js` : paramètres, état commun et configuration à chaud ;
- `widgets/wheel-design.js` et `wheel-animation.js` : dessin et rotation de roue ;
- `widgets/match.js` : lecture Match, file et récupération après inactivité ;
- `widgets/match-widgets.js` : six widgets locaux Matchs et scores complémentaires,
  sans démo automatique, ni relais public ; contrat et contrôles dans
  `docs/matches-overlays.fr.md` ;
- `alerts-feed.js` : alertes, audio, objectifs et flux ;
- `widgets/coin-jar.js`, `timers.js`, `win-counter.js` et `game.js` : moteurs
  indépendants chargés uniquement par la vue concernée ;
- `session.js` : hydratation unique des compteurs, classements et flux ;
- `transport.js` : canaux, SSE, messages d'aperçu et relais Firebase.
- `scene.js` : composition transparente de widgets avec un seul transport. Le
  contrat `../scene-layout.js` borne et filtre la composition par droits. Les
  widgets incorporés (`embedded=scene`) reçoivent uniquement les messages de
  leur parent de même origine et n'ouvrent ni SSE ni relais supplémentaires.
- `dependencies.js` : chargement à la demande des bibliothèques lourdes ; le
  lecteur Lottie reste limité à la source Alertes qui sait l'utiliser.

`loader.js` conserve l’ordre d’exécution des scripts classiques et télécharge
en parallèle uniquement les moteurs utiles. Un Timer ne compile plus le moteur
physique du Coin Jar, les dessins de roue ou le lecteur Match. Les cartes statiques,
sources locales, relais Firebase et scènes composites gardent les mêmes canaux.

Les chemins historiques `widgets.js` et `wheel-match.js` restent disponibles pour
les anciens loaders. Ce sont des fichiers générés depuis les mêmes modules par
`scripts/build-overlay-runtime.js`, appelé par `npm run overlays:build`. Il ne faut
jamais les modifier à la main. Les tests vérifient leur génération exacte, les
modules effectivement choisis par chaque vue et le comportement DOM de chaque
widget. Aucun déploiement du runtime public n’est effectué par la génération.

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
