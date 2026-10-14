# Architecture du processus principal

Le processus principal reste responsable du magasin local, des connecteurs LIVE,
des actions et des API locales. Les points d’entrée historiques restent stables :
`main.js`, `core.js`, `ipc.js`, `action-runner.js` et `source-hub.js`.
Un déplacement de fichier ne justifie pas un changement du protocole public.

## Répartition des responsabilités

| Domaine | Emplacement | Responsabilité |
| --- | --- | --- |
| Amorçage Electron | `src/main/main.js` | Fenêtre, permissions, lancement et arrêt propre des services |
| Campagnes de test | `src/main/bootstrap/interaction-audit.js` | Reprise d’une campagne, validation manuelle et mémorisation des refus |
| IPC | `src/main/ipc/*.js` | Enregistrement par domaine derrière le même garde central |
| Coordination LIVE | `src/main/core.js` | Composition des services, ingestion et instantanés destinés à l’interface |
| Sessions et politiques | `src/main/core/*.js` | Transitions LIVE, statistiques, événements natifs, sessions de jeux et abonnements aux événements |
| Exécution des actions | `src/main/action-runner.js` | Aiguillage par type d’action et opérations d’overlay persistantes |
| Politiques d’actions | `src/main/actions/*.js` | TTS, groupes parallèles, file de roue, requêtes réseau et actions système |
| Sources LIVE | `src/main/source-hub.js` | Cycle de connexion, reconnexion et arrêt des connecteurs |
| Protocoles des sources | `src/main/sources/*.js` | Analyse des messages TikTok/Twitch sans ouvrir de connexion |
| Collections bornées | `src/shared/bounded-collection.js` | Insertion ordonnée réutilisée par les déduplications des likes et événements TikTok |

## Ajouter ou modifier un canal IPC

1. Choisir le module métier : `account`, `admin`, `media`, `session`,
   `integrations`, `workspace`, `settings`, `games` ou `desktop`.
2. Enregistrer le canal avec le `handle` injecté. Ne jamais utiliser directement
   `ipcMain` dans un module métier : cela contournerait le garde central.
3. Conserver l’authentification générale, le contrôle propriétaire pour
   l’administration et le contrôle du document principal pour les intégrations.
4. Valider les données avec `ipc/sanitizers.js`. Ne jamais élargir les tailles,
   champs acceptés, schémas d’URL ou identifiants sans test dédié.
5. Injecter les primitives Electron nécessaires : un simple import d’un module
   de domaine ne doit ouvrir aucune fenêtre, lancer aucun service ou réseau.

Les 105 canaux de l’application empaquetée avant la refonte sont figés dans
`tests/main-architecture.test.js`. Les exports des anciens validateurs demeurent
accessibles via `require('./ipc')` pour préserver les consommateurs existants.

## Lire l’état sans recopier tout l’espace utilisateur

Utiliser `readState(store, ['settings.tiktok', 'connections'])` pour une lecture
locale ciblée. Le magasin retourne une projection isolée ; les anciens magasins
de test passent par le repli compatible. `core.snapshot()` conserve volontairement
une copie complète : c’est son contrat avec l’interface. Les paramètres, sources,
sessions et transitions ne doivent pas demander un tel instantané pour lire un
seul drapeau. Un instantané obtenu avant un `await` n’est pas réutilisé si la
fonction devait lire un état plus récent après l’opération.

## Contrats fonctionnels à préserver

- Une interruption TikTok conserve les compteurs, timers et classements du même
  LIVE. Une autre salle déclenche la réinitialisation prévue. Kick et les sessions
  manuelles ne sont pas arrêtés par la perte d’une source TikTok.
- La file des roues reste FIFO. Les groupes d’actions restent parallèles ; leurs
  références circulaires et erreurs partielles restent diagnostiquées.
- Le TTS reste limité au chat. Les filtres Unicode, rôles, mentions, commandes,
  liens, déduplications de 30 secondes et 30 minutes sont inchangés.
- Les événements TikTok conservent leurs limites de 4 000 identifiants, et les
  likes leurs 2 000 identifiants. Les spectateurs mesurés à zéro ne sont jamais
  remplacés par un total cumulatif.
- Les statistiques gardent 5 000 identifiants de spectateurs. Aucun seuil de
  rétention, temps d’attente ou limite de sécurité n’a été abaissé dans ce découpage.
- La visibilité de l’annuaire est modifiée uniquement par le contrôle explicite
  prévu. Les identifiants chiffrés des intégrations passent par leurs API dédiées.

## Vérification

`npm run verify` contrôle les imports, la syntaxe et les régressions. Les tests
d’exécution injectent les connecteurs et Electron ; ils ne sollicitent ni un
paiement réel, ni une action physique, ni les comptes cloud de l’utilisateur.
`tests/helpers/main-source-bundles.js` parcourt les imports réels du domaine pour
les anciens tests de contrats source, sans charger les services ni masquer leur
implémentation par une copie de l’ancien monolithe.

Le découpage améliore la maintenabilité ; il ne constitue pas à lui seul une
promesse de baisse de RAM. Les gains d’exécution proviennent des projections
sélectives et de la suppression de traitements redondants, pas du nombre de fichiers.
