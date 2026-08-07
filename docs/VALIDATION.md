# Rapport de validation — ShenPulse 1.0.10

Date : 7 août 2026
Environnement : Windows 11 x64 10.0.26200, Node.js 24.14.0, npm 11.9.0,
Electron 43.2.0, electron-builder 26.15.3 et WACK 10.0.26100.7705.

## Notes de version

- les déclencheurs peuvent réutiliser plusieurs actions existantes et exécuter
  toutes les actions ou une sélection aléatoire sans doublon ;
- Coin Pusher dispose d’un parcours de configuration complet, de barèmes cadeaux,
  de bonus et de visuels locaux optimisés propres au profil ;
- la découverte locale des prises Shelly PlugPlus combine mDNS et la table réseau
  Windows, conserve les noms personnalisés et refuse les appareils sans relais ;
- le catalogue TikTok récupère les cadeaux localisés en français et déduplique les
  variantes partageant le même visuel ;
- les pages Actions, jeux et overlays ont été réorganisées et leurs mises à jour
  évitent davantage de reconstruire les aperçus actifs.

## Résultats automatisés

- installation reproductible avec `npm ci` réussie ;
- audit des dépendances distribuées : 0 vulnérabilité connue ;
- syntaxe contrôlée sur 125 fichiers JavaScript ;
- 430 tests réussis, 0 échec ;
- compilation Vite des jeux réussie ;
- création AppX et AppXUpload réussie ;
- identité `ShenPulse.ShenPulse`, version technique `1.0.10.0`, éditeur Store
  et architecture x64 contrôlés dans le manifeste ;
- AppXUpload ouvert et contenu contrôlé ;
- installation, lancement et désinstallation silencieux de la 1.0.10 réussis ;
- mise à jour isolée de la 1.0.9 vers la 1.0.10 réussie avec conservation des
  données utilisateur ;
- le site public passe ses 17 contrôles de build et de routes ;
- Windows App Certification Kit : résultat global `PASS`, 24 tests exécutés ;
- le site public et la route `/docs` répondent en HTTP 200 ;
- l’installateur public 1.0.10 a été retéléchargé puis comparé au SHA-256 local.

L’audit complet de l’outillage de développement signale trois vulnérabilités
élevées dans `brace-expansion`, `fast-uri` et `js-yaml`. Elles ne sont pas
présentes dans les dépendances embarquées (`npm audit --omit=dev` : 0), mais
elles devront être résorbées lors d’une mise à jour séparée de l’outillage.

## Artefacts

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `ShenPulseSetup-1.0.10-x64.exe` | 502 734 399 octets | `888A7805104CE73DA151130C4B52C7152D92FEE31848549C60E8B96625ABCA15` |
| `ShenPulseSetup-1.0.10.exe` | 502 734 399 octets | `888A7805104CE73DA151130C4B52C7152D92FEE31848549C60E8B96625ABCA15` |
| `ShenPulse-1.0.10-x64.appx` | 553 938 771 octets | `4C2E898DD5032476C1D68CB7AAA88964E013318C6C92076E9A51E225903F7C10` |
| `ShenPulse-1.0.10-x64.appxupload` | 553 782 044 octets | `BFAFAC4C715BBEEFF1842AA3D68BA8EFBC9FD525CD84A639497D7483106C6365` |

Le fichier EXE sans suffixe d’architecture est une copie binaire identique
destinée au chemin public
`/downloads/ShenPulseSetup-1.0.10.exe`. L’ancienne version reste disponible
pour le retour arrière. Une sauvegarde du site précédent est conservée sur le
VPS sous `production-before-1.0.10-20260807T075542Z`.

Le rapport WACK complet est conservé localement dans
`.artifacts/wack/ShenPulse-1.0.10-WACK.xml`. Son unique test individuel en échec,
« Fichiers exécutables bloqués », est marqué facultatif et le résultat global
du package est `PASS`.

## Signature et Store

Le package Store est volontairement non signé : Partner Center le signe après
certification. L’installateur direct `.exe` n’a pas de signature Authenticode
publique et Windows peut donc afficher un avertissement SmartScreen.

Le fichier `.appxupload` est prêt pour le produit Partner Center `9NDR71Z41ZJG`.
La soumission et le vol privé restent à effectuer depuis une session Partner
Center authentifiée ; aucune session navigateur contrôlable ni configuration
StoreBroker/API n’était disponible lors de cette validation.

## Déploiements conditionnels

Les overlays publics et les règles Firebase n’ont pas changé dans cette release.
Le déploiement Firebase a donc été volontairement omis.

Les paiements réels, OAuth et connexions avec des comptes de production n’ont
pas été débités ou modifiés par cette qualification. Ils restent à contrôler
manuellement si les services externes concernés ont changé indépendamment du
dépôt.
