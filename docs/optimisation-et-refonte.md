# Optimisation et refonte — octobre 2026

## Objectif et périmètre

La refonte porte sur les sources propres à ShenPulse : processus Electron,
interface, jeux Vue/TypeScript, overlays, site, utilitaires, tests, extensions
natives et SDK. Les dépendances tierces, médias binaires et sorties compilées
ne sont pas des sources à réécrire. L'inventaire reproductible est disponible
avec `npm run architecture:audit -- --json`.

Les API, clés de stockage, profils, schéma de données, catalogues et droits
commerciaux sont conservés. La version reste 1.0.16 ; cette intervention n'est
pas une publication Store, Firebase ou du site.

## Organisation

| Ancienne concentration | Nouvelle responsabilité |
|---|---|
| dictionnaires de traduction : 7 531 lignes | 30 domaines par langue, façade de 6 lignes |
| runtime/installation des jeux : environ 2 690 lignes | façade et 13 modules métier |
| état : 1 809 lignes | façade de 356 lignes, migrations/profils/persistance isolés |
| compte : 1 928 lignes | façade et domaines OAuth/commerce/entitlements/HTTP |
| bridges de jeux : 1 148 lignes | façade et 7 modules spécialisés |
| catalogue principal : 1 388 lignes | jeux internes/externes, guides, effets et builders |
| catalogue Minecraft : 1 340 lignes | un module par mode |
| manifestes d'installation : 862 lignes | un manifeste par jeu |
| classe de scène 3D : 3 909 lignes après extraction des helpers | façade d'environ 500 lignes et composants de rendu explicites |
| réglages Coin Pusher : 1 599 lignes | façade de 22 lignes et modules par contrat |

Les tailles sont des repères de migration, pas un indicateur de performance.
Les détails et modules exacts sont dans [ARCHITECTURE.md](ARCHITECTURE.md),
les guides du renderer et les README des jeux.

## Optimisations de fonctionnement

- Les services lisent leurs réglages par projection, sans copier profils,
  historique et catalogue complet à chaque opération.
- La synchronisation des workspaces ne capture plus deux fois le même profil.
  Les champs immédiatement remplacés ne sont plus clonés inutilement.
- Les accès au compte et les déclenchements de bridges utilisent des vues ciblées.
- Un jeu et ses dépendances se chargent à sa demande, pas les quatre au démarrage.
  Les événements arrivant pendant cet import restent ordonnés et bornés.
- Le package local n'embarque plus les sources Vue/TS ni leurs PNG/MP3 originaux
  déjà compilés (environ 50 Mo de duplication). L'image WebP brute référencée
  par l'interface principale est conservée ; les sources restent dans le dépôt.
- Les widgets ont des moteurs distincts ; l'hydratation répétée a été retirée.
- Champs HTML, formatteurs, helpers de catalogues, HTTP, collections bornées
  et utilitaires de maintenance réutilisent des implémentations communes.
- La scène Three.js utilise une composition explicite et libère ses ressources ;
  huit collections CPU et six cibles de texture sont réutilisées par trame ; un
  recadrage UV inchangé ne provoque plus d'upload inutile. Les caches gardent
  leurs limites. Les calculs de fenêtres du Puissance 4 sont
  réutilisés, sans réutiliser une évaluation d'un ancien plateau.

Les optimisations de cadence réalisées juste avant cette refonte sont conservées :
checkpoint runtime de cinq secondes, coalescence du relais, aperçus à la demande,
suspension du rendu masqué sans interrompre live, interactions ni audio.

## Mesures et interprétation

Le bundle d'entrée des jeux passe d'environ 1,3 Mo à environ 466 Ko non compressés
lors de l'extraction initiale des chargements différés. Les autres chunks ne sont
chargés que pour le jeu choisi : cela réduit le travail initial, pas la taille
du jeu une fois ouvert.

Une capture synthétique de 100 profils avec 1 000 règles globales et 500 règles
de jeu a donné 903,6 ms / 5 200 clones avant, contre 369,5 ms / 900 clones après.
Ce test ciblé porte sur la capture des profils, pas sur la RAM totale de Windows.

Le rejeu de 100 chats sur la configuration locale (HTTP simulé, actions et
persistance désactivées) conserve zéro clone complet, 306 projections et deux
PATCH de 58 420 octets avant/après cette refonte. Un échantillon a donné 12,39 ms
avant et 13,58 ms après : pas de gain significatif revendiqué sur ce trajet déjà
optimisé. Utiliser plusieurs mesures dans les mêmes conditions, pas une seule
capture du Gestionnaire des tâches.

Découper un fichier ne suffit pas à réduire la RAM. Electron, WebGL, médias,
jeux ouverts et durée de session influencent sa consommation. Les tailles des
bundles, clones et CPU sont des métriques distinctes ; aucune promesse de rejoindre
une application affichant 25 Mo dans un autre contexte.

`npm run benchmark:live` utilise un état de test par défaut. Pour une comparaison
locale représentative, fournir `--state-file=CHEMIN` et éventuellement
`--baseline-asar=CHEMIN` vers une application antérieure. Le fichier est lu,
jamais chargé/sauvegardé par le store ; aucun connecteur réel n'est démarré.

## Contrôles de conservation

- Contrats IPC, exports publics, droits, sessions OAuth et retours de paiement.
- Migrations, isolation des comptes/profils, écritures atomiques et récupération.
- Empreintes identiques des traductions, catalogues et manifestes après extraction.
- Traces déterministes des jeux : règles, IA, gains, offres, physique, ressources.
- Opérations Canvas, arbres Three.js, matrices, géométries et libération GPU.
- Styles Vue compilés : sélecteurs, ordre, valeurs, keyframes et chemins d'assets.
- Chargement différé : ordre/rejeu/annulation des événements et démontage.
- Compilations GTA/Cult isolées, corps de méthodes et protocoles natifs identiques.
- Téléchargements simulés : taille, SHA-256, progression et refus d'URL non autorisée.

Les références dans `tests/fixtures/` et `catalog-architecture.test.js` ont été
capturées avant extraction. Ne pas les régénérer automatiquement pour masquer
une régression. Une évolution volontaire d'un catalogue ou d'une traduction
doit expliquer la modification de référence dans la revue.

## Validation locale de la refonte d’architecture

Cette section décrit le contrôle de la refonte initiale. Pour les pages créateur
remaniées ensuite et la validation à 1 097 tests, voir
[la refonte des espaces créateur](refonte-espaces-createur.fr.md).

`npm run verify` : 995 tests réussis, aucun échec. `npm run build:dir`
et la construction/validation locale du site réussissent également.
Les protocoles natifs exécutent 13 assertions GTA et 9 Cult avec succès.
Le package conserve l'entrée compilée des jeux et l'image WebP partagée, sans
sources Vue/TS ni médias PNG/MP3 de développement dupliqués.

Après redémarrage, le LIVE se reconnecte. Les trois profils et les 21 règles
du profil actif conservent leurs identifiants. L'accueil, les offres, les actions,
le catalogue et les réglages Coin Pusher sont contrôlés dans la vraie fenêtre
Windows, via le skill de contrôle d'application. Aucun déclencheur IRL manuel
n'est exécuté ; l'application est laissée sur l'accueil, LIVE connecté.

Un échantillon de trente secondes après relance, accueil au premier plan et LIVE
actif, donne 1,06 % de CPU machine, 669,4 Mio de mémoire privée engagée et
563 Mio de mémoire résidente privée pour quatre processus. Ce sont des mesures
de contexte, pas une preuve de baisse RAM : le prélèvement antérieur utilisait
une session ancienne et une visibilité différente. La mémoire privée engagée
est pratiquement inchangée (670,7 Mio auparavant).

## Limites de la validation

Les tests automatiques et compilations ne remplacent pas l'essai de chaque
version de jeu externe, périphérique MIDI/Stream Deck, appareil IRL, compte OBS,
Spotify ou scénario de paiement réel. Aucun paiement, upload d'assets, déploiement
cloud ou installation tierce n'est nécessaire à la validation de cette refonte.

Les binaires natifs distribués et leurs empreintes n'ont pas été remplacés.
Le SDK .NET n'a pas été recompilé : la machine possède le runtime, pas le SDK
de compilation. Voir [l'audit SDK/Python](audit-sdk-et-python.fr.md).

Le guide [MAINTENANCE.md](MAINTENANCE.md) décrit les commandes et garde-fous
pour éviter que les nouveaux modules ne deviennent les prochains monolithes.
