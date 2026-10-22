# Rapport de validation — ShenPulse 2.0.5

Date : 22 octobre 2026. Windows 11 x64 10.0.26200, Node.js 24.14.0, npm 11.9.0, Electron 43.2.0, electron-builder 26.15.3. Version conservée à **2.0.5** conformément à la demande du propriétaire. Publication publique demandée, **sans vol privé**.

Voir les [notes 2.0.5](releases/2.0.5.fr.md) et le [rapport 2.0.4 archivé](validation/2.0.4.fr.md).

## Périmètre et limites

Overlays simplifiés et adaptés aux designs, roue réorganisée, Coin Jar sans compteur, galerie catégorisée, administration des logos et des versions minimales, conditions de jeu et disposition ZQSD par défaut. Packs de jeu distribués à la demande depuis Backblaze. Correction de la connexion ETS2 et autonomie des passerelles locales.

L’[audit des 53 fiches](autonomie-jeux.fr.md) distingue **37 intégrations locales** et **16 fiches de référence sans module autonome**. Les références restent non exécutables et conservent leurs associations. La qualification en partie de Duckov reste partielle ; son accès est limité au propriétaire et à partir de la 2.0.5. Les guides dédiés décrivent les éditions compatibles et les essais réellement effectués. Aucun essai manuel de tous les effets de tous les jeux n’est revendiqué.

## Contrôles réussis

- Dépendances réinstallées avec `npm ci`. Correctif ciblé de `follow-redirects` **1.16.0 → 1.16.1**, sans modification de la version de ShenPulse. Audit des dépendances distribuées : **zéro vulnérabilité connue**. Les 20 alertes d’outillage n’ont pas entraîné de mise à jour forcée. Références des correctifs : [en-têtes en tableau](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-q3jh-wrc6-jgq8), [échappement des en-têtes](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-8r9p-f939-6h3c).
- Ordre obligatoire respecté : installation des dépendances, vérification, build Store, build EXE, smoke de l’installateur puis contrôle du site. Les trois suites après réinstallation réussissent chacune leurs **2 743 tests**, sans échec ni test ignoré ; lint et imports sans cycle réussis.
- Installation, lancement et désinstallation isolés réussis. Mise à jour isolée **2.0.4 → 2.0.5** réussie avec conservation des données de test et restauration des raccourcis. Les données réelles du compte ne servent pas de fixtures.
- Audit du paquet : **2 634 sources** comparées ; **21 vidéos Match chiffrées**, aucune vidéo brute ni ressource privée décompressée ; pont Store natif PE32+ AMD64 et exports N-API conformes. Les archives de packs de jeu sont exclues de la distribution principale. Les **14 ressources** du registre Backblaze ont été relues avec taille et SHA-256 après leur publication.
- Site : **31 fichiers** validés, routes conformes ; QA responsive **34 captures**, zéro échec. Téléchargement, notes et références de cache synchronisés avec la 2.0.5. La politique publique explique le partage LIVE activé par défaut et sa désactivation depuis le compte.
- Manifeste AppX : `ShenPulse.ShenPulse`, éditeur réservé, **2.0.5.0**, **x64**, capacités `internetClient`, `privateNetworkClientServer`, `runFullTrust`. L’AppXUpload contient une seule entrée, identique à l’AppX par SHA-256.
- WACK **10.0.26100.7705** : résultat global **PASS**, exécution complète `PARTIAL_RUN=FALSE`, paquet **2.0.5.0**, workflow Centennial. Les 23 autres tests passent ; le test facultatif « Fichiers exécutables bloqués » signale les références Win32/Electron de lancement. Aucun test obligatoire n’échoue. L’installation Store **2.0.4.0** a été conservée. Voir les [contrôles Desktop Bridge Microsoft](https://learn.microsoft.com/en-us/windows/uwp/debug-test-perf/windows-desktop-bridge-app-tests).
- Smoke réel du relais public réussi avec canal temporaire. Les essais ETS2 et émulateurs ainsi que les contrôles des profils et associations sont détaillés dans leurs guides de qualification.

## Artefacts qualifiés

| Fichier | Taille en octets | SHA-256 |
|---|---:|---|
| `ShenPulse-2.0.5-x64.appx` | 690 886 120 | `c55db814281c9ea47677af7c91775d664417e4f0639ca78601a6e3af4aea08ad` |
| `ShenPulse-2.0.5-x64.appxupload` | 690 765 828 | `a0f186192c067fff3284c7db3b6da6654b754a452dba5e99df06fe991bbae47f` |
| `ShenPulseSetup-2.0.5-x64.exe` | 637 655 578 | `73986c93435fd90139616061e1757c621de884c281478ccedc48d05f187706fd` |
| `ShenPulseSetup-2.0.5.exe` | 637 655 578 | `73986c93435fd90139616061e1757c621de884c281478ccedc48d05f187706fd` |

Les deux EXE sont identiques, version Windows **2.0.5.0**, affichage **2.0.5**. Leur taille diminue de **20 833 305 octets** par rapport à la 2.0.4. Les packs nécessaires restent téléchargés pendant l’installation de chaque jeu.

EXE **NotSigned** : aucun certificat Authenticode public configuré ; un avertissement SmartScreen reste possible. Les certificats de test ne sont pas utilisés pour la distribution. Le Store réalise sa propre signature après certification.

## Microsoft Store et publication

Produit `9NDR71Z41ZJG`, soumission publique **11** (`1152921505702202086`), session authentifiée dans le navigateur intégré. L’AppXUpload 2.0.5 est importé, enregistré et marqué **Validated**. Description française et nouveautés actualisées ; aucune mention de fournisseur d’interactions tiers dans les textes de cette version. Captures, déclaration des achats hors Store et classification IARC/PEGI 3 héritées conservées.

Distribution relue : audience **Public non privé**, produit disponible et détectable, **240 marchés**, nouveaux marchés activés, téléchargement de base gratuit. **Aucun vol privé créé ni publié.**

La soumission publique finale, le déploiement VPS/Firebase et les contrôles HTTPS sont encore à effectuer à la date de ce rapport préparatoire. Leur résultat sera ajouté après exécution ; l’import du paquet ne vaut pas soumission ou disponibilité Store.

## Preuves locales

Journaux ignorés : `.artifacts/release-2.0.5-*.log`, métadonnées `.artifacts/release-2.0.5-artifacts.json`, rapport `.artifacts/wack-2.0.5.xml`. Les secrets, certificats, données utilisateur et `dist/` restent exclus de Git.
