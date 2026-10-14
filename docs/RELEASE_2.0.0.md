# ShenPulse 2.0.0 — notes de version

## Une interface repensée

- Nouvel accueil, navigation et barre de connexion compacte ; profils conservés.
- Tableaux cohérents pour les actions, sons, Machines IRL et commandes.
- Statistiques du LIVE en cours ou du dernier LIVE, classement et gestion des utilisateurs bloqués.
- Présentation harmonisée des abonnements, overlays, musique, voix et sons.

## Interactions en direct

- Commandes `!` pour la musique, les actions et les overlays, avec permissions et délais de réutilisation.
- Matchs TikTok : détection des événements reçus, widgets et automatisations, transport local immédiat pour Studio.
- Animations Match avec audio, protections de lecture et six nouveaux clips Cyber.
- Annuaire public des créateurs en LIVE, uniquement après activation de leur visibilité.
- Catalogue de cadeaux et récupération des associations des anciennes configurations améliorés.
- Les objectifs de likes et le tableau de bord partagent les tapotages de la session.

## Architecture et fiabilité

- Modules de domaine et composants réutilisables, documentation technique en français.
- Réduction des mises à jour inutiles de l'interface et des traitements LIVE redondants.
- Contrôles Pro côté interface et services ; Machines IRL, jeux, commandes et matchs accessibles selon les droits du compte.
- Conservation des profils et réglages existants, couverte par les tests de migrations et de réparation.

## Protection et limites

Les clips Match distribués sont chiffrés dans l'application et lus en mémoire,
sans export proposé ni fichiers vidéo en clair dans le package public. Les
sources privées nécessaires à leur construction ne sont pas publiées dans Git.
Cette protection n'est pas un DRM : elle ne peut empêcher une extraction experte
ou une capture de l'écran. Les médias déjà présents dans l'historique public du
dépôt ne peuvent pas devenir rétroactivement secrets.

Les prévisualisations et les tests automatisés sont isolés ; ils ne prouvent pas
à eux seuls la configuration du mixeur audio de chaque logiciel de diffusion.
Les données de match dépendent des événements disponibles sur la plateforme.

La validation, les empreintes des artefacts et l'état de publication sont suivis
dans `docs/VALIDATION.md`. Une soumission publique Microsoft Store exige WACK et
un vol privé installé et testé ; la génération du package ne vaut pas certification.
