# Programme Agences ShenPulse

## État de cette intervention

- Sauvegarde demandée avant intervention : commit `217d246`, poussé sur `origin/main`.
- Après la préparation initiale, le propriétaire a autorisé la publication du système le **28 octobre 2026**. Le service Agences, les règles de tarifs et les droits Diamant sont maintenant actifs sur le backend de production. Aucun paiement réel n’a été créé pendant les contrôles.
- Aucune commission ni rémunération d'agence dans cette version. Les réponses serveur déclarent explicitement `commissionsEnabled: false`.
- Application reconstruite en version 2.1.0 dans `.artifacts/shenpulse-dev-2.1.0-agency-layout/win-unpacked/`.

## Fonctionnement

La nouvelle page Agences est publique en lecture. Un compte connecté peut envoyer une fiche d'agence avec un nom, une présentation, une langue, des liens sociaux HTTPS, un logo et une bannière importés dans le stockage Backblaze du compte. Une adresse e-mail vérifiée est nécessaire pour devenir directeur. Une seule agence par directeur.

Le propriétaire ShenPulse accepte, refuse ou suspend la fiche depuis Administration → Agences. L’annuaire affiche les agences acceptées dès 3 créateurs Pro ou Premium acceptés et comptabilisés. Un abonnement personnel PayPal actif compte automatiquement ; un essai actif peut être sélectionné individuellement par l’administration (voir ci-dessous). Le code reste utilisable avant ce seuil. Les paliers sont Argent (3), Or (10, priorité dans l’annuaire et rotation Agence du jour), Diamant (25, bannière sur l’accueil et Pro offert au directeur). Les essais non sélectionnés, droits expirés et membres en attente restent exclus. Un cache de 30 secondes au maximum, borné aussi par l’échéance des essais comptés, et des lectures par lots évitent les calculs répétés. Le code privé et le lien d'invitation sont disponibles dans l'espace directeur après validation. Le lien ouvre une page expliquant comment rejoindre l'agence depuis ShenPulse ; il ne crée aucun compte ou abonnement.

Un créateur demande à rejoindre par code ou depuis l'annuaire, avec son pseudo TikTok. Son e-mail est communiqué au directeur après information explicite dans le formulaire. Le directeur vérifie manuellement l'appartenance réelle à son équipe puis accepte ou refuse la demande. Un compte ne peut avoir qu'une demande ou adhésion active. Le créateur peut partir ou annuler sa demande ; le directeur peut retirer un membre.

Il n'y a pas de synchronisation automatique TikTok ni d'extension Chrome. Le total comptabilisé repose sur les abonnements personnels PayPal actifs et, après activation de cette extension, les essais explicitement sélectionnés par l’administration. Les accès Pro offerts au directeur par le palier Diamant ne comptent pas à leur tour.

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

### Essais sélectionnés dans le comptage des agences

Dans **Administration → Offres d’essai**, « Compter pour l’agence » est désactivé par défaut. L’option peut être choisie à la création ou à la modification d’un essai Pro ou Premium. Pour une offre existante, le bouton « Compte agence : Oui/Non » ne modifie que le comptage : il conserve les dates, le palier et les droits. Une offre de jeux seuls ne peut pas être sélectionnée.

Le réglage `countsForAgency` appartient à l’essai protégé `users/<uid>/trials/subscription`, ou à `adminTrialGrants/<clé>` avant inscription. Seul l’administrateur vérifié peut le modifier via la route existante `/api/admin/trials/update`, avec `onlyAgencyCounting: true`. La transaction refuse une offre expirée, révoquée ou remplacée. Les essais en attente conservent ce choix et leur échéance lorsqu’ils sont appliqués à l’inscription.

Le service Agences lit l’essai normalisé actif côté serveur. Le comptage cesse à l’expiration, à la révocation ou lorsque le membre quitte l’agence ; il exige une adhésion et une agence validées. Un paiement et un essai sélectionné ne comptent jamais deux fois. Le tableau privé conserve `paying` pour compatibilité, et précise `countingSource: "trial"` et `paidSubscription: false`. Le directeur voit « essai comptabilisé » ; l’annuaire public reçoit seulement le total agrégé.

Ce réglage ne crée aucun paiement, ne touche aucun contrat et n’accorde pas de tarif historique. L’essai Premium du propriétaire de ShenPulse utilise la même option que les autres offres, sans exception liée à une adresse dans le code. **Extension activée le 29 octobre 2026 après autorisation explicite de relancer le backend même pendant les connexions de surveillance.** L’interface vérifie la capacité `agencyCountingAvailable` ; après Actualiser, le formulaire et les boutons de comptage sont disponibles. Les dates, le niveau Premium et les huit abonnements personnels existants sont inchangés.

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

## Confirmation des demandes et revue des fiches

Après une création confirmée par le serveur, une popup « Demande envoyée » explique la validation et le suivi dans l’espace privé. Une modification affiche « Fiche mise à jour ». Les erreurs conservent le brouillon ; un changement de compte invalide aussi la confirmation tardive. Le dialogue de réception utilise le composant modal commun, avec un bouton Compris.

L’espace « Votre agence » est propre au directeur et porte une mention explicite de confidentialité. La règle serveur reste inchangée : seuls le directeur et l’administration accèdent à une fiche en attente ; l’annuaire public exige une agence validée et trois créateurs acceptés avec abonnement payant actif. Les coordonnées et codes privés restent exclus de l’annuaire.

Les fiches de revue administrateur montrent la bannière entière, le logo, la présentation, la langue, les liens publics, le contact privé, les membres et les décisions existantes. Leur en-tête visuel est partagé avec l’espace directeur, avec un repli lisible en l’absence d’images. Aucun statut d’agence réel n’est modifié par les essais.

Qualification : 144 tests ciblés réussis, dont neuf régressions supplémentaires sur la confirmation, les images et la confidentialité ; lint valide et 150 scripts embarqués identiques aux sources. Construction locale : .artifacts/shenpulse-dev-2.1.0-agency-confirmation/win-unpacked/. Aucun redémarrage du backend ni envoi au Store pour cette correction du renderer.

## Affiche, cadres de paliers et classement

La page utilise maintenant `renderStudioHero("agencies", ...)` avec son affiche dédiée sous `src/renderer/assets/studio/agencies.webp`. Cette ressource WebP locale fait 189 742 octets ; aucune requête d’image distante ni animation supplémentaire n’est nécessaire. Le prompt et la provenance de génération sont conservés dans [assets/agencies-art.md](assets/agencies-art.md).

Les cartes Argent, Or et Diamant et les fiches de l’annuaire utilisent le même cadre `agency-tier-frame` et les mêmes variables de finition. Le contour métallique, le filet intérieur, les détails d’angle et la lueur suivent le palier. Les ornements ignorent les événements de pointeur ; les boutons restent utilisables et les cadres se replient avec la grille existante.

Le classement est décroissant sur `payingCount`, soit le nombre de créateurs acceptés avec abonnement payant actif déjà vérifié côté serveur. Ce même nombre est maintenant affiché sur chaque fiche. Le renderer trie une copie du catalogue, puis départage les égalités par nom et identifiant ; le cache reçu n’est pas modifié. Le tri serveur existant est couvert par une régression et reste compatible. Aucun changement du backend ou de ses seuils de visibilité.

Validation : 165 tests ciblés réussis, lint valide, 150 scripts embarqués comparés aux sources et présence de l’affiche confirmée dans l’ASAR. En-tête illustré et trois cadres vérifiés visuellement dans l’application native relancée : `.artifacts/shenpulse-dev-2.1.0-agency-tiers/win-unpacked/`. La fiche réelle Aphyra Agency reste en attente ; aucune agence de démonstration n’a été ajoutée à la production.

## Gestion des membres confiée au fondateur

La rubrique « Demandes et membres » est affichée uniquement dans **Agences → Mon agence**, après la validation de la fiche de l’agence. Le fondateur accepte ou refuse les demandes et peut retirer ses membres. Une agence en attente reçoit une explication à cet emplacement ; sa validation n’est jamais contournée.

L’administration conserve la revue des fiches (logo, bannière, présentation, contact, décision) et le nombre d’abonnés. Elle n’affiche plus les personnes ni les commandes d’adhésion. Le chemin `adminReviewMember` est retiré du client natif et le canal administrateur y refuse toute gestion de membres avant accès réseau. Un ancien bouton ou une décision rendue périmée par un changement de compte ne peut pas déclencher ce parcours.

Le serveur n’est pas redémarré et aucune donnée de production n’est modifiée pour cette correction d’interface. Le parcours normal des adhésions conserve son contrôle serveur du fondateur ; un test vérifie aussi qu’un compte ShenPulse administrateur ne peut pas l’utiliser sur l’agence d’un tiers. Les outils serveur internes d’administration ne font pas partie de l’interface livrée.

Validation : 172 tests ciblés réussis, lint valide, 150 scripts natifs comparés aux sources. Construction locale : `.artifacts/shenpulse-dev-2.1.0-agency-members-final/win-unpacked/`.

Contrôle natif : « Mon agence » est affiché avec l’explication de validation ; l’administration conserve les trois décisions sur la fiche et ne contient plus « Demandes et membres ». Le sous-titre de navigation est également corrigé en « Fiches partenaires » ; les 15 tests de visibilité/navigation et le lint passent après cette dernière correction de texte.

## Adhésion avec le code et identité TikTok automatique

Le code suffit : Rejoindre transmet directement la demande au directeur, avec le @ actuellement affiché en haut de ShenPulse. Aucun second formulaire de pseudo. L’envoi réussi affiche une popup ; un code refusé reste saisi. Sans @ valide, la demande est bloquée avec une explication vers la barre supérieure. Les informations de contact transmises au directeur sont indiquées près du bouton.

Le @ des adhésions en attente et acceptées est synchronisé après 750 ms de stabilité. Les mises à jour sont sérialisées : une ancienne réponse ne remplace pas le dernier @ ni le compte suivant. Les rafraîchissements LIVE ne repoussent pas la file ; une panne est retentée après 15 secondes. L’identité est liée au compte ShenPulse authentifié et ne modifie ni agence destinataire, ni statut d’adhésion, ni abonnement. Le serveur accepte encore les demandes anciennes, tandis que le client neuf transmet aussi le libellé dérivé pour compatibilité.

Sur une page Agences visible, le tableau du directeur et le statut du membre sont actualisés toutes les 15 secondes, hors édition, saisie et fenêtre modale. Les comptes sans adhésion ne transmettent aucune identité. Cette synchronisation ne déclenche ni enregistrement ni connexion TikTok : les commandes LIVE existantes restent inchangées.

Validation locale : 189 tests ciblés réussis ; lint valide ; 151 scripts du paquet comparés aux sources. Construction : .artifacts/shenpulse-dev-2.1.0-agency-auto-identity/win-unpacked/. Le module et la route serveur sont préparés et qualifiés sous Node 20.19.2 en état isolé, sans modification des données de production. L’activation attend le choix de fenêtre de reconnexion, un LIVE étant connecté lors de la préparation.

Activation autorisée et effectuée le 28 octobre 2026 : deux modules serveur remplacés après comparaison des empreintes et sauvegarde ; 15 surveillances restaurées et LIVE connecté. Les dix contrôles HTTPS authentifiés passent avec une agence et trois comptes temporaires supprimés en fin d’essai. Ils couvrent l’envoi par code, le @ initial, son changement en attente puis après acceptation, le refus d’une identité étrangère, la confidentialité et l’idempotence. Les huit abonnements existants sont identiques avant et après ; aucun paiement créé. Les fichiers principaux du serveur et des paiements sont inchangés.

Sauvegardes et rapports privés : `.deployments/agencies-identity-20261028T112040729Z/` sur le serveur. SHA-256 du service activé : `0fc01ea98e583d8d4406fc6a2af5d008ac111ad2bcaa0e95f038072452108156`. L’activation est limitée au service Agences ; aucune release Store ni incrément de version.


Dernier contrôle du renderer : l’actualisation périodique lit uniquement le tableau privé, sans spinner ni rechargement de l’annuaire. Une réponse inchangée ne redessine rien ; une mutation, une synchronisation du @, un changement de compte, une saisie ou une fenêtre modale invalide une réponse tardive. Les requêtes de fond sont sérialisées et les erreurs restent silencieuses jusqu’au prochain passage.

Validation finale après ce contrôle : 195 tests ciblés réussis, lint valide, 151 scripts natifs identiques aux sources et syntaxe du paquet vérifiée. Construction native finale : `.artifacts/shenpulse-dev-2.1.0-agency-auto-identity-final/win-unpacked/`. Aucun second redémarrage du backend pour cette optimisation du renderer.

Contrôle final dans le logiciel : la fenêtre du paquet final est ouverte sur Agences, avec le code et Rejoindre sur la même ligne et l’explication du @ automatique ; aucun second champ de pseudo. Le brouillon du code a été rétabli après vérification du compte actif, sans envoyer de demande réelle. Les contrôles d’envoi et de changement du @ sont couverts par les identités de test HTTPS ci-dessus.


## Espace fondateur et renouvellement des invitations

Le composant `agencies-director.js` regroupe l’espace privé du fondateur : identité visuelle, trois statistiques distinctes, invitation, progression et gestion des membres. Les membres en attente apparaissent avant les autres, sans modifier l’ordre ni les données enregistrées. La zone de code utilise un champ contrasté avec copie du code, du lien et régénération confirmée ; la grille se replie en une colonne sur les petites largeurs.

Les trois cartes de paliers ne sont rendues que pour un compte connecté disposant de sa propre agence validée. Les visiteurs, les membres ordinaires et les fondateurs dont l’agence est en attente, refusée ou suspendue ne voient pas cette rubrique. Les badges de palier des fiches publiques restent visibles.

La nouvelle route privée `POST /api/agencies/invitation/rotate` authentifie le fondateur, vérifie que son agence est validée et compare le code attendu avant transaction. Elle génère un nouveau code aléatoire côté serveur ; l’ancien code et les liens qui le contiennent sont immédiatement inutilisables pour rejoindre l’agence. Aucun tableau de membres, statut, demande ou abonnement n’est modifié. Un autre compte, un double clic ou un écran périmé ne peut pas renouveler son code. Le client ignore tout UID, identifiant d’agence ou code de remplacement fourni.

Après succès, le tableau privé est relu. Si cette relecture échoue, l’ancien code n’est plus proposé à la copie ; Actualiser permet de récupérer le nouveau. L’annulation, l’échec serveur et les changements de compte sont couverts.

Validation : 205 tests ciblés réussis et lint valide ; 152 scripts du paquet natif comparés aux sources. Construction locale : `.artifacts/shenpulse-dev-2.1.0-agency-director/win-unpacked/`. Le service est activé après contrôle des empreintes et sauvegarde des deux modules ; les 15 surveillances et le LIVE connecté ont été rétablis. Les fichiers principaux du serveur et des paiements sont inchangés.

Dix contrôles HTTPS authentifiés réussis avec une agence temporaire et trois comptes de test, supprimés après essais : authentification, propriété, agence validée, régénération, préservation des membres acceptés et en attente, refus de l’ancien code, acceptation du nouveau, rejet des clics périmés, confidentialité et conservation des tarifs. Les huit abonnements existants sont identiques ; aucun paiement créé. Les essais HTTPS utilisent uniquement des invitations temporaires. Sauvegardes privées : `.deployments/agencies-director-invitation-20261028T115351473Z/`.

Contrôle natif final : la fiche réelle affiche les trois cartes de statistiques, le code contrasté, ses trois commandes, la progression et les membres. Le dialogue de renouvellement explique clairement l’invalidation. Un nouveau code a été observé dans la fiche pendant ce contrôle ; c’est désormais l’invitation affichée dans Mon agence qui doit être partagée. La liste comporte toujours le même profil et le même statut. Les boutons sont revenus disponibles après fermeture du dialogue. Les trois paliers restent présents pour ce fondateur validé.

Contrôle complémentaire des vraies pages d’invitation : ancienne URL HTTP refusée en 404, nouvelle URL en 200 et fiche attendue affichée. Le dernier lot comporte 12 contrôles HTTPS réussis ; ses trois comptes et sa fiche temporaires ont aussi été supprimés. Aucun paiement et aucun changement des huit abonnements existants.

## Cartes compactes dans l’annuaire et l’administration — 29 octobre 2026

Les deux listes partagent une grille de trois, deux ou une colonne selon la largeur disponible. Une carte reste limitée à 440 px, même lorsqu’une seule agence est visible. Les bannières ont un format 2,4:1 et une hauteur maximale de 184 px ; la revue administrateur conserve l’image entière. Logos, titres, coordonnées, liens et décisions utilisent des espacements adaptés à cette taille. Les liens des fiches ne reprennent plus la disposition et les 122 px de remplissage du menu de navigation principal.

La présentation conserve deux lignes d’aperçu et une commande native « Lire la présentation » pour déplier le texte intégral, puis le réduire. Ce composant est commun aux cartes publiques et administrateur. Les cadres des paliers et le tri par abonnements comptabilisés restent appliqués. L’espace de travail privé « Mon agence » conserve sa disposition propre.

Validation : 49 tests renderer/client réussis, lint valide, contrôles visuels sur les grilles à une, deux et trois colonnes, carte unique et présentation dépliable. Les 153 scripts du paquet ont été comparés aux sources et leur syntaxe vérifiée. La construction locale `.artifacts/shenpulse-dev-2.1.0-agency-cards/win-unpacked/` a été relancée ; les deux vraies fiches de l’administration ont été contrôlées visuellement. Aucun changement des agences, membres, abonnements ou du backend pour cette correction d’affichage.
