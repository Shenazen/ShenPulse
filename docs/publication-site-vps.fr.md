# Publication ciblée de la vitrine ShenPulse

Cette procédure complète la release de l’application. Elle ne remplace ni les
contrôles obligatoires, ni les builds EXE/Store, ni les déploiements Firebase.
Ne la lancer qu’après la validation explicite des contrôles de release.

La destination existante, vérifiée en lecture seule le 14 octobre 2026, est
`debian@213.32.22.185`, `/var/www/shenpulse/dist`. Nginx transmet les deux domaines
ShenPulse au backend existant sur le port `3199`. Aucun redémarrage de ce backend
n’est nécessaire pour modifier ses fichiers statiques.

Après les builds et `npm --prefix website run check`, examiner le plan :

```powershell
powershell -NoProfile -File scripts/publish-public-site.ps1 -Version 2.0.2
```

Le plan ne crée rien et ne se connecte pas au VPS. La simulation explicite de la
publication est également possible avec `-Publish -WhatIf`. Pour publier après
validation :

```powershell
powershell -NoProfile -File scripts/publish-public-site.ps1 -Version 2.0.2 -Publish
```

Le script utilise la clé SSH déjà configurée, par son **chemin** seulement. Il
n’affiche ni son contenu ni aucun secret. `BatchMode=yes` et
`StrictHostKeyChecking=yes` imposent un accès déjà configuré : une empreinte
absente ou différente doit être contrôlée, jamais acceptée automatiquement.

Ordre et périmètre :

1. Vérifier version, nom de l’EXE, liens du site, fichiers autorisés et cibles.
2. Envoyer dans un staging privé les fichiers, puis comparer les SHA-256.
3. Publier l’EXE **versionné** par renommage atomique. Un fichier déjà présent
   avec une empreinte différente provoque un arrêt ; aucun EXE ancien n’est retiré.
4. Sauvegarder tous les fichiers de vitrine qui seront remplacés et mémoriser
   ceux qui n’existaient pas auparavant.
5. Publier les nouveaux modules et le contenu avant `app.js`, puis les HTML en
   dernier. Chaque fichier est remplacé atomiquement ; le site entier n’est pas
   basculé en une transaction unique.
6. Comparer à nouveau toutes les empreintes sur les fichiers publics.

`downloads`, `games`, le backend, `.env`, `private`, les données, les moniteurs
et PM2 sont conservés. Le script n’envoie aucune vidéo de Matchs en clair,
archive chiffrée ou clé de déchiffrement dans la vitrine. Il n’utilise pas
l’ancien script de déploiement global du dépôt web voisin.

Les archives et scripts exacts sont conservés dans
`.artifacts/public-site-release/`. Le VPS conserve le staging et la sauvegarde
dans `.deploy-staging/` et `.public-site-backups/`, hors du dossier public.
Aucun nettoyage automatique destructif n’est effectué.

Après publication, contrôler l’accueil, la documentation, les routes légales,
les liens de téléchargement, les en-têtes/tailles de l’EXE et son SHA-256 HTTP.
Vérifier aussi que les versions antérieures restent téléchargeables.

En cas d’interruption, inspecter l’état et la sauvegarde avant de relancer.
Pour un retour arrière de la vitrine, restaurer uniquement les fichiers de
`public/` de cette sauvegarde avec la même méthode de renommage, et retirer
uniquement les chemins listés dans `previously-absent.txt` après vérification.
Conserver les installateurs versionnés : le changement du lien du site suffit
à revenir à une version antérieure. Ne pas remplacer le backend ni supprimer
le dossier racine de l’application.
