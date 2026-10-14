# Réparation des associations de cadeaux existantes

## Pourquoi une migration est nécessaire

Actualiser le catalogue ne suffit pas à actualiser les sélections déjà
enregistrées. Un ancien profil peut garder une image erronée ou un identifiant
historique, alors que le catalogue propose déjà le cadeau courant.

La réconciliation est définie dans
`src/main/state/gift-upgrade-migration.js`. Le catalogue et les références
utilisent le même résolveur de `src/shared/gift-identity.js`.

## Références traitées

- Conditions exactes `data.giftName` des actions, sons et interactions IRL.
- Conditions des interactions de tous les packs de jeux, actifs ou inactifs.
- Cadeaux des réglages intégrés : règles Coin Pusher, barrières, dé, tickets,
  et cadeau d'inscription de Thiercelieux.
- Déclencheurs spécifiques des roues d'overlays, y compris les anciens
  déclencheurs qui ne mémorisaient que le nom.
- Copies de tous les profils et de tous les comptes locaux, pas seulement
  celles affichées à l'écran ; l'espace historique non revendiqué est inclus.
- Imports anciens dans le compte connecté, avec le dernier catalogue chargé.

Les archives LIVE, files d'inscription, joueurs et autres historiques ne sont
pas réécrits : ils décrivent ce qui a réellement été reçu à ce moment-là.

## Garanties

Un ID connu ou un alias confirmé est prioritaire. Sans ID, seul un nom exact
non ambigu peut établir un lien. Un prix seul, une image ou une ressemblance
de libellé ne permettent jamais de réattribuer un cadeau.

La réparation conserve l'identifiant sélectionné, ajoute les alias confirmés
et remet l'image du catalogue si elle est disponible. Un cadeau hors catalogue
et son image sauvegardée restent conservés. Une image vide dans le catalogue
ne supprime jamais une image existante.

Quand plusieurs cadeaux homonymes partagent exactement le même prix et le même
visuel non vide, le résolveur `giftVisualUrl` peut réparer cette image commune
sans choisir d'ID. Dans ce cas, aucun identifiant, alias ou famille n'est ajouté :
seule l'apparence change, jamais l'association ni la logique de déclenchement.
Des prix différents ou des images différentes interdisent ce secours visuel.

Les noms saisis, prix, critères de montant, quantités, actions, délais,
sélections aléatoires, états activés/désactivés et identifiants de règles ne
sont pas modifiés. Les roues filtrées par montant restent des filtres par
montant ; les conditions partielles `contains` ne deviennent pas des cadeaux
spécifiques.

## Sauvegarde et idempotence

`StateStore.reconcileGiftReferences(gifts)` prépare d'abord tous les changements
sans modifier l'état. Avant le premier changement, il écrit et valide une
sauvegarde permanente dans le dossier de données de l'application :

`shenpulse-state.before-gift-references-v1.json`

Cette sauvegarde n'est jamais remplacée par les réconciliations suivantes.
Si sa création ou sa validation échoue, aucune référence n'est modifiée.
Les références sont ensuite appliquées et sauvegardées par la persistance
atomique habituelle. Un deuxième passage avec le même catalogue ne modifie
rien et ne provoque pas de nouvelle écriture.

Le démarrage, l'actualisation du catalogue et les imports utilisent une
sauvegarde immédiate. Les métadonnées réellement nouvelles apprises pendant
le LIVE peuvent demander `{ immediate: false }` : l'état est réparé aussitôt,
mais son écriture est regroupée par le délai de configuration habituel. Un
passage identique ne repousse pas ce délai. La sauvegarde permanente préalable
reste obligatoire dans les deux cas.

Le passage ne dépend pas d'un unique numéro de version bloquant : un nouveau
catalogue peut apporter de nouveaux alias ou visuels, qui seront pris en compte
sans réinitialiser les configurations.

## Vérification

`tests/gift-upgrade-migration.test.js` vérifie les profils et comptes dormants,
les sons/IRL/jeux/roues/réglages intégrés, les références hors catalogue,
la sauvegarde avant changement, l'échec de sauvegarde sans modification,
l'absence de perte des actions et critères, l'idempotence, les imports anciens
et le chargement d'une version antérieure sans workspaces.

L'import prépare et réconcilie une copie de l'état. L'état en mémoire n'est
remplacé qu'après une écriture atomique réussie. Si la sauvegarde préalable
ou l'écriture finale échoue, les profils/comptes d'origine et leurs échéances
de sauvegarde restent inchangés ; un futur `flush()` n'applique jamais cet
import partiel. Ces deux scénarios sont vérifiés séparément.

Les tests utilisent exclusivement des états synthétiques et des répertoires
temporaires, jamais les données réelles d'un utilisateur.

## Confirmation ponctuelle d'une variante ambiguë

Lorsque l'utilisateur confirme le prix d'un ancien cadeau homonyme sans ID,
`collectGiftReferenceUpdates` accepte l'option `confirmedVariants`, une liste
de `{ name, cost }`. Chaque couple doit résoudre exactement un cadeau dans
le catalogue. Une variante absente, toujours ambiguë, un prix invalide ou deux
confirmations contradictoires provoquent un refus avant toute modification.

L'option `onlyConfirmed: true` limite le passage à ces anciennes références.
Les sélections possédant déjà un ID, des alias techniques ou un prix différent
restent intactes. Le nom de la condition est conservé ; l'ID, ses alias vérifiés,
son image et son prix confirmé sont ajoutés. Les actions, quantités, délais,
états activés et conditions de montant ne changent pas.

Ces confirmations ne sont ni des valeurs par défaut globales, ni une fusion
des cadeaux homonymes. La migration automatique ordinaire continue à refuser
une identité ambiguë. Les identifiants enregistrés permettent ensuite au
moteur de distinguer les différentes variantes lors des événements LIVE.

Le script `scripts/repair-confirmed-gift-variants.js` fournit un aperçu par
défaut, avec des arguments `--state <fichier>` et `--gift "Nom=Prix"` répétés.
`--apply` demande une écriture explicite : ShenPulse doit être fermé, une
sauvegarde permanente séparée est conservée, puis le contenu est revérifié
avant la sauvegarde atomique. Seuls les profils et copies du compte actif
sont traités ; les autres comptes et l'espace non revendiqué restent intacts.

`tests/gift-variant-confirmation.test.js` vérifie la préparation sans mutation,
la conservation du comportement des règles, l'idempotence, les variantes
invalides, les roues et réglages intégrés, ainsi que l'acceptation du bon
cadeau et le rejet de ses homonymes. Les tests du script vérifient également
l'isolation entre comptes et les garanties de sauvegarde.
