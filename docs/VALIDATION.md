# Rapport de validation — ShenPulse 1.0.12

Date : 25 août 2026
Environnement : Windows 11 x64 10.0.26200, Node.js 24.14.0, npm 11.9.0,
Electron 43.2.0, electron-builder 26.15.3 et WACK 10.0.26100.7705.

## Notes de version

- les cadeaux TikTok dont le nom est personnalisé par le créateur, notamment
  `Kiickers`, sont reconnus par leur identité technique et leur famille plutôt
  que par leur visuel ; `Heart Me`, `Envoie-moi un cœur` et leurs variantes sont
  réunis sous le nom canonique `Cœur sur moi`, tout en conservant le nom original ;
- les événements protobuf TikTok servent de repli pour les cadeaux, follows,
  commentaires, likes, partages, abonnements et arrivées ; un refollow du même
  spectateur est accepté et seuls les doublons réseau strictement identiques sont
  écartés pendant une courte fenêtre ;
- les règles, roues et sélecteurs de cadeaux partagent la même identité cadeau,
  ce qui maintient les associations existantes malgré un changement de nom du
  cadeau par le créateur ;
- la connexion Google passe directement par Firebase avec un retour local
  vérifié, sans dépendre d'un échange de session sur le site public ;
- le renderer et les overlays sont découpés en modules maintenables, avec un
  catalogue central des 17 overlays, un chargement ciblé des médias lourds et
  une file de lecture unique pour les vidéos Match.

## Résultats automatisés

- installation reproductible avec `npm ci` réussie ;
- audit des dépendances distribuées : 0 vulnérabilité connue ;
- structure, syntaxe, bundles et imports contrôlés sur 215 fichiers JavaScript ;
- 493 tests réussis, 0 échec ;
- compilation Vite des jeux réussie ;
- création AppX, AppXUpload et installateur EXE réussie ;
- identité `ShenPulse.ShenPulse`, version technique `1.0.12.0`, éditeur Store
  et architecture x64 contrôlés dans le manifeste ;
- pont natif WinRT de détection Microsoft Store présent dans la partie
  `app.asar.unpacked` du package ;
- AppXUpload ouvert et contenu contrôlé ;
- installation, lancement et désinstallation silencieux de la 1.0.12 réussis ;
- mise à jour isolée de la 1.0.11 vers la 1.0.12 réussie avec conservation des
  données utilisateur ;
- le site public passe ses 17 contrôles de build et de routes ;
- le relais public des overlays a été testé avec succès avant déploiement ;
- Windows App Certification Kit : résultat global `PASS`, analyse complète de
  24 tests.

L’audit complet de l’outillage de développement signale quatre vulnérabilités
élevées. Elles ne sont pas présentes dans les dépendances embarquées
(`npm audit --omit=dev` : 0), mais devront être résorbées lors d’une mise à jour
séparée de l’outillage.

Le compte TikTok configuré était hors ligne pendant la qualification stable.
Les parcours cadeaux et follows ont donc été couverts par les tests automatisés
et par les événements LIVE observés pendant la beta3, sans nouvel événement réel
émis pendant la construction 1.0.12.

## Artefacts

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `ShenPulseSetup-1.0.12-x64.exe` | 504 485 437 octets | `E07473B68964B13DAE50F85132BE0BCC8977337C9084ACD5138E622F4BF5DEAE` |
| `ShenPulseSetup-1.0.12.exe` | 504 485 437 octets | `E07473B68964B13DAE50F85132BE0BCC8977337C9084ACD5138E622F4BF5DEAE` |
| `ShenPulse-1.0.12-x64.appx` | 555 719 820 octets | `EB9B1C06202FA70DA020BB5C99D0EFCBB2573A6D641799511056D52A2696100F` |
| `ShenPulse-1.0.12-x64.appxupload` | 555 563 491 octets | `1C46EEE3721B9C7068BA457D89C83EBEF2660CBAE32EF991FB38F4486815F420` |

Le fichier EXE sans suffixe d’architecture est une copie binaire identique
destinée au chemin public `/downloads/ShenPulseSetup-1.0.12.exe`. La version
1.0.11 doit rester disponible pour le retour arrière.

Le rapport WACK complet est conservé localement dans
`.artifacts/wack/ShenPulse-1.0.12-WACK.xml`. Son unique test individuel en échec,
« Fichiers exécutables bloqués », est marqué facultatif et le résultat global
du package est `PASS`. Aucun test obligatoire n’échoue.

## Signature et Store

Le package Store est volontairement non signé : Partner Center le signe après
certification. L’installateur direct `.exe` n’a pas de signature Authenticode
publique et Windows peut donc afficher un avertissement SmartScreen.

Le fichier `.appxupload` est destiné au produit Partner Center `9NDR71Z41ZJG`.
La détection de mise à jour dépend de l’identité Store et reste silencieuse pour
les installations EXE ou les environnements de développement dépourvus
d’identité de package.

## Déploiements conditionnels

Les overlays publics et la configuration Firebase ont changé dans cette release.
Leur smoke test est réussi et leur déploiement Firebase fait partie de la
publication 1.0.12.

Les paiements réels et les droits commerciaux n’ont pas été débités ou modifiés
par cette qualification.
