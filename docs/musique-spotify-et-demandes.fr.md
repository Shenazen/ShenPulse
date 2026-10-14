# Musique : Spotify et demandes des spectateurs

## Répartition du code

- `src/main/spotify-service.js` conserve la connexion OAuth PKCE, le coffre local,
  le renouvellement des jetons et l'API publique du service.
- `src/main/spotify/library-controls.js` traite la recherche, la lecture, les
  playlists et la file native Spotify avec des entrées validées.
- `src/main/spotify/song-requests.js` gère une file de demandes ShenPulse indépendante,
  les filtres, les commandes musicales et leur historique local.

L'IPC existant `spotify:control`/`api.controlSpotify` est conservé. Il est réservé à
la fenêtre principale authentifiée. Les actions Spotify existantes des règles
continuent à appeler directement le service ; les commandes `!song` configurées
par le créateur ne sont pas supprimées.

## Contrat d'interface

`getSpotifyStatus()` retourne appareils, lecture en cours, erreurs éventuelles,
scopes autorisés et `songRequests`. Les opérations supplémentaires sont :

| Opération | Entrée principale | Résultat |
| --- | --- | --- |
| `search` | `query`, `limit`, `offset` | `tracks`, `total` |
| `queue_list` | aucune | `queue`, `currentlyPlaying` |
| `playlists` | `limit`, `offset` | `playlists`, `total` |
| `playlist_tracks` | `playlistId`, pagination | `tracks`, `total` |
| `play_track`, `play_tracks` | `uri` ou `uris` | résultat de commande |
| `play_playlist` | `playlistId` | résultat de commande |
| `previous`, `volume`, `seek` | volume 0–100 / position en ms | résultat de commande |
| `requests_status` | aucune | configuration, demandes, historique |
| `requests_settings` | `settings` | configuration normalisée |
| `requests_add` | `query` ou `uri` | demande validée ajoutée |
| `requests_remove`, `requests_clear` | identifiant / aucune | file ShenPulse mise à jour |
| `requests_play_next`, `requests_skip` | aucune | lecture Spotify et file locale |

Les morceaux normalisés comportent `id`, `uri`, `name`, `artists`, `album`,
`imageUrl`, `durationMs`, `explicit` et `url`. Une demande contient `id`, `track`,
`user`, `requestedAt`. Le dernier résultat de commande comprend
`transport: "local-ui"` : ce résultat n'est pas envoyé automatiquement dans le chat.
Les notifications `song-requests-changed` ne sont envoyées qu'au compte authentifié
et portent son `ownerUid` local pour rejeter une réponse tardive après changement
de compte. Aucun UID de ce service n'est publié dans l'annuaire public.

## Deux files différentes, sans promesse trompeuse

La file **Spotify** est celle retournée par son API. ShenPulse peut la lire et y
ajouter un titre via l'action existante `queue`, mais l'API n'offre pas de commande
pour la vider ou retirer individuellement un titre déjà placé. La file **Demandes
ShenPulse** est une liste locale en attente ; la suppression/vidange ne touche pas
Spotify. « Jouer la prochaine demande » transmet le premier titre à Spotify, puis
le retire de la liste locale seulement après un succès. Si Spotify refuse, la
demande reste disponible. Il n'y a pas de passage automatique au titre suivant
par un polling caché du service.

## Commandes et garde-fous

Les demandes sont désactivées par défaut. Après activation explicite :
`!sr titre` propose un morceau, `!skip` passe au suivant pour les modérateurs
(ou pour tous seulement si l'option est activée), `!np` affiche le titre courant et
`!queue` résume les demandes dans ShenPulse. Les quatre commandes sont configurables
et doivent rester distinctes. Les résultats sont locaux : aucun bot de chat ni
envoi TikTok fictif n'est annoncé.

Valeurs par défaut : 20 demandes, 3 par spectateur, 10 secondes de délai, filtre
explicite actif, durée maximale 10 minutes, liste d'artistes bloqués. Les réglages
sont bornés ; la file ne dépasse jamais 50 éléments, l'historique 30 et les caches
de délais 1 000 identités. Les demandes concurrentes sont sérialisées pour éviter
de dépasser les quotas après une recherche lente. La configuration est revérifiée
après le réseau et avant la lecture ; un changement de compte annule le résultat.
Les événements locaux de test et les participants bloqués ne déclenchent pas ce
service. Son réseau ne bloque pas le pipeline des autres interactions du LIVE.

## Autorisations et limites Spotify

La lecture nécessite un appareil Spotify contrôlable et un abonnement Spotify
Premium. ShenPulse ne contient pas de moteur audio Spotify et ne contourne aucun
appareil restreint. Voir la [référence officielle de lecture](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback)
et la [référence des appareils](https://developer.spotify.com/documentation/web-api/reference/get-a-users-available-devices).

Les playlists privées/collaboratives demandent les scopes correspondants ; une
ancienne autorisation peut devoir être renouvelée manuellement par le créateur.
Le code utilise `/playlists/{id}/items` et une recherche limitée à dix résultats par
page. Les restrictions du mode Development, dont l'accès aux playlists possédées
ou collaboratives, sont appliquées par Spotify : un refus 403 est expliqué, jamais
contourné. Voir le [guide de migration 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
et les [playlists du compte](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists).

Les appels sont limités à 15 secondes. Les jetons sont renouvelés une seule fois
pour des requêtes concurrentes ; ils restent dans le coffre local. Une erreur 401
ne doit jamais afficher un état connecté fictif ; les refus 403 et les limites 429
restent visibles. Cette intégration ne donne aucun droit supplémentaire de diffusion
publique des morceaux : les droits musicaux et les règles de Spotify/plateforme
restent à vérifier pour le LIVE.

## Vérification

`spotify-service.test.js`, `spotify-library-controls.test.js` et
`song-requests.test.js` vérifient contrats, HTTP simulé, erreurs, filtres, limites,
concurrence, isolation des comptes et conservation des demandes en cas d'échec.
Aucun test de développement n'ouvre une connexion OAuth ni ne démarre une vraie
lecture musicale sur le PC.
