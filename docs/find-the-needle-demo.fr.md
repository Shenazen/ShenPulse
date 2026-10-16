# Find The Needle Demo — intégration privée

Cette intégration incluse sans achat de pack ShenPulse est réservée **par défaut** au compte propriétaire vérifié. Sa visibilité peut être modifiée dans Administration → Visibilité → Jeux. Le contrôle Pro des jeux reste applicable et les opérations principales revérifient la portée choisie. Le catalogue public du site exclut toujours les jeux `ownerOnly`. Voir [la gestion de visibilité des jeux](visibilite-jeux.fr.md).

## Versions et provenance

- Démo Steam gratuite **5165210**, version V62, build **25867630** ; ne pas confondre avec le jeu complet 5160800.
- Mod fourni séparément par l’utilisateur : **S2E Find The Needle 1.2.7**, archive `s2e-find-the-needle-v1.zip`.
- SHA-256 de l’archive examinée : `8f49ffa901842f0308efa1ee25aac6533a11657937c59260dbcf166754a3b703`.
- Jaquette officielle Steam conservée à son ratio d’origine ; aucune image issue d’une capture étirée.

Le mod tiers n’est pas inclus dans le dépôt ou l’application. L’installation utilise le ZIP téléchargé par l’utilisateur, vérifie son empreinte, sauvegarde les fichiers remplacés et conserve les autres entrées de configuration. Aucun achat ni abonnement StreamToEarn n’est réalisé par ShenPulse.

## Utilisation

Fermez la démo avant l’installation du mod. Associez son dossier Steam et fournissez l’archive compatible dans Installation. Lancez ensuite le jeu et chargez une partie avant de vérifier la connexion. **F8** affiche le panneau des effets du mod.

Le bouton de lancement passe exclusivement par `steam://rungameid/5165210`. Le lancement direct de l’EXE peut empêcher Godot de trouver les scripts externes du mod : il ne constitue donc pas une solution de remplacement.

Les 37 commandes sont présentées en français et configurables. Quatre associations du modèle sont préparées : 100 likes vendent du foin au sol, un follow déverse le foin, une Rose fait tout lâcher et un Cœur avec les doigts active Extra Life. Les 33 autres n’ont pas de déclencheur tant que vous ne leur en attribuez pas ; elles ne réagissent pas toutes au même cadeau.

Les cibles des technologies et bâtiments acceptent `random` ou un identifiant obtenu dans les catalogues locaux `/technologies` et `/buildings`. Le jeu peut refuser une cible indisponible dans la démo : le refus est affiché, pas transformé en réussite.

## Transport et sécurité

ShenPulse communique uniquement en HTTP local avec `127.0.0.1:55001` par défaut. La vérification de `/health` exige l’identité du mod, sa compatibilité et une partie prête. Une requête POST est envoyée par commande, avec identifiant d’exécution, nom du spectateur et paramètres validés. Pas de redirection distante ni de réémission automatique des effets après une erreur. Un changement de profil, de compte ou de droit interrompt les demandes encore en attente.

La configuration du mod peut définir un port local et un jeton Bearer. Le jeton ne doit jamais apparaître dans les captures, journaux ou messages de diagnostic. Le mod d’origine autorise les pages web par CORS ; une configuration sans jeton n’est donc pas une authentification même si elle écoute exclusivement en boucle locale.

## Limites à connaître

- Par défaut, le mod suspend les temporisations et les transferts de foin lorsque le jeu est en pause, minimisé ou hors focus. Il faut revenir au jeu pour voir les effets avancer.
- Les modifications d’argent, technologies, bâtiments et foin peuvent être enregistrées par la sauvegarde automatique. `reset` annule seulement les effets temporaires et les travaux en attente, **pas la progression**. Testez dans un emplacement de sauvegarde distinct.
- Certaines commandes exigent du foin au sol, un objet tenu, une technologie éligible ou un emplacement de construction libre.
- « Needle In A Haystack » est reporté à la demande de l’utilisateur : aucun achat, installation ni validation en jeu de ce titre payant.

Références : [Steam](https://store.steampowered.com/app/5165210/), [fiche StreamToEarn](https://streamtoearn.io/games/findtheneedledemo), README et scripts de l’archive fournie.

## Qualification locale du 15 octobre 2026

- Lint valide ; suite complète : **2 093 tests réussis**.
- Installation réelle depuis le ZIP vérifié ; sauvegarde préalable de l’état ShenPulse et sauvegarde des fichiers du jeu remplacés.
- Démarrage Steam réel, identité du mod 1.2.7 et compatibilité confirmées, partie nouvelle distincte de la session du lancement direct.
- Les **37 commandes** ont reçu une confirmation du mod dans cette partie : 35 lors du premier parcours, puis `dropheld` avec une pelle équipée et `spillhay` après ramassage (53 brins déversés). Les refus à vide ont aussi été vérifiés.
- Argent réellement affiché dans le jeu et modifications de foin observées ; aucun test de réception de cadeau depuis un vrai LIVE, aucun achat, son ou action IRL déclenché.
- Cette qualification concerne les valeurs et cibles testées, pas toutes les combinaisons de technologies et bâtiments possibles.
