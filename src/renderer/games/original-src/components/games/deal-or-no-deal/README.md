# Deal or No Deal

La page Vue ne conserve que l’état réactif, les calculs de présentation et le câblage des contrôleurs. Les dépendances sont injectées sous leur nom d’origine ; les contrôleurs n’importent pas la page et ne partagent aucun état global.

- `round.mjs` pilote les phases, choix, révélations, réponses au banquier et gains. Il possède et annule les minuteurs de révélation de 520 ms à la sortie de page.
- `banker.mjs` construit et sélectionne les offres, échanges et achats, y compris les requêtes forcées déjà utilisées.
- `rigging.mjs` applique les réglages existants de pondération ; leurs probabilités et l’ordre des tirages restent identiques.
- `music-scene.mjs` choisit l’ambiance et possède son minuteur de remplacement temporaire.
- `price-fitter.mjs` adapte les textes des trois prix aux dimensions et possède son animation frame.
- `box-utils.mjs` contient les opérations communes sur les boîtes ; `audio-volume.mjs` conserve la clé persistée et les bornes du volume.

Les `dispose()` sont appelés avant de retirer les écouteurs et d’arrêter la musique. Les fonctions de choix du jeu restent inchangées : les suites `deal-controller-traces.json` et `deal-round-traces.json`, capturées avant leur déplacement, vérifient offres, pondération, manches, délais, banque, achats et gains finaux. Un test séparé vérifie que quitter le jeu empêche une ancienne révélation de se déclencher ensuite.

`tests/original-game-vue-setup.test.js` exécute également le vrai script Vue et tous ses imports. Il vérifie le câblage des contrôleurs dans la page, les hooks de montage, l’ajustement des prix, une première sélection et une révélation à exactement 520 ms, puis le retour au lobby et le retrait des écouteurs. Cette vérification d’assemblage complète les traces des contrôleurs isolés : la seule compilation ne détecte pas tous les identifiants JavaScript absents.
