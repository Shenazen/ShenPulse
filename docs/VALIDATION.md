# Rapport de validation — ShenPulse 2.0.4

Date : 20 octobre 2026. Windows 11 x64 10.0.26200, Node.js 24.14.0, npm 11.9.0, Electron 43.2.0, electron-builder 26.15.3. Version conservée à 2.0.4 à la demande de l’utilisateur.

Voir les [notes 2.0.4](releases/2.0.4.fr.md) et le [rapport 2.0.3 archivé](validation/2.0.3.fr.md). Les résultats ci-dessous portent sur les artefacts de cette version.

## Périmètre

Envoi incrémental des cadeaux TikTok pendant les combos avec déduplication ; sélecteur en un clic et cache des cadeaux par créateur ; intégrations autonomes Crash Bandicoot, The Mortuary Assistant et Unturned ; démarrage Crash via Steam confirmé par la connexion réelle du pont ; zombies Unturned hors navigation ; contrôleurs locaux liés au profil actif ; retrait de la navigation obsolète ; 737 images générées pour les interactions de 20 jeux.

La démo de The Mortuary Assistant reste non prise en charge. La rapidité dépend des événements reçus de TikTok et de la disponibilité du jeu. Les limites de qualification des jeux sont décrites dans leurs documents dédiés ; aucune validation universelle de chaque niveau n’est annoncée.

## Contrôles réussis

- Dépendances réinstallées par `npm ci` : 402 paquets installés. Audit des dépendances distribuées : **zéro vulnérabilité connue**. Les 19 alertes d’outillage connues n’ont pas entraîné de mise à jour forcée des dépendances.
- Ordre de construction respecté : `npm run verify`, `npm run build:store`, `npm run build:installer`, smoke de l’installateur puis contrôle du site. Les trois suites complètes ont chacune réussi leurs **2 613 tests**, zéro échec et zéro ignoré ; lint de 790 fichiers JavaScript et 1 141 sources, imports sans cycle.
- Installation, lancement et désinstallation isolés 2.0.4 réussis. Mise à jour isolée **2.0.3 → 2.0.4** réussie avec conservation du marqueur de données. Les données et raccourcis du compte utilisateur n’ont pas servi de fixtures.
- Audit ASAR : **2 598 sources** comparées, **21 vidéos Match chiffrées**, aucune vidéo brute ni ressource privée décompressée. Pont natif Store PE32+ AMD64 et exports N-API conformes.
- Qualification Electron du paquet : 26 cartes Crash, paramètres éditables, détection Steam réelle et archive d’installation embarquée ; les **737 nouvelles images** sont décodées. La page Contrôleurs et le changement de profil du plugin passent leur smoke isolé.
- Site : **31 fichiers** validés, routes conformes ; QA responsive : **34 captures**, zéro échec. Les références de cache sont actualisées.
- Manifeste AppX : `ShenPulse.ShenPulse`, éditeur réservé, **2.0.4.0**, **x64**, capacités `internetClient`, `privateNetworkClientServer`, `runFullTrust`. AppXUpload : une seule entrée, identique à l’AppX par SHA-256.
- Windows App Certification Kit **10.0.26100.7705** : résultat global **PASS**, exécution complète `PARTIAL_RUN=FALSE`, paquet **2.0.4.0**, workflow Desktop Bridge/Centennial. Les 23 autres tests passent ; un test facultatif « Fichiers exécutables bloqués » signale les API de lancement et références Win32/Electron, comme dans le rapport 2.0.2. Aucun test obligatoire n’échoue. Microsoft distingue ces contrôles facultatifs dans sa [documentation Desktop Bridge](https://learn.microsoft.com/en-us/windows/uwp/debug-test-perf/windows-desktop-bridge-app-tests). L’installation Store **2.0.3.0** a été conservée pendant le contrôle du paquet.

## Artefacts qualifiés

| Fichier | Taille en octets | SHA-256 |
|---|---:|---|
| `ShenPulse-2.0.4-x64.appx` | 711 705 947 | `8BA71D7E845D6C18B1BD8506E3F17C4D350B6A51940A4B1EB1BE3A221F91A8A4` |
| `ShenPulse-2.0.4-x64.appxupload` | 711 592 204 | `2FBA11D61510430840722B656EA31CB5D1C3C7850F60785350B8083ED2C12208` |
| `ShenPulseSetup-2.0.4-x64.exe` | 658 488 883 | `C42A2ABE36A754C74FCC6A3636FD64780E38B80B3D4866C5662851A9C0AFBEE7` |
| `ShenPulseSetup-2.0.4.exe` | 658 488 883 | `C42A2ABE36A754C74FCC6A3636FD64780E38B80B3D4866C5662851A9C0AFBEE7` |

Les deux EXE sont identiques. Leur version numérique Windows est **2.0.4.0**, avec chaîne de présentation NSIS `2.0.4`. Les versions précédentes restent disponibles pour retour arrière.

EXE **NotSigned** : aucun certificat Authenticode public configuré ; les certificats de test ne sont pas utilisés comme signature de distribution. Un avertissement SmartScreen reste possible.

Vérification complémentaire après demande de signature : les magasins de certificats de signature de code du compte courant et de la machine ne proposent qu’un certificat auto-signé d’identité Store et un certificat émis par une autorité de test locale. Aucun service de signature publique ni certificat Authenticode public n’est configuré. Ces certificats de test ne rendraient pas l’EXE reconnu sur les PC des utilisateurs ; l’EXE public qualifié est conservé. La signature du paquet distribué par le Microsoft Store est réalisée par Microsoft après certification, conformément à sa [documentation de signature](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).

## Microsoft Store

Produit `9NDR71Z41ZJG`, session Partner Center authentifiée dans le navigateur intégré. La **Soumission 10** (`1152921505702182178`) a été envoyée en certification publique le 20 octobre 2026. L’AppXUpload 2.0.4 est importé et marqué **Validated** ; la description française et les nouveautés détaillent la version et ses changements. La fiche conserve les captures existantes, la déclaration des achats hors Store, les URL de confidentialité et de site, ainsi que sa classification IARC. Les consignes de certification sont actualisées pour la soumission 10 avec justification `runFullTrust`, résultats WACK et étapes de test ; les identifiants de test déjà présents restent dans leur section dédiée.

Distribution enregistrée puis relue : audience **« Public non privé »**, application disponible et détectable dans le Microsoft Store, **240 marchés proposés sélectionnés**, dont la France et la Belgique. La sélection des pays a été validée avec **OK**, puis le brouillon enregistré ; la relecture affiche bien **240 marché(s)**. L’acquisition de base reste gratuite, avec les abonnements et achats externes déclarés sur la fiche.

Après l’envoi, Partner Center affiche **« Mise à jour en cours de certification »**, **Soumission 10**, étape **Envoi terminée / Prétraitement en cours**, avec **« La publication de votre produit commence dès qu’il obtient la certification »**. La certification et la disponibilité effective de la 2.0.4 dans le Store restent sous contrôle de Microsoft ; la version précédemment publiée reste disponible pendant ce traitement.

Le vol privé de validation créé initialement a été **annulé avant publication**, conformément à la consigne explicite du propriétaire de publier publiquement. Il reste à l’état de brouillon, sans distribution privée active. Aucun essai d’installation de la 2.0.4 distribuée par le Store n’est revendiqué : la qualification réalisée porte sur les artefacts locaux, l’installateur, sa mise à jour et WACK. Les procédures du projet précisent désormais que les vols privés nécessitent une demande distincte.

## Publication et contrôles post-production

- Commit de release `21eba558edc051bc6cb2110d23b39de94b28466f`, tag annoté `v2.0.4` : poussés vers `origin`, références distantes vérifiées.
- Publication VPS terminée : EXE versionné publié avant la vitrine, **31 fichiers statiques** contrôlés par SHA-256. Sauvegarde : `/var/www/shenpulse/.public-site-backups/pre-public-site-2.0.4-20261020T154105Z-8c1156d4`. Les installateurs antérieurs, le backend, les jeux et données privées sont conservés.
- Contrôle HTTPS indépendant : **31/31 fichiers** identiques aux sources qualifiées ; accueil, documentation et cinq routes légales réelles en **HTTP 200** avec le téléchargement 2.0.4 référencé. Les routes sont issues du module des pages légales du site.
- EXE intégralement téléchargé et haché depuis `https://www.shenpulse.leuridan.fr/downloads/ShenPulseSetup-2.0.4.exe` : **658 488 883 octets**, SHA-256 `C42A2ABE36A754C74FCC6A3636FD64780E38B80B3D4866C5662851A9C0AFBEE7`, identique à l’artefact qualifié. L’EXE 2.0.3 reste en HTTP 200 avec ses **512 659 659 octets**.
- Smoke réel du relais public réussi avec canal de test temporaire. Firebase `database,hosting` déployé sur `shenazenoverlay`, site `shenpulse-overlays`. Manifeste public **2.0.4-overlay1** ; index et loader publics identiques aux sources par SHA-256. La lecture anonyme de `/users` est refusée (HTTP 401).
- Le canal **EXE/site et les overlays sont publiés**. Le Microsoft Store a reçu la **soumission publique 10**, pour les **240 marchés sélectionnés**, avec publication automatique après certification Microsoft.

## Preuves locales

Journaux ignorés : `.artifacts/release-2.0.4-*.log`, métadonnées `.artifacts/release-2.0.4-artifacts.json`, rapport `.artifacts/wack-2.0.4.xml`, preuve Partner Center de la soumission publique `.artifacts/release-2.0.4-store-public.jpg`. Les secrets, certificats, données utilisateur et artefacts `dist/` sont exclus de Git.
