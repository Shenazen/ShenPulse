# Refonte des espaces créateur ShenPulse

## Navigation et présentation

Le catalogue Jeux est l’unique entrée pour les jeux communautaires et les
intégrations PC. L’onglet Studio Live et son rendu redondant sont supprimés ;
les anciens liens `studio` redirigent vers `games`, sans démarrer de jeu.
La galerie de jeux est retirée de l’accueil lors des retouches suivantes ; les
raccourcis restent disponibles et le catalogue complet demeure dans Jeux.
Voir [Retouches visuelles](retouches-visuelles.fr.md).

Un seul simulateur est présent, dans le tableau de bord. Ses sept événements,
les champs du viewer test, la sélection de cadeau et les raccourcis de prévisualisation
restent disponibles. Un ancien raccourci Actions → Simulateur ouvre le dashboard.
Les règles, profils, déclencheurs et actions enregistrés ne sont pas supprimés.

Les automatisations avancées sont conservées : elles combinent conditions et
actions, contrairement à l’onglet IRL consacré aux appareils connectés.
Overlays affiche les widgets individuels, sans le panneau de composition de scène.
Les anciennes configurations et URL de scènes restent compatibles pour les
sources déjà ajoutées dans OBS ou TikTok LIVE Studio.

## Carte Pro et typographie

La promotion est dans le défilement de la navigation, pas au-dessus du menu.
`creator-sidebar.js` rend une couronne SVG, les textes de promotion, la citation
et la signature manuscrite ShenPulse. Le bouton ouvre la popup d’offres ; il
ne souscrit jamais à un abonnement automatiquement. Le même helper de statut
que la barre supérieure masque la carte pour les abonnements actifs ou offerts,
mais la conserve pendant un essai gratuit. La visibilité de la page Abonnement
est respectée.

La police d’affichage Orbitron est distribuée localement (38 576 octets), avec
sa licence OFL. Elle cible les chiffres du dashboard et le titre Song Requests,
sans téléchargement distant au démarrage. Le reste de l’interface garde sa police
lisible. Source : dépôt officiel Google Fonts `ofl/orbitron`.

## Données et conservation

Le bilan du LIVE et la base cumulative Utilisateurs sont deux domaines distincts.
Les chiffres d’audience ne sont jamais déduits des spectateurs uniques ; une
valeur indisponible reste indiquée par un tiret. Aucun revenu net EUR n’est
inventé à partir des diamants. Le simulateur ne gonfle pas les chiffres du LIVE.

La base Utilisateurs commence à collecter avec cette mise à jour. Les données
qui n’étaient pas collectées auparavant ne peuvent pas être reconstituées.
Les suppressions proposées dans la nouvelle interface demandent une confirmation ;
les tests ne les exécutent que sur des données temporaires.

Pour les contrats, limites et tests de chaque domaine :

- [Tableau de bord et statistiques](tableau-de-bord-et-statistiques.fr.md).
- [Base privée Utilisateurs](base-utilisateurs.md).
- [Interface Utilisateurs et Musique](interface-utilisateurs-et-musique.fr.md).
- [Spotify et demandes musicales](musique-spotify-et-demandes.fr.md).
- [Identité des cadeaux](catalogue-cadeaux.md).

## Optimisations de cette évolution

Les graphiques utilisent du SVG sans bibliothèque supplémentaire. Les courbes
restent bornées à 120 points. L’interface reçoit cinq donateurs au lieu de recopier
tous les participants ; l’historique complet reste accessible via l’API paginée.
Les changements d’audience seuls rafraîchissent le dashboard, pas les formulaires
des autres pages. Le simulateur conserve son champ actif et ses valeurs.

Le lecteur Spotify est externe : aucune iframe ni lecteur audio supplémentaire.
Son statut est actualisé toutes les cinq secondes uniquement si le lecteur Music
est visible et connecté. Les recherches et playlists sont demandées à la demande,
sans interrogations répétées en arrière-plan. Les requêtes musicales ne bloquent
pas les interactions des jeux, des actions ou de la voix.

La réduction de taille d’un snapshot n’est pas une mesure de RAM globale.
Les tests de performance utilisent des états synthétiques et du réseau simulé.
Les appareils IRL, paiements et autorisations Spotify réels ne sont pas déclenchés
pendant la validation. Cette évolution est locale : aucun déploiement de production.

## Validation locale du 13 octobre 2026

- `npm run verify` : 1 097 tests réussis, zéro échec, aucun test ignoré.
- Lint : 541 fichiers JavaScript et 850 sources examinés, sans cycle d’import.
- `npm run build:dir` : application Windows locale reconstruite avec succès.
- Dix fichiers critiques du package ASAR sont comparés aux sources, octet pour
  octet : index, gardes de compte, vues, routeur, Spotify, catalogue et police.
- ShenPulse est relancé ; le LIVE TikTok se reconnecte. L’accueil, les cinq
  métriques du dashboard et la base Utilisateurs sont observés dans l’application.
  Le menu ne propose plus Studio Live et conserve les 21 actions du profil actif.

Les modifications de comptes, suppressions, fusions et connexions Spotify sont
validées sur des données temporaires et des réponses simulées, pas sur les données
réelles du créateur. Aucun bouton de simulation susceptible de commander un
appareil IRL n’est exécuté lors du contrôle visuel. La documentation précise les
limites de l’import tiers et de la file musicale ; la compilation ne signifie pas
que chaque périphérique ou service externe a été testé en conditions réelles.
