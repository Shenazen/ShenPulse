# Listes créateur compactes

## Périmètre

La refonte est limitée à la présentation du tableau de bord, des sons, des
machines IRL et des commandes. Aucun profil, appareil, association de cadeau,
commande ou automatisation enregistré n'est migré ni supprimé.

## Tableau de bord

Le simulateur garde ses sept types d'événements et son circuit de test existant.
Le cadeau et sa quantité occupent leurs propres colonnes plutôt qu'une ligne
pleine. Les cadeaux récents deviennent de petits raccourcis de largeur bornée.
Pour Likes, Follow, Message, Partage, Abonnement et Arrivée, le sélecteur, la
photo et les raccourcis cadeaux sont absents du DOM, pas seulement désactivés.
La quantité n'est présentée que pour cadeau/likes.

Le changement de type reconstruit uniquement le simulateur, préserve le
spectateur saisi et ne recrée pas les KPI ou le chat. Les mises à jour LIVE
ne réaffichent pas les cadeaux dans un simulateur d'un autre type. Le submit
n'inclut aucune métadonnée de cadeau pour un événement non-cadeau.

Le bouton d'envoi peut toujours exécuter des actions configurées, y compris
des appareils physiques : le contrôle visuel ne doit jamais cliquer dessus.

## Sons et voix

Les outils sont directs : lecture/test, modification, duplication et corbeille.
L'ancien menu trois-points et sa modification en double sont retirés. Le
bouton Supprimer conserve le gestionnaire et la confirmation existants, avec
les mêmes identifiants de règle, action et index d'action historique.
« Diffusion & réglages » reste disponible, replié par défaut.

## Machines IRL

Le menu et la bannière portent désormais « Machines IRL ». La route interne
`irl`, les contrôles Pro et la configuration gardent leur identité historique.

Les prises et « Mes interactions » utilisent des tableaux compacts :

- Prises : nom/modèle, état réseau, adresse/identité, cinq opérations de test,
  renommer et retirer. Aucun bouton de test n'est caché derrière un menu.
- Interactions : nom, déclencheur, appareil/action, statut et contrôles.
  Éditer, activer, tester et supprimer gardent leurs références exactes.
- Recherche, mode occupé, appareils non pilotables et relais manquants
  conservent les restrictions précédentes. Le rendu ne découvre ni ne pilote
  automatiquement les appareils.

Sur une petite fenêtre, le défilement horizontal appartient au tableau, pas
à toute la page. Les outils restent accessibles sans rétablir les grandes cartes.

## Commandes

Chaque commande fonctionnelle occupe une ligne : `!commande`/alias, effet,
accès/plateformes, délais, statut et aperçu/modifier/supprimer. Les réponses
texte et messages historiques restent stockés mais invisibles comme auparavant.
Les aperçus restent locaux. Le journal et les états vides sont également réduits.

## Composants et vérification

`app/core/components.js` expose `renderCompactResourceTable`, réutilisé pour
les deux listes IRL et les commandes. Les cellules HTML sont construites par
les composants internes ; identités, labels et attributs de données sont échappés.
Seuls les attributs `data-*` autorisés sont transmis. Le composant n'ajoute
aucun événement, timer ou appel réseau. Son style commun est isolé dans
`styles/compact-resource-table.css`.

Les tests DOM exécutent les vrais rendus et les vrais contrats de boutons :
`dashboard-live-layout`, `renderer-components`, `automation-audio-table`,
`irl-visual-layout`, `creator-chatbot` et `creator-navigation`. Les tests métier
IRL et des commandes restent distincts des contrôles de présentation.

`scripts/verify-compact-creator-layout.js` charge l'index réel dans un profil
Electron temporaire, avec des données artificielles et une API qui refuse les
actions. Il contrôle deux tailles de fenêtre et produit des captures locales.
Le réseau externe et la sortie sonore sont neutralisés. Aucune prise ni
commande réelle ne doit être utilisée pour vérifier cette refonte.

## Contrôles du 14 octobre 2026

- Suite complète de tests réussie ; lint de 651 fichiers JavaScript et
  967 sources inventoriées, sans cycle d'import.
- Index réel vérifié en Chromium isolé à 1 440 × 1 000 et 1 000 × 800.
  Aucun débordement horizontal du document ou du contenu ; seules les tables
  défilent horizontalement lorsque leur contenu le nécessite.
- Cinq prises : 57–65 px par ligne ; trois interactions : 56–57 px ; commandes :
  63–81 px ; alertes sonores : 73 px, quatre outils directs sans menu.
- Le champ cadeau occupe moins de 60 % de la largeur du simulateur en grand
  format. Follow ne présente ni champ, ni image, ni raccourci cadeau. Le test DOM
  couvre les six types non-cadeau et leurs mises à jour LIVE.
- Zéro appel réseau, lecteur audio, effet physique, mutation ou erreur de
  renderer lors du contrôle visuel. Les chiffres viennent de données factices.
- Paquet complet installé et audité : 1 800 sources/ressources conformes au
  workspace, protection des 21 vidéos Matchs et correctif audio conservés.
- ShenPulse relancé avec le nouveau menu « Machines IRL ». Profils, règles,
  commandes, timers, médias, paramètres IRL/Matchs et configurations d'overlays
  comparés à la sauvegarde après fermeture : aucune modification fonctionnelle.
  Aucun test physique, son ou événement de simulateur envoyé sur l'application
  réelle. Ancien paquet et configuration conservés pour récupération.
