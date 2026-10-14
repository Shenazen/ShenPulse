# Accès Pro et ouverture des Interactions IRL

Les sections **Jeux vidéo**, **Interactions IRL**, **Commandes** et **Matchs** portent une
étiquette `PRO` dans le menu. Leur utilisation exige un compte ShenPulse
authentifié et un abonnement Pro ou Premium actif. Une place offerte par un
abonné Premium et un essai non expiré utilisent les mêmes droits ; un paiement
en attente, un droit suspendu ou un essai expiré ne donne pas accès.

## Source unique du droit commercial

`src/shared/pro-access.js` est un contrat pur utilisable dans Node et dans le
navigateur (`ShenPulseProAccess`). Il expose `hasProAccess(state, nowMs)`,
`commerceExpiryMs(entry)`, `PRO_SECTIONS` et `requiresProSection(id)`. Les
exports historiques des jeux et des overlays délèguent à ce contrat pour
éviter des conditions divergentes. Il n'effectue aucune connexion Firebase,
aucun paiement et aucune mutation des abonnements.

L'abonnement reste distinct d'un droit d'achat de jeu : les produits achetés
ne sont pas supprimés lors d'un changement de palier. Les jeux privés restent
réservés au propriétaire, indépendamment de son abonnement.

## Compatibilité des anciennes configurations IRL

Avant le schéma de visibilité 9, trois portées IRL étaient forcées à
`admin` : `navigation.irl`, `features.irl:shelly` et
`actionTypes.irl:shelly`. La version actuelle les ouvre à `public`, puis
applique séparément le contrôle d'abonnement. Ce changement permet aux
abonnés non propriétaires d'utiliser leurs propres prises et leurs propres
configurations.

La migration pure `migrateVisibility` et la lecture `scopeFor` couvrent le
cache local, le repli hors ligne et les anciennes réponses Firebase. Elles
préservent les interdictions `hidden`/`false`, les autres portées privées,
les interrupteurs de types d'actions et les restrictions explicites de
schéma 9 ou ultérieur. L'alias historique `navigation.studio` des schémas
antérieurs à 8 reste celui des overlays, avant le relèvement du schéma.

La mise à jour ne publie aucune configuration Firebase. Les anciens clients
restent soumis à leur ancienne restriction propriétaire ; les clients mis
à jour interprètent les portées historiques sans devoir réécrire le cloud.

## Vérification sans effet réel

Les tests du contrat vérifient les paliers, les essais et les échéances, ainsi
que l'exécution Node/navigateur. Les tests de visibilité vérifient la
migration idempotente et l'absence d'ouverture des éléments masqués ou
privés. Les tests d'accès au service utilisent des doubles de réseau et de
prises : ils ne déclenchent pas de commande de prise, de jeu ou de chat réel.
