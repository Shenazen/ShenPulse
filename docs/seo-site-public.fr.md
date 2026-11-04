# Référencement du site public ShenPulse

Le site public conserve son hébergement existant. L’application Windows reste en 2.1.3 : cette évolution concerne la vitrine, sans reconstruire les installateurs ni relancer les services des LIVE.

## Construction

`npm --prefix website run check` génère le site, puis vérifie le catalogue public, les ressources, les données de démonstration et les pages HTML.

Le générateur partage ses composants de présentation et son manifeste de routes avec le navigateur. Les pages sont complètes dès la réponse HTTP : accueil, catalogue et fiches jeux, guides, notes de version et pages légales. Les filtres, menus et aperçus sont des améliorations progressives. Les anciennes adresses `/docs#...` restent valides.

Le catalogue provient exclusivement de la visibilité publique actuelle. Ne pas publier des fiches de jeux réservés à un utilisateur. Les statuts et prérequis restent explicites ; ne pas promettre une compatibilité non testée.

Les métadonnées, fils d’Ariane, données structurées et sitemap sont générés depuis le même manifeste. Aucune note, aucun témoignage et aucun classement ne sont inventés. Le téléchargement gratuit et les fonctions payantes sont indiqués visiblement.

Les images sont traitées à la construction avec Sharp, en WebP, à deux résolutions. Les URL contiennent une empreinte du fichier ; les originaux des captures restent disponibles pour leur agrandissement. Les polices sont locales.

## Vérification

- `npm --prefix website run check:visual` : Chromium isolé, tailles desktop et mobile, navigation, recherche, agrandissement, clavier, absence de débordement et lecture avec les scripts du site bloqués.
- Rapport de génération et vérifications SEO : `.artifacts/website-seo/`.
- Captures et rapport visuel : `.artifacts/public-site-qa/<date>/`.
- `npm audit --omit=dev` pour les dépendances d’exécution.

## Publication

La vitrine utilise `scripts/publish-public-site.ps1` avec la version déjà publiée et l’EXE existant. Le script vérifie les empreintes et conserve une sauvegarde avant remplacement. Il ne touche pas au backend, aux données ni aux anciens téléchargements.

Le modèle `website/deploy/nginx-shenpulse.conf` réserve les routes API, WebSocket, téléchargements, jeux historiques et invitation agence au proxy existant. Seules les pages de la vitrine reçoivent la redirection vers le domaine canonique avec www, la résolution des HTML générés, la compression et les vraies réponses 404.

`website/deploy/apply-nginx.sh` exige l’empreinte de la configuration courante, sauvegarde celle-ci, exécute `nginx -t` et recharge Nginx sans redémarrer le backend. Il restaure la configuration précédente si la validation ou le rechargement échoue.

Après publication : contrôler toutes les routes du sitemap, les en-têtes, les redirections, les 404, les ressources, le téléchargement 2.1.3 et la santé des services applicatifs. Une future suppression de page doit également retirer ou rediriger son ancien HTML du serveur ; une absence du sitemap ne suffit pas.

## Google

Conserver le fichier de validation de propriété fourni par Search Console, y compris lors des publications suivantes. Le sitemap canonique est `https://www.shenpulse.leuridan.fr/sitemap.xml`.

La validation technique ne garantit ni l’indexation immédiate ni la première place. Les impressions, clics, pages indexées et Core Web Vitals se suivent dans Search Console ; les données terrain demandent suffisamment de visites.
