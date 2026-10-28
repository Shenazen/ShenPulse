# Programme Agences ShenPulse

## État de cette intervention

- Sauvegarde demandée avant intervention : commit `217d246`, poussé sur `origin/main`.
- Après la préparation initiale, le propriétaire a autorisé la publication du système le **28 octobre 2026**. Le service Agences, les règles de tarifs et les droits Diamant sont maintenant actifs sur le backend de production. Aucun paiement réel n’a été créé pendant les contrôles.
- Aucune commission ni rémunération d'agence dans cette version. Les réponses serveur déclarent explicitement `commissionsEnabled: false`.
- Application reconstruite en version 2.1.0 dans `.artifacts/shenpulse-dev-2.1.0-agency-layout/win-unpacked/`.

## Fonctionnement

La nouvelle page Agences est publique en lecture. Un compte connecté peut envoyer une fiche d'agence avec un nom, une présentation, une langue, des liens sociaux HTTPS, un logo et une bannière importés dans le stockage Backblaze du compte. Une adresse e-mail vérifiée est nécessaire pour devenir directeur. Une seule agence par directeur.

Le propriétaire ShenPulse accepte, refuse ou suspend la fiche depuis Administration → Agences. L’annuaire affiche les agences acceptées dès 3 créateurs Pro ou Premium acceptés et titulaires d’un abonnement personnel PayPal actif. Le code reste utilisable avant ce seuil. Les paliers sont Argent (3), Or (10, priorité dans l’annuaire et rotation Agence du jour), Diamant (25, bannière sur l’accueil et Pro offert au directeur). Le comptage serveur exclut les essais, accès offerts, abonnements expirés et membres en attente ; un cache de 30 secondes et des lectures par lots évitent les calculs répétés. Le code privé et le lien d'invitation sont disponibles dans l'espace directeur après validation. Le lien ouvre une page expliquant comment rejoindre l'agence depuis ShenPulse ; il ne crée aucun compte ou abonnement.

Un créateur demande à rejoindre par code ou depuis l'annuaire, avec son pseudo TikTok. Son e-mail est communiqué au directeur après information explicite dans le formulaire. Le directeur vérifie manuellement l'appartenance réelle à son équipe puis accepte ou refuse la demande. Un compte ne peut avoir qu'une demande ou adhésion active. Le créateur peut partir ou annuler sa demande ; le directeur peut retirer un membre.

Il n'y a pas de synchronisation automatique TikTok ni d'extension Chrome. Le nombre d'abonnés payants est calculé à partir des abonnements personnels PayPal actifs, sans compter les essais et accès Pro offerts.

## Facturation et protection des abonnés existants

| Offre mensuelle | Public | Membre accepté d'une agence active |
|---|---:|---:|
| Pro | 14,99 EUR | 9,99 EUR |
| Premium | 20,99 EUR | 13,99 EUR |

Les prix serveur se trouvent dans `backend/agencies/service.mjs`. La nouvelle application vérifie le tarif au moment du paiement et transmet le prix attendu. Le serveur refuse un prix périmé ; le client ne choisit jamais lui-même sa réduction. Un ancien client sans prix attendu ne peut pas créer un nouvel abonnement au tarif public : il reçoit une demande de mise à jour (HTTP 426) avant toute création de plan PayPal. Les anciens abonnés conservant leur tarif historique restent compatibles. Cela évite de montrer 9,99 EUR dans un ancien client puis de facturer 14,99 EUR. Le parcours web doit également afficher les nouveaux prix et transmettre le prix attendu avant l’activation commerciale.

Les abonnements personnels existants aux tarifs 9,99/13,99 conservent leur groupe historique. Un essai ou accès offert n'accorde pas ce traitement. Les plans PayPal existants ne sont jamais modifiés : le serveur sélectionne ou crée un plan distinct lors d'un nouveau parcours de paiement. Le passage au tarif agence sur un abonnement existant nécessite une révision confirmée dans PayPal.

Une suspension ou un départ retire l'éligibilité aux nouvelles offres à prix agence. Il ne modifie pas silencieusement le prélèvement d'un contrat existant. Le tarif convenu de ce contrat subsiste jusqu'à une modification approuvée ou une nouvelle souscription. Cette politique est volontaire pour éviter toute hausse sans confirmation.

Les métadonnées d'une proposition de paiement sont liées à l'UID, à l'abonnement et au plan PayPal ; une révision annulée ne transforme pas le groupe d'un autre plan au renouvellement. Le propriétaire a confirmé Pro offert au directeur à partir de 25 créateurs abonnés le 28 octobre 2026. Cet accès Pro est dérivé côté serveur (`agencyReward`) à chaque synchronisation des droits. Il n’ouvre pas Premium ni les jeux vendus séparément. Il n’écrit aucun abonnement et ne modifie aucun prélèvement existant : un abonnement personnel actif reste prioritaire. Le client conserve un bail de 15 minutes au maximum, renouvelé par la synchronisation existante toutes les 30 secondes ; une agence suspendue ou passée sous 25 membres n’obtient plus de nouveau bail. Un directeur déjà abonné peut gérer lui-même l’arrêt de son abonnement, qui conserve sa période payée.

## Données et architecture

- `backend/agencies/service.mjs` : politique serveur, validations, transactions Firebase, annuaire et tableaux de bord.
- `backend/agencies/routes.mjs` : routes HTTP additives.
- `backend/agencies/invitation.mjs` : invitation publique échappée et sans formulaire de connexion.
- `backend/agencies/integrate.mjs` : adaptation stricte du serveur historique. Arrêt si un ancrage manque, est ambigu ou si l'intégration est déjà appliquée.
- `src/main/agency-service.js` et `ipc/agencies.js` : transport authentifié, vérification du renderer principal, garde de génération de compte. Aucun jeton transmis au renderer.
- `src/renderer/app/features/agencies.js` : contrôleur, espace directeur et administration. `agencies-layout.js` : bandeau, tarifs, annuaire, étapes, paliers, bannière accueil. `agencies-forms.js` : création et modification intégrées à la page, brouillon isolé par compte, import logo/bannière et demande par code.

Les données sont sous `serverOnly/agencyProgram`, les propositions de paiement sous `serverOnly/agencyCheckouts`. Ces branches doivent rester interdites aux clients Firebase. Le SDK Admin est utilisé seulement sur le serveur. Les décisions d'adhésion utilisent une transaction, avec un historique borné aux 200 dernières opérations. Un directeur n'obtient que ses membres ; seul le propriétaire vérifié peut lire la vue administrative. L'annuaire n'expose ni contacts, ni codes, ni membres.

Les données privées du renderer sont invalidées lors d'un changement de compte ou d'une reconnexion du même UID. Pas de polling automatique : chargement à l'ouverture et actualisation explicite, puis nouvelle vérification avant paiement.

## Qualification locale

```powershell
node --test tests/agencies-checkout.test.js tests/agencies-service.test.js tests/agencies-client.test.js tests/agencies-renderer.test.js tests/membership-popup.test.js tests/membership-visual-layout.test.js tests/integration-ipc-access.test.js
node backend/agencies/qualify.mjs
node backend/agencies/prepare.mjs
node scripts/preview-agencies.mjs
npm run lint
npm run build:dir -- --config.directories.output=.artifacts/shenpulse-dev-2.1.0-agencies
```

Le banc visuel est disponible sur `http://127.0.0.1:42082/` (variable `AGENCY_PREVIEW_PORT`). Il utilise le véritable service et le vrai composant, avec une base mémoire et des identités fictives. Les rôles annuaire, créateur, directeur et administration permettent de parcourir les présentations sans toucher aux utilisateurs.

Le qualificatif du pont de paiement lit les copies locales du backend déployé sous `.artifacts/agencies/baseline/`, valide la syntaxe du serveur complet et exécute le vrai parcours de création de souscription avec transports simulés. Il vérifie les montants publics/agence, les anciens contrats, les révisions et le refus d'un prix périmé. Aucun appel PayPal réel.

## Procédure de bascule et de retour arrière

1. Recontrôler l'activité LIVE et obtenir le feu vert pour la fenêtre d'activation.
2. Comparer les SHA-256 du backend courant aux empreintes `baseline` du manifeste préparé. En cas d'écart, reprendre les sources actuelles, réappliquer l'adaptateur et refaire la qualification. Ne jamais remplacer un backend plus récent par le paquet préparé.
3. Sauvegarder uniquement les fichiers serveur concernés. Déployer les trois modules agences, puis les fichiers index/payments qualifiés, sans toucher à `.env`, aux données, aux jeux ou aux secrets.
4. Mettre à jour uniquement les deux prix du catalogue public décrits dans `catalog-prices.patch.json`, après sauvegarde de leurs valeurs. Ne jamais migrer les abonnements des utilisateurs.
5. Relancer le processus backend existant pendant la fenêtre validée. Vérifier santé, annuaire public, refus des routes privées sans jeton, invitations invalides et configuration de paiement. Revenir aux fichiers et prix sauvegardés si ces contrôles échouent.
6. Distribuer ou lancer l'application construite, puis vérifier les vues propriétaire/directeur/créateur sur des comptes d'essai. Une vraie souscription reste un acte volontaire dans PayPal.

Le paquet préparé et son manifeste sont sous `.artifacts/agencies/deployment/`. Aucune de ces commandes de qualification ne déclenche son déploiement.

## Bilan de la suite générale

La commande historique `npm run verify` utilise un seul processus pour toute la suite et a atteint la limite mémoire V8 de 4 Gio. Une exécution isolée avec concurrence limitée à 2 a terminé : 3 219 tests, dont 15 échecs initiaux. Cinq concernaient les contrats attendus modifiés par cette fonctionnalité (nouveaux canaux IPC, nouvelle page et tarif public en barre supérieure) ; ces contrats ont été mis à jour et leurs tests repassent.

Les dix autres échecs concernent les catalogues, manifestes, lanceurs et effets de jeux. Ils ont été reproduits à l’identique en relisant les fichiers originaux du checkpoint `217d246`, sans modifier le répertoire de travail : 65 tests de référence, 55 réussis et les mêmes 10 échecs. Ils sont donc antérieurs au programme agences. Les rapports se trouvent dans `.artifacts/agencies/isolated-tests.log` et `checkpoint-tests.log`. La suite générale ne doit pas être présentée comme entièrement verte.

Qualification finale du périmètre comptes, agences, abonnement, navigation et IPC : **169 tests ciblés réussis**, aucun échec. Les contrôles supplémentaires du prix attendu et du changement de compte passent également après la dernière optimisation de lecture de session. Le lint et la construction locale réussissent.

## Reprise de la présentation SyncLive

La page de référence ouverte a été inspectée visuellement : en-tête, bandeau avec tarifs à droite et code à gauche, annuaire, trois étapes, création intégrée et trois paliers. ShenPulse reprend cette composition en conservant ses deux formules mensuelles, sans inventer un tarif annuel. La grille se replie selon la largeur réelle de la page. Les erreurs de serveur ne sont jamais affichées comme un annuaire vide. Le formulaire conserve son brouillon après une panne et l’invalide après un changement de compte. Les imports sont limités aux PNG/JPG/WebP par le sélecteur natif et l’IPC, avec le stockage du compte. Aucun envoi réel sur SyncLive, paiement ou déploiement n’a été effectué.

Contrôle de reprise dans l’application : 133 tests ciblés réussis, lint valide et qualification du backend réussie. Construction native de contrôle : .artifacts/shenpulse-dev-2.1.0-agency-app/win-unpacked/. Le banc HTTP reste un outil de test ; la page livrée est intégrée au renderer et au preload du logiciel.

Vérifications natives : page Agences ouverte depuis le menu de ShenPulse 2.1.0 ; formulaire intégré affiché avec langue et liens sociaux ; sélecteur Windows du logo ouvert avec le filtre PNG/JPG/WebP, puis annulé sans téléversement. Les 150 scripts embarqués ont été comparés aux sources et leur syntaxe vérifiée. Construction finale : .artifacts/shenpulse-dev-2.1.0-agency-final/win-unpacked/.

Le sélecteur natif revient au formulaire après Annuler et libère ses contrôles. Le test supplémentaire des messages d’erreur natifs passe (134 scénarios ciblés au total, dont 133 dans le lot complet et 1 régression ajoutée).

## Publication du 28 octobre 2026

Le backend préparé a été comparé octet par octet aux fichiers distants avant intervention. Les cinq fichiers serveur ont été sauvegardés, contrôlés sous Node 20.19.2 et publiés. Seules les deux valeurs publiques du catalogue ont été mises à jour (Pro 14,99 EUR et Premium 20,99 EUR). Les huit fiches d’abonnement présentes sont restées strictement identiques, contrôle effectué avant et après tous les essais. Aucun plan ou prélèvement existant n’a été modifié.

Le test authentifié en production a révélé le comportement à cache froid des transactions RTDB : un premier callback pouvait recevoir null et faire refuser une validation existante. La mutation conserve maintenant une écoute pendant le chargement et la transaction, puis la libère dans finally. Une régression dédiée reproduit cette situation. Ce correctif est publié ; SHA-256 de service.mjs : 193beb180665f238ce87a10cb0593bf3ce2f8c014441a03141beb604082aadbe.

Les 14 contrôles HTTPS avec identités réelles de test passent : annuaire, quatre tarifs, authentification, accès propriétaire, création en attente, validation ShenPulse, code, demande en attente, refus d’un tiers, acceptation du directeur, réduction, confidentialité, seuil de visibilité, départ et protection Firebase. Les trois comptes et la fiche temporaires ont été supprimés ; les 64 comptes inscrits sont conservés. Aucune souscription PayPal n’a été créée. Les anciens clients dépourvus du prix attendu sont refusés avant paiement au nouveau tarif public.

Les 15 surveillances LIVE sont restaurées et la connexion LIVE contrôlée est reconnectée. La brève reconnexion liée à la bascule a été annoncée avant intervention. Les rapports et sauvegardes privées sont sous .deployments/agencies-20261028T095726033Z sur le serveur ; ils ne sont pas distribués ni versionnés.

Cette intervention active le service pour la page Agences intégrée à ShenPulse 2.1.0. Elle ne soumet pas de nouvelle version au Microsoft Store et ne remplace pas l’installateur public : la distribution des interfaces nouvelles aux anciens clients relève de la release de l’application.

Bilan final de publication : 135 tests ciblés réussis, lint valide, 14 contrôles HTTPS authentifiés réussis en production, huit fiches d’abonnement inchangées et aucun compte de test restant. La page Agences a été contrôlée dans l’application ouverte : l’annuaire se charge et le message d’indisponibilité a disparu.
