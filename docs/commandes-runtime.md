# Commandes de chat exécutables

Une commande commence par `!`. Elle agit localement dans ShenPulse lorsque le
connecteur reçoit le commentaire pendant le LIVE. Aucun service d'envoi TikTok
n'est nécessaire : recevoir `!suivant` et piloter Spotify ne publie pas de message
dans le chat TikTok.

## Effets disponibles

- Musique Spotify : morceau suivant/précédent, lecture/pause, titre fixe ou titre
  indiqué après la commande, ajout à la file native Spotify, playlist et volume.
  Le compte Spotify doit être autorisé et disposer des droits/appareils requis.
- Action existante : référence d'identifiant vers une action active du profil.
  Le moteur habituel reste responsable du son, du jeu, d'OBS ou d'une interaction
  IRL. Une commande n'autorise jamais une fonctionnalité interdite à son compte.
- Overlays : chronomètre, compteur de victoires, objectif de likes, pot de
  diamants, roue et chronomètre multiplicateur. Les valeurs utilisent le même
  moteur de session que les actions et overlays existants.

Les descriptions et aperçus sont purs : ils ne jouent ni musique ni son et
n'actionnent aucune prise. Une URI/recherche provenant du chat est une chaîne
littérale bornée, pas un modèle, du JavaScript ou une commande système.

## Droits et isolation

Chaque commande conserve les filtres de plateforme, rôle et délais d'attente
par utilisateur/global. Le rôle modérateur comprend le créateur lorsque son
identité publique correspond à celle du LIVE TikTok direct vérifiée par le
connecteur, ou à l'identifiant du compte Kick du webhook signé. Un pseudo
d'affichage ou une métadonnée de relais générique n'accorde pas ce rôle.

La section Commandes nécessite désormais un accès Pro ou Premium actif,
y compris un essai non expiré ou un accès offert. Ce droit est contrôlé côté
processus principal avant chaque effet, même pour une commande déjà en attente.

Les cibles directes et les enfants de groupes supprimés, désactivés, ambigus ou
absents du profil actif sont refusés. Une roue reste utilisable quand certains
secteurs ont une ancienne liaison indisponible : ces secteurs conservent leur
libellé et leur identifiant, mais ne lancent jamais cette action. Aucun appareil
ni aucune règle n'est réactivé automatiquement. Les cycles de groupes sont détectés ; les graphes partagés sont
audités une fois. L'accès IRL est ouvert aux abonnés, sans privilège propriétaire ;
les restrictions de visibilité des types
d'actions et fonctionnalités, les droits des jeux et abonnements d'overlays
continuent de s'appliquer. Aucun seuil ni droit commercial n'est modifié.

Les effets sont annulés si le compte, profil, session, source ou définition de
commande change pendant l'attente. Les services Spotify et IRL revalident ce
contexte après les étapes asynchrones et avant leur effet. Une impulsion IRL
déjà commencée conserve sa restauration sur la prise capturée, même après
annulation : on ne laisse pas un relais allumé en interrompant son extinction.

## Architecture et compatibilité

- `src/shared/command-execution.js` : contrat pur et liste fermée des effets.
- `src/main/commands/executor.js` : résolution des cibles et droits.
- `src/main/commands/context-guard.js` : garde asynchrone réutilisable.
- `src/main/chatbot-service.js` : correspondance, rôles, délais d'attente et file
  bornée à 50 éléments, deux tâches simultanées et une seule par source.
- `src/main/core/ingestion.js` : une commande explicite revendique son nom avant
  Song Requests, même si son rôle ou son délai refuse ensuite l'effet. Ainsi
  `!sr` ne déclenche pas deux ajouts et ne permet pas un contournement par repli.

Les projections ne copient pas les espaces privés des autres comptes/profils.
Les commandes musicales et overlays simples ne copient aucune règle ; les
références d'actions utilisent la projection de règles et du seul pack actif.
Les groupes de commandes résolvent leurs enfants dans cette même projection,
y compris les actions du jeu actif, avec les mêmes gardes avant chaque effet.

Une roue déjà occupée peut mettre la commande en attente : le journal indique
« Commande mise en file », pas « exécutée ». Cette file de commandes est bornée
à 50 effets. Un groupe partiel produit un avertissement avec le nombre d'effets
exécutés et échoués ; il n'est jamais présenté comme un succès complet.
Les groupes imbriqués propagent ces états et leurs compteurs d'effets feuilles.
Si certains effets ont eu lieu mais qu'une roue attend encore, l'avertissement
partiel est prioritaire et le nombre d'effets en attente reste indiqué.

Le préflight d'une roue et son exécution utilisent le même sélecteur
`src/main/actions/wheel-selection.js` : roue explicitement demandée, sinon
sélection courante, sinon première active. Les autres presets n'empêchent pas
l'enregistrement. Les anciens identifiants de roues dupliqués gardent la
première correspondance active, sans migration destructive des secteurs.
Une action de secteur indisponible produit un résultat partiel visible ; un
échec différé est journalisé uniquement si le compte, profil, commande et LIVE
ayant lancé la roue sont encore valides. Les erreurs brutes des fournisseurs,
adresses d'appareils et secrets ne sont jamais copiés dans ce diagnostic.

## Diagnostic des commandes reçues

Les commandes sont réservées aux modérateurs et au créateur du LIVE par
défaut. Un autre compte de test doit réellement être modérateur, ou la commande
doit être explicitement ouverte à « Tout le monde » dans son formulaire. La
correction ne change pas les autorisations des commandes déjà enregistrées.
Le connecteur TikTok moderne transmet aussi les rôles dans
`userIdentity.isModeratorOfAnchor` et `isSubscriberOfAnchor` : seuls les booléens
réels sont reconnus, en complément des anciens champs.

Les refus de rôle, de cooldown et de file pleine d'une commande reconnue
apparaissent dans « Exécutions récentes ». Le journal est limité à un refus par
commande, source et motif toutes les cinq secondes (256 clés au maximum). Il
n'enregistre pas tous les commentaires, leurs arguments ni l'identité du viewer.
Les événements d'une API locale ou d'un WebSocket gardent la source fournie par
leur transport ; leur payload ne peut pas usurper le connecteur TikTok pour
obtenir les droits du créateur.

L'éditeur propose également les actions du seul jeu démarré dans le profil
actif. Les règles et packs inactifs ne sont jamais importés ou réactivés par ce
sélecteur. Les aperçus et vérifications d'enregistrement restent sans effet.

La production utilise `functionalOnly: true` : seules les commandes `!` avec un
effet musique/action/overlay sont exécutées. Les anciennes réponses texte,
réponses automatiques et messages programmés sont ignorés, sans scheduler ni
émission locale/réseau. Leurs données restent sur disque, sans suppression ni
conversion automatique ; elles ne réservent plus les noms dans Commandes.
Une entrée avec `execution` n'envoie jamais son ancien texte conservé.

L'IPC de création/modification exige une commande avec effet. La suppression
explicite d'une ancienne entrée reste possible pour récupération. Le moteur
compatible historique reste disponible uniquement avec l'option explicite
`functionalOnly: false` pour les anciens tests/outils ; il n'est pas instancié
par le service LIVE de production. Les droits reposent sur
`navigation.commands`, pas sur `chat.reply`. Aucun nouvel exemple exécutable
n'est installé automatiquement.

## Vérification sans effet réel

`tests/commands-runtime.test.js` utilise exclusivement des connecteurs, services
et réponses réseau simulés. Il vérifie les trois cibles, aliases exacts, rôles,
anciens textes préservés, compteurs, annulations tardives, droits et références,
re-spins légitimes, OAuth Spotify et sécurité de restauration IRL. Les tests
historiques des réponses/timers et de l'ingestion restent appliqués.
