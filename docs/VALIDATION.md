# Rapport de validation — ShenPulse 2.0.1

Date : 15 octobre 2026.
Environnement : Windows 11 Famille x64 10.0.26200, Node.js 24.14.0,
npm 11.9.0, Electron 43.2.0 et electron-builder 26.15.3.

Le [rapport 2.0.0](validation/2.0.0.fr.md) est conservé.
Voir les [notes de version](RELEASE_2.0.1.md) et l’[architecture du stockage](stockage-media-partage.fr.md).

## Périmètre

Correction des imports Backblaze dans le client Windows : utilisation du courtier
de signature déjà déployé, authentification Firebase, conservation des URL
existantes et séparation des comptes. Aucun changement de serveur ni de bucket
public, aucun nouveau service payant.

## Contrôles réussis

- `npm ci` : versions verrouillées installées, sans mise à jour forcée.
- Audit des dépendances distribuées : zéro vulnérabilité connue ; l’outillage
  conserve 19 alertes préexistantes (8 modérées, 11 élevées).
- Lint : 659 fichiers JavaScript, 978 sources inventoriées, imports sans cycle.
- Suite complète finale du build installateur : **1 826 tests réussis**,
  aucun échec. Une première passe avait détecté un tag de cache overlay encore
  en 2.0.0 ; les versions ont été synchronisées avant les builds validés.
- Builds Store/AppXUpload et EXE réussis. Le build Store avait validé 1 823
  tests ; les trois tests ajoutés ensuite portent uniquement sur l’outil de
  smoke et ne changent pas les sources applicatives construites.
- Installation, lancement et désinstallation isolés de 2.0.1 : réussis.
- Mise à jour isolée 2.0.0 → 2.0.1 : réussie avec conservation du marqueur de données.
- Site public : 19 fichiers et routes contrôlés.
- Relais public Firebase : smoke réel réussi, canal temporaire nettoyé.
- Audit du package : 1 801 sources vérifiées, 21 vidéos Match chiffrées, zéro
  vidéo brute ni fichier privé décompressé. Pont natif AMD64 cohérent, seuls les
  timestamps et GUID de compilation qualifiés diffèrent.
- Manifeste AppX : `ShenPulse.ShenPulse`, éditeur réservé, version `2.0.1.0`,
  architecture x64. AppXUpload : un seul AppX attendu.

## Stockage de production

Le courtier existant répond configuré ; il exige une identité Firebase et
refuse les appels anonymes. Aucun déploiement serveur ni changement de bucket
n’est nécessaire. Le client utilise une autorisation par objet et n’embarque
pas les clés Backblaze d’administration.

Smoke réel avec la session active, sans configuration B2 locale : WAV silencieux
de 204 octets et GIF de 42 octets téléversés puis relus en HTTP 200, avec MIME et
SHA-256 identiques. Deux objets QA (246 octets au total) restent stockés ; aucune
clé administrateur n’a été utilisée pour les supprimer. Le profil temporaire
contenant la copie chiffrée du fichier de chiffrement a été nettoyé après arrêt.
Les trois fichiers réels contrôlés (état, coffre et Local State) sont restés
inchangés. Aucune bibliothèque n’a reçu les fixtures, aucun son ni effet LIVE
n’a été déclenché.

L’accès Free/Pro et les changements de compte sont couverts par les tests
automatisés ; le smoke réel utilise seulement le compte local existant, sans
création de compte ni usurpation d’un autre utilisateur.

## Artefacts

| Fichier | Taille en octets | SHA-256 |
|---|---:|---|
| `ShenPulseSetup-2.0.1-x64.exe` | 512 540 484 | `2096146995F8693E924A43E3FAD17FE21B7A7406E915F349A4A8E5CFBBA9952F` |
| `ShenPulseSetup-2.0.1.exe` | 512 540 484 | `2096146995F8693E924A43E3FAD17FE21B7A7406E915F349A4A8E5CFBBA9952F` |
| `ShenPulse-2.0.1-x64.appx` | 565 718 565 | `94EFCEE42208711110346B7878BD3D1CC276AB7AF8E060C7E334E697C76FC380` |
| `ShenPulse-2.0.1-x64.appxupload` | 565 556 496 | `0E8FAAEAD8627F6B2A43E4E1258B4CC95A1112FC4973B06D974766D2E98C17FD` |

Les deux EXE sont identiques ; les artefacts 2.0.0 sont conservés pour retour arrière.
Les artefacts, profils, rapports bruts et secrets sont exclus de Git.

## Signature et canal Microsoft Store

L’EXE et le programme sont `NotSigned`, aucun certificat Authenticode public
n’étant configuré. Un avertissement SmartScreen reste possible.

WACK 2.0.1 **non exécuté** : le lancement contrôlé de `appcert.exe reset`
par `Start-Process` refuse l’opération avec « L’opération demandée nécessite
une élévation ». Aucun rapport 2.0.1 n’a été produit ; le résultat PASS de 2.0.0
n’est pas réutilisé comme qualification de cette version.

Partner Center redirige vers la page de connexion Microsoft, sans session
authentifiée disponible. Le `.appxupload` est construit mais **non envoyé**.
Restent obligatoires : WACK administrateur, envoi Partner Center, vol privé,
installation et smoke de la version Store, puis seulement soumission publique.

## Publication

Les contrôles locaux EXE et site sont terminés. Les confirmations Git, HTTPS et
Firebase seront ajoutées après les opérations externes. Cette section ne vaut
pas confirmation de publication tant que ces résultats ne sont pas consignés.
