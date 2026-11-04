# Personnalise tes jeux

Cette entrée reste la première de la galerie, y compris pendant une recherche ou un filtre. Elle ouvre les packs personnels du compte et du profil actifs. Elle n’est pas comptée comme un jeu supplémentaire.

## Préparer un pack

1. Ouvrir le jeu, puis choisir **Créer mon pack**.
2. Donner un nom au pack et sélectionner la fenêtre du jeu. Une affiche PNG, JPEG ou WebP est facultative. Le choix de la fenêtre peut être fait plus tard.
3. Adapter les six cartes initiales : Sauter, Sprint, Interagir, S’accroupir, Lâcher objet et Recharger. Ces exemples doivent correspondre aux touches configurées dans le jeu.
4. Choisir les cadeaux, sons, follow et likes, les actions supplémentaires et le modèle d’overlay. Les wins sont facultatives et désactivées au départ.
5. Ouvrir une partie jouable puis activer les interactions. ShenPulse remet automatiquement le jeu choisi au premier plan avant chaque raccourci, y compris avec le bouton de test. Le jeu doit rester ouvert et hors menus.

L’entête, la carte de la galerie et les packs sans affiche personnelle utilisent la même illustration de clavier et de cadeaux (`personalise-tes-jeux.webp`). Une affiche importée reste prioritaire sur le pack concerné. Les fenêtres d’assistants et les applications système sont exclues du choix du jeu ; un ancien pack qui en ciblait une conserve ses cartes et demande de choisir une vraie fenêtre de jeu.

## Raccourcis

- `z`, `espace`, `maj`, `ctrl`, `alt`, `f1` à `f24`, flèches et pavé numérique (`num1`, etc.).
- `maj+z` maintient deux touches simultanément.
- `e ; r` envoie deux étapes successives.
- Chaque action dispose de son propre maintien, nombre de répétitions et intervalle. Les actions ajoutées au même cadeau conservent leurs propres réglages.
- Les lettres sont littérales : `z` reste Z, sans conversion WASD/ZQSD.
- Les valeurs initiales restent **ESPACE**, **SHIFT**, **E**, **CTRL**, **A** et **R**. Les anciens noms (`espace`, `maj`, `echap`, etc.) sont toujours acceptés et affichés avec leur libellé standard, notamment **ESC** pour Échap.
- Pour changer une touche, cliquer dans son champ, appuyer sur la touche ou la combinaison puis la relâcher : la carte l’enregistre directement. **Saisie texte** permet aussi d’écrire une séquence, puis de valider avec Entrée ou en quittant le champ. Ces contrôles sont aussi disponibles pour les actions supplémentaires et l’éditeur détaillé.

Une séquence accepte huit étapes, quatre touches simultanées, dix répétitions, 120 événements et trente secondes au maximum. Le maintien est limité à dix secondes. Les raccourcis Windows réservés ne sont pas acceptés. Certains jeux avec anti-triche peuvent refuser les touches simulées.

## Isolation et fonctionnement

Les définitions résident dans `game.customPacks`, les règles dans `game.interactionRulesByPack`. Le changement de compte ou de profil change aussi la liste des packs. La modification du nom, de l’image ou de la fenêtre préserve les cartes et cadeaux. La suppression vise uniquement ce pack et demande une confirmation dans l’application ; les fichiers du jeu ne sont pas modifiés.

Les raccourcis utilisent le transport Windows existant : la fenêtre du processus choisi est restaurée et activée une fois avant l’envoi, puis son premier plan est vérifié pendant la séquence. Un échec d’activation, une perte de fenêtre, de session ou de droits interrompt la séquence ; les touches maintenues sont relâchées. Une carte sans raccourci n’active aucune fenêtre. Les autres jeux conservent leur comportement d’entrée existant. Les packs ne téléchargent aucun mod. Leurs cartes et réactions utilisent les composants, URL de studio et relais d’overlay déjà présents dans ShenPulse.

## Contrôles

`tests/custom-games.test.js` couvre compilation, limites, accès, persistance disque, isolation entre profils et comptes, suppression et projection publique. `tests/custom-games-navigation.test.js` exerce le vrai renderer : première carte, création, édition, test et actions supplémentaires. `tests/custom-game-focus.test.js` vérifie l’activation et l’arrêt en cas de perte de fenêtre avec un moteur d’entrée simulé, sans envoyer de touches au PC. Les suites existantes vérifient les cadeaux, sons, wins, studios et overlays partagés.
