# Interface Matchs

L’espace Matchs appartient au compte ShenPulse et au profil actif. Il requiert
un accès Pro, Premium, un essai Pro actif ou un accès Pro offert actif. Il ne
connecte pas TikTok et ne déclenche aucune action lors du rendu.

## Organisation

- `creator-matches.js` affiche le tableau de bord et réconcilie les scores et
  contributions sans recréer les avatars, la bannière ou les onglets.
- `matches/widgets.js` affiche sept widgets et les huit animations existantes.
  Il réutilise les sources protégées fournies par le processus principal ; il
  ne fabrique jamais de lien quand une source n’est pas disponible.
- `matches/editor.js` utilise les formulaires, bibliothèques de médias et de
  sons déjà présents dans ShenPulse.
- `matches/reactions.js` partage les sorties des cartes et les éditeurs
  spécialisés. Ajouter un son ou une vidéo conserve l’animation et l’action
  éventuellement déjà liées ; le rendu n’exécute aucune sortie.
- `actions/handlers/creator-matches.js` contient uniquement les commandes
  explicites de l’interface : configuration, copie, confirmation et test.
- `creator-matches.css` est le module de présentation, avec adaptations aux
  écrans étroits et réduction des mouvements.

Les posters d'animations réutilisés du catalogue sont des images positionnées
absolument. Dans Matchs, chaque miniature possède maintenant un contenant
local de 130 pixels, avec confinement de géométrie/peinture et débordement
masqué. Le décor ne capte aucun clic. Le poster du mage ne peut donc plus
couvrir les widgets, les onglets ou leurs boutons. Le lecteur d'animation réel
reste distinct de ces miniatures ; aucun effet n'est joué pendant le rendu.

Le tableau de bord indique si le LIVE est déconnecté, si la détection attend
une manche, ou si un match a été reçu. Une session manuelle ou un WebSocket
générique ne prouvent pas une connexion TikTok. Ce diagnostic est actualisé
en place lorsque la connexion change, sans reconstruire la bannière ou les
onglets. Les automatisations ne sont pas nécessaires à la détection.

Les patches runtime actualisent aussi les sept aperçus HTML des widgets. Seul
leur contenu visuel est rapproché du nouvel état ; les boutons, leur focus,
les posters, la bannière et les onglets restent en place. Le classement utilise
des lignes identifiées et réordonne au plus quatre participants sans recharger
leurs photos inchangées. Une modification des réglages ou du lien public peut
reconstruire le panneau ; les scores seuls ne le font pas. Aucun iframe, son ou
lecteur vidéo n’est créé pour actualiser ces aperçus.

Les automatisations ont une signature distincte, fondée sur leur configuration
et la disponibilité des cartes. Une rafale de scores ne remonte donc pas leurs
cartes et ne ferme pas un sélecteur en cours d’utilisation.

## Données et compteurs

Le tableau de bord affiche les participants et scores réellement reçus de
TikTok. Les contributions du LIVE proviennent de `matchSession.liveContributors`
et peuvent être reçues hors bataille. Aucun utilisateur, cadeau ou score
d’exemple n’est ajouté à l’annuaire du compte.

Le compteur de manches d’une paire identifiée utilise `rounds.own/opponent`.
En dehors d’une paire, il peut utiliser le compteur manuel. Le bouton Corriger
ne réécrit pas l’historique ni les statistiques des victoires confirmées.
Les statistiques de session restent distinctes de ce compteur manuel.

Le médaillon « Dernier donateur » utilise la dernière contribution effectivement
reçue ; le classement et le plus gros donateur utilisent les cumuls du LIVE.
Les sources locales nécessitent que ShenPulse reste ouvert et autorisé.

## Automatisations

Onze moments sont proposés : début, bonus ×2, bonus ×3, carte, passage devant,
remontée, égalité dans la dernière minute, rafale de tapotages, dernières
secondes, victoire et défaite. Chaque effet peut être une animation existante,
un média personnel, un son ou une action enregistrée.

Les cartes sont organisées en quatre colonnes sur un écran large, puis deux
ou une colonne sur un écran étroit. Les moments « Pendant le match » et
« Après le match » sont séparés. Le bonus ×2 / ×3 partage une carte visuelle
mais conserve deux automatisations et deux événements TikTok distincts.
Les configurations supplémentaires du même moment ne sont pas perdues.
La carte des bonus conserve deux choix d’animation et une paire de tuiles
vidéo/son. Leur éditeur propose d’appliquer la sortie au bonus ×2, ×3 ou aux
deux, sans modifier leurs autres sorties ni les activer automatiquement.

Un groupe de sorties (`reaction.type = "bundle"`) accepte au plus une animation,
un média, un son et une action. Les anciennes réactions uniques restent
compatibles. Retirer la dernière sortie conserve un brouillon désactivé ; une
carte vide ne peut ni être activée ni être testée. Le sélecteur d’animation
modifie seulement l’animation. Les tuiles vidéo et son ouvrent les bibliothèques
existantes, avec enregistrement explicite. Aucun changement de sélection ne
joue l’effet. Les actions liées et leurs autorisations restent disponibles dans
les réglages avancés.

Les nouveaux sons ont pour sortie initiale la source Match du LIVE. Un ancien
son configuré en lecture locale conserve ce choix. Le même lien protégé Match
sert aux animations, vidéos et sons LIVE ; les autres sources audio et écrans
média de ShenPulse ne sont pas requis pour ces sorties de match.

Les automatisations sont désactivées par défaut. Enregistrer une configuration
ne teste jamais l’effet. Le bouton Tester demande une confirmation explicite
car il joue réellement le son, l’animation ou l’action configurés ; il ne crée
pas de faux événement TikTok et ne modifie pas les scores du match.

La connexion TikTok actuelle ne fournit pas la détection automatique des cartes.
L’interface l’indique et empêche leur activation automatique. Leur configuration
et un test manuel explicite restent possibles.

## Isolation et vérification

Chaque formulaire capture le compte et le profil de départ. Les requêtes
transmettent ce périmètre au backend et une réponse tardive n’est jamais
appliquée après un changement de compte, de profil ou d’accès Pro.
Le modèle privilégie toujours l’état courant, même après une remise à zéro
dont l’horodatage serait nul.

`tests/creator-matches.test.js` vérifie le rendu sans effet, les sept widgets,
les onze moments, les cartes indisponibles, les bibliothèques réutilisées,
les confirmations de test, l’échappement des noms et les changements de périmètre.
Tous ces tests utilisent des données et services artificiels, sans paiement,
message envoyé, action de jeu, lecture Spotify ou prise réelle.
`tests/renderer-performance-visibility.test.js` exerce également le vrai
gestionnaire `runtime-state-changed` de l’application : scores, manches et
donateurs atteignent leur affichage sans reconstruction complète ni effet.
