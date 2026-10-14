# Relais Matchs temps réel

Le lecteur et les widgets Matchs utilisent exclusivement leur alias HTTPS
dédié. Les données de score ne transitent pas par le canal des autres overlays.

## Retard dans l'application

Le moteur Match mettait bien son état à jour, mais le snapshot runtime envoyé
au renderer omettait `matchSession`. Le tableau de bord attendait ainsi une
autre actualisation complète de l'application pour afficher les données, ce
qui pouvait sembler être un retard de trente secondes. `core.runtimeSnapshot`
inclut désormais cet état. Il ne s'agit pas d'un polling TikTok à trente secondes
et aucun score n'est recalculé ou inventé pour masquer des données manquantes.

## Files indépendantes

`src/main/relay/match-publication.js` possède une file indépendante du relais
général. Les changements rapprochés sont regroupés pendant **8 ms**. Une seule
requête Match est en vol ; pendant celle-ci, seul le dernier état est conservé.
Une requête lente de chat, de chronomètre ou d'un autre overlay ne bloque donc
pas la publication d'un score ou d'une animation Match. Le réseau, Firebase et
la cadence des événements réellement envoyés par TikTok restent déterminants :
ce délai local ne constitue pas une garantie de latence bout en bout.

Les écritures du canal Match, ses heartbeats, sa fermeture et sa rotation sont
sérialisés entre eux. Une écriture ancienne ne peut pas remplacer un état plus
récent du même canal. Le relais général conserve sa sérialisation antérieure.

## Effets ciblés

L'alias publie `lastBatch`, contenant un identifiant de lot, une séquence, sa
date de création et des messages datés. Seuls `match`, `match-media` et
`match-audio` y sont admis. Les messages génériques restent dans leur canal
habituel. L'état des widgets et le lot d'effets sont écrits atomiquement.

La file est limitée à 1 000 messages, par lots de 250 ; les identifiants de
lecture sont dédupliqués. Un effet vieux de plus de 15 secondes n'est plus
publié. Le lecteur n'exécute pas le lot déjà présent à son ouverture : recharger
une source ne doit pas relancer une animation du match précédent.

## Permissions et médias

Chaque effet est attaché au compte, au profil et à la room LIVE actifs lors de son émission,
sans exposer leurs identifiants internes. Le contexte et les permissions sont
relus après l'authentification et après une éventuelle reprise HTTP 401.
Un changement de profil ou de LIVE, une déconnexion de compte ou une révocation Pro
annulent les effets en attente. L'arrêt et la rotation annulent les requêtes
concernées avant de publier le nouvel état ou de retirer l'ancien canal.

`matchSource.contextId` est un hash SHA-256 opaque des trois identifiants de
contexte. Un lot d'effets porte le même `contextId` ; le lecteur peut ainsi
arrêter une lecture d'une autre room ou d'un autre profil sans recevoir leurs
identifiants bruts. Un lot du contexte précédent n'est jamais rejoué, même si
les scores et les permissions sont identiques après le changement de LIVE.

`src/main/relay/match-messages.js` ne conserve que les champs utiles à la
lecture. Les URL locales des ressources embarquées deviennent des URL HTTPS
du dossier `/media/` de l'hôte public, sans jeton local. Cette conversion ne
téléverse aucun fichier personnalisé : celui-ci doit déjà être disponible
publiquement via un mécanisme explicitement autorisé avant de fonctionner dans
une source hébergée. Les uploads Backblaze existants restent autorisés via la
base publique B2/CDN configurée et les URL HTTPS choisies dans la bibliothèque
ou une automatisation enregistrée. Les paramètres nécessaires aux liens signés
externes sont conservés, sans jamais être journalisés. Les credentials d'URL,
IP, loopbacks et noms locaux sont refusés. Une sélection non autorisée retourne
une erreur sans son URL, au lieu d'annoncer une lecture réussie silencieusement.

## Vérifications

`tests/public-overlay-match-latency.test.js` vérifie notamment l'indépendance
face à une requête générale bloquée, la coalescence, l'ordre des messages,
les doublons, les effets expirés, les changements de profil, les révocations,
la reprise d'authentification, l'arrêt et la rotation. Ces tests n'ouvrent aucun
LIVE et ne déclenchent aucun effet sur le compte utilisateur.
