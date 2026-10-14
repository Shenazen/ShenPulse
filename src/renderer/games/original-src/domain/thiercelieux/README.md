# Domaine Thiercelieux

`../thiercelieuxEngine.mjs` est la façade publique compatible (53 exports). Les données figées des personnages, camps, bâtiments, variantes et événements sont dans `catalog.mjs`. Les réglages et leurs bornes sont dans `configuration.mjs`.

`lobby.mjs` gère inscriptions, files et places actives. `setup.mjs` construit et valide les compositions. `players.mjs` gère les identités, voisinages et connaissances privées. `game.mjs` possède le cycle nuit/jour, actions, votes, réactions aux décès et victoire. `persistence.mjs` conserve le format de sauvegarde et l’export des résumés ; les conversions et écritures d’historique communes sont dans `utils.mjs`.

Chaque fichier reçoit l’état de la partie explicitement. Il n’y a pas de singleton de partie ; aucune information privée n’est ajoutée à la vue publique par le découpage.

`thiercelieux-architecture.test.js` protège la totalité de l’API, des collections et des corps des règles déplacées. Les 21 scénarios exécutés de `thiercelieux-engine.test.js` restent la référence fonctionnelle : tours de nuit, personnages spéciaux, votes, décès, annonces, confidentialité et aller-retour des sauvegardes.
