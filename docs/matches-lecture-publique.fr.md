# Lecture publique des effets de Matchs

## Une source dédiée

Le lecteur d'animations est l'URL HTTPS Matchs sans paramètre `widget`.
Les compteurs utilisent le même alias avec leur paramètre `widget` et ne lisent
aucun son ni animation. Le lecteur s'abonne uniquement à son alias Firebase
Matchs ; il ne s'abonne plus au canal des autres overlays.

Les canaux `match`, `match-media` et `match-audio` sont réservés au lecteur
Matchs. Le premier sélectionne une animation du catalogue ; le deuxième lit
une vidéo ou image personnalisée ; le troisième lit un son. Les trois couches
peuvent fonctionner en parallèle. Les médias et sons ordinaires des autres
actions restent sur leurs sources Media habituelles.

Activer un automatisme ne déclenche pas une démonstration. Il faut recevoir
son vrai moment de match, ou demander explicitement un test depuis ShenPulse.
Un lecteur ouvert après un effet ne rejoue pas l'ancien batch initial.

## Mode compatible immédiat

À réception d'une demande d'animation, le lecteur HTTPS montre immédiatement
le poster de l'effet et du pack choisis, animé par des transformations et une
opacité CSS finies. Le libellé **Mode compatible** indique que ce rendu n'est
pas une reproduction de la vidéo originale.

En parallèle, il demande un ticket opaque au serveur ShenPulse de ce PC.
Le poster disparaît seulement lorsque la vidéo originale démarre réellement.
Si le navigateur refuse l'accès réseau local, le rendu compatible reste visible
au maximum huit secondes, puis disparaît. Rien ne tourne en boucle au repos.
Le secours ne change aucune permission de navigateur, ne démarre aucun service
et ne met aucune vidéo premium à disposition publique.

Le site héberge uniquement les posters WebP déjà utilisés par les aperçus.
Les vidéos du catalogue sont distribuées chiffrées dans l'application,
déchiffrées en mémoire puis servies par le pont local protégé, sans export.
Voir [Médias Matchs protégés](matches-medias-proteges.fr.md) pour les modalités
de génération, le cache et les limites de cette protection côté client.
La lecture complète de ces vidéos nécessite donc
ShenPulse ouvert sur le même PC que la source et un navigateur autorisant
son accès réseau local.

Les vidéos/images personnalisées et les sons utilisent leurs URL existantes.
Ils ne sont pas remplacés par le poster d'une animation sans rapport. Un média
personnalisé indisponible produit un diagnostic français, sans URL ni jeton.

## TikTok Studio sans hébergement vidéo supplémentaire

Le bouton **Copier pour TikTok Studio** fournit le même alias HTTPS avec
`?transport=local`. Ce mode explicite est destiné au PC où ShenPulse est ouvert.
L'entrée HTTPS réutilise sa requête Firebase de démarrage pour vérifier une
présence fraîche, le compte, l'accès et la version du lecteur local. Elle ne
considère jamais le cache comme une autorisation. Le port reste strictement
borné et la destination est toujours `127.0.0.1` ; aucun hôte arbitraire n'est
accepté. Les widgets et les sources navigateur habituelles ne sont pas changés.

La page effectue ensuite une navigation de premier niveau vers
`/match-bridge/<compte>/<capacité>`. Le lien configuré dans Studio reste HTTPS,
mais le document effectivement rendu et les vidéos sont locaux et de même
origine. Il ne s'agit ni de désactiver la sécurité du navigateur, ni de faire
un appel HTTP depuis la page HTTPS. Aucun certificat n'est installé, aucune
permission n'est changée et aucun nouveau service ou téléversement vidéo
n'est nécessaire. Un autre PC sans ShenPulse ne peut pas utiliser ce lecteur.

Le serveur revalide l'authentification, la visibilité Matchs, l'abonnement Pro,
le compte et la capacité actuelle. `/state` ne renvoie que la projection Matchs
publique ; la clé privée Match, l'UID et les secrets ne sont pas exposés.
Les événements sont bornés aux canaux `match`, `match-media`, `match-audio`.
La régénération du lien, la perte des droits ou le changement de compte, profil
ou LIVE révoquent flux et tickets de l'ancien contexte. Les vidéos restent
protégées par des tickets opaques de 90 secondes. Les méthodes et plages HTTP
ainsi que les origines CORS sont validées ; aucune origine générique `*`.

Le bouton **Copier la source navigateur** conserve le lecteur HTTPS historique
et son secours par poster. Ce secours ne reproduit pas l'animation originale :
la vidéo fournie par l'utilisateur montrait précisément ce mode dans Studio.

Une promesse `video.play()` résolue n'est plus suffisante pour retirer le
secours. Le moteur attend une progression effective des images décodées (ou
de l'horloge vidéo sur les anciens moteurs), détecte un démarrage figé après
1,8 seconde et un gel persistant après 2 secondes, puis nettoie proprement.
Le suivi est borné à la lecture en cours : rien ne tourne au repos et aucun
ancien effet n'est rejoué. Il ne garantit pas la prise en charge de tous les
codecs par toutes les versions de Studio ; le test visuel dans Studio reste
distinct des tests DOM et Chromium.

## Délais, isolation et arrêt

Un nouveau visuel remplace le visuel précédent plutôt que de créer une longue
file d'effets décalés. La couche de média personnalisé reste indépendante.
Une seule piste sonore joue à la fois ; sa file est limitée à seize éléments,
et les sons en attente depuis plus de quinze secondes sont abandonnés.

Chaque identifiant de lecture est dédupliqué dans un ensemble borné.
Le lecteur ignore les messages sans date valide, datant de plus de quinze
secondes ou anormalement dans le futur. Il accepte seulement les trois canaux
Matchs connus, jamais les actions Media/audio générales.

L'accès exige l'alias courant, le bon compte, les permissions Matchs et une
présence fraîche. Déconnexion, révocation, navigation hors de la source ou
expiration du bail de présence de 120 secondes arrêtent vidéos, média, sons,
timers et requêtes de ticket. Une réponse HTTP ou un événement `canplay`
retardé ne peut pas ressusciter un effet annulé.

Les batches sont également associés à un `contextId` opaque. Il change lorsque
le compte, le profil ou le LIVE TikTok change ; aucun identifiant privé brut
n'est publié. Un changement de contexte arrête toutes les pistes même si les
permissions Pro restent actives. Un batch du contexte quitté est ignoré,
mais un nouveau moment du contexte courant reçu dans la même mutation est
joué normalement. L'anti-relecture à la première ouverture/reconnexion reste
inchangée.

La demande de ticket est bornée à huit secondes et l'attente de média à dix
secondes. Le mode compatible expire indépendamment à huit secondes et annule
le travail encore en attente. Quand la vidéo originale démarre, le délai du
poster ne l'interrompt pas ; elle se termine naturellement.

## Sources et vérifications

- `resources/overlays/runtime/widgets/match.js` : animations originales et diagnostics.
- `resources/overlays/runtime/match-local-entry.js` : entrée HTTPS Studio locale explicite.
- `src/main/match-source-service.js` : capacité locale, flux et tickets révocables.
- `resources/overlays/runtime/widgets/match-progress.js` : progression réelle et gel vidéo.
- `resources/overlays/runtime/widgets/match-reactions.js` : couches personnalisées
  et sons bornés, chargés avant le lecteur principal.
- `resources/overlays/runtime/widgets/match-compatible.js` : poster de secours
  et durée finie, uniquement à réception d'un événement réel.
- `resources/overlays/styles/match-player.css` : CSS fini, sans canvas permanent
  ni animation infinie, avec prise en compte de la réduction des mouvements.
- `resources/overlays/runtime/transport.js` : alias dédié, présence,
  ancienneté des messages et révocation.
- `tests/matches-public-playback.test.js` : vrais modules DOM et transport avec
  médias/réseau entièrement simulés. Aucun test de cette suite ne touche un
  LIVE, une session, un appareil, un son réel ou un compte Firebase.

Après modification du moteur, régénérer les anciens bundles par
`npm run overlays:build`. Ils ne se modifient pas à la main.
L'ancien point d'entrée `wheel-match.js` charge le même module canonique
de réactions et le transport attend ses déclarations avant tout abonnement.
Le moteur n'est pas recopié dans ce bundle de compatibilité.

Vérifications locales sans LIVE : `tests/matches-studio-entry.test.js`,
`tests/matches-studio-local-transport.test.js`, `tests/match-video-progress.test.js`,
et `scripts/verify-studio-local-match.js` (Chromium isolé, vidéo muette et état
artificiel). Les sources, comptes et automatisations de l'utilisateur ne sont
pas utilisés par ce dernier test.

## Contrôle de l'installation du 14 octobre 2026

Ce contrôle décrit le paquet `overlay9`, antérieur au conditionnement chiffré
et à l'import Cyber. Les exigences actuelles de distribution sont celles du
[guide des médias protégés](matches-medias-proteges.fr.md).

Le paquet local `overlay9` a été vérifié avant installation : 522 sources
JS/CSS/HTML/JSON et 3 documents identiques à l'espace de travail, ainsi que
les 15 vidéos WebM décompressées. L'ancien paquet et un instantané des réglages
ont été conservés. Après redémarrage, profil, alias, automatisations Matchs et
configurations d'overlays étaient sémantiquement identiques à la sauvegarde.

La suite complète de tests et le contrôle Chromium isolé passent. Ce dernier
observe trois images différentes de la vraie WebM, sans poster, requête externe
ni erreur console ; il vérifie aussi l'arrêt/reconnexion sans replay au
changement de profil. Il ne remplace pas la vérification du moteur de Studio.

Pour le contrôle réel dans TikTok LIVE Studio 1.37.4, l'utilisateur a ajouté
`transport=local` au lien HTTPS existant, appliqué ce réglage puis lancé un
unique test visuel **Coffre · Gladiador**. Les captures de la scène et de l'aperçu
ont montré les pièces et effets de la vidéo originale, sans badge **Mode
compatible**, puis le retour à une source transparente. Les connexions locales
étaient détenues par le processus TikTok LIVE Studio. Aucun son ou effet IRL
n'a été ajouté. Ce contrôle confirme cette source et cette version de Studio,
pas tous les codecs ni toutes les versions futures.

