# Offres d’essai Pro et Premium

Depuis le 28 octobre 2026, Administration → Offres d’essai permet de choisir « Aucun abonnement », « Pro » ou « Premium », à la création comme à la modification. Les jeux restent une option indépendante. Le niveau est affiché dans la liste des offres.

Le palier est validé dans le processus principal et par le serveur. Une ancienne demande sans palier explicite reste un essai Pro. Une offre Premium conserve son niveau même si le compte bénéficiaire n’existe pas encore ; elle est appliquée à son inscription avec l’adresse e-mail correspondante.

Un essai Premium donne accès aux fonctions Premium, y compris Machines IRL. Il conserve sa propre échéance et ne transforme pas l’abonnement payé. À expiration ou révocation, le serveur rétablit les droits sous-jacents : Pro payé ou gratuit, suivant le compte. Un essai Pro ne dégrade jamais Premium payé. Les achats de jeux permanents restent conservés.

Le backend est maintenu hors de ce dépôt. L’adaptateur versionné `backend/trials/integrate.mjs` modifie uniquement les fonctions d’essai dans une copie vérifiée du fichier `server/payments.js`. `backend/trials/qualify.mjs` exerce les véritables fonctions préparées avec un stockage isolé, avant déploiement :

```powershell
node backend/trials/qualify.mjs <payments-original.js> <payments-prepare.js>
```

Validation effectuée :
- 64 tests ciblés du renderer, des services d’essai, des droits et des changements de compte réussis.
- 10 parcours backend isolés réussis sous Node 24 et Node 20 du serveur.
- Vérification HTTPS sur deux comptes techniques : création, modification Pro/Premium, refus d’un palier invalide, lecture des droits privés/publics, révocation, attribution avant inscription et activation après inscription.
- Deux comptes techniques et leurs données supprimés après vérification ; les huit abonnements existants sont inchangés. Aucun paiement créé.
- Serveur activé avec sauvegarde et contrôles des empreintes ; les 15 sessions surveillées et le LIVE connecté ont été rétablis.
- Application native 2.1.0 reconstruite dans `.artifacts/shenpulse-dev-2.1.0-premium-trials/win-unpacked` ; les 152 scripts du renderer et les sources main modifiées correspondent au paquet.

Il s’agit d’une mise à jour du backend et de la version locale de développement. Aucun nouvel installateur ni paquet Microsoft Store n’a été publié.

## Comptabiliser un essai pour son agence

L’extension préparée le 29 octobre ajoute « Compter pour l’agence » dans les formulaires de création et de modification, ainsi qu’un bouton « Compte agence : Oui/Non » sur les offres Pro et Premium actives. Ce dernier conserve strictement le palier, les dates et les accès de l’offre. Le comptage est désactivé par défaut ; il ne s’applique pas aux offres de jeux seuls. Les essais choisis avant inscription conservent le réglage à l’arrivée du compte.

L’autorisation appartient au serveur et au compte administrateur vérifié. L’agence et l’adhésion doivent être validées pour que l’essai compte dans les effectifs et paliers. Le compte reste en essai sans paiement ; il cesse de compter à l’expiration ou à la révocation. Un abonnement payé et un essai sélectionné ne créent jamais deux places pour la même personne.

`backend/trials/agency-counting.mjs` prépare les fonctions de paiement historiques déjà adaptées aux essais Premium. `backend/trials/qualify-agency-counting.mjs` vérifie huit groupes de parcours en stockage isolé, en plus des dix régressions Premium : attribution, bouton sans changement des dates, refus des accès non autorisés, offres remplacées, révocation, expiration, choix par défaut et inscription ultérieure.

```powershell
node backend/trials/qualify-agency-counting.mjs <payments-original.js> <payments-prepare.mjs>
node --test tests/trial-agency-counting.test.js tests/premium-trials.test.js tests/agencies-service.test.js tests/agencies-renderer.test.js tests/agencies-client.test.js tests/admin-service.test.js
```

**Extension activée le 29 octobre 2026.** Le propriétaire a explicitement autorisé la mise à jour même pendant les connexions de surveillance. Le serveur annonce `agencyCountingAvailable: true` et le compte du propriétaire est sélectionné, en conservant son essai Premium et son échéance.

Qualification de cette extension : **137 tests ciblés réussis**, lint valide, huit parcours de comptage et dix régressions Premium réussis sous Node 24 local et Node 20.19.2 sur le serveur. Le véritable formulaire et le bouton de liste ont été contrôlés dans un aperçu isolé avec données fictives : activation visible, date conservée et option désactivée sans abonnement.

Paquet natif 2.1.0 construit sous `.artifacts/shenpulse-dev-2.1.0-trial-agency-counting/win-unpacked/` : 153 scripts renderer identiques aux sources, syntaxe vérifiée, modules principaux et styles comparés. Aucun nouveau paquet public ou Store publié, aucune relance imposée à l’application ouverte.

Préparation serveur sauvegardée sous `.deployments/trial-agency-counting-20261029T110636284Z/` : les deux fichiers préparés sont qualifiés et les fichiers actifs inchangés. La simulation du compte propriétaire fait passer son agence de 1 à 2 accès comptabilisés, sans toucher au Premium d’essai ni à son échéance du 28 octobre 2027. Le contrôle de préparation indique 15 sessions surveillées, dont 2 LIVE connectés. Aucune activation ni écriture Firebase ; l’ancien paquet d’exception propriétaire est remplacé par cette extension générale et sa commande locale d’activation a été neutralisée.

## Activation du backend et vérification réelle

Après sauvegarde et nouvelle comparaison des empreintes, `server/payments.js` et `server/agencies/service.mjs` ont été remplacés, puis le service PM2 relancé. Le fichier principal `server/index.js` est inchangé. Sauvegardes privées de bascule : `.deployments/trial-agency-counting-20261029T110636284Z/activation-20261029T115011037Z/`. L’autorisation initiale d’attendre sans LIVE a été remplacée par la demande explicite de mettre à jour même en présence de connexions.

Les **16 contrôles HTTPS authentifiés en production** passent : capacité annoncée, refus sans connexion, comptage du propriétaire, source « trial » sans paiement, une seule place ajoutée, droits Premium et échéance inchangés, création d’un essai sélectionné, refus d’un bénéficiaire ordinaire, booléen invalide, activation/désactivation sans changement de dates, relecture administrative, révocation, huit abonnements conservés, agences et adhésions inchangées, surveillances conservées. Un seul compte technique temporaire et ses données ont été supprimés après essai ; aucune autre personne ni fiche d’agence supprimée et aucun paiement créé.

Le compte propriétaire porte désormais `countsForAgency: true` sur son essai existant. Son agence passe de **1 à 2 accès comptabilisés**, avec Premium d’essai jusqu’au **28 octobre 2027 à 13:00:13 UTC**. Les autres offres gardent leur choix précédent.

Contrôle natif après Actualiser dans Administration → Offres d’essai : la case « Compter pour l’agence » est disponible et le bouton du propriétaire affiche « Compte agence : Oui ». Aucune nouvelle offre réelle n’a été accordée depuis l’interface et aucune saisie n’a été remplacée. Au contrôle final, les 15 surveillances TikTok sont conservées, dont deux connexions rétablies. Ces états de surveillance ne désignent pas les utilisateurs actuellement actifs dans ShenPulse.
