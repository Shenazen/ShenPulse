# Rapport de validation — ShenPulse 2.0.2

Date : 15 octobre 2026.
Environnement : Windows 11 Famille x64 10.0.26200, Node.js 24.14.0,
npm 11.9.0, Electron 43.2.0 et electron-builder 26.15.3.

Les rapports [2.0.0](validation/2.0.0.fr.md) et
[2.0.1](validation/2.0.1.fr.md) sont conservés.
Voir les [notes 2.0.2](releases/2.0.2.fr.md) et
le [contrat de stockage](architecture-etat.md).

## Périmètre et preuves

Correction de la conservation des profils après reconnexion sur le même PC :
récupération d'un espace local manquant sous son UID identifié, transitions
identité/espace atomiques, sauvegarde immédiate des profils, rejet des réponses
d'authentification ou de sélection périmées et synchronisation des catalogues
du rendu. TTS et préférences des demandes musicales sont isolés par profil.
Les intégrations, bibliothèques et droits restent rattachés au compte.

Quatre scénarios de défaillance reproduits avant correction échouaient :
cache de compte absent avec/sans session lisible et panne disque pendant
activation/déconnexion. Le cycle normal passait déjà. Ces reproductions
ne prouvent pas la cause précise rencontrée par le client : ses données
n'ont pas été consultées. Une mise à jour ne recrée pas des données déjà
effacées de toutes les sauvegardes. Aucune synchronisation entre PC ajoutée.

La restriction propriétaire Administration/Contrôleurs/Paramètres préparée
précédemment est incluse. La configuration partagée avait déjà été restreinte ;
le code de cette version renforce aussi le contrôle local et les opérations
d'infrastructure. Les imports créateur ne remplacent plus ces réglages sensibles.

## Contrôles réussis

- `npm ci` : dépendances verrouillées installées sans mise à jour forcée.
- Audit des dépendances distribuées : zéro vulnérabilité connue. L'outillage
  conserve 19 alertes préexistantes (8 modérées, 11 élevées).
- Lint final : 675 fichiers JavaScript et 994 sources, imports sans cycle.
- Suite complète finale du build installateur : **1 902 tests réussis**,
  aucun échec. Le build Store avait validé 1 900 tests ; les deux tests
  supplémentaires ne modifient pas les sources applicatives déjà construites.
- Test d'intégration avec vrai StateStore temporaire et AccountService :
  deux profils A1/A2, voix et politiques musicales distinctes, son importé,
  déconnexion/redémarrage/reconnexion, compte B vierge puis retour A.
  Les réponses Firebase et droits sont entièrement simulées ; chaque écriture
  vérifie la cohérence UID actif / identité.
- Gardes testées pour refresh/lookup/Google/droits retardés, reconnexion au
  même UID et changement A/B, arrêts/reprises IPC et sélection de profils.
  L'annulation Google libère immédiatement le port du retour local.
- Builds Store/AppXUpload et EXE réussis.
- Installation, lancement et désinstallation isolés 2.0.2 : réussis.
- Mise à jour isolée 2.0.1 → 2.0.2 : réussie, marqueur utilisateur conservé.
- Site construit et validé : 19 fichiers, routes publiques conformes.
- Audit package : 1 805 sources vérifiées, 21 vidéos Match chiffrées, zéro
  vidéo brute et zéro fichier privé décompressé. Pont Store PE32+ AMD64 valide ;
  seules les métadonnées de compilation qualifiées diffèrent.
- Manifeste AppX : `ShenPulse.ShenPulse`, éditeur réservé,
  version `2.0.2.0`, architecture x64. AppXUpload : un seul AppX attendu.
- Relais public Firebase : smoke réel réussi, canal temporaire nettoyé.
- Stockage média de production : endpoint public valide, bucket configuré,
  limite 209 715 200 octets. Aucun nouvel envoi de média client ni effet LIVE.

Les tests fonctionnels de persistance utilisent des profils fictifs isolés,
pas la bibliothèque ou les réglages d'un client réel.

## Artefacts

| Fichier | Taille en octets | SHA-256 |
|---|---:|---|
| `ShenPulseSetup-2.0.2-x64.exe` | 512 541 217 | `B322E2DED6E97A46F242BC7F589D6E6C1ADD198565E5805FE073AF4027AEC7BE` |
| `ShenPulseSetup-2.0.2.exe` | 512 541 217 | `B322E2DED6E97A46F242BC7F589D6E6C1ADD198565E5805FE073AF4027AEC7BE` |
| `ShenPulse-2.0.2-x64.appx` | 565 713 109 | `632477ABC0A43CFCEE354A733B2FF555BFF62C30B4AE9D87657CAA0604687031` |
| `ShenPulse-2.0.2-x64.appxupload` | 565 551 356 | `1E1E17523641AEA78775932796389F8CF777E876B2F240201EA8A820E977D413` |

Les deux EXE sont identiques. Le programme porte ProductVersion `2.0.2.0`.
Les artefacts 2.0.1 restent conservés pour retour arrière. Les artefacts,
profils, rapports bruts et secrets sont exclus de Git.

## Signature et qualification Store

L'EXE et le programme restent `NotSigned`, aucun certificat Authenticode
public n'étant configuré. Un avertissement SmartScreen reste possible.

WACK exécuté sur l'AppX 2.0.2 : **OVERALL_RESULT=PASS**,
`APP_VERSION=2.0.2.0`, `PARTIAL_RUN=FALSE`, sortie du processus 0.
23 sous-tests PASS ; un sous-test **optionnel** « Fichiers exécutables
bloqués » est FAIL, signalant les références de lancement de processus
d'Electron et de l'archive applicative. Ce point doit être expliqué avec
la capacité `runFullTrust` lors de la soumission, pas présenté comme absent.
Tous les tests obligatoires sont réussis.

Rapport local : `.artifacts/wack-2.0.2.xml`, SHA-256
`60EAF0926971BE401D7BFB6E6937D65B30B65CBD6F4CE1DCE3BDDF2AC269E51C`.
Le blocage d'élévation observé en 2.0.1 n'est pas réutilisé pour cette version.

Partner Center reste sur la page de connexion Microsoft, sans session
authentifiée disponible. Le package est construit mais **non envoyé**.
Restent : connexion humaine Partner Center, envoi, vol privé, installation
et smoke de la version Store, puis seulement soumission publique.

## Publication

Les contrôles de construction et qualification ci-dessus sont terminés.
La publication Git, EXE/site et Firebase ainsi que les contrôles HTTPS
post-production restent à consigner après leur exécution effective.
