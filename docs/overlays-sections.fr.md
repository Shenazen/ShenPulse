# Présentation des catégories d'overlays

## Titres et séparateurs

Le catalogue utilise un cadre néon autour du titre de chaque catégorie et un
ornement de fin après chaque grille. La catégorie « Compteurs » garde son filtre
historique ; son titre de section devient « Objectifs & compteurs ».

Le composant `renderOverlayCategorySection`, dans
`src/renderer/app/features/overlays/cards.js`, assemble une seule fois :

1. le cadre décoratif et un titre HTML `h3` ;
2. le guide des Matchs, uniquement pour cette catégorie ;
3. les cartes existantes, avec leurs droits et commandes inchangés ;
4. le séparateur décoratif de fin.

Les deux images locales réutilisées sont
`assets/studio/overlay-section-frame.webp` et
`assets/studio/overlay-section-divider.webp`. Le texte n'est pas incrusté dans
les images : il reste sélectionnable, accessible et traduisible. Les images ont
un attribut `alt` vide et sont ignorées par les lecteurs d'écran. Le nombre
d'overlays reste annoncé dans le titre mais est visuellement masqué pour garder
le cadre épuré.

Les deux fichiers sont les ressources WebP natives et transparentes, sans
conversion ni génération d'une imitation : cadre de 1 600 × 307 px (111 960
octets) et séparateur de 1 600 × 228 px (79 500 octets). Ils ne contiennent aucun
logo ni texte. Leur poids total reste inférieur à 200 ko.

## Performances et compatibilité

Les ornements sont réutilisés par catégorie, jamais par carte. Le navigateur
charge chaque ressource locale une seule fois grâce à son cache ; les séparateurs
utilisent aussi le chargement différé natif. Aucune animation, source OBS, iframe,
requête distante, dépendance ou minuterie n'est ajoutée. Les dimensions des
images sont réservées avant leur chargement et les styles de
`src/renderer/styles/creator-overlays.css` adaptent les cadres aux petits écrans.

Les filtres de catégorie, la recherche dans les noms/descriptions/designs, les
accès administratifs, les restrictions Pro et les aperçus invités conservent
leur logique. Une section sans résultat n'affiche ni cadre ni séparateur.

## Tests

`tests/overlay-catalog-sections.test.js` exécute les vrais composants de page,
de section et de carte dans un DOM isolé. Il couvre l'ordre des catégories et
des ornements, la séparation texte/image, l'accessibilité, le filtrage, la
recherche, les états vides, les restrictions Pro, les accès masqués, le mode
invité et l'échappement des titres. Aucune donnée du compte n'est modifiée.
Le nouveau titre est traduit en anglais et retrouve son texte français lors du
retour FR/EN, sans modifier les ressources ni les contenus privés des utilisateurs.
`tests/studio-assets.test.js` contrôle séparément le budget des neuf illustrations
existantes et celui des deux ornements, ainsi que leurs dimensions, leur canal
alpha et l'absence d'animation WebP.

La version locale reconstruite a été relancée le 13 octobre 2026. Le cadre
« Objectifs & compteurs », son titre distinct et l'aperçu Like Goal ont été
contrôlés dans la fenêtre ShenPulse. Les séparateurs et l'ordre de toutes les
sections sont couverts par les tests DOM ; aucun réglage ou bouton de test
LIVE n'a été activé pendant cette vérification visuelle.
