# Architecture de ShenPulse

## Flux d'un live

```text
TikTok / Kick / Twitch / démo / relais autorisé
                 │
              SourceHub
                 │ événement normalisé
              ShenPulseCore.ingest
                 ├── StateStore : session, compteurs, historique
                 ├── RuleEngine : filtres, seuils, cooldowns, priorités
                 └── ActionRunner
                      ├── audio, TTS, overlays
                      ├── OBS, Spotify, HTTP, contrôleurs
                      └── GameHub → TCP / HTTP / UDP / WebSocket / RCON

StateStore → projections ciblées → IPC / serveur local / relais public
                              ├── interface Electron
                              └── sources navigateur OBS / LIVE Studio
```

Le processus principal possède les accès réseau, fichiers et secrets. Le renderer
ne reçoit que l'API du preload : isolation de contexte, absence de Node dans les
pages et contrôles d'accès côté principal restent en place.

## Carte des sources

| Emplacement | Responsabilité |
|---|---|
| `main.js`, `bootstrap/` | cycle de vie Electron et fenêtres |
| `core.js`, `core/` | orchestration du live et transitions |
| `store.js`, `state/` | persistance, migrations et profils |
| `ipc.js`, `ipc/` | routes par domaine et gardes d'accès |
| `account-service.js`, `account/` | session, abonnements, OAuth et paiements |
| `source-hub.js`, `sources/` | connexions et normalisation |
| `action-runner.js`, `actions/` | exécution des actions |
| `game-hub.js`, `game-hub/` | bridges et contrôle des droits |
| `game-runtime.js`, `game-runtime/` | installations, processus et serveurs |
| `game-catalog/`, `game-installers/` | catalogues et manifestes par jeu |

Ces chemins sont sous `src/main/`. Les façades conservent leurs chemins et
exports publics ; les modules internes ont des dépendances explicites et ne
démarrent pas de connexion au simple import.

Les autres couches sont :

- `src/shared/` : contrats sans Electron ni DOM ;
- `src/renderer/app/` : pages, composants HTML, éditeurs et commandes ;
- `src/renderer/game-overlays/` : sources du générateur Canvas ;
- `src/renderer/games/original-src/` : jeux Vue/TypeScript chargés séparément ;
- `resources/overlays/catalog/`, `runtime/` : manifestes et moteurs navigateur ;
- `website/` : site public et construction locale ;
- `native/`, `sdk/` : extensions natives et SDK de bridges ;
- `scripts/lib/` : utilitaires des outils de maintenance.

## Données et coût du live

`getState()` construit un snapshot complet lorsqu'il est nécessaire.
Les chemins fréquents utilisent des projections limitées : réglages d'un
service, session active ou règles du profil/jeu courant. Les mutations passent
toujours par le store ; une projection n'est pas une référence modifiable.

La configuration est sauvegardée rapidement et atomiquement ; les compteurs du
live utilisent un checkpoint moins fréquent. La fermeture force les écritures
utiles. Les vues cachées suspendent uniquement leur rendu : interactions et
audio continuent. Les aperçus sont créés à la demande puis libérés hors écran.

## Annuaire public et relais

`live-directory-service.js` utilise Firebase Realtime Database pour les
créateurs ayant choisi de publier leur live. Le protocole commun filtre les noms
publics, photos HTTPS, plateformes et audiences réellement disponibles.
Une présence expirée disparaît ; aucun spectateur fictif n'est ajouté.

L'annuaire n'est pas le relais des overlays : celui-ci publie un état de widgets
assaini sous un identifiant révocable ; l'annuaire publie une présence consentie.
Ne jamais y envoyer le snapshot complet, les jetons ou l'e-mail du compte.

## Guides par domaine

- [Processus principal, IPC et actions](architecture-main.fr.md)
- [État, profils et migrations](architecture-etat.md)
- [Compte et abonnements](architecture-compte.md)
- [Bridges de jeux](architecture-game-hub.md)
- [Installation et catalogues](architecture-jeux-installation.md)
- [Extension GTA](../native/gtav-montchiliad-enhanced/README.fr.md)
- [Extension Cult of the Lamb](../native/cult-of-the-lamb-reliability/README.md)
- [SDK et sidecar Python](audit-sdk-et-python.fr.md)
- [Renderer](../src/renderer/app/README.md)
- [Overlays](../resources/overlays/runtime/README.md)
- [Maintenance](MAINTENANCE.md)
- [Bilan de la refonte](optimisation-et-refonte.md)
