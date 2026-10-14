# Connect Four

La page Vue orchestre la partie et la présentation. `models.ts` décrit ses données, `board-engine.ts` contient les règles et les deux IA, et `sound.ts` possède le contexte audio. Les références de dimensions et de plateau sont injectées : le moteur ne dépend pas de Vue et continue de suivre les réglages en cours.

Les quatre directions sont communes aux recherches de victoire et aux évaluations. Les coordonnées des fenêtres d’évaluation sont calculées une seule fois pour une taille/longueur de victoire donnée, au lieu d’être reconstruites à chaque branche minimax. Seules les valeurs du plateau sont relues ; un changement de dimensions invalide le cache et aucun ancien plateau n’est conservé.

Les choix d’IA, priorités victoire/blocage, profondeur et délais restent inchangés. `tests/connect-four-architecture.test.js` compare des scénarios capturés avant l’extraction, avec une source aléatoire fixée. La sortie de page ferme désormais le contexte audio, en plus des minuteurs et écouteurs existants.

`tests/original-game-vue-setup.test.js` exécute le véritable script Vue, ses imports, son montage et ses événements de partie jusqu’à une victoire verticale. L’horloge contrôlée vérifie les déverrouillages de 260 ms ; le démontage retire les écouteurs et les minuteurs de jeu.
