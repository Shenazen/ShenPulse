# Listes compactes des automatisations

Les actions, déclencheurs, automatisations avancées, alertes audio, voix et
règles Spotify partagent `src/renderer/app/core/automation-table.js`. La table
utilise les colonnes Nom, Déclencheur, Actions exécutées, Statut, Date et Actions.
La présentation commune est isolée dans `styles/automation-table.css` : fonds
sombres alternés, titres Orbitron chargés localement, badges colorés et icônes
SVG. Les timers gardent leurs colonnes métier avec le même habillage.

## Fonctionnement conservé

- Les boutons réutilisent les commandes et références existantes. Les menus
  conservent la suppression ; les scénarios à plusieurs actions gardent les
  outils de chaque action, avec ses identifiants et son index d'origine.
- Le statut active ou désactive la règle entière, comme auparavant. Il ne
  correspond pas à une activation individuelle d'une action du scénario.
- Les sons gardent volume, sortie locale/LIVE, écran de diffusion et tests.
  Les réglages sont repliables, mais jamais supprimés ou migrés.
- `triggerPill(rule, { compact: true })` réutilise la résolution canonique du
  cadeau et affiche son coût connu. Les conditions de valeur et seuils restent
  visibles ; aucun cadeau n'est remplacé d'après son seul nom.
- Une date absente reste « — » : aucune date de création n'est inventée.

## Tri et sélection sans effet LIVE

Le tri des noms, statuts et dates réordonne uniquement les lignes affichées. Il
ne modifie ni le profil ni l'ordre d'exécution. Les cases de sélection sont
indépendantes des statuts : cocher toute la liste ne réactive aucune règle. La
sélection est locale et disparaît lors d'une reconstruction de la liste.

Les écouteurs sont intégrés à la délégation de `core/events/content.js`. Le
composant n'ajoute pas de service, de timer, de chargement audio ou de requête
réseau. Les formatters Intl sont réutilisés. L'affichage d'un détail ou le tri
ne teste jamais une prise, un son, un jeu ou un overlay.

## Vérification

Les tests `automation-table.test.js`, `automation-audio-table.test.js` et ceux
de Voix et sons vérifient l'échappement HTML, les références, les droits, les
filtres, les cadeaux, les tris et la conservation des réglages. Les tests
d'interface utilisent uniquement des données locales et des API simulées.
