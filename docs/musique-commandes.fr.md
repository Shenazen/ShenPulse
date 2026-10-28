# Commandes musicales partagées

La page Musique reste accessible gratuitement. Ses commandes Song Requests (demander un titre, passer, titre en cours, file d’attente) sont inscrites dans la collection Commandes du profil lorsqu’elles sont activées. Elles restent exécutées par Song Requests, sans exiger Pro et sans double exécution par le moteur des commandes.

- Musique permet de choisir le nom et l’activation de chaque commande.
- Modifier le nom, les alias, l’audience, la plateforme, les délais ou l’activation depuis Commandes est repris par le même moteur musical. Supprimer une commande désactive son entrée Song Requests.
- Le passage d’un titre reste soumis au rôle configuré. Les réponses de consultation restent locales à ShenPulse.
- Les commandes Spotify personnalisées et celles qui ciblent directement une action Spotify du profil apparaissent aussi dans les paramètres Musique. Leur édition conserve les droits Pro de Commandes ; leurs actions ne sont pas converties en commandes gratuites.
- Les modifications restent propres au profil et au compte. Une recherche déjà commencée est annulée si le profil ou le compte change avant sa fin.
- Une collision de nom ou d’alias est refusée avant toute écriture. Les anciennes commandes personnalisées ne sont pas remplacées par la migration.
- Remplacer un effet Song Requests par une autre action désactive son ancienne fonction musicale, sans réactiver ni remplacer l’action personnalisée au rechargement.

Le contrat de liaison est dans `src/main/spotify/music-command-links.js`. Le store applique la modification des réglages dans la même mutation que le CRUD de commande. Les profils anciens sont normalisés sans remplacer leurs données utilisateur.

Les entêtes communs utilisent maintenant une image positionnée sur tout le bloc, en `object-fit: cover` et centrée, avec le dégradé de lisibilité existant. Le cadrage peut couper le haut et le bas d’une image selon les proportions du bloc, mais ne laisse plus de zone vide à gauche.

Validation : 202 tests ciblés réussis (musique, commandes, IPC, profils/comptes et assets), lint sans erreur. Les appels Spotify, fichiers secrets, prises et autres transports sont simulés dans les tests. Aucun message de chat ni commande matérielle réelle n’a été envoyé. L’application locale 2.1.0 a été reconstruite dans `.artifacts/shenpulse-dev-2.1.0-music-commands-final/win-unpacked`, avec contrôle des 152 scripts et des sources main/CSS du paquet.

Une ancienne commande personnalisée qui utilisait déjà un mot de Song Requests reste conservée. Elle n’empêche pas les réglages sans rapport (limites, filtres) de s’enregistrer ; une nouvelle collision reste refusée.

## Correction des désactivations dans les deux sens

Les interrupteurs Song Requests, activation individuelle et autorisation de passage sont enregistrés immédiatement. Chaque changement envoie uniquement sa propriété et passe par une file ordonnée commune au bouton Enregistrer. Les brouillons des autres champs restent dans le formulaire. Une erreur rétablit l’interrupteur ; une réponse arrivée après un changement de compte ou de profil n’est pas appliquée.

Les anciens raccourcis Spotify compatibles (`next` pour le passage, `queue` avec arguments pour la demande) sont liés par leur fonction et leur nom, en conservant leur identifiant, leur effet, leurs alias et leurs délais. Désactiver ou renommer depuis Musique met à jour cette entrée dans Commandes, et réciproquement. Les commandes sans rapport restent indépendantes. Si Commandes est ouvert avant la fin de la sauvegarde, son tableau est également actualisé.

Validation de cette correction : 176 tests ciblés réussis, dont les régressions sur le raccourci historique `!skip`, la désactivation générale, les changements rapides sans Enregistrer, le retour arrière sur erreur et le changement de page/profil. Lint et syntaxe valides. Version locale reconstruite dans `.artifacts/shenpulse-dev-2.1.0-music-toggle-sync/win-unpacked`.
