# Rapport de validation — ShenPulse 1.0.14

Date : 1er octobre 2026
Environnement : Windows 11 Famille x64 10.0.26200, Node.js 24.14.0,
npm 11.9.0, Electron 43.2.0, electron-builder 26.15.3 et WACK
10.0.26100.7705.

## Notes de version

- les huit Matchs peuvent préparer leurs quinze variantes en fichiers WebM
  temporaires pour TikTok LIVE Studio, OBS et les autres logiciels de diffusion ;
  le chemin reste masqué, l'accès exige Pro ou Premium et le cache est nettoyé
  à la perte du droit sans bloquer le démarrage si un fichier est encore ouvert ;
- les follows TikTok sont comptés une seule fois par spectateur et par LIVE,
  y compris après reconnexion ou livraison par plusieurs sources techniques, puis
  sont réautorisés au LIVE suivant ;
- le catalogue MyInstants utilise la session réseau Electron et des en-têtes de
  navigateur compatibles ;
- l'éditeur de profil s'ouvre sans fermer prématurément son dialogue et les
  guides Match ont été adaptés au parcours fichier vidéo.

## Résultats automatisés

- installation reproductible avec `npm ci` réussie ;
- audit des dépendances distribuées avec `npm audit --omit=dev` :
  0 vulnérabilité connue ;
- structure, syntaxe, bundles et imports contrôlés sur 233 fichiers JavaScript ;
- 584 tests réussis, 0 échec ;
- compilation Vite des jeux réussie ;
- création AppX, AppXUpload et installateur EXE réussie ;
- identité `ShenPulse.ShenPulse`, version technique `1.0.14.0`, éditeur Store
  et architecture x64 contrôlés dans le manifeste ;
- pont natif WinRT de détection Microsoft Store présent dans
  `app.asar.unpacked` ;
- AppXUpload ouvert : il contient uniquement l'AppX x64 attendu ;
- installation, lancement et désinstallation silencieux de la 1.0.14 réussis ;
- mise à jour isolée de la 1.0.13 vers la 1.0.14 réussie avec conservation
  des données utilisateur ;
- le site public passe ses 17 contrôles de build et de routes ;
- le relais public des overlays a été testé puis déployé avec ses règles
  Firebase ; sa métadonnée publique annonce `1.0.14` ;
- la page d'accueil, `/docs` et le téléchargement public répondent HTTP 200 ;
  l'installateur re-téléchargé correspond exactement à l'artefact local.

L'audit complet de l'outillage de développement signale sept vulnérabilités
élevées. Elles ne sont pas présentes dans les dépendances embarquées et
devront être résorbées lors d'une mise à jour séparée de l'outillage.

Les parcours Match, droits Pro/Premium, cache temporaire, follows TikTok,
MyInstants, profils et publication du site sont couverts par les tests
automatisés ou les smoke tests. Les connexions LIVE, OBS, paiements et droits
commerciaux n'ont pas déclenché d'opération réelle pendant cette construction.

## Artefacts

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `ShenPulseSetup-1.0.14-x64.exe` | 530 170 463 octets | `DF04404DA60389A31206A675833D9A65E3D118F4C1B05A163F0593DFD5403C1F` |
| `ShenPulseSetup-1.0.14.exe` | 530 170 463 octets | `DF04404DA60389A31206A675833D9A65E3D118F4C1B05A163F0593DFD5403C1F` |
| `ShenPulse-1.0.14-x64.appx` | 582 385 797 octets | `C8C9D296D81D892C9C1AA5937DB84517637705325DF5D8D108272F5B52CF7D36` |
| `ShenPulse-1.0.14-x64.appxupload` | 582 228 020 octets | `FB5CCD1AC7DAB84A8342A0F66E32B40920CA55237D37954C1388DD1EC9F150C9` |

Le fichier EXE sans suffixe d'architecture est une copie binaire identique
publiée sous `/downloads/ShenPulseSetup-1.0.14.exe`. La version 1.0.13 reste
disponible publiquement comme solution de retour arrière.

## Signature, WACK et Store

Le package Store est volontairement non signé : Partner Center le signe après
certification. L'installateur direct `.exe` n'a pas de signature Authenticode
publique ; Windows peut donc afficher un avertissement SmartScreen.

Le Windows App Certification Kit 10.0.26100.7705 a contrôlé le package
1.0.14.0 avec un résultat global `PASS`. Le rapport complet est conservé dans
`.artifacts/wack/ShenPulse-1.0.14-WACK-20261001.xml`. Son unique échec
individuel concerne le contrôle facultatif `Fichiers exécutables bloqués` ; il
n'invalide pas le résultat global, comme pour la version 1.0.13.

Le fichier `.appxupload` est prêt pour le produit Partner Center
`9NDR71Z41ZJG`. Le vol privé et son smoke test restent obligatoires avant la
soumission Store en production.

## Déploiements

L'installateur 1.0.14 et le site public ont été déployés sur le VPS. Le
runtime overlay et les règles Firebase ont été publiés sur le projet
`shenazenoverlay`. Les anciens installateurs versionnés ont été conservés.
