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


## Configuration Google en production

Le fournisseur Google doit rester activé dans Firebase Authentication du projet
`shenazenoverlay`, avec le nom public `ShenPulse`. Son client OAuth Web doit
autoriser exactement l’URI de redirection `http://localhost:21216/callback`,
en plus du gestionnaire Firebase existant. Cette adresse est le retour local
de l’application Windows ; elle ne doit pas devenir une origine publique ni
être remplacée par une URL de profil.

Une URI absente provoque `redirect_uri_mismatch` avant même le choix du compte.
La correction de cette liste dans Google Auth Platform est indépendante du
déploiement du site et profite aussi aux applications déjà installées qui
utilisent ce même retour. Google indique un délai possible de propagation.

Le 28 octobre 2026, le parcours réel a été vérifié avec le service de compte
ShenPulse et un store temporaire en mémoire : choix Google, retour local,
échange Firebase, identité vérifiée et photo récupérées. La session de
l’application ouverte n’a pas été remplacée et aucun jeton n’a été enregistré
dans le rapport d’essai.

Connexion et inscription Google utilisent ce même parcours : Firebase crée
l’identité lors du premier accès et retrouve l’identité existante aux accès
suivants. Aucun compte d’essai réel supplémentaire n’est créé par les tests
automatisés.

`google-loopback.test.js` protège aussi le refus d’un état falsifié contenant
des caractères UTF-8 : la comparaison porte sur les longueurs en octets avant
`timingSafeEqual`, pour éviter une exception non interceptée. La page de
retour reste sans cache ni ressources distantes et efface le fragment OAuth.
