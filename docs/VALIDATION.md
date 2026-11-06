# Rapport de validation — ShenPulse 2.1.5

Date : 6 novembre 2026. Release complète autorisée : application, Git, site public, overlays, Store et Discord. Publication directe sans vol privé. Les communications regroupent les changements depuis la dernière annonce 2.1.3. Notes : [2.1.5](releases/2.1.5.fr.md). Rapport précédent : [2.1.4](validation/2.1.4.fr.md).

La protection contre le partage de compte a été rappelée au propriétaire ; elle reste hors de cette release. Les Sims 4 conserve sa restriction au compte du propriétaire et n'est pas annoncé comme jeu public.

## Qualification réussie

- Dépendances réinstallées par npm ci. Audit des dépendances de production : zéro vulnérabilité. Les avertissements de dépendances de développement sont conservés dans les journaux ; aucune mise à jour majeure forcée.
- npm run verify : 3 810 tests réussis, zéro échec, lint et imports valides. Les mêmes contrôles passent dans les constructions Store et EXE.
- 47 régressions ciblées passent après la correction du contrôle strict de l'identifiant Steam et du cache overlay 2.1.5.
- Audit ASAR : 3 841 fichiers identiques aux sources, aucune anomalie ni fichier interdit ; 27 médias protégés conservés chiffrés.
- Identité Store ShenPulse.ShenPulse, éditeur réservé, architecture x64, version Windows 2.1.5.0. AppXUpload vérifié : paquet embarqué identique par SHA-256.
- Installation, lancement et désinstallation de l'EXE validés dans un environnement isolé. Mise à jour 2.1.3 vers 2.1.5 validée avec conservation des données utilisateur.
- Site : 79 pages HTML, 227 fichiers, 3 299 liens et ressources vérifiés. Contrôle dans un navigateur réel : 59 captures, zéro échec.
- Relais public des overlays validé. Déploiement Firebase database/hosting réussi ; six fichiers publics comparés octet pour octet aux sources, version de cache 2.1.5-overlay1.
- Santé du backend positive. Configuration des paiements prête en production ; les huit jeux annoncés sont effectivement à 4,99 EUR. Aucun paiement réel ni modification de contrat client pour ces vérifications.

## Limites de certification et signature

Le kit officiel Microsoft signé est présent, mais sa commande reset ne peut pas démarrer dans cette session non élevée : « L'opération demandée nécessite une élévation ». Le propriétaire est absent. Aucun écran de sécurité n'a été contourné et aucun résultat WACK 2.1.5 n'est revendiqué. Les anciens rapports ne qualifient pas ce nouveau paquet. Ce blocage est consigné avant la soumission publique, conformément à la procédure.

L'installateur EXE n'a pas de signature Authenticode configurée (NotSigned) : Windows peut présenter un avertissement SmartScreen. Le paquet soumis au Store est destiné à être signé par Microsoft pour sa distribution.

## Distribution

- Microsoft Store : brouillon 17, identifiant 1152921505702332400. Nouveau paquet 2.1.5 validé et textes français enregistrés. Audience publique, détectabilité active, 240 marchés et publication dès certification confirmés. La soumission finale reste à effectuer après les derniers contrôles.
- Site : contenu et EXE qualifiés ; publication à effectuer.
- Discord : nouvelle annonce et compléments de guides à publier après la soumission, sans écraser les anciennes annonces et sans mention d'application concurrente.

## Empreintes des artefacts

| Artefact | Taille | SHA-256 |
| --- | ---: | --- |
| `ShenPulse-2.1.5-x64.appx` | 851853322 | `6fdbff74ca0e6d4dea352c0c8a65826bd772bf205b07396ca7d2b461e38a83c4` |
| `ShenPulse-2.1.5-x64.appxupload` | 851778609 | `af93dba3960c9a28d466261bac136bdcbb2c7fc9a09d160b17e29e9c91276d53` |
| `ShenPulseSetup-2.1.5-x64.exe` | 797402169 | `02d908022794f1eac4e6b1b2a6abe0e9d76ec25d0618c546867b8bac4708d5e9` |
| `ShenPulseSetup-2.1.5.exe` | 797402169 | `02d908022794f1eac4e6b1b2a6abe0e9d76ec25d0618c546867b8bac4708d5e9` |

Journaux et rapports : .artifacts/release-2.1.5/. Le contrôle visuel du site est conservé dans .artifacts/public-site-qa/2026-11-06T11-27-36-812Z/.
