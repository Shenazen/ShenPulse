# Rapport de validation — ShenPulse 2.1.1

Date : 29 octobre 2026. Windows 11 x64, Node.js 24.14.0, npm 11.9.0, Electron 43.2.0. Version précédente 2.1.0 déjà disponible sur le Store. Publication publique directe demandée ; aucun vol privé.

Notes : [2.1.1](releases/2.1.1.fr.md). Rapport précédent : [2.1.0](validation/2.1.0.fr.md).

## Qualification

- npm ci réussi. Audit des dépendances de production : zéro vulnérabilité signalée. Les dépendances n'ont pas été mises à jour de force.
- npm run verify, npm run build:store et npm run build:installer : 3 385 tests réussis à chaque passage, zéro échec et zéro test ignoré. Les quatre anciennes références de versions signalées au premier contrôle ont été corrigées avant la qualification finale.
- Lint et génération des jeux, des overlays et du pont Microsoft Store réussis.
- Module KOTH natif compilé ; 19 678 assertions géométrie/physique/manches et 14 scénarios de création progressive passent. Les packs KOTH 1.0.10, Hiking 1.0.4 et Mont Chiliad Enhanced 1.0.15 partagent le même module SHA-256 vérifié. Les cinq fichiers Lava Rise et le module KOTH ont été retéléchargés depuis Backblaze par le vrai téléchargeur de l'application.
- Installation EXE, lancement et désinstallation isolés : réussis. Mise à jour 2.1.0 vers 2.1.1 : réussie avec conservation des données de test. Les profils réels et l'installation Store 2.1.0.0 sont conservés.
- Windows App Certification Kit 10.0.26100.7705 : PASS, version 2.1.1.0, type Centennial, PARTIAL_RUN=FALSE, rapport du 29 octobre 2026 à 19:13:54. Aucun contrôle obligatoire en échec. L'élévation Windows a été acceptée.
- Identité ShenPulse.ShenPulse, éditeur CN=F6F04997-3A7F-4EC3-8492-5BB9FCC0FE46, architecture x64. Le paquet AppX incorporé à l'AppXUpload a la même empreinte que le paquet qualifié.
- Audit ASAR : 3 686 fichiers sources/ressources concordants, version 2.1.1, 21 vidéos chiffrées .spm. Aucune archive de packs, vidéo Match brute, donnée privée ou secret dans le paquet.
- L'EXE n'est pas signé Authenticode : un avertissement SmartScreen reste possible. Le Microsoft Store gère la signature de son paquet distribué.
- Site : 31 fichiers validés ; 34 vues contrôlées sans échec. Le catalogue Minecraft regroupe désormais ses quatre modes et annonce la version Java à utiliser. Les captures existantes proviennent de données de démonstration isolées.
- Relais public des overlays : essai réel sur un canal temporaire réussi, puis nettoyage. Le cache public est préparé en version 2.1.1-overlay1.

## Périmètre et limites

Correctifs KOTH, cadrage studio des wins, agences et offres d'essai, ajout Minecraft Lava Rise et adaptations de sa présentation. L'essai KOTH sur le PC Epic initialement concerné reste à confirmer : aucune validation en jeu sur ce PC n'est revendiquée. Les 36 contrôles en partie Lava Rise et ses 24 effets sont documentés dans [Minecraft Lava Rise](minecraft-lavarise.fr.md).

Le backend Agences de production correspond déjà à la source qualifiée ; le service public répond en HTTP 200 et les commissions restent désactivées. Cette release ne nécessite aucun redémarrage du backend. Les essais de paiements ne réalisent aucun achat et les abonnements existants conservent leur tarif contractuel.

Les ressources graphiques des jeux déjà publiées sur Hosting doivent être conservées : elles ne se trouvent pas toutes sous resources/overlays. La publication préparée fusionne les 427 fichiers canoniques, les 2 303 images d'interactions et les deux ressources déjà hébergées hors de ces ensembles, au lieu de les effacer.

## Artefacts qualifiés

| Fichier | Octets | SHA-256 |
| --- | ---: | --- |
| ShenPulse-2.1.1-x64.appx | 795289540 | `2877d4444565eec1aa6edd992ac6074fd7aa33e36bb0ab75cc3e50aa1da7ba53` |
| ShenPulse-2.1.1-x64.appxupload | 795196719 | `7485b5b25ef2371f569af510a9bd9bd12475110622bc7569daaf00c6f7d163e2` |
| ShenPulseSetup-2.1.1-x64.exe | 741263388 | `f84326b25ce598297034008fd279a8d23034b4b717a2c9ba8c39b11f23d6faa5` |
| ShenPulseSetup-2.1.1.exe | 741263388 | `f84326b25ce598297034008fd279a8d23034b4b717a2c9ba8c39b11f23d6faa5` |

## Publication

La soumission publique 13 (1152921505702270386) est préparée dans Partner Center avec le paquet 2.1.1.0. Les nouveautés françaises sont enregistrées ; disponibilité publique, détectabilité et 240 marchés, dont France et Belgique, relus. Publication automatique après certification sélectionnée. L'envoi final en certification n'a pas encore été effectué à ce stade du rapport.

Les rapports détaillés, journaux et fichiers distribuables restent ignorés dans .artifacts/release-2.1.1/ et dist/. Aucun secret, certificat privé ou fichier de distribution n'est ajouté à Git.
