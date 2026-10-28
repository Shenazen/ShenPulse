# Rapport de validation — ShenPulse 2.1.0

Date : 28 octobre 2026. Windows 11 x64, Node.js 24.14.0, npm 11.9.0,
Electron 43.2.0. Version conservée à **2.1.0**, conformément à la demande
du propriétaire. Publication publique demandée, **sans vol privé**.

Voir les [notes 2.1.0](releases/2.1.0.fr.md) et le
[rapport 2.0.5 archivé](validation/2.0.5.fr.md).

## Qualification

- `npm ci` réussi ; audit des dépendances de production : zéro vulnérabilité signalée.
  Les dépendances n’ont pas subi de mise à jour forcée.
- `npm run verify`, `npm run build:store` puis `npm run build:installer` :
  **3 346 tests réussis** à chaque passage, zéro échec, zéro test ignoré.
- Le runner isole chaque fichier, avec deux processus au maximum, pour libérer
  les fixtures DOM/VM. Les anciennes références de catalogue ont été revues pour
  les intégrations 2.1.0 ; les contrôles d’empreinte et de publication sont conservés.
- `npm run lint` : structure et syntaxe valides, 1 002 fichiers JavaScript et
  1 440 sources inventoriées, imports sans cycle.
- Installation EXE, lancement puis désinstallation de test : réussis.
- Mise à jour **2.0.5 → 2.1.0** : réussie avec conservation des données de test.
- Windows App Certification Kit **10.0.26100.7705** : **PASS**, version
  **2.1.0.0**, type Centennial, `PARTIAL_RUN=FALSE`, rapport du
  28 octobre 2026 à 18:50:54. Tous les contrôles obligatoires réussissent. Le contrôle
  facultatif « Fichiers exécutables bloqués » signale les références de lancement
  de processus de l’application de bureau ; il ne change pas le résultat global PASS.
  L’élévation Windows a été acceptée par le propriétaire.
- Identité `ShenPulse.ShenPulse`, éditeur
  `CN=F6F04997-3A7F-4EC3-8492-5BB9FCC0FE46`, architecture x64.
  Le contenu AppX embarqué dans l’appxupload correspond exactement au fichier contrôlé.
- Audit ASAR : **3 683 fichiers** sources/ressources concordants, métadonnées 2.1.0
  conformes, **21 vidéos chiffrées .spm**. Pas d’archives de packs, de vidéos Matchs
  brutes, de journaux, de secrets ou de données utilisateur dans le paquet.
- EXE **non signé Authenticode** : un avertissement SmartScreen reste possible.
  Le Store gère la signature du paquet distribué par son service.
- Site : **31 fichiers validés**, **34 vues de contrôle sans échec**,
  12 nouvelles captures publiques et 12 captures Store, issues de données de
  démonstration isolées, sans dialogue de connexion ni données personnelles.
- Relais public des overlays : smoke test réussi sur un canal temporaire.

## Connexion et inscription Google

Cause `redirect_uri_mismatch` reproduite puis réparée : URI de retour exacte
`http://localhost:21216/callback` ajoutée au client OAuth existant, en conservant
ses autres URI. Nom public ShenPulse enregistré ; audience externe en production ;
aucune permission supplémentaire demandée. La visibilité du nom dépend encore
des règles de vérification de la marque Google.

Parcours Google réel réussi dans un store de test uniquement en mémoire : retour
navigateur, échange Firebase, identité, adresse vérifiée et photo récupérés.
Aucun jeton dans ce rapport, session du logiciel ouvert préservée.
L’inscription initiale est couverte par une réponse Firebase de test
`isNewUser=true`, sans création d’un compte réel supplémentaire.
**39 tests ciblés** de compte et de retour Google réussis.
Comparaison UTF-8 de l’état OAuth corrigée après reproduction d’une exception.

## Limites et conservation

Les essais supplémentaires du premier bonus de match sont reportés à la demande
du propriétaire. Le secours visuel reste optionnel ; aucun nouveau succès en
LIVE n’est revendiqué. Le second bonus conserve sa détection existante.

Les profils réels n’ont pas été réinitialisés. Les abonnements existants conservent
leur tarif contractuel tant que leur contrat reste inchangé. Les tests de paiement
ne réalisent aucun achat. Le déploiement statique ne nécessite pas de relancer le backend.

## Artefacts qualifiés

| Fichier | Octets | SHA-256 |
| --- | ---: | --- |
| ShenPulse-2.1.0-x64.appx | 792907693 | `248faa6472417115d4dacc8f715bfe9a556334f14395cdc557489c485aa48880` |
| ShenPulse-2.1.0-x64.appxupload | 792813811 | `c872ca66020edc9a0354f60f23b563cfd13e0168a89e58099026a2bcb936f8fb` |
| ShenPulseSetup-2.1.0-x64.exe | 738895573 | `425905b7e9fe5b91da84445e8a7c2f8eb77ec03002350b4f2c0065b69af7ea7f` |
| ShenPulseSetup-2.1.0.exe | 738895573 | `425905b7e9fe5b91da84445e8a7c2f8eb77ec03002350b4f2c0065b69af7ea7f` |

## Publication

- Commit de release **d06da10be427a246f22c47fb2655bceb5a67ca47** poussé sur
  `origin/main` ; tag annoté **v2.1.0** poussé sur le même commit qualifié.
- Site et installateur publiés sur **https://www.shenpulse.leuridan.fr**.
  Les 31 fichiers statiques et l’EXE ont été vérifiés sur le serveur. Depuis
  Internet : accueil, documentation et pages légales en HTTP 200 ; modules
  principaux et deux captures identiques aux fichiers locaux.
- Téléchargement public complet de l’EXE : **738 895 573 octets** et SHA-256
  **425905b7e9fe5b91da84445e8a7c2f8eb77ec03002350b4f2c0065b69af7ea7f**.
  L’EXE 2.0.5 reste téléchargeable (HTTP 200, 637 655 578 octets).
- Sauvegarde de la vitrine conservée sur le VPS avant déploiement ; backend,
  secrets, jeux privés, anciens installateurs et processus PM2 préservés.
- Firebase : règles Realtime Database et hébergement des overlays déployés
  sur `shenazenoverlay` / `shenpulse-overlays`. Relais testé après déploiement.
  Index, game-pack et game-wins publics en HTTP 200 et identiques aux fichiers
  locaux ; lecture anonyme de `/users.json` refusée (HTTP 401).
- **Store : soumission publique 12 (1152921505702258218) envoyée le 28 octobre
  2026**, paquet 2.1.0.0 validé. Le portail confirme « en cours de certification »,
  prétraitement démarré. Publication automatique après validation Microsoft,
  sur les 240 marchés proposés, application gratuite, publique et détectable.
  **Aucun vol privé**. La version Store 2.1.0 n’est pas encore déclarée disponible.
- Quatre captures 1920 × 1080 et leurs légendes ont été sauvegardées et relues.
  Description, tarifs publics/agence, nouveautés et notes techniques à jour.
  Classification IARC/PEGI 3 et déclaration d’achats externes héritées conservées.
  Les textes publiés ne mentionnent aucun fournisseur d’interactions concurrent.
- ShenPulse 2.1.0 qualifié relancé sur le PC ; compte, profil et associations
  visibles conservés.
- Annonce publiée dans le salon Discord demandé :
  [annonce 2.1.0](https://discord.com/channels/1561730092995051671/1561731045949313327/1565065087490719744).
  Elle distingue le téléchargement EXE disponible et la certification Store en cours.
- Captures de preuve locales : confirmation Google, état Store et annonce Discord
  conservés dans le dossier temporaire du poste. Aucun secret ni journal ajouté à Git.

Les journaux de travail et rapports détaillés restent ignorés sous
`.artifacts/release-2.1.0/`, `.artifacts/google-auth/` et `.artifacts/wack-2.1.0.xml`.
Les secrets et artefacts de distribution restent exclus de Git.
