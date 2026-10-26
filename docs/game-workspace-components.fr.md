# Composants des pages de jeux

La page Supermarket est un adaptateur des composants communs. Pour un autre jeu, fournir ses données et ses capacités à ShenPulseGameWorkspace.createContext, puis appeler renderPage ; ne pas recopier le HTML ni le CSS du jeu.

## Découpage vérifié

| Partie | Composant commun | Données propres au jeu |
| --- | --- | --- |
| En-tête, titre, statistiques, installation, lancement | workspace/sections.js | hero, actions, état d’installation |
| Téléphone, caméra, image de jeu, modèles, couleurs, mouvement, URL | workspace/preview.js | preview, capacités de chaque modèle |
| Guide de préparation et bouton d’aide | workspace/sections.js | guide, tour.steps |
| Visite avec surbrillance, navigation et focus | workspace/tour.js | sélecteurs, textes et conditions de présence |
| Cartes, cadeaux, effets, paramètres, actions multiples, sons | workspace/interactions.js | pack.effects, rows, bindings et actions |
| Follow/Likes, seuils et lignes inactives | workspace/free-events.js | freeTypes, freeDefaults et règles |
| Catalogue, catégories, recherche et carte d’effet | workspace/catalog.js | effets et ui.catalog |
| Choix des cadeaux, studios, résultats et erreurs de popup | workspace/dialogs.js | données fournies par les contrôleurs |
| Wins et overlays optionnels, repliables ou non | workspace/sections.js | features.wins/overlays, cards, renderCard/renderBody |
| Conditions de jeu et touches | features/games/conditions.js | guide, type du connecteur et contrôles enregistrés |
| Connexion/session viewers et messages/progression | features/games/interactions.js et access.js | session, droits et progression du runtime |
| Mises à jour locales et conservation des iframes | workspace/updates.js | anciennes/nouvelles vues et portée du profil |
| Styles et adaptation à la largeur | styles/game-workspace.css | variables de présentation communes |

Les conditions, états de session et progressions sont déjà des composants utilisés par plusieurs jeux. Les adaptateurs les injectent par fragments ; les composants de présentation n’interrogent ni le runtime ni les IPC.

## Contrat de réutilisation

- pack conserve les vrais identifiants d’effets, paramètres et durées ; rows conserve les identifiants de règles et d’actions.
- actions et bindings relient la vue aux contrôleurs du jeu. classAliases sert uniquement à la compatibilité des contrôleurs historiques.
- features active les sections utiles. Les fournisseurs des wins/overlays ne sont jamais appelés si leur section est désactivée.
- sectionOrder règle l’ordre des sections. La visite guidée se place dans l’en-tête ; ses cibles absentes sont ignorées.
- Les labels sont échappés. Les callbacks de fragments et de cartes fournissent uniquement du HTML de confiance produit par le renderer.
- Les écritures, droits, sauvegardes, associations cadeaux/actions et gardes asynchrones restent dans les contrôleurs et le processus principal. Ce ne sont pas des responsabilités des composants visuels.

## Optimisations

Le contexte possède un index des effets et un cache de listes d’options limités au rendu courant. Aucune donnée d’un compte ou profil n’est gardée dans un cache global.

Un catalogue fermé ne crée ni cartes ni images. À l’ouverture, le contrôleur synchronise son état et appelle populateCatalog(ctx, details). Au repli, la même fonction libère les cartes ; recherche et catégorie restent dans ui.catalog. La recherche et les catégories actualisent uniquement leurs résultats et conservent le champ de recherche monté.

Le renderer utilise patchPage(content, ancienneVue, nouvelleVue) pour mettre à jour les composants modifiés. Les autres cartes, les brouillons actifs et les iframes inchangées restent montés. Un autre compte, profil, jeu, une nouvelle source iframe ou une structure incompatible impose le rendu normal. Le plan est validé avant toute mutation. Les pages sans workspace ne sont pas analysées.

## Vérifications

Les tests couvrent une seconde page de jeu indépendante, deux instances, les sections optionnelles, la consultation seule, les caractères malveillants, les fenêtres réduites, le focus, les filtres, la persistance par IPC et les réponses asynchrones obsolètes.

Mesure locale indicative sur 12 interactions par défaut : HTML initial de 163 658 à 130 535 octets ; éléments DOM de 1 584 à 1 229 ; cartes du catalogue replié de 42 à 0. La durée de génération de cette vue est passée d’environ 3,81 à 2,08 ms dans cette mesure. Ce n’est pas une garantie de temps d’ouverture de l’application.


## Portée du choix de cadeaux

Le composant GiftBrowser accepte des groupes de cadeaux et de variantes, un sous-ensemble régional/LIVE, ses identifiants, une portée (live, standard ou inconnue), les références déjà utilisées et le nombre de résultats visibles. Les cadeaux du LIVE ne sont pris en compte que pour le créateur et la salle courants. Une réponse complète vide ne provoque jamais de substitution silencieuse par le catalogue mondial.

La case « Afficher tous les cadeaux » élargit explicitement la portée. Recherche et filtres de prix conservent ce choix. Le compteur indique le nombre de groupes correspondant à la portée et aux filtres ; les résultats supplémentaires sont affichés par lots de 60. Les variantes gardent leurs identifiants et restent sélectionnables dans un détail repliable : un dessin semblable ne fusionne jamais leurs règles ou leurs alias.

Hors liste TikTok vérifiée, le catalogue standard embarqué reste visible avec une indication explicite ; il n’est pas présenté comme une preuve de disponibilité en France. Une réponse de salle actualise la fenêtre déjà ouverte sans effacer la recherche. Les changements de compte, profil, créateur, salle ou session de dialogue invalident les réponses précédentes. Le rafraîchissement ne lance pas de nouvelle recherche réseau à chaque filtre.
