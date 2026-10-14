# Base Utilisateurs et modération

La page Utilisateurs possède une base locale cumulative, séparée du résumé du
LIVE courant ou précédent du tableau de bord. Elle n'est pas un annuaire public
Firebase : les contributions observées et la liste de blocage restent dans
l'espace local du compte ShenPulse actif.

## Identité, compte et rétention

Une identité est composée de **plateforme + streamer + ID du spectateur**.
Deux comptes TikTok et Kick de même nom ou même ID ne sont jamais rapprochés
automatiquement. Le nom affiché et la photo peuvent évoluer sans perdre les
contributions liées à l'ID technique. Le changement de profil de jeu ne change
pas cette base ; le changement de compte ShenPulse charge une base distincte.

Les compteurs `diamonds`, `events`, `likes`, `gifts`, `comments` et `shares`, ainsi
que `firstSeen` et `lastSeen`, sont conservés. `diamonds` représente la valeur
unitaire fournie par la source multipliée par la quantité : pièces TikTok ou
valeur native Kick, **pas une conversion en euros ni un revenu garanti**.
Les rangs sont des paliers propres à ShenPulse, sans avantage ou droit associé.

Chaque rang possède une icône affichée avant son libellé dans les filtres, le
tableau, le rang dominant et les fiches détaillées. Ces quatre présentations
utilisent les mêmes métadonnées partagées avec le moteur de classement. Les
icônes sont décoratives (`aria-hidden`), les noms des rangs restent accessibles
aux lecteurs d'écran. Le survol reprend la condition du rang partagée avec le
moteur, sans second barème propre à l'interface. Aucun téléchargement d'image
ni lecture supplémentaire de la base n'est nécessaire pour ces icônes.

### Conditions des onze rangs

Le barème existant est conservé : les seuils exacts d'une autre application
n'ont pas été confirmés et ne sont pas inventés. L'icône et la couleur sont
des repères visuels ; ils ne changent ni les contributions ni les droits.
Le moteur, les filtres, les badges et le guide dépliable de la page utilisent
`src/shared/viewer-ranks.js`, seule source des paliers.

| Rang | Minimum de contribution cumulée |
| --- | ---: |
| 🌱 Nouveau | 0 |
| 🔰 Fan | 1 |
| 💙 Supporter | 10 |
| ⭐ Actif | 50 |
| 💎 Fidèle | 100 |
| 🏆 VIP | 500 |
| 👑 Légende | 1 000 |
| 🌟 Mythique | 5 000 |
| 🔱 Divin | 10 000 |
| 🌌 Cosmique | 50 000 |
| ☄️ Immortel | 100 000 |

Le plus haut seuil atteint est appliqué, bornes incluses. Par exemple, 499
contributions donnent Fidèle ; 500 donnent VIP. Les rangs sont calculés depuis
les contributions, jamais importés comme des libellés autoritaires. Un nouveau
barème pourra donc recalculer les rangs sans effacer l'historique.

La fiche détaillée indique aussi le **prochain rang**, les contributions qui
restent à atteindre et une barre de progression dans le palier courant. Par
exemple, 300 diamants donnent Fidèle, avec 200 diamants restants avant VIP :
la barre est à 50 % de l'intervalle 100–500, pas à 60 % d'un objectif depuis zéro.
`progressForDiamonds` dérive ces valeurs du même contrat partagé. Au rang
Immortel, la fiche indique « Rang maximal atteint » sans inventer de palier
suivant. Cette présentation est propre à ShenPulse, et ne prétend pas reproduire
des conditions externes non vérifiées.

Le calcul est purement visuel : aucun historique, profil ou compteur n'est
modifié. Il n'ajoute ni polling, ni timer, ni lecture de la base. Les libellés
et l'accessibilité de la barre sont traduits FR ↔ EN ; les boutons de filtres
exposent leur état sélectionné (`aria-pressed`), y compris « Tous ».

- Seuls les cadeaux réels ajoutent à la contribution : valeur unitaire entière
  non négative × quantité reçue. Likes, commentaires, partages, follow,
  abonnements ou durée de présence ne changent pas le rang.
- Le cumul traverse les LIVE et les profils de jeu, mais reste séparé par
  compte ShenPulse et par identité plateforme + streamer + ID du spectateur.
- `NaN`, valeurs infinies, booléens, objets et valeurs négatives ne peuvent pas
  donner artificiellement un rang supérieur. Les chaînes numériques finies
  restent compatibles ; les décimales sont ramenées à l'entier inférieur,
  comme les compteurs persistés.
- Bloquer un viewer ne réécrit pas sa contribution passée. Les imports répétés
  ne doublent pas les totaux ; une fusion manuelle explicite peut les additionner.
- Les séries TikTok incomplètes sont filtrées et les callbacks natifs déjà
  dédupliqués avant ingestion. Un relais personnalisé doit émettre chaque
  contribution terminale une seule fois : aucune déduplication globale
  arbitraire ne retire de vrais cadeaux distincts.

La base est bornée à **10 000 spectateurs par compte**, toutes plateformes et
tous streamers confondus. Lorsqu'une nouvelle identité dépasse cette limite,
la plus ancienne ligne conservée est évincée. Les anciens historiques non
collectés ne peuvent pas être reconstruits : la collecte démarre à cette mise
à jour. Les événements de simulateur/démo et les utilisateurs anonymes ne sont
pas enregistrés comme audience réelle.

## Performance et persistance

- `ViewerService` utilise des index réutilisés pour les ID et les alias.
- L'enregistrement LIVE passe par `mutateRuntime`, sans snapshot complet ni
  duplication de tous les profils à chaque événement. La sauvegarde suit le
  checkpoint existant de 5 secondes et la sauvegarde finale à la fermeture.
- La base complète est exclue du snapshot général du renderer. La page demande
  au maximum 200 lignes via l'API `users:snapshot`, avec recherche, rang, tri,
  streamer et pagination.
- Le résumé visuel runtime conserve les statistiques scalaires, les comptes
  de participants, les 120 points des courbes et seulement les cinq principaux
  donateurs. Le classement de donateurs est indépendant du tampon de 1 000
  participants récents, pour garder les contributions d'un donateur ancien.
  La persistance et les lectures internes restent complètes.

## Modération globale des interactions

Bloquer un spectateur dans ShenPulse coupe ses commandes, actions, jeux,
voix et autres interactions déclenchées par son événement. Son événement reste
comptabilisé dans les statistiques : bloquer ne réécrit pas le bilan du LIVE.
L'événement brut n'est pas transmis aux fenêtres de jeux ou aux overlays
interactifs. **Cela ne bannit pas son compte sur TikTok ou Kick.**

Les listes de `@` sont limitées au streamer et à la plateforme concernés.
Supprimer des lignes ou vider l'historique ne supprime pas automatiquement
leurs blocages ; ceux-ci se changent explicitement via la liste de modération.
Les mutations de modération sont sauvegardées immédiatement.

### Consulter et retirer un blocage

Le bouton **Utilisateurs bloqués**, dans la zone Modération, ouvre une liste
privée repliable avec le nombre de blocages. Chaque entrée indique la plateforme,
le `@` et le streamer concernés ; un bouton **Débloquer** retire uniquement ce
blocage, sans effacer la fiche, les contributions ou les autres blocages.
Cela fonctionne également pour un `@` saisi manuellement qui n'a jamais interagi,
une fiche supprimée ou un ancien blocage par ID sans pseudo. Les doublons d'un
même `@`, sur une même plateforme et un même streamer, sont regroupés.

La liste suit le filtre Streamer de la base. **Tous les streamers** permet de
retrouver les blocages d'anciens LIVE ; la liste des streamers inclut aussi ceux
qui n'ont plus que des blocages et aucune fiche historique. TikTok et Kick ne
sont jamais confondus, même avec le même pseudo. La recherche et le filtre de
rang de la base ne masquent pas cette liste de modération.

Les entrées détaillées sont demandées via `users:snapshot` uniquement quand la
liste est ouverte (`includeBlocked`, `blockedLimit`, `blockedOffset`), par pages
de 50 et avec un plafond de 200 lignes par réponse. Le panneau n'ajoute aucun
timer, polling ou lecture Firebase. Le nombre de blocages reste disponible quand
il est fermé, sans cloner les métadonnées des fiches. Après un retrait sur la
dernière page, la pagination revient automatiquement à une page valide.

`users:unblock` cible une identité explicite plateforme + streamer + pseudo
(ou l'ID d'une ancienne fiche sans pseudo), plutôt que de remplacer toute une
liste potentiellement obsolète. Les nouvelles entrées enregistrées entre-temps
restent conservées. Le canal garde les contrôles d'authentification et de fenêtre
principale des autres opérations privées. Les réponses et opérations tardives
d'un ancien compte ne repeignent pas la liste ni ne modifient le nouveau compte.
L'IPC exige également l'UID du compte capturé avant le clic et le compare à
l'UID réellement actif avant la mutation synchrone. Une identité publique
identique présente dans deux comptes ne permet donc pas un déblocage tardif
dans le compte qui vient d'être sélectionné. Aucun UID n'est affiché dans la liste.
Un brouillon non enregistré dans le champ de modération reste intact.

## Import, export et opérations explicites

Le format JSON pris en charge est `shenpulse-viewers`, version 1. Les exports
contiennent uniquement les champs publics utiles à cette base et la liste de
modération : aucun UID ShenPulse, token, secret ou contenu de message.

Les imports sont limités à 20 Mo et 10 000 lignes. Les prototypes, accesseurs,
identités invalides et valeurs non autorisées sont refusés. Les champs inconnus
ne sont pas recopiés. Réimporter la même identité reprend le maximum de chaque
compteur, pas une addition répétée. Aucun fichier d'état utilisateur existant
n'a été modifié manuellement pendant cette implémentation.

La fusion manuelle demande des lignes du même `@`, de la même plateforme et
du même streamer. Elle additionne leurs contributions et garde leurs anciens
ID comme alias, dans la limite de 32 alias. Elle ne prétend pas démontrer que
deux ID différents appartiennent à la même personne : la sélection est une
décision explicite de l'utilisateur.

`cleanup` retire uniquement les lignes à zéro contribution en pièces de la
portée sélectionnée ; `remove` supprime une ligne et `clear` les lignes de cette
portée. L'interface demande confirmation. Ces opérations n'ont pas été
exécutées sur la base réelle de l'utilisateur pendant les tests.

Tous les canaux `users:*` exigent un compte authentifié et le renderer principal
local de ShenPulse ; les fenêtres de jeux, sous-cadres et pages distantes ne
peuvent pas lire ou modifier cette base.

Tests : `tests/viewer-service.test.js`, `tests/viewer-ranks.test.js`,
`tests/creator-users-music.test.js`, `tests/runtime-statistics-projection.test.js`
et `tests/users-ipc.test.js`.

### Contrôle de la retouche des rangs — 13 octobre 2026

- Onze icônes observées dans la référence, puis reprises sous forme d'emojis
  système : aucun asset téléchargé, aucun nouveau polling ou accès Firebase.
- Barème historique conservé, conditions générées depuis les minima du contrat
  partagé. Les seuils de la référence ne sont pas présentés comme vérifiés.
- Traduction FR ↔ EN des rangs et de leurs conditions, limitée aux badges
  statiques de l'interface : un spectateur nommé « Actif » garde son vrai nom.
- `npm run verify` : **1 227 tests réussis, zéro échec**. Les nouvelles vérifications
  couvrent les onze intervalles, les valeurs invalides, les quantités de cadeaux,
  les événements non-cadeaux, les imports et les langues.
- Compilation locale validée ; les cinq fichiers runtime modifiés sont comparés
  octet par octet avec leur version empaquetée. Aucun historique réel n'a été
  supprimé, fusionné, nettoyé ou réimporté pour les vérifications.

Les journaux de cette intervention sont conservés localement sous
`release/utilisateurs-rangs-verification.log`,
`release/utilisateurs-rangs-build.log` et
`release/utilisateurs-rangs-repack.log`. Aucune publication PROD n'a été faite.
