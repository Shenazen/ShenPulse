# Matchs LIVE

La page Matchs est réservée à Pro, Premium, aux essais non expirés et aux accès Pro offerts. Elle utilise la connexion TikTok déjà autorisée dans ShenPulse. Elle ne demande aucun service d’envoi de messages et ne publie aucun commentaire.

## Organisation du code

- `src/shared/matches-contract.js` : contrat pur partagé avec l’interface, validations et valeurs par défaut.
- `src/main/matches/tiktok-battle.js` : adaptateur des messages du SDK installé.
- `src/main/matches/service.js` : observation des matchs, contributeurs, échéances et réactions.
- `src/main/matches/core-integration.js` : injection des dépendances du noyau.
- `src/main/ipc/matches.js` : opérations explicites de l’interface, protégées avant tout effet.
- `src/main/matches-overlay-state.js` : projection publique minimale destinée aux widgets.

## Données réellement disponibles

Le connecteur fournit `linkMicBattle`, `linkMicArmies` et `linkMicBattleTask`. Les références primaires sont la [documentation du SDK](https://github.com/zerodytrash/TikTok-Live-Connector#linkmicbattle) et ses types installés dans `node_modules/tiktok-live-connector/dist/types/tiktok-schema.d.ts`.

La détection est automatique lorsque le LIVE TikTok est connecté : il n'est pas
nécessaire de créer ou d'activer une automatisation pour recevoir les matchs.
Le départ, les scores, le chronomètre et la fin viennent des événements du
connecteur. Les automatisations configurées sont des effets supplémentaires,
désactivés par défaut ; elles ne démarrent pas un match sur TikTok.

Après une reconnexion, un nouveau match peut être repris depuis une mise à jour
de scores même si son événement OPEN n'a pas été reçu. Lorsque l'ancien match
est encore connu, les dates doivent prouver que la nouvelle manche est plus
récente et en cours. Cette reprise ne produit pas artificiellement un événement
de début, une remontée ou une victoire. Un ancien paquet ou une bataille déjà
terminée ne peut pas remplacer le match courant.

Les paquets de score peuvent précéder OPEN, notamment pendant un cohébergement.
La détection du match depuis ces scores ne doit pas consommer son départ : le
premier OPEN réellement reçu déclenche encore l’automatisation de début, une
seule fois pour cette bataille. Les OPEN répétés ne la rejouent pas, même après
le délai de réarmement de la règle.

Si OPEN manque, un premier paquet de scores peut confirmer un départ récent,
mais uniquement avec une date de début TikTok datant de dix secondes au maximum,
une fin future, des scores effectivement fournis et une session LIVE démarrée
avant cette bataille (date de session valide obligatoire). Cette confirmation
consomme le même départ unique ; un OPEN ultérieur ne rejoue pas l’animation.
Une reprise de match déjà avancé, sans dates fiables ou après reconnexion au
milieu de la manche ne produit aucun départ artificiel. `startOrigin` distingue
les preuves `open` et `recent-scores` dans l’état privé, sans ajouter de donnée
personnelle ni de service externe.

Les callbacks SDK et `decodedData` partagent la même déduplication. Les valeurs
protobuf par défaut `"0"` ne masquent plus les identifiants fournis dans les
réglages ou les maps. La salle du paquet est vérifiée avant toute réception.
Un relais configuré comme TikTok peut transmettre ces mêmes événements SDK,
après avoir annoncé explicitement le LIVE et sa salle. Un WebSocket générique
ou un événement local ne constitue pas une source de bataille TikTok.

La connexion au milieu d'une manche attend le prochain événement effectivement
transmis par TikTok. ShenPulse n'invente pas un match à partir des cadeaux, des
tapotages ou de la seule présence de plusieurs invités.

Dans cette version du schéma, `BattleAction` vaut 4 pour OPEN et 5 pour FINISH. `Result` vaut 0 pour WIN, 1 pour LOSE et 2 pour DRAW. Le champ `WebcastLinkMicArmies.battleStatus` est un `TriggerReason` : sa valeur 2 signifie BATTLE_END, pas un code de victoire.

Les participants viennent de `anchorInfo` et les scores de `armies` / `battleItems` / `battleResult`. En cohébergement, `teamUsers` identifie les membres et `teamArmies` / `teamBattleResult` fournissent les totaux et résultats des équipes. L’identité du diffuseur vient du `room.owner` vérifié ou de son @ public exact. Le premier participant, l’initiateur du match et l’auteur d’une action ne sont jamais considérés automatiquement comme le créateur. Une identité ou un score absent reste inconnu.

Le résultat explicite de TikTok est utilisé quand il existe. À défaut, une fin confirmée avec deux scores connus permet de comparer un duo identifié, ou deux équipes dont l’une contient le diffuseur identifié. Les scores individuels et les totaux d’équipe sont conservés séparément : aucun total n’est copié sur chaque cohébergeur ni calculé en additionnant arbitrairement leurs cadeaux. Une fin incomplète ou une bataille à plusieurs camps sans comparaison fiable ne produit pas de résultat deviné.

Les multiplicateurs ×2/×3 suivent le cycle de tâche de la salle TikTok liée.
Le `START` d'un défi ordinaire conserve le `rewardMultiple`, la durée et la
date prévue : il ne prouve pas que le bonus est gagné. `TASK_SETTLE` doit confirmer `SUCCEED` ou
`BOTH_SUCCEED` dans cette salle, puis sa date réelle remplace la prévision.
`FAILED` n'active pas le multiplicateur du diffuseur, même si l'adversaire
bénéficie d'un bonus. Le règlement ne répétant généralement pas la
configuration, celle-ci est conservée dans une mémoire bornée et éphémère.
Une période différente peut rejouer ×2 même si ×2 était déjà affiché ; les
répétitions du même règlement ne rejouent pas l'animation. Les périodes
expirées sont ignorées. Les horodatages protobuf par défaut `"0"` ne masquent
jamais une vraie date positive.

Les premières tâches reçues avant OPEN attendent la preuve du match et
l'identification du diffuseur ; elles ne créent pas une fausse bataille.
Compte, profil, salle, UID du diffuseur et composition de son équipe sont
revérifiés avant une sortie différée. Ni l'initiateur du match, ni un donateur,
ni `taskUpdate.fromUserUid` ne sont utilisés comme bénéficiaire supposé.
Si la configuration n'a pas été reçue après une reconnexion, aucun ×2/×3
n'est inventé à partir du seul résultat de tâche.

Le chronomètre respecte `endTimeMs` en priorité. Sans date de fin explicite, il utilise `startTimeMs + duration + extraDurationSecond` ; une durée supplémentaire n’est pas assimilée à une détection de carte.

### Synchronisation et bonus « premier cadeau »

Les petites valeurs `rewardStartTime` sont des secondes restantes avant la fin
réglementaire de la manche, hors prolongations. Elles sont prioritaires sur
`rewardStartTimestamp`, conformément au calcul de Studio. La fin réglementaire
vérifiée est conservée séparément de `endsAtMs` : le temps ajouté ne retarde
pas le bonus, même si la prolongation précède son annonce. Le chronomètre et
Snipe utilisent toujours la vraie fin prolongée. Une mise à jour qui omet la
durée supplémentaire n'écrase pas cette ancre déjà établie.

Les dates absolues `rewardStartTimestamp`, en secondes Unix ou millisecondes,
restent un repli strict lorsque le compte à rebours est absent. Un SETTLE sans
horaire explicite conserve la prévision ; un succès anticipé n'est jamais
assimilé à une activation immédiate. Aucun début n'est calculé en ajoutant
arbitrairement vingt secondes au début du match.

Le conteneur de la connexion TikTok fournit une horloge serveur. Une avance
positive mesurée est compensée uniquement dans les dates de match et de
bonus, avec une mémoire bornée de 60 secondes propre à cette connexion.
Aucune horloge Windows n'est modifiée, aucun sondage supplémentaire n'est
ajouté et un paquet retardé ne crée jamais une attente négative artificielle.
La déduplication conserve la date serveur d'origine : affiner l'estimation
ne rejoue pas une période. La déconnexion détache l'observateur et efface
l'estimation. Le compte à rebours et les échéances utilisent les dates locales
ainsi normalisées, sans attendre le prochain paquet de scores.

Le bonus « premier cadeau » est distinct des défis classiques. Les observations
réelles du 15 octobre 2026 ont montré son bandeau dans Studio sans message de
tâche ni effet de multiplicateur correspondant dans le flux public. Les lectures
publiques JSON et protobuf de `battle/info`, avec identifiants int64 exacts et
paramètres de compatibilité Studio, n'ont pas renvoyé sa configuration non plus.
Sa détection exhaustive n'est donc pas annoncée comme fonctionnelle dans cette version.
Si TikTok transmet un vrai `START` de type `START_BONUS` (22), sa fenêtre
explicite ×2 ou ×3 est désormais prise en charge sans attendre un SETTLE de
défi ordinaire. La salle explicite, l'UID vérifié du diffuseur et les bornes
du match sont obligatoires ; aucun démarrage après 20 secondes n'est inventé.
Ce chemin est validé avec des fixtures dérivées du contrat Studio, pas avec
une capture réussie de ce type dans le flux public.

Un second chemin reçoit désormais `gift.matchInfo` avant la fin d'une série
de cadeaux. Une valeur effectivement créditée ×2/×3 peut lancer l'animation
du premier bonus non annoncé, comme le secours constaté dans SyncLive. Le
destinataire vient notamment de `giftExtra.toUserId`, nom utilisé par le SDK
pour `GiftMonitorInfo.to_user_id` ; ni le donateur ni `anchorId` ne servent de
repli. Tous les UID explicites doivent désigner le diffuseur vérifié de la
salle courante. Carte active, critical, catégorie de carte, destinataire
inconnu/adverse, compte/profil différent et preuve ancienne sont refusés.

Sans annonce de période corrélable, ce cadeau prouve un multiplicateur à l'instant de sa réception, pas une durée
de trente secondes. La preuve n'ajoute aucun état de durée/multiplicateur et
reste valable cinq secondes pour l'exécution différée. Elle est dédupliquée
pour cette manche, sans empêcher une période classique ultérieure de rejouer
le même ×2. Une tâche classique déjà jouée ou active exclut ce secours pour
éviter un doublon. Sans message de tâche ni cadeau éligible crédité, aucun
démarrage à vingt secondes n'est simulé. Les fixtures SDK, le routage avant
fin de série et le lecteur Chromium isolé sont vérifiés ; aucun premier bonus
positif réel n'a encore été capturé lors de cette révision.

Si la fiche publique du salon ne renvoie que des informations partielles,
l'identité peut être récupérée dans `OPEN.anchorInfo`, avant la transmission
du match au service. Le pseudo configuré doit correspondre exactement à un
seul créateur, dans la salle connectée, avec un UID texte concordant entre
l'utilisateur et la clé de la map. Le premier participant, l'auteur de
l'événement et les donateurs ne servent jamais de repli. Cette preuve est
liée à la connexion, effacée à son arrêt et réévaluée après reconnexion ; une
contradiction d'identité bloque son utilisation plutôt que de choisir un côté.

Contrôle local complémentaire du 16 octobre 2026 : 2 313 tests réussis, lint
valide et six cas vidéo vérifiés dans Chromium isolé et muet (dont le premier
cadeau propre crédité ×2, puis deux périodes classiques ×2 distinctes et ×3).
Le paquet et sa copie installée ont été audités : 1 825 sources concordantes,
21 vidéos protégées, aucune vidéo brute. Après relance, le compte, les trois
profils, le profil actif et la configuration Matchs sont conservés. Cette
validation simulée ne remplace pas l'observation d'un premier bonus réel.
Le premier LIVE suivi s'est arrêté avant le prochain OPEN après cette relance.
Sur le nouveau LIVE choisi par l'utilisateur, l'identité et le côté propre
sont reconnus ; Snipe s'est exécuté naturellement à 10:09:12 (heure de Paris),
au seuil des 15 dernières secondes. Le premier bonus court et le repli
d'identité par OPEN restent à confirmer en réel ; un test manuel ne constitue
pas cette confirmation.

L'utilisateur a confirmé l'absence du premier bonus court sur la manche
suivante : aucune animation initiale n'a été exécutée. Un bonus classique ×2
s'est ensuite exécuté naturellement à 10:12:42.646 (heure de Paris), puis son
état est revenu à ×1 après sa période de 50 secondes. L'identité propre est
restée cohérente. La synchronisation avec le bandeau TikTok doit encore être
confirmée par l'observation utilisateur ; le journal seul ne la prouve pas.

Les adaptateurs isolés `tiktok-battle-info.js` et `tiktok-battle-wire.js` sont
testés sur le contrat de configuration `START_BONUS` (type 22), mais aucun
nouveau sondage réseau ni multiplicateur ou horaire par défaut n'est activé.
Leurs fixtures positives sont dérivées du schéma, pas d'une capture LIVE réussie.

Observation du 16 octobre 2026 (heure de Paris), sans test manuel sur le LIVE :
un défi classique réussi à 00:40:29 annonçait encore « bientôt disponibles »
dans Studio. L'animation ×2 a été exécutée à 00:41:22.991 ; à 00:41:50–51,
Studio affichait ×2 actif avec 23 secondes restantes, puis TikTok a envoyé la
fin à 00:42:13. Cette manche confirme le cycle ordinaire de 50 secondes, mais
n'explique pas les captures précédentes où le bonus était manqué ou retardé.
Le succès anticipé du défi ne doit pas être confondu avec son activation.
À ce stade de la révision, l'utilisateur avait refusé la lecture locale du
bandeau. L'autorisation donnée ensuite le 16 octobre 2026 permet le secours
optionnel décrit ci-dessous ; elle ne l'active pas pour les autres comptes.
Aucune prestation payante ou session Studio privée n'est utilisée.

Validation de cette révision locale : 2 265 tests réussis, lint valide,
lecteur Chromium isolé et muet vérifié (début, deux périodes ×2, ×3, Snipe),
paquet audité avec 21 vidéos protégées et aucune vidéo brute. ShenPulse a
été relancé après la fin de manche, avec reconnexion au LIVE et conservation
du compte, des trois profils et de la configuration Matchs. Aucune animation
manuelle n'a été envoyée au LIVE. Cette validation ne garantit pas la réception
du premier bonus absent du flux public observé.

Le SDK installé ne possède pas de décodeur certifié pour les cartes gant, brume, marteau et prolongation. Les configurations et essais manuels de réactions sont disponibles, mais leur activation automatique est refusée. Aucun cadeau n’est traité arbitrairement comme une carte.

## Automatismes

Toutes les automatisations sont désactivées par défaut. Une automatisation lie un moment à une animation existante, un son, un média ou une action du profil.

- Début du match : événement OPEN observé, ou confirmation de départ récent strictement bornée décrite ci-dessus ; une seule fois par bataille.
- Passage devant : croisement mesuré du score propre avec celui de l’adversaire, en duo identifié ou entre les totaux explicites de deux équipes identifiées.
- Grande remontée : même croisement après un déficit au moins égal au seuil configuré, 1 000 points par défaut. Ce seuil est un choix ShenPulse, pas une valeur prétendument identique à une autre application.
- Égalité dans la dernière minute : scores mesurés égaux pendant la fenêtre de fin configurée, 60 secondes par défaut ; une seule fois par match.
- Rafale de likes : nombre de tapotages reçus pendant la fenêtre configurée, 300 sur 5 secondes par défaut.
- Snipe : entrée dans les dernières secondes configurées, 30 secondes par défaut ; une seule fois par match.
- Victoire / défaite : résultat confirmé, sans double comptage d’un paquet répété.

Les rôles et droits propres aux actions, jeux, IRL et overlays restent appliqués. Une action retirée, modifiée, désactivée ou hors profil n’est jamais remplacée par une autre.

## Compteurs, profils et confidentialité

`settings.matches` contient les widgets et automatisations du profil. `matchSession` contient l’état observé, les compteurs et un historique borné à 20 matchs. Les configurations, références de cadeaux, actions et données des autres profils ne sont pas modifiées.

La correction manuelle des manches modifie le compteur du duo courant ou un compteur manuel séparé. Elle ne réécrit ni le résultat TikTok ni la statistique des victoires confirmées. Les contributeurs LIVE utilisent les vrais cadeaux et likes du LIVE ; les utilisateurs bloqués ne déclenchent pas ces interactions.

En cohébergement, les automatismes de score utilisent l’équipe du diffuseur, pas
le premier invité. Les victoires confirmées alimentent le bilan du profil, mais
ne réutilisent pas le compteur d’une ancienne paire individuelle pour une
équipe. La simple présence d’invités ne lance aucune automatisation de match.
Une annulation explicite est terminale pour la bataille concernée : un paquet
de score ou de fin reçu en retard ne la réactive pas.

Les données publiques des widgets excluent les UID Firebase, IDs de salons, historique, actions et automatisations. Un invité ne reçoit aucun ancien état Matchs. Les tests de widgets n’ajoutent aucun score, donateur ou victoire fictifs.

Les échéances sont annulées lors d’une déconnexion, d’un arrêt ou d’un changement de compte/profil. Les droits Pro et le contexte sont relus avant chaque effet différé. Les publications de contributions sont regroupées à quatre mises à jour par seconde au maximum ; aucun minuteur de polling n’est actif à l’arrêt.

## Vérification

Les tests automatisés couvrent le contrat, la normalisation SDK, la déduplication, les échéances, les seuils, l’identité du créateur, les widgets, les restrictions IPC/Pro, les profils et les projections publiques. Les régressions de cohébergement couvrent les équipes, les scores partiels, les résultats, les annulations et le transport direct/relais. Ils utilisent des connecteurs et effets factices : aucun vrai match TikTok, son, média ou appareil physique n’est déclenché.

`tests/matches-cohost-delivery.test.js` relie aussi le vrai service, le moteur
d’actions et le serveur HTTP/SSE aux modules du lecteur Matchs pour le début,
×2, ×3 et snipe. Seule la primitive vidéo de JSDOM est remplacée : ce test
vérifie la livraison et les tickets, pas le décodage de la vidéo dans Studio.
Les contrôles isolés Chromium n’accèdent pas aux données utilisateur ni au
LIVE ; une validation dans TikTok LIVE Studio pendant un véritable match
cohébergé reste une vérification distincte.

`node scripts/verify-cohost-match-player.js` mesure les quatre vidéos Cyber
sur un lecteur Chromium invisible : temps vidéo, images décodées/présentées et
empreintes des images doivent évoluer. Le trajet passe par les vrais services
et les tickets de vidéos chiffrées. Le profil est temporaire, le réseau externe
est interdit et les sorties audio sont coupées dans le lecteur et au niveau
matériel. Le rapport et les captures de cette fixture sont écrits uniquement
dans son dossier temporaire, sans jeton ni donnée utilisateur.

## Reprise du lecteur et cache après mise à jour

Le lien HTTPS `?transport=local` peut être chargé par Studio avant que ShenPulse
ait démarré. Une présence hors ligne, trop ancienne ou une première requête
interrompue ne laisse plus cette entrée définitivement bloquée : elle attend
une présence fraîche sur un seul flux Firebase du canal Match existant, puis
navigue vers le lecteur local. Il n'y a ni nouveau service ni scrutation HTTP.
Le flux d'attente est fermé dès la navigation ou la fermeture de la page.

Cette reprise n'assouplit pas les autorisations : compte différent, alias
supprimé, droits retirés, port invalide ou version incompatible arrêtent
l'entrée. Après une coupure réseau, un nouveau document complet est exigé ;
un cache ou une ancienne preuve ne peut pas autoriser la navigation.

Les scripts et styles locaux portaient auparavant une adresse identique entre
deux corrections de la même version de ShenPulse, malgré un cache immutable
d'un an. Le document des routes Match locales utilise maintenant une empreinte
du code réellement installé (`src/main/overlay-code-version.js`). Le chargeur
propage cette empreinte aux modules et au CSS. Les vidéos protégées, secrets et
données de compte ne participent pas au calcul. Les autres overlays gardent
leur contrat de publication existant.

Le lecteur préparé pour la version 2.0.3 porte la révision `2.0.3-overlay1`, distincte de
la version commerciale de l'application. Une actualisation initiale de la
source Studio est nécessaire pour remplacer un ancien lecteur déjà bloqué en
mémoire ; les reprises suivantes ne nécessitent pas de modifier son lien.

Régressions ciblées :

- `tests/matches-studio-entry.test.js` reproduit une ouverture avant ShenPulse,
  puis vérifie la reprise et les refus de sécurité.
- `tests/matches-local-code-cache.test.js` garde l'ancien cache immutable entre
  deux serveurs et vérifie que le nouveau module est chargé sans vider le cache.
- `node scripts/verify-match-entry-late-start.js` mesure la navigation HTTPS vers
  le lecteur local, puis les images réellement décodées dans Chromium.
- `node scripts/verify-match-player-reconnection.js` garde un lecteur ouvert
  pendant un remplacement du serveur sur le même port et un changement de
  LIVE/profil : nouvelle animation, pas de rejeu des anciennes.

Ces sondes sont isolées et matériellement muettes. Une présence Firebase
« connectée » décrit ShenPulse, pas la visibilité de la source dans Studio :
la source Matchs doit aussi être visible dans la scène et son lecteur chargé.

### Source Studio déjà bloquée

Une relance de ShenPulse ne recharge pas la page déjà conservée en mémoire par
Studio. Vérifier aussi la révision du lecteur hébergé : un correctif présent
dans l'EXE ne met pas à jour Firebase Hosting. La révision `2.0.2-overlay2` a été
déployée le 15 octobre 2026, avec contrôle d'identité des fichiers publiés.

Pour remplacer une ancienne source bloquée, conserver son lien Matchs et son
paramètre `transport=local`, ajouter un paramètre inoffensif
`&refresh=20261015`, puis appliquer dans Studio. Ne pas régénérer les URL ni
partager le lien protégé. Le noir transparent de l'aperçu hors animation est
normal ; une connexion réseau ou une présence Firebase seule ne prouve pas
que la scène principale affiche la vidéo.

La vérification réelle du 15 octobre a constaté x3 Cyber puis le test unique
Snipe Cyber dans la scène cohébergée, avec retour transparent en fin de vidéo.
L'utilisateur a confirmé l'image et le son du test. Cela vérifie le transport
Studio ; un test manuel ne constitue pas une preuve de déclenchement
automatique par un événement TikTok.

Le même match cohébergé a ensuite confirmé les déclenchements naturels :
Bonus ×2 à 23 h 02 min 56 s, puis Snipe à 23 h 04 min 25 s, au seuil configuré
des 15 dernières secondes. Le Snipe a été observé dans la scène principale de
Studio, puis s'est terminé normalement. Aucun test supplémentaire n'a été
envoyé pendant cette observation ; les réglages et les scores sont restés
inchangés.

### Horloge de l'interface et identité TikTok

Le tableau de bord et l'aperçu du widget chronomètre recalculent leur texte
chaque seconde depuis `endsAtMs`, même sans nouveau paquet de scores. Ce
travail utilise la boucle visuelle existante : aucun polling IPC, nouveau
minuteur par page, rechargement d'avatar ou reconstruction de contrôles.
Il est suspendu hors de la page Matchs ou lorsque la fenêtre est masquée ;
les gardes de compte, profil et accès restent appliqués. Une arrivée à zéro
ne simule jamais une fin de match ni un résultat TikTok.

Les scores restent les dernières valeurs réellement transmises par TikTok :
le passage des secondes ne crée ni points ni événement de bonus. Les
automatisations sont calculées dans le processus principal, indépendamment
du décompte visuel ; les régressions couvrent notamment 105 secondes sans
score et deux manches successives avec ×2 et Snipe.

L'identité du diffuseur privilégie désormais `room.owner.id_str` et les autres
champs texte exacts. Un UID numérique dépassant la précision entière de
JavaScript n'est plus utilisé comme preuve d'identité. Cela évite qu'un
arrondi empêche d'identifier le côté du streamer, sans remplacer les gardes
d'UID par un pseudo supposé.

Validation locale après cette correction, le 15 octobre 2026 : 2 155 tests
réussis, lint valide, paquet contrôlé et application relancée. Le décompte
réel de l'interface a été observé à `3:58`, `3:57`, `3:56` sur trois secondes,
sans changement des scores. Le côté du streamer est à nouveau identifié.
Le ×2 naturel a été capturé sur trois images différentes dans la scène
cohébergée de Studio, sans test manuel. Le Snipe de la même manche figure
comme exécuté à 23 h 21 min 17 s ; l'utilisateur a ensuite confirmé son
affichage pendant les dernières secondes dans Studio. Cette validation du
Snipe ne prouvait pas l'attribution correcte des multiplicateurs, dont le
suivi annonce/règlement a été corrigé séparément.

### Écoute des multiplicateurs pendant toute la manche

Les abonnements aux annonces et confirmations TikTok sont actifs pendant
toute la connexion : aucune fenêtre à +20 secondes, ni arrêt après un premier
×2 ou ×3. Chaque période confirmée possède sa propre identité ; deux ×2
distincts peuvent donc chacun déclencher leur animation sans attendre les
scores suivants. L'animation attend le bonus réellement actif, pas l'annonce
d'un défi encore à réussir. La fin du match interdit toute sortie tardive.

`tests/matches-full-battle-bonus-listening.test.js` vérifie les vrais codecs du
SDK jusqu'au service : 598 réceptions actives (×2 et ×3 à chaque seconde de
+1 à +299), plusieurs périodes successives, la dernière seconde, les doublons,
les refus et la reconnexion. Le retour de l'indicateur à ×1 est aussi vérifié
à la fin exacte du match, même sans nouveau paquet de scores.

Ces tests hors LIVE ne prouvent pas que TikTok transmet tous les bonus au
connecteur. En particulier, élargir une fenêtre d'écoute ne crée pas les
données manquantes du premier bonus court. Son observation réelle reste à
valider séparément ; aucun bonus ni multiplicateur n'est déduit du seul temps
écoulé. Le secours visuel optionnel ci-dessous constitue un chemin séparé.

### Secours visuel local facultatif

Ce mode est désactivé par défaut. Il ne remplace pas la détection TikTok : il
nécessite une fenêtre du PC affichant réellement le bandeau actif. Par défaut,
la preuve d'identité visuelle est le @pseudo exact du créateur.
Le mode explicite **TikTok Studio : encart « Toi »** accepte aussi le nom du
créateur associé à la ligne « Toi » pendant un duel identifié. Le nom vient du
diffuseur dont l'UID est vérifié ; ni « Toi » seul, ni le nom de l'adversaire
ne suffisent. Un nom tronqué doit porter une ellipse visible, avec un préfixe
d'au moins huit lettres/chiffres qui reste unique dans le duo. Les équipes de
plusieurs personnes et les noms ambigus sont refusés dans ce mode Studio.
Le troisième mode explicite **Mon propre écran — zone déclarée** ne demande
ni nom, ni « Toi », ni rectangle autour du visage. L'utilisateur choisit son
emplacement (gauche en duel, haut gauche avec trois ou quatre participants),
le rectangle du bandeau et confirme, dans une case non précochée, que ce
bandeau concerne son côté plutôt que celui de l'adversaire. C'est une
déclaration de l'utilisateur, **pas une identité reconnue par l'image** : un
bandeau global ou central ne prouve pas automatiquement quel participant en
bénéficie. L'interface doit conserver cet avertissement et ne jamais annoncer
une attribution visuelle vérifiée dans ce mode. Les données TikTok doivent
toujours identifier le compte, l'UID propre, la salle et le match en cours.
Une page Web sans bandeau et un affichage présent
seulement sur un téléphone ne suffisent pas. Il ne constitue donc pas, à lui
seul, une solution universelle pour les utilisateurs Android, iPhone et PC.

Dans Automatisations → Lecture visuelle locale, choisir explicitement une
fenêtre et le mode d'identification, demander son aperçu puis délimiter deux
petites zones : le bandeau du bonus et le @pseudo propre, ou l'encart contenant
le nom propre et « Toi » pour le mode Studio. Dans le mode « Mon propre
écran », seul le rectangle du bandeau est lu : aucune image d'identité n'est
capturée ni passée au moteur OCR. Un changement de mode invalide
l'aperçu et les zones pour imposer un nouveau calibrage. Le choix de fenêtre
n'est pas conservé après redémarrage. La confirmation de zone propre reste
éphémère, liée au calibrage, et doit être redonnée à chaque choix de fenêtre ;
elle n'est ni enregistrée ni restaurée depuis le profil. Un changement de
disposition détecté dans les données TikTok invalide cet accord et demande une nouvelle confirmation, même
si la disposition précédente revient ensuite. Un simple nouveau rival dans
la même disposition n'est pas traité comme un changement de disposition.
Un déplacement purement visuel des panneaux n'est pas déduit de ces données :
l'utilisateur doit vérifier et recalibrer son rectangle après ce changement.
Un changement de compte TikTok, de LIVE ou de calibrage invalide également la
confirmation précédente, sans la rétablir si l'ancien contexte revient.
Seuls l'activation, le mode, l'emplacement et les
rectangles sont enregistrés par profil. L'état du lecteur est maintenant
visible directement dans Automatisations, notamment la fenêtre à rechoisir.

Le moteur Windows lit localement ces deux zones. Les petites zones sont
agrandies au maximum deux fois, sans élargir les rectangles consentis, en
respectant les limites PNG existantes. L'aperçu complet n'est pas agrandi.
Deux images fraîches et un décompte décroissant sont obligatoires. Dans les
deux modes à identité visuelle, celle-ci doit aussi être reconnue ; le mode
déclaré conserve sa confirmation manuelle et les gardes d'identité TikTok.
Une barre verticale reconnue comme un jeton isolé « 1 », « I »
ou « l » est acceptée uniquement comme séparateur avant la durée d'un bandeau
actif complet. Le ×2/×3 et sa fin
proviennent du texte visible : aucune durée de trente secondes ni activation
à vingt secondes ne sont inventées. Les défis non gagnés, comptes WIN, images
figées et fenêtres/profils/LIVE différents sont refusés. Une période reconnue
met à jour l'indicateur du tableau de bord et utilise l'automatisation existante,
sans doublon si TikTok confirme ensuite la même période par son flux habituel.

Le traitement fonctionne en mémoire : aucune image ni texte OCR n'est écrit
sur disque, envoyé au réseau, au relais, au journal ou aux statistiques.
L'aperçu complet de la seule fenêtre choisie sert uniquement au calibrage
explicite ; la surveillance ne lit que le ou les rectangles choisis. Aucun son n'est
capturé, aucun service ou modèle cloud n'est utilisé et aucune permission
Windows n'est modifiée automatiquement. Si le moteur Windows ou la capture
est indisponible, le mode échoue sans interrompre la détection classique.

Une perte de capture est signalée, même si le flux se termine sans erreur.
La reprise est bornée à trois essais sur la même fenêtre déjà choisie, sans
redécouverte automatique d'une autre fenêtre. Une preuve partielle est annulée,
mais les périodes déjà observées restent dédupliquées. Aucune capture ne
reprend automatiquement après le redémarrage de ShenPulse.

### Correctif local du 16 octobre 2026 après la publication 2.0.3

Un `START_BONUS` explicite reçu avant `OPEN` n'est plus perdu : une file
éphémère de huit annonces au maximum, expirant après trente secondes, attend
la preuve `OPEN`, l'UID du diffuseur et le même compte/profil/LIVE/salon.
L'expiration du bonus, une annulation ou une fin invalident la preuve. Aucun
bonus n'est exécuté avant l'identification du match. Ce chemin est reproduit
par tests ; aucun paquet réel positif de type 22 n'a été capturé pour cette
révision et les annonces absentes du flux ne sont pas inventées.

`node scripts/verify-first-match-bonus.js` qualifie le vrai moteur Windows OCR
jusqu'au service Matchs avec des images synthétiques en mémoire : bandeaux
de trente secondes ×2 et ×3, petites polices, nom tronqué + « Toi », puis refus
du rival et de « Adversaire », ainsi que la lecture du seul bandeau dans
le mode déclaré (duel à gauche et quatre participants en haut à gauche).
Aucun écran réel, compte, son ou effet LIVE
n'est utilisé. La qualification synthétique ne remplace pas une première
période réelle après activation explicite par l'utilisateur.

Les tests synthétiques ne valident pas l'affichage réel d'un bonus TikTok.
Une vérification d'une première période effectivement visible demeure requise
avant d'annoncer que le problème initial est résolu.

## Réactivité et affichage des multiplicateurs — 28 octobre 2026

L'indicateur revient à **×1 par défaut**. Le remplacement par « ×— » a été
retiré après le retour utilisateur : il rendait les manches sans information
de bonus peu lisibles.

### Deux preuves complémentaires, sans lecture d'écran

Le chemin prioritaire reste la période TikTok : START_BONUS explicite ou
annonce de défi puis résultat réussi. Début, durée et fin utilisent les dates
transmises. Une annonce peut aussi être confirmée immédiatement par un cadeau
crédité ×2/×3 pendant son unique fenêtre correspondante. Les chevauchements
ambigus, équipes différentes, dates futures et périodes terminées restent exclus.

Sans période exploitable, un cadeau explicitement crédité ×2/×3 au diffuseur
courant met immédiatement à jour l'indicateur. Cette observation est rafraîchie
à chaque nouveau cadeau boosté propre et expire **six secondes après sa date**,
ou à la fin du match si elle arrive avant. L'interface affiche alors ×1.
Cette fraîcheur d'affichage est distincte de la durée du bonus TikTok et de la
preuve de cinq secondes autorisant une sortie différée. Aucune période de
trente secondes n'est inventée.

Un ×2 puis un ×3 peuvent chacun déclencher leur automatisation une fois par
valeur et par manche. Les cadeaux répétés rafraîchissent l'affichage sans rejouer
l'animation. Les vraies périodes TikTok gardent leurs propres identités ; un
nouveau cycle explicite peut donc rejouer le même multiplicateur. La mémoire de
secours est bornée à 64 clés, effacée à la déconnexion/changement de contexte.
Une carte de match, un critical non ordinaire, un rival ou un destinataire
inconnu ne fournit pas une preuve de bonus ordinaire.

Le timer d'observation ne peut modifier ni un autre compte/profil, ni une autre
manche, ni couper un bonus à durée connue arrivé entre-temps. Il n'attend aucun
nouveau paquet de scores pour revenir à ×1. Le secours n'ajoute ni OCR, ni
sondage HTTP, ni cookie Studio, ni abonnement à un service externe.

### Comparaison de fonctionnement

L'application SyncLive 3.6.97 installée a été examinée en lecture seule pour
l'interopérabilité. Ses gestionnaires Matchs étudiés utilisent les événements
de tâches TikTok et la valeur `matchInfo.multiplierValue` des cadeaux. Le secours
cadeau conserve la valeur six secondes après le dernier cadeau boosté, puis
revient à ×1. Le déclenchement est dédupliqué par bataille et valeur.
Ces gestionnaires ne lisent pas l'écran. Aucune garantie sur les autres parties
de l'application n'est déduite de cette inspection.

Empreinte SHA-256 du binaire examiné :
`1ccf7a165bdd89e994316d4284e1b3412387ef4681c0df10a52e178dc531532c`.
Aucun code extrait ni actif SyncLive n'est incorporé au produit ShenPulse.

### Qualification et limite

663 tests ciblés réussis dans 48 fichiers : vrais codecs SDK, progression
×1 → ×2 → ×3 → ×1 dans le vrai renderer, expiration et rafraîchissement sans
nouveau score, plusieurs manches, absence de doublons, droits et identité.
Lint et contrôle des sources du paquet natif valides.

La vérification globale du dépôt a échoué lors du contrôle précédent sur trois
tests existants de catalogue/navigation des jeux, puis par épuisement mémoire
du processus de tests partagé. Elle n'est pas considérée réussie et n'est pas
relancée à l'identique ; les tests ciblés ci-dessus utilisent des processus isolés.

L'écoute publique précédente de six minutes a reçu annonce, règlements et fin
d'un bonus classique, mais aucun START_BONUS initial ni cadeau explicitement
crédité ×2/×3. Elle ne valide donc pas les nouveaux cas positifs en LIVE.
La valeur d'un bonus absent de tous les messages reçus ne peut pas être
anticipée : la détection exhaustive reste dépendante des données TikTok.


## Présentation du tableau de bord Matchs

L’arène présente le compte du @ TikTok suivi à gauche et l’adversaire à droite,
avec avatars circulaires, scores cyan/rose, repère VS et répartition des points.
Le multiplicateur reste immédiatement à droite du chrono. Les équipes explicites
conservent leurs membres et leurs totaux ; un total absent n’est pas inventé.
Les photos proviennent des participants TikTok ou du profil TikTok correspondant
au même @ et au même identifiant. Une photo indisponible laisse des initiales.

Les composants de présentation sont regroupés dans
`src/renderer/app/features/matches/dashboard.js` : arène, donateurs, bilan et
historique. Les autres onglets reprennent les contours et fonds de l’arène.
La grille se replie selon la largeur réelle du contenu, indépendamment de la barre
latérale. Les scores, le chrono, le podium et ses avatars se mettent à jour en
place ; aucune nouvelle minuterie, requête de profil ni automatisation n’est
créée par cette présentation. Les règles et réglages du profil restent inchangés.

Les tests renderer couvrent l’ordre du @, les photos et leur repli, les équipes,
les scores absents, la barre proportionnelle et le changement de podium sans
recréation des cartes ni de leurs contrôles.

Validation de cette présentation : 668 tests ciblés Matchs/TikTok dans 48 fichiers,
lint du projet valide, 153 scripts renderer du paquet natif comparés aux sources.
Le contrôle natif sur un vrai match a confirmé les deux photos, l’ordre du compte
suivi, les mises à jour de scores et du podium ; les onglets Widgets et
Automatisations restent accessibles et leurs réglages inchangés.
