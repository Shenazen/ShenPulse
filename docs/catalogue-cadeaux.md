# Catalogue cadeaux : identité et visuel

Le cadeau **Cœur sur moi** correspond uniquement aux identifiants `7934` et
`heart-me` (libellés historiques `Heart Me` et `Envoie-moi un cœur`). Son image
est toujours le **cœur rouge souriant au clin d'œil et au bord doré**, y compris
si TikTok renvoie une composition personnalisée pour cette même entrée.
L'ancienne icône dorée entrelacée `17712` n'est plus proposée dans les nouveaux
choix ; elle reste uniquement dans les références historiques.

Un cadeau personnalisé est une identité indépendante : dans la réponse TikTok
vérifiée le 16 octobre 2026, `157842` s'appelle exactement **Shenazen Pulse**.
Son nom et son image personnalisée sont conservés. Ni un prix d'une pièce, ni
une image composée, ni un ancien alias incorrect ne doivent le renommer
« Cœur sur moi » ou le faire déclencher à la place du cœur rouge.

`src/shared/gift-identity.js` centralise la base neutre HTTPS fournie par le
[CDN TikTok](https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/heartme_outfit/base_heartme_composition.png~tplv-obj.webp),
vérifiée visuellement le 15 octobre 2026. Le fichier fournisseur n'est ni généré
ni retouché. Les JSON sources restent intacts pour conserver leur provenance.
`src/main/catalogs/gifts.js` harmonise seulement le catalogue **historique de
références** de cette famille, distinct de la liste actuelle du créateur.

## Liste du créateur et doublons

La recherche fournit deux listes distinctes : les références historiques pour
résoudre les anciennes règles et les cadeaux renvoyés par TikTok pour la salle
du `@` configuré. Le sélecteur commun (actions, sons, jeux, overlays et simulateur)
affiche cette dernière par défaut. Le catalogue global reste accessible
explicitement, avec un avertissement de disponibilité non garantie.

Les variantes régionales partageant réellement le même visuel et le même prix
sont regroupées à l'affichage. Leurs identifiants restent consultables dans
« Autres variantes » : aucune équivalence de déclenchement n'est déduite d'une
image ou d'un nom. Les prix et dessins différents ne sont pas masqués ensemble.

Les images personnalisées restent dans un cache de salle séparé. Un changement
de compte, profil, `@` ou salle empêche la réutilisation de l'ancien contexte ;
les réponses asynchrones obsolètes sont rejetées. Le cache de disponibilité est
borné à douze salles et six heures. Une liste observée uniquement à partir des
cadeaux réellement reçus est marquée partielle, jamais présentée comme complète.
Si TikTok ne fournit pas le catalogue du créateur, le repli global est signalé.

## Préservation des associations

- La réconciliation déjà présente au démarrage et après enrichissement du
  catalogue actualise les images enregistrées dans les actions, sons, jeux,
  roues et profils, y compris les espaces de comptes inactifs. La correction
  ciblée `heart-identity-v2` dispose de sa propre sauvegarde permanente,
  `shenpulse-state.before-gift-identity-v2.json`, même si une sauvegarde v1 existe.
  Si sa création échoue, aucune correction n'est appliquée.
- Les anciennes métadonnées de `157842` peuvent retrouver leur nom fournisseur
  exact et perdre leurs faux alias cœur. Les références `17712` ne sont
  réattribuées à `7934` que si les métadonnées prouvent l'ancienne confusion
  avec le cœur rouge. Les références inconnues ne sont jamais devinées.
  Les prix sauvegardés, effets, délais et actions associés restent préservés.
- Les règles des profils, les interactions des jeux et les sons continuent
  d'identifier les cadeaux par ID ou famille, jamais par leur image.
- Les visuels personnalisés des cadeaux distincts du catalogue de salle et des
  événements LIVE vérifiés restent disponibles dans l'interface et dans
  `giftImageUrl` ; seul le vrai cœur garde toujours sa base rouge. Un événement manuel,
  une API locale ou une autre salle ne peut pas personnaliser la liste courante.
- Le cache du renderer remplace ses anciens objets par les objets actualisés,
  y compris derrière les alias de noms et d'ID déjà chargés. Cela évite un ancien
  visuel dans les listes ou les sélecteurs après un rafraîchissement.

La récupération des cadeaux de la salle utilise `fetchAvailableGifts()` du
[connecteur embarqué](https://github.com/zerodytrash/TikTok-Live-Connector), qui
appelle `gift/list/` avec le `room_id`. Ce connecteur est **non officiel** : le
catalogue local reste disponible si TikTok ne répond pas. Les identifiants des
cadeaux et leurs visuels peuvent évoluer; ce test n'est pas une garantie sur
tous les cadeaux futurs ou personnalisés.

## Contrôle

`node --test tests/gift-room-catalog.test.js tests/gift-room-integration.test.js tests/gift-picker-display.test.js tests/gift-catalog-integrity.test.js tests/gift-renderer-recovery.test.js tests/gift-upgrade-migration.test.js tests/gift-heart-identity-correction.test.js tests/state-gift-heart-backup.test.js tests/gift-game-identity-recovery.test.js tests/gift-identity.test.js tests/catalogs.test.js`

Les tests vérifient la base rouge neutre pour les identifiants reconnus, sa
conservation après rafraîchissement du catalogue, l'identité distincte des
cadeaux personnalisés et la préservation du prix et des actions. Ils couvrent
la réparation ciblée des anciennes confusions dans plusieurs profils/comptes,
la sauvegarde v2, l'idempotence, les badges et sélecteurs, les jeux intégrés,
ainsi que la non-mutation des sources et des événements LIVE.
