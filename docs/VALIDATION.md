# Rapport de validation — ShenPulse 2.1.3

Date : 4 novembre 2026. Windows 11 x64, Node.js 24.14.0, Electron 43.2.0. Version conservée à 2.1.3 ; version Windows 2.1.3.0. Publication publique directe autorisée, sans vol privé. Discord reporté à la demande du propriétaire.

Notes : [2.1.3](releases/2.1.3.fr.md). Rapport précédent : [2.1.2](validation/2.1.2.fr.md).

## Qualification

- npm ci réussi. La dépendance follow-redirects passe à 1.16.2 pour corriger GHSA-mrwp-f3q8-3g9p. Audit de production : zéro vulnérabilité. Les alertes restantes de développement ne sont pas présentées comme corrigées.
- npm run verify, build:store et build:installer : 3 648 tests réussis à chaque passage final, aucun échec ni test ignoré. Lint et générations réussis. Les fixtures ont été actualisées pour charger les nouveaux modules partagés et vérifier les contrats voulus (outils uniques par scénario, sons et volumes).
- Correction supplémentaire : une connexion TikTok partiellement initialisée refuse proprement l’envoi sans exception ; la visite guidée utilise explicitement le jeu de son contexte.
- Audit ASAR : 3 828 fichiers sources/ressources concordants, 27 vidéos chiffrées et aucun fichier privé interdit. Analyse des sources modifiées et nouvelles sans secret identifié.
- Windows App Certification Kit : PASS, version 2.1.3.0, Centennial, PARTIAL_RUN=FALSE. Installation Store locale 2.1.2.0 préservée.
- Installation EXE, lancement et désinstallation isolés réussis. Mise à jour 2.1.2 vers 2.1.3 réussie avec conservation des données de test ; profils réels préservés.
- Identité Store ShenPulse.ShenPulse, éditeur CN=F6F04997-3A7F-4EC3-8492-5BB9FCC0FE46 et architecture x64 contrôlés. L’AppX contenu dans l’AppXUpload a la même empreinte que le paquet qualifié.
- EXE non signé Authenticode : un avertissement SmartScreen reste possible. Le Store signe son paquet distribué.
- Vitrine construite et validée ; 34 vues contrôlées sans échec. Catalogue documenté : 58 jeux/modes validés, dont les cinq Final Fantasy, Mortuary Assistant et les deux modes Minecraft supplémentaires. Les préparations incomplètes ne sont pas annoncées comme validées.
- Dix packs actifs modifiés téléchargés depuis Backblaze et vérifiés par taille et SHA-256. Les anciennes versions historiques non utilisées ne font pas partie de cette qualification. Miroir vocal accessible : 322 voix.
- Relais public des overlays testé réellement sur un compte et un canal temporaires, puis nettoyé. Runtime 2.1.3-overlay1 et 2 319 illustrations publiés par fusion ; deux ressources supplémentaires déjà hébergées conservées.
- Service serveur des réponses TikTok déployé avec sauvegarde préalable et comparaison des empreintes. Routes privées refusant les appels non authentifiés HTTP 401. Aucun compte bot connecté, aucun message réel envoyé.
- Paiements en production : configuration HTTP 200, environnement live, PayPal et Stripe prêts ; santé LIVE HTTP 200. Aucun paiement réel ni changement de tarif contractuel.

## Limites et périmètre

Les droits de visibilité administrateur ont été relus sans être modifiés. Les nouveaux clients interprètent les seuils de version ; les anciens continuent de voir les entrées versionnées comme masquées. Les ajouts qui demeurent en préparation ne constituent pas une promesse de validation universelle.

Farming Simulator 25 : les effets Steam et Game Pass ont leurs résultats précédents ; le dernier lancement du profil déplacé sous AppData reste à finaliser quand Steam est disponible. Aucun jeu n’a été lancé pendant la release. Les Sims 4 reste en préparation ; Frog Sqwad a ses limites de validation solo. Le bot TikTok commun n’est pas activé sans compte autorisé. La protection contre le partage de comptes a été rappelée au propriétaire et reste à traiter séparément.

## Artefacts qualifiés

| Fichier | Octets | SHA-256 |
| --- | ---: | --- |
| ShenPulse-2.1.3-x64.appx | 851817022 | `fe9fbad104d52c87e62ca9c7e73ae5f96d41580d4c8e3adad71e772b5141b358` |
| ShenPulse-2.1.3-x64.appxupload | 851742379 | `e8982525167bffc8ea45c9b9777abb4b4ebb220a8dbca3d0c0c810548515eb82` |
| ShenPulseSetup-2.1.3-x64.exe | 797380472 | `fba2e7814684cc413e185e5df592fb7881b847ece15c3238fe8a210f189104bd` |
| ShenPulseSetup-2.1.3.exe | 797380472 | `fba2e7814684cc413e185e5df592fb7881b847ece15c3238fe8a210f189104bd` |

## Publication

Soumission publique 15 : 1152921505702316401. Notes françaises, description, confidentialité, classification, diffusion publique détectable et 240 marchés contrôlés. Publication automatique après certification sélectionnée. Le statut externe final est consigné après l’envoi ; un import de paquet ne vaut pas publication.

Les preuves et journaux détaillés sont conservés hors Git sous .artifacts/release-2.1.3/ ; les distribuables restent sous dist/. Aucun secret, certificat privé, donnée utilisateur ou distribuable n’est ajouté au dépôt.
