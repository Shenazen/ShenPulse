# Rapport de validation — ShenPulse 1.0.11

Date : 11 août 2026
Environnement : Windows 11 x64 10.0.26200, Node.js 24.14.0, npm 11.9.0,
Electron 43.2.0, electron-builder 26.15.3 et WACK 10.0.26100.7705.

## Notes de version

- ShenPulse interroge désormais nativement Microsoft Store au démarrage et
  régulièrement pendant son exécution ; un bandeau n’apparaît que lorsqu’une
  mise à jour est réellement disponible, avec installation silencieuse si le
  Store l’autorise et ouverture de la page des mises à jour en secours ;
- l’arrêt d’un abonnement désactive son renouvellement tout en conservant
  l’accès jusqu’à la fin de la période déjà payée ;
- les follows TikTok sont dédupliqués par LIVE, y compris après une reconnexion,
  puis réarmés pour le LIVE suivant ;
- les interactions WINS Minecraft acceptent une variation personnalisée et les
  anciennes associations sont réparées automatiquement.

## Résultats automatisés

- installation reproductible avec `npm ci` réussie ;
- audit des dépendances distribuées : 0 vulnérabilité connue ;
- syntaxe contrôlée sur 130 fichiers JavaScript ;
- 447 tests réussis, 0 échec ;
- compilation Vite des jeux réussie ;
- création AppX, AppXUpload et installateur EXE réussie ;
- identité `ShenPulse.ShenPulse`, version technique `1.0.11.0`, éditeur Store
  et architecture x64 contrôlés dans le manifeste ;
- pont natif WinRT de détection Microsoft Store présent dans la partie
  `app.asar.unpacked` du package ;
- AppXUpload ouvert et contenu contrôlé ;
- installation, lancement et désinstallation silencieux de la 1.0.11 réussis ;
- mise à jour isolée de la 1.0.10 vers la 1.0.11 réussie avec conservation des
  données utilisateur ;
- le site public passe ses 17 contrôles de build et de routes ;
- la route de production `/api/payments/subscriptions/cancel` répond `401` sans
  authentification, ce qui confirme sa présence sans modifier d’abonnement ;
- Windows App Certification Kit : résultat global `PASS`, analyse complète.

L’audit complet de l’outillage de développement signale quatre vulnérabilités
élevées. Elles ne sont pas présentes dans les dépendances embarquées
(`npm audit --omit=dev` : 0), mais devront être résorbées lors d’une mise à jour
séparée de l’outillage.

## Artefacts

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `ShenPulseSetup-1.0.11-x64.exe` | 502 815 502 octets | `65A692D41FAEB87A9D932BBC9C9F5BB85C480AE4408FE9268B82D499172AE0D9` |
| `ShenPulseSetup-1.0.11.exe` | 502 815 502 octets | `65A692D41FAEB87A9D932BBC9C9F5BB85C480AE4408FE9268B82D499172AE0D9` |
| `ShenPulse-1.0.11-x64.appx` | 554 029 210 octets | `251143799A92D6681C7C7D54F76C949523D5128B806A58B297D65224E0C66C0A` |
| `ShenPulse-1.0.11-x64.appxupload` | 553 871 441 octets | `1C7FD5F86F0D58AE9DA937D653FB776F4C79FE861D74F630D33A198392DC1D0C` |

Le fichier EXE sans suffixe d’architecture est une copie binaire identique
destinée au chemin public `/downloads/ShenPulseSetup-1.0.11.exe`. La version
1.0.10 doit rester disponible pour le retour arrière.

Le rapport WACK complet est conservé localement dans
`.artifacts/wack/ShenPulse-1.0.11-WACK.xml`. Son unique test individuel en échec,
« Fichiers exécutables bloqués », est marqué facultatif et le résultat global
du package est `PASS`. Aucun test obligatoire n’échoue.

## Signature et Store

Le package Store est volontairement non signé : Partner Center le signe après
certification. L’installateur direct `.exe` n’a pas de signature Authenticode
publique et Windows peut donc afficher un avertissement SmartScreen.

Le fichier `.appxupload` est prêt pour le produit Partner Center `9NDR71Z41ZJG`.
La détection de mise à jour dépend de l’identité Store et reste silencieuse pour
les installations EXE ou les environnements de développement dépourvus
d’identité de package.

## Déploiements conditionnels

Les overlays publics et les règles Firebase n’ont pas changé dans cette release.
Le déploiement Firebase est donc volontairement omis.

Les paiements réels, OAuth et connexions avec des comptes de production n’ont
pas été débités ou modifiés par cette qualification.
