# Escape From Duckov — Steam

Le catalogue contient les 83 codes du pack officiel EscapeFromDuckov, avec leurs noms français, conditions, icônes, durées et fiches d’interactions. Aucun cadeau n’est associé automatiquement.

Le jeu est réservé au compte propriétaire (`scope: admin`). Sa version minimale est `2.0.5`, conservée dans le catalogue et dans les deux branches Firebase `site/adminSettings` et `site/publicVisibility`. La restriction de version reste disponible si le propriétaire publie ensuite le jeu. Le logo configuré est Steam.

## Installation et lancement

- Steam PC, AppID `3167020`, exécutable `Duckov.exe`.
- Installation automatique de MelonLoader et du module, après fermeture du jeu. Les fichiers remplacés sont sauvegardés ; les préférences MelonLoader existantes sont conservées.
- ShenPulse écoute uniquement sur `127.0.0.1:58440`. L’installateur vérifie l’empreinte du module d’origine avant d’adapter son port. Les durées transmises au module sont en millisecondes.
- Le lancement passe par Steam. Une instance existante est réutilisée, y compris lors de demandes simultanées. Steam doit être connecté au compte possédant le jeu.
- Les effets nécessitent une expédition chargée, hors refuge, chargement, pause, menus et mort du personnage. Les armes, altérations, emplacements du sac et points d’apparition requis sont précisés dans « CONDITION DE JEU ».

## Distribution

Le pack ShenPulse `1.1.1` reprend le module officiel `1.1.0` et ajoute un correctif d’équipement des ennemis. Le module d’origine essaie de placer les armes à feu dans l’emplacement de mêlée ; le correctif les redirige vers l’emplacement principal uniquement dans sa coroutine d’apparition, pour les personnages autres que le joueur. Les commandes d’inventaire normales et les armes de mêlée gardent leur comportement.

Archive : [duckov-shenpulse-1.1.1.zip](https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/escape-from-duckov/1.1.1/duckov-shenpulse-1.1.1.zip).

- Taille : `11979534` octets.
- SHA-256 : `29142ce78b597beee17b694514da07848d7e8d96a9cedc2efea4875d8924ff75`.
- Sources du correctif : `native/escape-from-duckov/Compatibility.cs`.
- Reconstruction : `node scripts/build-duckov-pack.js <dossier-du-jeu>` ; publication par le registre `scripts/manifests/game-packs.json`.
- Les binaires compilés restent dans `.artifacts/game-pack-builds` et Backblaze. Ils ne sont pas embarqués dans l’application. Le diagnostic temporaire des essais n’est pas inclus dans l’archive.

## Validation au 22 octobre 2026

L’installation réelle depuis Backblaze a été effectuée sur le jeu Steam installé. La taille et l’empreinte de l’archive publiée ont été relues intégralement. Le correctif se charge dans MelonLoader.

Les 83 codes passent les tests de transport ShenPulse. Les contrôles automatisés couvrent aussi la restriction propriétaire, la version minimale, le téléchargement, la corruption d’archive, la sauvegarde des fichiers, le refus de réparation pendant une partie et le lancement sans doublon. Un exécutable de test compile le vrai correctif et vérifie huit comportements d’équipement, notamment l’absence d’effet sur le joueur et hors apparition.

La suite complète passe : 2 738 tests, aucun échec. Le contrôle de syntaxe et la construction de l’application Windows 2.0.5 passent également ; son API locale confirme le compte propriétaire, la portée privée, les 83 effets et l’installation 1.1.1.

Dans une expédition réelle, 76 effets hors apparitions et mort ont été confirmés par l’état du moteur : santé, ressources, altérations, objets, armes, météo, heure, taille, vitesse, endurance et expiration des effets temporaires. Les journaux détaillés des essais restent dans `.artifacts/duckov` ; des sauvegardes du jeu ont été conservées avant les essais.

**Validation en jeu restant à terminer :** les six apparitions avec leur équipement après le correctif et l’effet de mort. Après une déconnexion Steam (`No Connection`), la reconnexion a réussi mais le dernier lancement est refusé à l’étape `RequestingLicense` (`AppError_5`). Les réponses positives des anciennes tentatives d’apparition ne constituent pas une validation de l’équipement corrigé. Une nouvelle expédition d’essai, depuis le compte Steam possédant le jeu, est nécessaire.

Le diagnostic temporaire est conservé uniquement sur le PC d’essai pour terminer ces sept contrôles ; il doit être retiré de `Mods/ShenPulse.DuckovProbe.dll` après validation. Il ne fait partie ni du pack Backblaze ni de ShenPulse distribué.

Références : [guide officiel](https://crowdcontrol.live/guides/escapefromduckov/), [catalogue officiel des effets](https://open-api.crowdcontrol.live/games/EscapeFromDuckov/packs).
