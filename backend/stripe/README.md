# Paiements Stripe ShenPulse

Stripe Checkout ajoute la carte bancaire, Google Pay, Apple Pay et Link au parcours PayPal existant.

Les sessions limitent les moyens à `card` et `link` ; Apple Pay et Google Pay utilisent le paiement par carte et sont affichés selon la compatibilité du navigateur et du compte client.

## Serveur

Les routes `/api/payments/stripe/checkout`, `/sync` et `/abandon` exigent une session Firebase. Le webhook `/api/payments/stripe/webhook` vérifie le corps brut, la signature et sa date. Les montants proviennent du catalogue serveur et des tarifs agence vérifiés.

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et `STRIPE_WEBHOOK_ID` restent dans le fichier privé `.env` du serveur. Aucune clé Stripe secrète ne doit être ajoutée à Git ou à l’application Electron.

Les achats, renouvellements, résiliations et remboursements mettent à jour les droits Firebase. Le comptage des agences inclut les abonnements Stripe payés. Un abonnement actif garde son prestataire pour éviter une double souscription.

## Validation

- `tests/stripe-payments.test.js` : prix, identité, signature, droits, remboursements, annulations et réservations.
- `tests/stripe-checkout.test.js` : retour local, synchronisation et isolation des comptes.
- `scripts/verify-stripe-payments-ui.js` : renderer et preload réels avec IPC fictif, sans réseau externe.
- `verify-live.mjs` : création de sessions non payées dans Stripe, expiration immédiate puis retrait du client fictif. Aucun prélèvement.

`prepare.mjs` construit une extension du serveur historique à partir des sources conservées en baseline. `deploy.ps1` vérifie les empreintes des sources, sauvegarde les fichiers puis contrôle PayPal et Stripe après redémarrage. Les sauvegardes restent sous `server/.stripe-backups/`.

Le 29 octobre 2026, le serveur a été connecté au compte Stripe et les deux prestataires ont été contrôlés actifs. Deux événements Stripe réels de sessions expirées ont été reçus avec HTTP 200. La distribution Store et l’installateur public ne sont pas remplacés par cette intégration ; une version locale autonome est produite pour vérification.
