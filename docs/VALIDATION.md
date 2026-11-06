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

- Git : commit de release `4da4886` et tag annoté `v2.1.5` poussés sur origin. Les artefacts et journaux ne sont pas versionnés. Le compte rendu final est ajouté ensuite sans déplacer le tag qualifié.
- Microsoft Store : soumission 17, identifiant `1152921505702332400`, envoyée le 6 novembre 2026. L'interface confirme « Mise à jour en cours de certification ». Nouveau paquet 2.1.5 validé et textes français enregistrés. Audience publique, détectabilité active, 240 marchés et publication automatique dès certification confirmés ; aucun vol privé. La disponibilité publique de la 2.1.5 dépend encore de Microsoft et n'est pas revendiquée.
- Site public et EXE publiés. Contrôle de production réussi : 79 pages, zéro erreur. Téléchargement intégral de l'EXE public vérifié le `2026-11-06T11:35:01.659Z` : HTTP 200, 797 402 169 octets, SHA-256 identique à l'artefact qualifié. L'ancien installateur 2.1.3 reste disponible. Sauvegarde distante avant publication : `/var/www/shenpulse/.public-site-backups/pre-public-site-2.1.5-20261106T113238Z-0bdc1b94`.
- Overlays et règles Firebase publiés ; comparaison des six fichiers publics réussie. Le backend de production n'a pas été redémarré pour cette publication.
- Discord : [nouvelle annonce 2.1.5](https://discord.com/channels/1561730092995051671/1561731045949313327/1568228117817065532), publiée aussi vers les abonnés du salon. Elle regroupe les nouveautés depuis 2.1.3, omet la version urgente intermédiaire, conserve les anciennes annonces et utilise le lien Microsoft Store officiel. L'intégration automatique périmée de la fiche Store a été masquée sur ce seul nouveau message.
- Documentation Discord : [complément du guide des jeux](https://discord.com/channels/1561730092995051671/1561739559895834725/1568229786134904894) sur les combos, les cartes et Actions & IRL ; [nouveau guide des agences et offres groupées](https://discord.com/channels/1561730092995051671/1561738323553427456/threads/1568231323095662662). Contenu envoyé et présence vérifiés dans l'interface.
- Application locale finale relancée depuis `dist/win-unpacked/ShenPulse.exe` : version 2.1.5 observée, compte et profil conservés, connexion LIVE rétablie. Aucun jeu relancé pour ce contrôle.

La règle interdisant les références à des applications concurrentes dans les communications de publication est intégrée à `DEPLOIEMENT.txt`, `docs/STORE_SUBMISSION.md` et au skill personnel de mise en production. Les textes de cette release ont été contrôlés avant envoi.

## Empreintes des artefacts

| Artefact | Taille | SHA-256 |
| --- | ---: | --- |
| `ShenPulse-2.1.5-x64.appx` | 851853322 | `6fdbff74ca0e6d4dea352c0c8a65826bd772bf205b07396ca7d2b461e38a83c4` |
| `ShenPulse-2.1.5-x64.appxupload` | 851778609 | `af93dba3960c9a28d466261bac136bdcbb2c7fc9a09d160b17e29e9c91276d53` |
| `ShenPulseSetup-2.1.5-x64.exe` | 797402169 | `02d908022794f1eac4e6b1b2a6abe0e9d76ec25d0618c546867b8bac4708d5e9` |
| `ShenPulseSetup-2.1.5.exe` | 797402169 | `02d908022794f1eac4e6b1b2a6abe0e9d76ec25d0618c546867b8bac4708d5e9` |

Journaux et rapports : .artifacts/release-2.1.5/. Le contrôle visuel du site est conservé dans .artifacts/public-site-qa/2026-11-06T11-27-36-812Z/.
