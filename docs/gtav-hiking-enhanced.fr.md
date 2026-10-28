# GTA V Hiking Enhanced

Version application : 2.1.0. Module Hiking : 1.0.3.

Le module natif C++ ShenPulse s’exécute uniquement en mode Histoire Enhanced. Aucun logiciel tiers de streaming ni serveur externe ne sont nécessaires à sa connexion. La fiche GTA propose Hiking, KOTH et Mont Chiliad ; changer de mode nécessite de fermer GTA.

## Parcours

Trente points sont validés dans l’ordre. Le délai est de vingt minutes par défaut, réglable sur la fiche du jeu. La victoire ajoute une win ; une mort ou un TIME OUT retire une seule win. Le curseur de session empêche les doubles comptages. Le redémarrage attend la fin du retour à la vie et le rétablissement des commandes.

F10 ouvre le menu : nouvelle randonnée, véhicules autorisés, compteur, téléportations, création des points et du départ, sauvegarde ou restauration du parcours. Par défaut, les points se valident à pied. Un itinéraire personnel comporte de 2 à 100 points et reste dans le dossier local ShenPulse.

## Interactions

21 effets natifs, 6 aides et 6 pièges avec cadeaux par défaut, ainsi que les règles et overlays de wins partagés. Les noms restent courts. Chaque effet natif a une image distincte. Les personnages portent le nom du viewer ; ils restent au plus trois minutes. Maximum : 20 personnages par appel, 80 simultanés, avec refus explicite au-delà. Il faut créer un adversaire avant de l’incendier. Les durées des effets temporaires sont configurables.

## Distribution

Le module compilé et ScriptHook sont téléchargés depuis Backblaze avec vérification de taille et SHA-256. Les sauvegardes de fichiers remplacés restent locales. Le code source C++ et les illustrations restent dans le dépôt ; aucun binaire installé du logiciel de référence n’est distribué. Les trois installateurs GTA utilisent le même module commun pour éviter une régression lors d’un changement de mode.

## Validation du 27 octobre 2026

- Installation depuis la fiche du jeu, connexion sur le port local 58470, lancement unique Enhanced.
- 21 effets envoyés ; création de six familles de personnages, embrasement après apparition, nettoyage.
- Chronomètres de sprint, saut, séisme, trou noir et bouclier revenus à zéro après 3 secondes.
- 30 points réels validés dans Enhanced, retour arrière et au départ, victoire +1 unique.
- TIME OUT à une minute : -1 unique, retour puis nouvelle manche ; durée rétablie à vingt minutes.
- Téléchargements sans cache des modules Hiking, KOTH et Mont Chiliad : octets et empreintes vérifiés.

Les rapports détaillés d’essai locaux sont dans .artifacts/hiking/.

## Référence fonctionnelle

Fiche Hiking affichée dans l’application de référence et documentation publique : https://streamtoearn.io/games/gta5. Seuls les comportements et coordonnées numériques du parcours servent de référence ; l’implémentation est propre à ShenPulse.

Contrôles complémentaires du module 1.0.3 : adversaires armés, mort réelle puis hôpital et retour automatique au départ ; une seule win retirée et protection normale rétablie. Les choix véhicules et compteur F10 ont été modifiés puis sauvegardés et vérifiés dans le fichier de parcours.

Le cougar est créé avec le type animal et les comportements de fuite sont désactivés ; sa poursuite est rétablie si une tâche de fuite remplace le combat. Attaque et mort réelle constatées en jeu.

Fin de manche : suppression immédiate des personnages et attente de la fin de l’invulnérabilité de réapparition du jeu avant le nouveau départ.

Validation finale : 3 163 tests JavaScript passent sans échec, avec 471 assertions natives Hiking et 3 364 KOTH. Le module final 1.0.3 a passé la mort réelle par cougar, le nettoyage immédiat et le retour après hôpital, puis les trente étapes et une victoire unique. Le contexte viewer « TEST SHENPULSE » est transmis au compagnon ; un appel à 25 personnages est refusé avec un message explicite. Le jeu est laissé au départ, sans personnages ajoutés ni effet temporaire, avec le compteur revenu à zéro et vingt minutes configurées.
