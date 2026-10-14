# Architecture du compte

[account-service.js](../src/main/account-service.js) reste l'unique façade
publique et conserve ses huit exports CommonJS. Les jetons d'identité, leur
échéance et les promesses de renouvellement restent dans cette instance.
Les domaines extraits n'introduisent ni nouvelle connexion Firebase, ni
nouvelle route IPC, ni changement de droits ou de tarification.

## Modules

| Module sous `src/main/account/` | Responsabilité |
| --- | --- |
| `constants.js` | Endpoints, ports et délais historiques. |
| `validation.js` | E-mail, UID, produits, paliers et URLs autorisées. |
| `http-client.js` | Lecture JSON et classification d'erreur commune. |
| `entitlement-payload.js` | Fonctions pures de fusion et de validation des droits. |
| `entitlements.js` | Synchronisation serveur et application des droits locaux. |
| `checkout.js` | Achat de jeu, abonnement et paiement complémentaire de prorata. |
| `browser-auth.js` | Échange Google/Firebase orchestré par le compte. |
| `browser-loopback.js` | Retour OAuth local historique par code. |
| `google-loopback.js` | Retour OpenID en POST local, état vérifié. |
| `payment-loopback.js` | Retour PayPal local, annulation et nettoyage. |
| `callback-pages.js` | Pages locales de retour sans ressources distantes. |

La façade fournit aux flux un contexte de callbacks explicites pour demander
un jeton, vérifier l'identité et construire le statut public. Les domaines
ne contournent pas les méthodes privées de session. Les champs et promesses
historiques restent sur le service afin de conserver la coalescence des
authentifications et checkouts.

## Invariants sensibles

- Le mot de passe n'est jamais persisté. Le jeton de renouvellement utilise
  le coffre local existant et le jeton d'identité reste en mémoire.
- Deux renouvellements concurrents partagent la même promesse. La présence
  LIVE utilise la projection de compte et refuse de publier une identité
  obtenue pendant un changement de propriétaire.
- Une panne réseau ne vaut pas session invalide. Seules les erreurs déjà
  classées comme telles déclenchent le nettoyage de session.
- Les retours navigateur écoutent uniquement la boucle locale. L'état attendu
  est comparé avec `timingSafeEqual`. Le fragment Google est envoyé en POST
  local puis retiré de l'historique du navigateur.
- Les pages d'authentification sont limitées à `accounts.google.com` en
  HTTPS ; les approbations de paiement restent limitées à PayPal en HTTPS.
- La forme et le numéro d'ordre sont vérifiés avant capture. Annuler une
  attente locale n'effectue jamais d'annulation distante non demandée.
- Les erreurs, délais, URLs, méthodes HTTP, en-têtes et corps restent ceux
  des flux historiques. `requestJson` mutualise seulement la requête, la
  lecture et la vérification de statut.
- Un essai expiré ou un paiement en attente ne devient pas un achat actif.
  La synchronisation fusionne uniquement les réponses serveur vérifiées.

## Vérification

`account-service.test.js` couvre Google, mot de passe, inscriptions, reset,
PayPal, annulations, prorata, déconnexion et fonctionnement hors ligne.
`entitlement-sync-regressions.test.js` et `game-cheat-access.test.js`
protègent les droits. `account-architecture.test.js` vérifie les exports,
la fidélité des options HTTP, la coalescence de renouvellement et le changement
de propriétaire pendant une demande de présence.
