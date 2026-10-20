# Illustrations des interactions

Le catalogue contient 1 850 interactions. L’ajout du 20 octobre 2026 complète les 737 interactions sans image, réparties sur 20 jeux. Les visuels déjà présents sont conservés, dont les 97 images distantes vérifiées lors de la qualification locale.

Les nouvelles illustrations sont produites avec l’outil `image_gen` intégré. Après les huit premiers visuels individuels de Crash, l’utilisateur a choisi des planches par jeu, découpées en images individuelles. Chaque case possède une action, une direction artistique liée au jeu et une position précise. Les 31 planches retenues complètent les 729 images restantes. Les PNG finaux mesurent 256 × 256 pixels pour des cartes affichées à 78 × 78 pixels. Le découpage retire une fine marge pour éviter les séparations entre cases.

Deux planches Mario Kart ont été refusées automatiquement. Leurs 51 actions ont finalement été illustrées par des karts, couleurs, accessoires et objets de course originaux dans le style rétro, plutôt que des portraits de personnages. Les prompts de ces trois planches de remplacement figurent au registre.

Les fichiers sont livrés dans `resources/game-interaction-art/<gameId>/<effectId>.png`. Le registre `resources/catalogs/game-interaction-art.json` conserve les associations, empreintes SHA-256, prompts de génération et coordonnées de découpe. Aucun appel réseau ou générateur n’est nécessaire à l’affichage de ces nouveaux visuels.

`src/main/game-catalog/interaction-art.js` enrichit le catalogue commun, sans changer les identifiants, codes, paramètres, disponibilités ou règles. Les cartes, la bibliothèque de sélection, l’éditeur et les exports d’overlays utilisent ainsi la même image. Un visuel existant reste prioritaire ; les chemins incorrects ou fichiers absents ne sont pas exposés par le résolveur.

Préparation des prompts, sans appel API :

```powershell
node scripts/game-interaction-art-plan.js .tmp/interaction-art-plan.json
node scripts/game-interaction-art-plan.js .tmp/interaction-art-sheets.json --sheets
```

La génération elle-même utilise l’outil intégré. Une fois les planches relues, leur import reçoit un JSON de la forme `[{"id":"<identifiant de planche>","source":"<PNG généré>"}]` :

```powershell
node scripts/import-interaction-art-sheets.js .tmp/generated-sheet-results.json
node --test tests/interaction-art.test.js
```

L’outil C# `scripts/interaction-art-thumbnail.cs` effectue uniquement le découpage et le redimensionnement, sans modifier le contenu dessiné. Les traitements intermédiaires passent par le dossier temporaire Windows ; Node copie ensuite les images dans le projet. L’import refuse de remplacer un fichier existant. Les prompts réellement utilisés sont ceux du registre, qui peut différer des modèles de préparation affinés ultérieurement.

Les contrôles vérifient la couverture de toutes les interactions, les 737 fichiers, leurs dimensions, signatures et empreintes, l’absence d’images identiques ou de cases vides, les coordonnées de découpage, la préservation du catalogue historique et le chargement des PNG dans Electron, y compris depuis le paquet ASAR.
