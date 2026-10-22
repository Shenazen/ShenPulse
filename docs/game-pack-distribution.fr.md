# Distribution des packs de jeux

Les packs compilés sont hébergés sur Backblaze B2, dans le bucket public existant `shenpulse-media`, sous `installer-assets/<jeu>/<version>/<fichier>`. Ils sont téléchargés uniquement pendant l’installation ou la réparation du jeu. Les sources des modules restent dans `native/` et les règles d’installation dans `src/main/game-installers/`.

Les archives ZIP et DLL compilées ont été retirées de `resources/installer-assets/` et du dépôt. Ce répertoire conserve uniquement les petits manifestes et configurations utiles aux scripts et aux tests ; il est entièrement exclu des distributions Electron.

Les tests récupèrent les packs nécessaires depuis Backblaze, avec contrôle de taille et SHA-256. Ils utilisent ensuite un cache de développement hors dépôt : `%LOCALAPPDATA%\ShenPulseDev\game-packs` sous Windows. Une connexion est nécessaire lors du premier lancement des tests sur une machine sans cache ; les essais de déploiement utilisent ensuite les archives vérifiées du cache.

Les quatorze ressources du registre de publication sont décrites dans `scripts/manifests/game-packs.json` avec leur provenance, leur taille et leur SHA-256, dont les deux archives du nouvel hôte d’émulation autonome. Les autres packs déjà publiés sur Backblaze conservent leurs adresses. Les prérequis officiels (BepInEx, .NET, Lovely, Steamodded) restent téléchargés depuis leurs éditeurs. L’archive fournie personnellement par l’utilisateur pour Find the Needle reste locale.

Pour publier ces packs, depuis PowerShell, avec la configuration Backblaze déjà enregistrée dans ShenPulse :

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& node_modules/electron/dist/electron.exe scripts/publish-game-packs.js --user-data "$env:APPDATA\ShenPulse"
```

Ajouter `--verify-only` pour contrôler les fichiers publics sans envoyer de fichiers. Le script déchiffre les accès avec le coffre-fort Windows sans les écrire dans le dépôt ou les journaux. Il refuse d’écraser un objet dont la taille ou l’empreinte diffère. Chaque envoi est suivi d’une relecture publique complète avec contrôle SHA-256 ; le rapport est écrit dans `.artifacts/game-pack-migration/verification.json`.

Les compilations locales Balatro et DREDGE produisent leurs fichiers sous `.artifacts/game-pack-builds/`, ignoré par Git. Le registre de publication utilise `buildPath` pour ces sorties et `sourceUrl` pour les packs tiers. Aucun binaire n’est nécessaire dans `resources/installer-assets/` pour publier ou installer un jeu.

Pour une nouvelle version d’un module : compiler son pack, choisir un nouveau chemin versionné, renseigner sa provenance et son empreinte dans le registre de publication, publier puis mettre à jour le manifeste d’installation. Garder les anciennes versions disponibles pour les applications déjà distribuées. Aucun secret Backblaze n’est nécessaire dans l’application cliente.

Le téléchargement conserve la progression et le délai d’inactivité. Les fichiers incomplets ou corrompus sont supprimés avant une nouvelle tentative. L’extraction, les sauvegardes, la détection Steam/Game Pass, les réglages des jeux et les associations avec les actions ne changent pas.
