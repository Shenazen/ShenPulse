# Rapport de validation — ShenPulse 2.1.2

Date : 30 octobre 2026. Windows 11 x64, Node.js 24.14.0, npm 11.9.0, Electron 43.2.0. Publication publique directe demandée ; aucun vol privé. Version précédente 2.1.1 disponible dans le Store.

Notes : [2.1.2](releases/2.1.2.fr.md). Rapport précédent : [2.1.1](validation/2.1.1.fr.md).

## Qualification

- npm ci réussi. Audit des dépendances de production : zéro vulnérabilité signalée. Les dépendances n’ont pas été mises à jour de force ; les alertes de l’outillage de développement ne concernent pas les dépendances embarquées auditées.
- npm run verify, npm run build:store et npm run build:installer : 3 362 tests réussis à chaque passage final, aucun échec ni test ignoré. Quatre assertions obsolètes ont été corrigées avant ces passages ; les contrôles d’accès restent appliqués avant installation et lancement.
- Lint, génération des jeux et overlays et construction du pont Microsoft Store réussis.
- Module KOTH : 19 678 assertions géométrie/physique/manches, 14 scénarios de construction et 5 scénarios de sélection des modèles passent. Les packs KOTH 1.0.12, Hiking 1.0.6 et Mont Chiliad 1.0.17 partagent le module qualifié.
- Treize téléchargements réels Backblaze des packs concernés ont été vérifiés par le téléchargeur de l’application (taille et SHA-256), y compris la sauvegarde GTA et les cinq nouveaux jeux.
- Installation EXE, lancement et désinstallation isolés : réussis. Mise à jour 2.1.1 vers 2.1.2 : réussie avec conservation des données de test. Les profils réels et l’installation Store du poste sont conservés.
- Windows App Certification Kit 10.0.26100.7705 : PASS, version 2.1.2.0, type Centennial, PARTIAL_RUN=FALSE. Élévation Windows acceptée ; aucun contrôle obligatoire en échec.
- Identité ShenPulse.ShenPulse, éditeur CN=F6F04997-3A7F-4EC3-8492-5BB9FCC0FE46, architecture x64. L’AppX incorporé dans l’AppXUpload correspond exactement au paquet qualifié.
- Audit ASAR : 3 768 fichiers sources/ressources concordants, version 2.1.2, 21 vidéos chiffrées .spm ; aucune archive d’installation, vidéo Match brute, donnée privée ou secret dans le paquet. Recherche de secrets dans les sources modifiées et nouvelles sans résultat.
- L’EXE n’est pas signé Authenticode : un avertissement SmartScreen reste possible. Le Microsoft Store gère la signature de son paquet distribué.
- Vitrine : 31 fichiers validés et 34 vues contrôlées sans échec. Le catalogue publié est aligné sur la configuration publique relue à la version 2.1.2 : 50 jeux/modes, 47 fiches avec les quatre modes Minecraft regroupés. Les autres préparations privées restent exclues.
- Relais public des overlays : essai réel sur un canal temporaire réussi, puis nettoyage. Cache préparé en version 2.1.2-overlay1. Publication Hosting par fusion avec les ressources déjà présentes pour conserver les images hors des sources canoniques.
- Version empaquetée : huit scénarios complets de paiement simulé (carte, Link, Google Pay, Apple Pay ; jeu et abonnement), retour local et droits synchronisés sans débit réel.
- Production Paiements : configuration HTTP 200, PayPal et Stripe actifs, paiement sans authentification refusé HTTP 401 et fausse signature webhook refusée HTTP 400. Empreintes distantes des services Stripe et Agences identiques aux sources ; aucun redémarrage du backend nécessaire.

## Périmètre et limites

Les cinq nouvelles ouvertures publiques (BALL x PIT, Brotato, CloverPit, Fallout: New Vegas Ultimate Edition, Escape the Backrooms) ont été relues dans la configuration de visibilité : masquées en 2.1.1, publiques à partir de 2.1.2. Farming Simulator 25 et les autres préparations restent privées. Les résultats en jeu sont détaillés dans [les essais Game Pass](gamepass-validation-2026-10-30.md). CloverPit refuse correctement le rangement sans tiroir ; son chemin de réussite demande encore une sauvegarde disposant d’un tiroir débloqué.

Les essais GTA Enhanced sur l’installation Epic locale confirment la sauvegarde Histoire, la rampe métallique et le départ Hiking. Les profils, sauvegardes existantes et réglages de rampe sont conservés ; voir [la préparation des sauvegardes](gta-enhanced-save-preparation.md). Le cadrage des cartes Hiking est corrigé sans modifier les réglages de Cult of the Lamb ni d’Euro Truck Simulator 2.

Les scénarios de paiement ne prélèvent aucun fonds réel. Carte et Link ont été vérifiés dans Stripe sandbox ; Google Pay et Apple Pay restent conditionnés au navigateur, à l’appareil et à l’autorisation du client. L’autorisation finale Apple Pay n’a pas été réalisée sans appareil équipé ; l’essai Google Pay est resté impayé après une demande d’authentification. Aucun changement aux tarifs contractuels des abonnés existants.

## Artefacts qualifiés

| Fichier | Octets | SHA-256 |
| --- | ---: | --- |
| ShenPulse-2.1.2-x64.appx | 798581898 | `da78c16d4bcb1e3ef042bd82216b8861cc778f8acdb6f2398e584250325f4182` |
| ShenPulse-2.1.2-x64.appxupload | 798489050 | `ec122779ba359cd64f8482278aca13a121b29827b1fec0d423db1a9af38be37c` |
| ShenPulseSetup-2.1.2-x64.exe | 744407520 | `5df4ec93cee211767db823e49afc330faf831305e4aca5304fecf0b0ec720262` |
| ShenPulseSetup-2.1.2.exe | 744407520 | `5df4ec93cee211767db823e49afc330faf831305e4aca5304fecf0b0ec720262` |

## Publication

La soumission publique 14 (1152921505702280925) est préparée dans Partner Center avec le paquet validé 2.1.2.0. Nouveautés et description françaises enregistrées ; audience publique, détectabilité et 240 marchés relus. Publication automatique après certification sélectionnée. Envoi définitif et déploiements à confirmer dans les résultats ci-dessous.

Les rapports détaillés, preuves et distribuables restent ignorés sous .artifacts/release-2.1.2/ et dist/. Aucun secret, certificat privé ou fichier de distribution n’est ajouté à Git.
