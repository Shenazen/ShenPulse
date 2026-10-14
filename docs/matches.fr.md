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

Les participants viennent de `anchorInfo` et les scores de `armies` / `battleItems` / `battleResult`. L’identité du diffuseur vient du `room.owner` vérifié ou de son @ public exact. Le premier participant n’est jamais considéré automatiquement comme le créateur. Une identité ou un score absent reste inconnu.

Le résultat explicite de TikTok est utilisé quand il existe. À défaut, une fin confirmée avec deux scores connus et un duo identifié permet de comparer les scores. Les matchs par équipes ou les fins incomplètes ne produisent pas de résultat deviné.

Les multiplicateurs ×2/×3 proviennent du `rewardMultiple` d’une tâche et de sa date de début réelle. Une annonce anticipée n’active pas immédiatement le multiplicateur.

Le chronomètre respecte `endTimeMs` en priorité. Sans date de fin explicite, il utilise `startTimeMs + duration + extraDurationSecond` ; une durée supplémentaire n’est pas assimilée à une détection de carte.

Le SDK installé ne possède pas de décodeur certifié pour les cartes gant, brume, marteau et prolongation. Les configurations et essais manuels de réactions sont disponibles, mais leur activation automatique est refusée. Aucun cadeau n’est traité arbitrairement comme une carte.

## Automatismes

Toutes les automatisations sont désactivées par défaut. Une automatisation lie un moment à une animation existante, un son, un média ou une action du profil.

- Début du match : événement OPEN observé.
- Passage devant : croisement mesuré du score propre avec celui de l’adversaire, uniquement en duo identifié.
- Grande remontée : même croisement après un déficit au moins égal au seuil configuré, 1 000 points par défaut. Ce seuil est un choix ShenPulse, pas une valeur prétendument identique à une autre application.
- Égalité dans la dernière minute : scores mesurés égaux pendant la fenêtre de fin configurée, 60 secondes par défaut ; une seule fois par match.
- Rafale de likes : nombre de tapotages reçus pendant la fenêtre configurée, 300 sur 5 secondes par défaut.
- Snipe : entrée dans les dernières secondes configurées, 30 secondes par défaut ; une seule fois par match.
- Victoire / défaite : résultat confirmé, sans double comptage d’un paquet répété.

Les rôles et droits propres aux actions, jeux, IRL et overlays restent appliqués. Une action retirée, modifiée, désactivée ou hors profil n’est jamais remplacée par une autre.

## Compteurs, profils et confidentialité

`settings.matches` contient les widgets et automatisations du profil. `matchSession` contient l’état observé, les compteurs et un historique borné à 20 matchs. Les configurations, références de cadeaux, actions et données des autres profils ne sont pas modifiées.

La correction manuelle des manches modifie le compteur du duo courant ou un compteur manuel séparé. Elle ne réécrit ni le résultat TikTok ni la statistique des victoires confirmées. Les contributeurs LIVE utilisent les vrais cadeaux et likes du LIVE ; les utilisateurs bloqués ne déclenchent pas ces interactions.

Les données publiques des widgets excluent les UID Firebase, IDs de salons, historique, actions et automatisations. Un invité ne reçoit aucun ancien état Matchs. Les tests de widgets n’ajoutent aucun score, donateur ou victoire fictifs.

Les échéances sont annulées lors d’une déconnexion, d’un arrêt ou d’un changement de compte/profil. Les droits Pro et le contexte sont relus avant chaque effet différé. Les publications de contributions sont regroupées à quatre mises à jour par seconde au maximum ; aucun minuteur de polling n’est actif à l’arrêt.

## Vérification

Les tests automatisés couvrent le contrat, la normalisation SDK, la déduplication, les échéances, les seuils, l’identité du créateur, les widgets, les restrictions IPC/Pro, les profils et les projections publiques. Ils utilisent des connecteurs et effets factices : aucun vrai match TikTok, son, média ou appareil physique n’est déclenché.
