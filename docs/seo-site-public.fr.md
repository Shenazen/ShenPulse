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

## Publication vérifiée le 4 novembre 2026

- Commit principal : `f6a4230`, publié sur Git.
- 79 pages HTML, dont 55 fiches jeux et 16 guides ; 3 299 liens et ressources contrôlés.
- 56 images traitées, environ 89 % de réduction sur leurs versions WebP principales par rapport aux originaux.
- 59 vues Chromium contrôlées sur sept largeurs de fenêtre ; aucune erreur visuelle, JavaScript ou ressource manquante dans le rapport final. Lecture avec modules du site bloqués également contrôlée.
- Contrôles HTTP de production : 79 réponses 200 avec contenu complet, métadonnées et compression ; 404 réelles, redirections canoniques, sitemap XML, robots, cache immutable des images et revalidation ETag conformes.
- EXE 2.1.3 conservé : 797 380 472 octets, SHA-256 `fba2e7814684cc413e185e5df592fb7881b847ece15c3238fe8a210f189104bd`.
- Nginx rechargé après validation, PID backend inchangé : 312378. Vérification des routes publiques LIVE et de configuration paiement sur les deux noms de domaine. Aucun paiement réel effectué.
- Audit npm des dépendances de production : zéro vulnérabilité signalée.
- Propriété Search Console `https://www.shenpulse.leuridan.fr/` validée par fichier HTML ; sitemap traité avec succès, **79 pages découvertes**. Ce nombre ne signifie pas que les 79 pages sont déjà indexées.
- L’inspection Google indique que l’accueil est déjà indexé ; la demande d’actualisation a été acceptée et placée en file d’exploration prioritaire.

Sauvegardes serveur :
- Vitrine : `/var/www/shenpulse/.public-site-backups/pre-public-site-2.1.3-20261104T203029Z-9d2448e3`.
- Ajustement final des données structurées : `/var/www/shenpulse/.public-site-backups/pre-public-site-2.1.3-20261104T204203Z-0c51d68f`.
- Nginx : `/var/www/shenpulse/.public-site-backups/nginx-20261104T203129Z.conf`.
- Nouvelle configuration Nginx : SHA-256 `466837ff03091e383ed6c75efd8eb73512a2a1d9c265e2c3aac04516eb8e63be`.

Rapports : `.artifacts/website-seo/production-check.json`, `.artifacts/website-seo/validation.json`, `.artifacts/public-site-qa/2026-11-04T20-29-40-231Z/report.json`. Le script `node website/scripts/verify-production.cjs` permet de refaire les contrôles publics après une publication (construction du site et EXE versionné requis).

Le balisage SoftwareApplication enrichi est volontairement omis tant qu’aucune note ou aucun avis authentique, affichable et vérifié ne peut être fourni : Google exige l’un de ces éléments pour ce résultat enrichi. Les balisages WebSite, Organization, WebPage, BreadcrumbList, Article et ItemList décrivent les contenus réels. Référence : https://developers.google.com/search/docs/appearance/structured-data/software-app .
