# Administration du stockage Backblaze

La rubrique **Administration → Stockage Backblaze** permet à l'administrateur ShenPulse de consulter les fichiers présents dans le bucket et de les télécharger sur son PC. La version de l'application reste 2.1.4.

## Utilisation

- Par défaut, la page affiche les fichiers importés par les utilisateurs. Le filtre de catégorie permet aussi d'afficher les packs de jeux et les autres fichiers, ou tout le bucket.
- La recherche porte sur le nom et le chemin du fichier. Les filtres permettent de choisir les vidéos, sons, images ou autres fichiers.
- Chaque fiche affiche le nom, le dossier, la taille et la date. Lorsque le chemin permet de l'identifier, l'identifiant du compte d'origine est indiqué.
- **Aperçu** ouvre une image ou un lecteur audio/vidéo sans démarrer automatiquement la lecture.
- **Télécharger** ouvre la boîte Windows permettant de choisir le dossier et le nom du fichier.
- Les anciens fichiers dont le nom a été remplacé par un identifiant lors de l'import conservent ce nom technique : aucun nom original n'est inventé.

## Accès et fonctionnement

Les clés Backblaze restent uniquement sur le serveur. Chaque lecture de liste, aperçu et téléchargement vérifie l'identité de l'administrateur. Les liens signés expirent rapidement. Aucun bouton de suppression n'est exposé.

L'inventaire est paginé et mis en cache pendant deux minutes. Le bouton Actualiser demande son renouvellement. Si la limite d'inventaire est atteinte, un avertissement indique explicitement que la liste est partielle.

Le téléchargement utilise un fichier temporaire dans le dossier choisi. La taille reçue est vérifiée avant le remplacement atomique de la destination. Une erreur ou un changement de compte interrompt le téléchargement et nettoie le fichier temporaire.

## Validation du 5 novembre 2026

- Accès serveur authentifié vérifié : 311 fichiers, dont 10 vidéos ; inventaire complet.
- Accès anonyme refusé par les deux routes administrateur.
- Aperçu vidéo partiel reçu avec HTTP 206.
- Téléchargement réel de 459 759 octets, taille et empreinte vérifiées.
- 3 759 tests automatisés réussis.
- Construction Windows 2.1.4 contrôlée : fichiers de cette fonctionnalité identiques aux sources dans l'archive de l'application.

Le serveur utilise les routes GET `/api/admin/storage` et POST `/api/admin/storage/file`. La sauvegarde du point d'entrée précédent est conservée dans le répertoire privé de déploiement du serveur. Le script `scripts/maintenance/verify-admin-storage.js` permet la vérification authentifiée sans écrire dans le profil utilisateur réel.
