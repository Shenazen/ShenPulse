# Stardew Valley — ShenPulse

Pack 1.1.0, pour Stardew Valley 1.6.14+ et SMAPI 4.5.2, Steam et Xbox / Game Pass. Les sources du module sont ici ; aucun binaire de pack n’est embarqué dans ShenPulse. Le téléchargement utilise les tailles et SHA-256 du manifeste versionné Backblaze.

## Construction

Définir SHENPULSE_CSC vers un compilateur Roslyn compatible, puis lancer node scripts/build-stardew-mod.js avec le dossier Steam de Stardew Valley en argument si nécessaire. Le script compile contre les assemblages installés, construit le ZIP sous .artifacts et synchronise les manifestes. Publier une version immuable avec scripts/publish-game-packs.js ; ne jamais remplacer un objet déjà publié avec un autre contenu.

## Installation et lancement

L’installateur extrait exclusivement internal/windows/install.dat et copie le fichier Stardew Valley.deps.json de l’édition choisie en StardewModdingAPI.deps.json. Steam démarre directement StardewModdingAPI.exe. Xbox démarre gamelaunchhelper.exe ; le lanceur SMAPI est copié sous le nom Stardew Valley.exe, conformément à l’installation SMAPI pour Xbox. L’exécutable Xbox protégé est renommé dans le même dossier en Stardew Valley original.exe, sans changement d’autorisations ni lecture de son contenu. Le déploiement possède un rollback ; une mise à jour conserve aussi l’ancienne sauvegarde du lanceur.

L’installation retient la plateforme. Un jeu déjà ouvert depuis une autre édition est refusé. Les chemins WindowsApps et XboxGames sont normalisés au niveau de l’exécutable pour reconnaître la même instance. Après une mise à jour Xbox, relancer l’installation si le lanceur d’origine a été rétabli.

## Fonctionnement

Le client TCP se reconnecte uniquement à 127.0.0.1:58432. Le réseau met les requêtes en file ; seul le fil principal du jeu exécute les actions. Une requête bloquée par un menu, un dialogue ou une partie multijoueur est refusée. La durée des effets ShenPulse repose sur une échéance monotone, pour qu’un effet ne reste pas actif en arrière-plan. Les outils respectent les niveaux 0 à 4 et les objets respectent la quantité transmise par ShenPulse.

## Vérification du 27 octobre 2026

Les 28 interactions ont été exécutées dans les deux éditions : Steam 1.6.15 build 24356 et Game Pass 1.6.15 build 24354. Les contrôles utilisent le vrai GameHub et les mesures de l’état natif (vie, énergie, argent, objets, outils, buffs, monstres). Les essais incluent les variantes de quantités, tous les niveaux des outils, l’expiration des sept effets temporaires et la mise K.-O. en dernier. La reconnexion après redémarrage du pont est vérifiée. Les sauvegardes ont été copiées avant les essais.

Les mesures et sauvegardes de cette session sont conservées hors sources dans .artifacts/stardew-terraria. Les sondes ne font pas partie du ZIP public et sont retirées après la campagne.
