# Interfaces Utilisateurs et Musique

## Organisation

Les pages sont des vues indépendantes : `features/creator-users.js` traite
l'historique d'audience et `features/creator-music.js` les Song Requests. La page
Voix conserve ses règles audio dans `creator-voice.js` ; elle n'embarque plus le
rendu de la page Musique. Les mutations et confirmations sont isolées dans
`actions/handlers/creator-audience.js` et `creator-music.js`. Leurs styles sont
scopés dans `styles/creator-audience.css` et `creator-music.css`.

Les composants de rang, identité/photo, métrique, liste de morceaux, couverture,
état vide, commande et interrupteur sont partagés entre les vues qui en ont
besoin. `src/shared/viewer-ranks.js` est le contrat unique entre le service
d'audience et l'interface. Les libellés se traduisent dans `studio-language.js` ;
les noms de viewers, appareils, artistes, morceaux et playlists ne se traduisent
pas.

## Utilisateurs : historique réel, rendu borné

La base est privée, cumulative sur les LIVE de chaque streamer et séparée du
résumé du tableau de bord. La collecte débute avec cette version ; aucun ancien
historique non identifiable n'est inventé. Voir [le contrat du service](base-utilisateurs.md)
pour l'isolation des comptes, les identités, la modération et la persistance.

L'interface charge 50 lignes par défaut (choix 50, 100 ou 200) et filtre côté
service : recherche, streamer, rang, tri et ordre. Les interactions LIVE ne
reconstruisent pas la table à chaque événement ; elles déclenchent au plus une
lecture par seconde tant que la page est visible. Seule une réponse fraîche
repeint les lignes et les trois indicateurs. Les filtres, la recherche et la
saisie de la liste de blocage conservent leur focus et leurs valeurs non sauvées.

Une suppression, le nettoyage des fiches à zéro contribution, la vidange et la
fusion demandent confirmation. Import/export utilisent uniquement le format
JSON natif `shenpulse-viewers` ; l'interface limite le fichier choisi à 10 Mo
(le service accepte jusqu'à 20 Mo). Aucun import TikFinity n'est simulé : il faut
un échantillon de format validé avant d'ajouter un adaptateur. La fusion reste
manuelle et limitée aux doublons du même utilisateur, streamer et plateforme.

Les onze rangs sont des paliers de contribution **propres à ShenPulse**, pas des
rangs officiels TikTok ou Kick, et n'accordent aucun droit supplémentaire :

| Rang | Contribution cumulée minimale |
| --- | ---: |
| Nouveau | 0 |
| Fan | 1 |
| Supporter | 10 |
| Actif | 50 |
| Fidèle | 100 |
| VIP | 500 |
| Légende | 1 000 |
| Mythique | 5 000 |
| Divin | 10 000 |
| Cosmique | 50 000 |
| Immortel | 100 000 |

Le rang dominant est le rang le plus représenté dans la portée sélectionnée,
avec priorité au palier supérieur en cas d'égalité. La base vide affiche « — ».
Le champ de valeur native est intitulé Diamants pour homogénéité visuelle ; il
n'est pas une conversion en euros. Une dernière activité ne prouve pas que le
spectateur est encore présent.

Un repli existe pour les anciens preloads sans `api.users`. Il n'affiche que
les participants observables de la session et ne prétend pas reconstruire la
base cumulative. Un résumé runtime projeté ne contenant que cinq donateurs
n'est jamais considéré comme l'audience complète dans ce repli.

## Musique : commandes explicites, aucune lecture cachée

La page comprend Lecteur, File d'attente, Rechercher, Mes playlists et Paramètres.
Elle conserve les règles Spotify déjà créées dans un panneau repliable. Les
requêtes de bibliothèque sont à la demande, sans réinterrogation périodique des
playlists ou recherches. La recherche charge au maximum dix titres ; playlists
et contenu de playlist chargent les cinquante premiers résultats disponibles.

Le lecteur seul actualise le statut Spotify toutes les cinq secondes lorsque
sa page et son onglet sont visibles, la fenêtre est active et Spotify connecté.
Il n'y a qu'un appel en vol ; quitter la vue ou cacher la fenêtre annule le
timer. Le volume et la position ne sont envoyés qu'après validation du geste
(`change`), pas à chaque déplacement du curseur. Aucun moteur audio local,
OAuth automatique ou démarrage automatique de lecture n'est ajouté.

La file de demandes ShenPulse est locale et distincte de la file native Spotify.
« Vider les demandes ShenPulse » ne vide pas Spotify et ne coupe pas le titre
en lecture. La lecture de la prochaine demande reste une commande explicite.
La recherche, l'ouverture d'une playlist et l'actualisation ne jouent aucun titre.
Les réglages sont bornés comme le service : 1–50 demandes, 1–10 par viewer,
0–3 600 secondes de délai, 1–120 minutes de durée maximum. Les quatre commandes
commencent par `!` et restent distinctes ; les réponses sont visibles localement,
sans promesse d'envoi automatique au chat. Les saisies de paramètres et de
recherche sont conservées lors d'une notification.

Voir [les contrats Spotify et Song Requests](musique-spotify-et-demandes.fr.md)
pour les droits Premium, appareils, scopes, filtres, artistes bloqués, limitations
de l'API et règles de diffusion.

## Isolation des opérations asynchrones

`core/account-operation-guard.js` attache les commandes à l'UID du compte et à
une génération de session d'interface. Le logout invalide cette génération,
vide immédiatement le statut Spotify et les caches Users/Music. Une reconnexion
au même UID ne réactive pas les anciennes opérations. Après une confirmation,
une lecture de fichier ou une requête réseau, les gardes sont revérifiées avant
mutation, téléchargement ou insertion de données dans la vue.

Les lectures paginées possèdent également un compteur de requête : une réponse
ancienne ne remplace jamais une recherche plus récente. Les notifications
musicales vérifient leur `ownerUid`. Les snapshots généraux n'incluent ni la base
utilisateurs complète ni les secrets OAuth.

## Vérification

`tests/creator-users-music.test.js` vérifie compteurs réels, exclusions des tests,
pagination, focus, refus de suppressions, absence de lecture implicite, files
distinctes, limites, polling visible seulement, rafales sans reconstruction et
changement de compte pendant une confirmation, un import ou une requête.
`creator-studio.test.js` et `creator-navigation.test.js` couvrent la compatibilité,
les droits, les traductions et la navigation. Ces tests utilisent des réponses
simulées : aucune connexion OAuth réelle, musique jouée ou donnée utilisateur
réelle supprimée n'est nécessaire à leur exécution.
