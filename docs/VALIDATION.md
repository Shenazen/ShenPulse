# Rapport de validation — ShenPulse 1.0.13

Date : 23 septembre 2026
Environnement : Windows 11 x64 10.0.26200, Node.js 24.14.0, npm 11.9.0,
Electron 43.2.0, electron-builder 26.15.3 et WACK 10.0.26100.7705.

## Notes de version

- Brumelune rejoint les jeux intégrés avec son moteur de partie, la composition
  automatique ou manuelle des rôles, la reprise de sauvegarde et un compagnon
  LAN protégeant les informations privées des joueurs ;
- Thiercelieux dispose désormais d'une partie animée de trois à huit joueurs,
  de rôles et annonces privées, de compositions adaptées aux extensions
  activées et d'un ordre de révélation corrigé ;
- Coin Pusher expose une poussée complète manuelle et une poussée finale qui
  attend le comptage des dernières pièces avant le podium ; son parcours de
  configuration, ses interactions et l'export de son overlay ont été unifiés ;
- les actions groupées ou aléatoires, les timers, le connecteur Fortnite et les
  interactions de jeux disposent de nouveaux contrats et contrôles d'accès ;
- les overlays publics partagent un protocole de session renforcé, un lecteur
  Match protégé et unique, des polices embarquées et un runtime découpé en
  modules maintenables.

## Résultats automatisés

- installation reproductible avec `npm ci` réussie ;
- audit des dépendances distribuées : 0 vulnérabilité connue ;
- structure, syntaxe, bundles et imports contrôlés sur 231 fichiers JavaScript ;
- 574 tests réussis, 0 échec ;
- compilation Vite des jeux réussie ;
- création AppX, AppXUpload et installateur EXE réussie ;
- identité `ShenPulse.ShenPulse`, version technique `1.0.13.0`, éditeur Store
  et architecture x64 contrôlés dans le manifeste ;
- pont natif WinRT de détection Microsoft Store présent dans la partie
  `app.asar.unpacked` du package ;
- AppXUpload ouvert : il contient uniquement l'AppX x64 attendu ;
- installation, lancement et désinstallation silencieux de la 1.0.13 réussis ;
- mise à jour isolée de la 1.0.12 vers la 1.0.13 réussie avec conservation des
  données utilisateur ;
- le site public passe ses 17 contrôles de build et de routes ;
- le relais public des overlays a été testé avec succès avant déploiement ;
- Windows App Certification Kit : résultat global `PASS`, analyse complète de
  24 tests.

L'audit complet de l'outillage de développement signale cinq vulnérabilités
élevées. Elles ne sont pas présentes dans les dépendances embarquées
(`npm audit --omit=dev` : 0), mais devront être résorbées lors d'une mise à jour
séparée de l'outillage.

Les parcours critiques Brumelune, Thiercelieux, Coin Pusher, actions, overlays,
sessions publiques et contrôles d'accès sont couverts par les tests automatisés.
Les connexions LIVE, OBS, paiements et droits commerciaux n'ont pas déclenché
d'opération réelle pendant cette construction.

## Artefacts

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `ShenPulseSetup-1.0.13-x64.exe` | 530 208 309 octets | `DBC5CB32F2AC653869C28FB155816B2683BA6E9B3E7BEA64C766B647EC0CCC6C` |
| `ShenPulseSetup-1.0.13.exe` | 530 208 309 octets | `DBC5CB32F2AC653869C28FB155816B2683BA6E9B3E7BEA64C766B647EC0CCC6C` |
| `ShenPulse-1.0.13-x64.appx` | 582 310 496 octets | `7575D3736E9C26502E7EACBC2BD151FD7F3B545AFA97ABE0843FF0E2A27E85E8` |
| `ShenPulse-1.0.13-x64.appxupload` | 582 158 527 octets | `ECDEB6E0DFBB53BB6EA4E33FC9D64988F03AEFEF6D66EAB7C5A7642077D99D79` |

Le fichier EXE sans suffixe d'architecture est une copie binaire identique
destinée au chemin public `/downloads/ShenPulseSetup-1.0.13.exe`. La version
1.0.12 reste disponible comme solution de retour arrière.

Le rapport WACK complet est conservé localement dans
`.artifacts/wack/ShenPulse-1.0.13-WACK-20260923.xml`. Son unique test individuel
en échec, « Fichiers exécutables bloqués », est marqué facultatif et le résultat
global du package est `PASS`. Aucun test obligatoire n'échoue.

## Signature et Store

Le package Store est volontairement non signé : Partner Center le signe après
certification. L'installateur direct `.exe` n'a pas de signature Authenticode
publique et Windows peut donc afficher un avertissement SmartScreen.

Le fichier `.appxupload` est destiné au produit Partner Center `9NDR71Z41ZJG`.
La détection de mise à jour dépend de l'identité Store et reste silencieuse pour
les installations EXE ou les environnements de développement dépourvus
d'identité de package.

## Déploiements conditionnels

Les overlays publics et la configuration Firebase ont changé dans cette
release. Leur smoke test est réussi et leur déploiement Firebase fait partie de
la publication 1.0.13.

Les paiements réels et les droits commerciaux n'ont pas été débités ou modifiés
par cette qualification.
