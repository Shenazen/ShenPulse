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
