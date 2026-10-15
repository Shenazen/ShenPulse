# Pages réservées au propriétaire

Administration, Contrôleurs et Paramètres sont réservées au compte propriétaire
ShenPulse vérifié. Un abonnement Pro ou Premium ne donne pas cet accès.

## Application

Les déclarations de navigation portent `ownerOnly: true`. La session du compte
et la session administrateur doivent correspondre au même UID et à l’adresse
propriétaire. Ni un ancien cache de visibilité publique ni une route directe ne
réouvrent ces pages. Le raccourci Paramètres du menu du compte suit les mêmes
droits et reste caché avant la première lecture de session.

Les rendus des pages sensibles refusent également les comptes ordinaires avant
de lire leurs réglages. Les autres fonctions restent indépendantes : langue,
apparence, voix, configurations d’overlays et réglages IRL conservent leurs
contrôles d’accès habituels.

## Processus principal

Les opérations Contrôleurs et le redémarrage des serveurs exigent le propriétaire.
Le service HTTP Stream Deck vérifie ce droit en plus du jeton d’appareil. Aucun
socket Contrôleurs n’est ouvert pour un compte ordinaire.

La sauvegarde générale des réglages n’est pas bloquée globalement : plusieurs
pages créateur l’utilisent. Les modifications d’infrastructure sont réservées au
propriétaire, tandis que les réglages créateur explicitement autorisés restent
disponibles. Les snapshots historiques complets n’écrasent ni l’identité, ni les
droits, ni les états gérés par les services. Le contrôle précède toute écriture
de configuration, de secret ou tout effet.

L’autorisation locale de simulation de touches n’est jamais activée implicitement.
Masquer Paramètres supprime aussi l’accès ordinaire à cet interrupteur ; les
effets clavier continuent d’exiger une autorisation préexistante ou un futur
parcours de consentement dédié.

## Installations existantes

L’outil de maintenance `scripts/maintenance/restrict-owner-pages.js` peut poser
les seules portées `admin` des trois pages dans la configuration privée et son
miroir public Firebase. Il ne republie pas les autres droits, jeux ou abonnements.

Les clients 2.0.1 prennent cette configuration au prochain démarrage ou prochain
chargement explicite de visibilité. Ce n’est pas une révocation en temps réel,
et un ancien client hors ligne conserve son cache. Le verrouillage statique et
les contrôles principaux renforcés nécessitent une nouvelle version distribuée.

Le 15 octobre 2026, le PATCH atomique a été appliqué et relu avec succès : les
trois pages portent `admin` dans les deux branches. Auparavant Paramètres était
déjà `admin` ; Administration et Contrôleurs n’avaient pas d’entrée explicite.
Les autres entrées et métadonnées de navigation sont restées identiques. Une
sauvegarde bornée aux navigations a été conservée dans `.artifacts/maintenance/`.
L’application ouverte n’a pas été fermée et son état n’a pas été réécrit par
l’outil. Les changements de code associés ne sont pas encore publiés dans un
nouvel installateur.

Qualification finale : `npm run verify` réussi, 665 fichiers JavaScript et
984 sources inventoriées sans cycle, **1 856 tests réussis**, aucun échec.
Les scénarios couvrent les comptes invités, Free, Pro/Premium et propriétaire,
les routes directes, les raccourcis, les API Contrôleurs, les sauvegardes et
imports de profils sans perte des contenus créateur.

Point d’audit distinct, non corrigé dans cette intervention : l’import historique
peut reprendre les droits commerciaux du fichier au lieu de toujours conserver
ceux du compte actif. Ce comportement n’accorde pas le rôle propriétaire et
doit être traité séparément, sans faire du fichier une source de droits.
