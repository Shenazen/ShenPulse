# ARK: Survival Ascended

Intégration du 21 octobre 2026. Le [pack officiel Crowd Control](https://open-api.crowdcontrol.live/games/ARKSurvivalAscended/packs)
contient **29 Input Disrupts**, exécutés par commandes clavier et souris dans
`ArkAscended.exe`. Le [guide officiel](https://crowdcontrol.live/guides/disrupts)
décrit leur fonctionnement. Ce pack ne contient pas d’effets natifs de météo,
ressources ou apparition de dinosaures.

Les séquences officielles sont conservées dans
`resources/catalogs/ark-survival-ascended-effects.json`. Les libellés français,
les descriptions précises et les illustrations réutilisées sont dans
`src/main/game-catalog/ark-survival-ascended.js`.

Le parcours propose :

1. Détection Steam (2399830) ou XboxGames, validation de l’exécutable et mémorisation du dossier. Aucun fichier du jeu ou de sauvegarde n’est modifié.
2. Choix WASD ou ZQSD pour les déplacements. Les autres touches restent celles du pack officiel et doivent correspondre aux raccourcis configurés dans le jeu.
3. Association facultative des cadeaux et autres déclencheurs. Aucun cadeau n’est associé automatiquement.
4. Deux formats de fiches d’overlay liés aux cadeaux actifs, puis lancement du jeu et activation de la session.

Sur Game Pass, le lancement utilise `gamelaunchhelper.exe` pour conserver
l’identité Xbox du jeu ; l’exécutable GDK n’est pas ouvert directement.
La fenêtre du jeu est attendue avant de continuer. Un lanceur manquant provoque
une erreur explicite. Sur Steam, le lancement cible l’exécutable Win64.
L’édition Steam est préparée mais n’a pas été essayée sur ce PC.

Le connecteur Windows commun place la fenêtre reconnue au premier plan,
sérialise les séquences et relâche les touches et boutons maintenus. Le nom du
processus ne peut pas être redirigé depuis un réglage de connexion. Les touches
numériques de la barre sont envoyées par code physique pour fonctionner aussi
sur un clavier AZERTY sans imposer Maj.

Les actions d’arme, accessoire, conteneur, créature et corps nécessitent la
situation correspondante. Les objets consommables de la barre peuvent être
utilisés. Fermer les menus et le chat avant les essais.

## Vérifications

- Détection réelle de `C:\XboxGames\ARK- Survival Ascended\Content` et lancement Game Pass, version GDK 1.94.34.0.
- Confirmation utilisateur en partie : saut, accroupissement et retour debout, ouverture/fermeture d’inventaire et de carte, puis avance, recul, gauche et droite en ZQSD.
- Les 29 séquences traversent le hub et le transport normalisé dans les tests ; les touches et boutons sont équilibrés. Les 29 effets n’ont pas tous été vérifiés visuellement dans chaque contexte d’équipement.
- Tests de préparation sans déploiement, lancement Xbox, lanceur absent, préservation des associations et révocation des accès.
- 12 rendus Chromium des étapes Installation, Overlays et Démarrage entre 400 et 1440 pixels, sans débordement.

Exécuter `node --test tests/ark-survival-ascended.test.js` pour les tests ciblés.
`scripts/verify-ark-configuration.js` s’exécute dans Electron avec un profil
temporaire et ne modifie pas la configuration réelle.

Cities: Skylines est laissé inchangé à la demande de l’utilisateur, qui ne
possède pas Natural Disasters. Le [module officiel](https://crowdcontrol.live/guides/citiesskylines/)
exige ce DLC.
