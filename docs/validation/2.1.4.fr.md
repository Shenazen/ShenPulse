# Rapport de validation — ShenPulse 2.1.4

Date : 5 novembre 2026. Mise à jour urgente limitée au Microsoft Store, autorisée par le propriétaire. Publication directe sans vol privé. Site, installateur EXE, Discord et autres étapes de diffusion reportés à sa demande. Version Windows : 2.1.4.0.

Notes : [2.1.4](releases/2.1.4.fr.md). Rapport précédent : [2.1.3](validation/2.1.3.fr.md).

La protection contre le partage de comptes a été rappelée au propriétaire avant la publication ; elle reste hors de ce correctif urgent.

## Qualification réussie

- `npm ci` réussi ; audit des dépendances de production : zéro vulnérabilité.
- `npm run verify` final : 3 683 tests réussis, zéro échec ; structure, syntaxe et imports validés.
- 77 contrôles ciblés supplémentaires réussis, dont les combos de jeux, les packs agences et les métadonnées de version/cache des overlays.
- Paquet AppX x64 et AppXUpload construits en 2.1.4.0. Identité Microsoft Store `ShenPulse.ShenPulse`, éditeur réservé conservé.
- Audit ASAR : 3 831 fichiers contrôlés, aucune anomalie, aucun fichier interdit ; les 27 médias protégés sont conservés chiffrés.
- AppXUpload : AppX embarqué identique au paquet contrôlé, vérifié par SHA-256.
- Kit officiel de certification Windows : `PASS`, version 2.1.4.0, exécution complète (`PARTIAL_RUN FALSE`). Installation Store 2.1.3.0 conservée pendant le contrôle.

Journaux et audits : `.artifacts/release-2.1.4/`. Rapport Windows : `.artifacts/wack-2.1.4.xml`.

## Soumission publique Microsoft Store

Le 5 novembre 2026 vers 10 h 24 (Europe/Paris), la soumission publique 16, identifiant `1152921505702322167`, a été envoyée pour certification. Microsoft a validé le paquet `ShenPulse-2.1.4-x64.appxupload`. Description et notes françaises mises à jour pour ce correctif ; tarification et disponibilité conservées.

État observé après envoi : **mise à jour en cours de certification**, prétraitement en cours. La publication démarre automatiquement dès acceptation. Aucun vol privé créé. La disponibilité publique de 2.1.4 n’est pas encore confirmée ; le délai de certification appartient à Microsoft.

Preuve visuelle enregistrée via le navigateur intégré : `C:/Users/alexa/AppData/Local/Temp/shenpulse-2.1.4-store-submitted.png`.

## Empreintes des artefacts

| Artefact | Taille | SHA-256 |
| --- | ---: | --- |
| `ShenPulse-2.1.4-x64.appx` | 851 826 279 octets | `a198a6558d82873791c9758d5aa58ff1f9bd5c5ecdae5b561636c9e1f6d8ed3c` |
| `ShenPulse-2.1.4-x64.appxupload` | 851 748 779 octets | `1bd5c457e139eb5de59f508a30c4bb6df603435197e5e7c85a9021ee3b0ac953` |

## Étapes reportées à la demande du propriétaire

Le site public, l’installateur EXE, Discord et les autres opérations de la procédure complète restent à réaliser ultérieurement. Le correctif des combos est contenu dans l’application ; aucune mise à jour de pack de jeu ni du backend n’est nécessaire pour l’activer après installation de 2.1.4.