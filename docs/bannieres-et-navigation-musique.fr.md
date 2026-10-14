# Bannières créateur et navigation Musique

Les pages **Tableau de bord** et **Utilisateurs** affichent à nouveau leur bannière photo locale au-dessus du contenu. Elles réutilisent `renderStudioHero` et les images `assets/studio/dashboard.webp` et `assets/studio/users.webp`, comme les autres espaces créateur. Aucun en-tête global supprimé auparavant n'est rétabli.

Les mises à jour des statistiques, de l'historique et des filtres ne recréent pas ces bannières. Les statistiques du LIVE courant ou du dernier LIVE, le simulateur, la pagination et la séparation des comptes restent inchangés.

## Navigation Musique

Les cinq fonctions existantes — Lecteur, File d’attente, Rechercher, Mes playlists et Paramètres — sont présentées dans une barre segmentée avec une icône vectorielle et un libellé lisible. Le nombre de demandes apparaît uniquement dans un badge de la file d’attente.

- L'onglet actif est identifié par son contraste et `aria-pressed`.
- Les boutons restent accessibles avec Tab, puis Entrée ou Espace ; le focus est visible.
- La grille passe de cinq à trois, puis deux colonnes lorsque la largeur diminue.
- Le rafraîchissement du lecteur conserve les boutons et leur focus. Seul un changement d'onglet ou du nombre de demandes reconstruit la barre, en rétablissant le focus sur le même onglet.
- Une traduction des libellés ne provoque pas de reconstruction à chaque rafraîchissement.

Les commandes Spotify, les demandes ShenPulse, les permissions, les garde-fous de compte et la fréquence de rafraîchissement existants ne sont pas modifiés. Aucun média ni paquet supplémentaire n'est chargé.

## Vérification

Les tests `dashboard-live-layout`, `creator-users-music` et `creator-navigation` vérifient la présence des images locales, la conservation des champs et des bannières, les cinq onglets, leur état accessible, le badge, le focus et les règles responsive. Le contrôle visuel final est effectué dans l'application reconstruite.
