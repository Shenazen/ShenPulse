# Cadeaux : retrouver les sélections enregistrées

## Origine des cadeaux sans image

Le catalogue embarqué fusionné contient actuellement 4 077 cadeaux, dont
1 399 cadeaux à un diamant. L'ancien chargement initial était limité aux
1 000 cadeaux les moins chers. Des cadeaux pourtant présents dans le catalogue
complet n'atteignaient donc jamais les caches d'affichage : Forever Rosa,
Sunglasses, Corgi, Lion, Voiture de course, Chat et Trésor de pirate notamment.

Le catalogue accepte maintenant un chargement initial complet, borné à
10 000 entrées. Les recherches ciblées conservent leur propre limite : il ne
s'agit pas de recharger tout le catalogue à chaque événement LIVE.

## Règles de récupération du catalogue

- Une réponse partielle d'une nouvelle salle ne supprime plus les cadeaux
  localisés déjà connus pendant l'exécution de ShenPulse. L'ensemble localisé
  reste borné à 10 000 entrées et les réponses récentes enrichissent les mêmes ID.
- Un événement LIVE peut compléter ou actualiser l'image d'un ID déjà connu.
  Auparavant, cet événement était immédiatement ignoré dès que l'ID existait.
- Les métadonnées absentes d'un événement ne remplacent pas le prix, le nom
  affiché, les propriétés de combo ou les références de l'entrée connue.
- Les anciens ID et noms sont conservés comme alias. Un événement utilisant
  un alias déjà reconnu ne change pas l'ID canonique existant.
- Deux ID numériques distincts ne sont jamais regroupés sur le seul nom,
  le prix ou le dessin. Les alias techniques explicitement déclarés et la
  famille de cœur identifiée par le résolveur partagé restent pris en compte.
- Les anciens slugs peuvent être reliés à un ID numérique uniquement lorsque
  leur dessin et leur prix correspondent à un seul groupe technique connu.
  Deux slugs sans cette preuve ne sont pas fusionnés entre eux.
- Les événements identiques ne reconstruisent pas le catalogue : les objets
  du catalogue restent inchangés tant que leur identité et leurs données utiles
  ne changent pas.
- Le cache des cadeaux appris pendant le LIVE est lui aussi limité à
  10 000 entrées. Une entrée nouvelle ou enrichie reste conservée ; en cas de
  dépassement, la plus ancienne entrée du cache est évincée. Les sources
  embarquées et localisées ainsi que les références sauvegardées des profils
  ne sont pas supprimées par cette borne.
- L'image issue d'un événement LIVE valide est prioritaire sur les anciennes
  sources. Le cœur de communauté conserve l'harmonisation dédiée de son visuel
  de catalogue ; son identité logique reste indépendante de ce dessin.

La conservation des salles précédentes est un cache de catalogue en mémoire,
pas une publication ni une nouvelle synchronisation des fichiers utilisateurs.
La reprise des sélections après une mise à jour utilise en complément les
références enregistrées et leur réconciliation non destructive.

## Correspondances vérifiées

Les associations ci-dessous sont déjà présentes dans les deux catalogues
embarqués :

| Ancienne référence | ID TikTok conservé |
| --- | --- |
| `forever-rosa` | `8914` |
| `sunglasses` | `5509` |
| `corgi` | `6267` |
| `pirate-s-treasure` | `17357` |
| `sign-language-love` | `8259` |

Le libellé historique « Amour en langue des signes » est explicitement ajouté
à l'ID `8259`, dont le catalogue TikTok indique « Amour en langage des signes ».
Il utilise le même visuel `a90213d1783ef37bf68d1c7d4a0f4d4b`. Cette correction
est fondée sur une correspondance connue, pas sur une recherche approximative.

Un prix identique ou un dessin commun ne suffit pas à identifier deux cadeaux
techniquement distincts. Un cadeau inconnu reste une référence inconnue ; il
ne doit pas être remplacé silencieusement par un cadeau voisin.

Le slug `voiture-de-cou` est conservé avec son image et son nom historiques.
Les ID `7063` et `7286` possèdent le même nom, le même prix et le même dessin
dans le catalogue disponible, mais aucune donnée ne prouve qu'il s'agit
d'alias techniques. Les trois références restent donc indépendantes. Il en
va de même pour les quinze ID « Chat » à 222 diamants.

Après normalisation des variantes de format d'un même hash TikTok, l'audit
identifie 37 groupes de noms/prix couvrant 115 ID numériques dont les
références d'images sont réellement différentes :
« Je t'adore » (`6890`, `15231`), « Cœur » (`6247`, `7774`) ou « Chat porte
bonheur » (`6066`, `14682`) notamment. L'ancien catalogue réduisait ces groupes
à une seule entrée et inventait ainsi des alias. Le catalogue corrigé
conserve tous les ID numériques indépendants hors famille vérifiée.

Pour les noms ambigus dont tous les cadeaux connus partagent le même dessin
et le même prix, le résolveur partagé `giftVisualUrl` peut retrouver uniquement
ce dessin commun. Il ne choisit aucun ID et ne modifie pas les déclencheurs.
Les variantes `.png` ou `.webp` d'un hash TikTok de 32 caractères sont reconnues
comme le même dessin, pas comme le même cadeau. Les différents ID de
« Crinière de lion », par exemple, restent indépendants malgré leur image
commune. Cette équivalence ne s'applique pas arbitrairement à tous les noms
de fichiers de sites externes.

Un ID inconnu portant simplement le nom « Heart Me » ne reçoit pas la famille
du cœur actuel ni son image : seules les références techniques autorisées,
les anciennes références sans ID et la preuve de protocole TikTok conservent
ce traitement dédié.

Certains anciens noms sans ID sont réellement ambigus : « Gants de boxe »
désigne des cadeaux à 299 ou 1 999 diamants, « Love You » des cadeaux à 1 ou 199,
« Rosa » un cadeau personnalisé à 1 ou le cadeau à 10 et « Voiture de sport »
des cadeaux à 4 999 ou 7 000. Un ID connu, ou un nom exact accompagné du coût
déjà enregistré, permet de les distinguer. Un nom seul ne doit pas entraîner
une réaffectation arbitraire. « TikTok » et « Galaxy », en revanche, disposent
d'une correspondance unique dans le catalogue embarqué actuel.

## Exports d'images des interactions de jeux

`src/renderer/game-overlays/gifts.mjs` utilise également une résolution stricte.
Le regroupement des options repose sur leurs ID et les alias techniques
explicitement déclarés, y compris les chaînes d'alias transitives. Il ne repose
plus sur le nom, le dessin ou le prix. Deux ID distincts restent donc présents,
même s'ils affichent temporairement le même libellé ou la même image.

Une référence `gift:<ID>` inconnue n'est jamais remplacée par une option dont
le nom lui ressemble. Les anciens choix `gift-name:<nom>` sont repris seulement
si leur nom ou un alias déclaré désigne une seule option. Les anciens ID
`5886` et `11046`, par exemple, ne sont pas fusionnés automatiquement au seul
motif que les deux options s'appellent « Galaxy » ou « Galaxie ».

La normalisation conserve les lettres non latines. Ainsi « TikTok 화산 » ne
devient plus « TikTok » et « هيا يا Galaxy » ne devient plus « Galaxy ».
Cette distinction évite des faux homonymes lors de la reprise des anciens noms.

Après modification du module maintenable, `npm run overlays:build` régénère
le bundle navigateur. Les contrôles Canvas vérifient que la disposition et
les rendus graphiques des exports existants restent identiques.

## Contrôles automatiques

`node --test tests/gift-catalog-recovery.test.js tests/catalogs.test.js tests/gift-catalog-integrity.test.js tests/game-overlay-gift-identity.test.js`

Les tests couvrent le chargement complet, les anciens slugs, l'alias `8259`,
les catalogues de salles partiels ou en erreur, l'enrichissement d'un ID connu,
la priorité du visuel LIVE, la conservation des métadonnées et des alias,
l'absence de reconstruction à chaque cadeau et la limite maximale de recherche.
Un contrôle exhaustif des 3 711 entrées TikTok embarquées vérifie qu'aucun
autre ID numérique n'est ajouté à chaque cadeau, hors famille de cœur vérifiée.
Les tests d'export couvrent en complément les homonymes, les dessins communs,
les ID inconnus, les alias transitifs, les anciennes références et la
non-mutation des options conservées dans les profils.
