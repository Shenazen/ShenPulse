# Retouches visuelles ShenPulse

## Périmètre

Les photos du tableau de bord et de la base Utilisateurs sont rétablies avec
`renderStudioHero`, le composant de bannière déjà utilisé par les autres pages.
Les en-têtes globaux redondants restent supprimés. IRL et Abonnement réutilisent
l’illustration locale Actions ; aucune image distante supplémentaire n’est chargée.

L’accueil ne présente plus de galerie de jeux. Ses quatre raccourcis disposent
d’icônes SVG, de contours colorés, de titres alignés et de boutons en pleine
largeur. Le catalogue Jeux et ses interactions restent disponibles depuis le
menu et les raccourcis. L’annuaire LIVE et les trois étapes sont conservés.

## Espaces réorganisés

- [Interactions IRL](interactions-irl-presentation.fr.md) : activation séparée,
  résumé compact, appareils avant les règles, commandes et états explicites.
- [Abonnement](abonnement-interface.fr.md) : offre actuelle, comparaison des
  trois tarifs réels, accès offert et modules payants séparés.
- [Bannières et navigation Musique](bannieres-et-navigation-musique.fr.md) :
  sous-onglets segmentés, icônes, libellés et compteur de demandes distincts.

Les actions déléguées, les protections pendant une opération, les prix, les
profils, les cadeaux et les données enregistrées restent inchangés. La refonte
n’ajoute ni lecture automatique, ni paiement, ni commande physique au rendu.

## Coût du rendu

Les bannières utilisent les WebP locaux déjà embarqués. La suppression de la
galerie évite la sélection du catalogue et le chargement de ses images à
l’accueil. Une modification du catalogue met à jour le compteur du menu, sans
reconstruire la bannière d’accueil. Les changements d’accès continuent à
actualiser les raccourcis visibles, y compris au retour d’une fenêtre masquée.

Musique ne reconstruit plus sa barre de navigation pendant les rafraîchissements
si l’onglet et le nombre de demandes sont inchangés. L’index des prises IRL est
construit une fois par rendu pour retrouver les cibles des règles en temps constant.
Les effets sont statiques : pas de vidéo, canvas animé, police ou dépendance ajoutée.

Les tests de rendu et de visibilité utilisent un DOM et des données temporaires.
Les opérations sur prises, les paiements et les autorisations Spotify réels ne
sont pas déclenchés pendant la validation.

## Validation locale du 13 octobre 2026

- `npm run verify` : 1 121 tests réussis, zéro échec, aucun test ignoré.
- Lint et audit : 543 fichiers JavaScript, 852 sources, zéro erreur de syntaxe
  et zéro cycle d’import.
- `npm run build:dir` : version Windows locale compilée avec succès.
- Treize fichiers de présentation du package ASAR comparés aux sources,
  octet pour octet.
- ShenPulse relancé : accueil, cartes de raccourcis, bannières Dashboard et
  Utilisateurs, appareils et interactions IRL, offres Abonnement et cinq boutons
  de sous-navigation Musique observés dans l’application.

Le profil actif conserve ses 21 actions, le catalogue ses 49 jeux et la page IRL
ses cinq prises et dix interactions. Le LIVE TikTok s’est reconnecté après le
redémarrage, puis la source est passée en attente du LIVE pendant le contrôle.
Aucun test de simulateur, bouton physique, connexion Spotify ou paiement n’a
été déclenché. La validation des commandes et des autres états utilise les tests
automatisés, pas une transaction ou une opération réelle.

Les journaux sont dans `release/retouches-visuelles-verification.log`,
`release/retouches-visuelles-architecture.log` et `release/retouches-visuelles-build.log`.
Cette mise à jour reste locale : aucune publication de production ni nouvelle
version commerciale n’a été envoyée.
