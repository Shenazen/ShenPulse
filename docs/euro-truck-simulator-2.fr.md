# Euro Truck Simulator 2 — connexion ShenPulse

## Correctif du 22 octobre 2026

L’installateur ShenPulse **1.0.5** conserve les 30 interactions et l’archive
distante `TruckSimulator-CC-1.0.4.zip` vérifiée par SHA-256, téléchargée depuis
Backblaze. Aucun pack supplémentaire n’est embarqué dans l’application.

Le module natif d’origine vérifie la présence d’un processus Crowd Control avant
de se connecter ou de reprendre une connexion. ShenPulse seul ne satisfait pas
cette vérification. Le port d’origine, 51337, peut également être occupé par un
autre jeu ou logiciel d’interactions.

Pendant la préparation de l’installation, ShenPulse configure uniquement ce
module pour :

- activer son mode de compatibilité existant, sans attendre le processus tiers ;
- utiliser la connexion locale dédiée `127.0.0.1:58441` ;
- conserver cette configuration lorsque Steam redémarre le processus du jeu.

Une variable d’environnement du lanceur ne suffit pas : Steam peut recréer le
processus sans la transmettre. Les adaptations portent sur deux instructions
de même longueur et le port indiqué dans les journaux. L’empreinte complète du
module d’origine, les octets attendus et l’empreinte du résultat sont vérifiés.
Toute autre version est refusée. L’exécutable du jeu, ses sauvegardes et les
autres plugins ne sont pas modifiés. Le module précédent est sauvegardé avant
remplacement.

Les anciens paramètres de connexion enregistrés ne peuvent plus détourner ETS2
vers le port partagé. Les droits Pro et la visibilité du jeu restent vérifiés.
Le lancement réutilise une instance existante et attend une vraie connexion
TCP, pendant 90 secondes au maximum, avant de confirmer la session. Une
réparation est refusée pendant que le jeu est ouvert.

## Utilisateurs déjà équipés

1. Installer la version de ShenPulse contenant ce correctif.
2. Fermer complètement ETS2.
3. Ouvrir **ETS2 → Installation → Réinstaller les interactions** dans le dossier
   de l’édition utilisée. Le lanceur signale explicitement un module ancien.
4. Démarrer depuis ShenPulse, valider le choix de lancement Steam et le message
   du SDK avancé si ces fenêtres apparaissent.
5. Charger une sauvegarde et fermer les menus avant de tester les effets.

La réparation n’a pas besoin de fermer les autres logiciels utilisant 51337.
La version Steam complète et la démo restent détectables. Le mode Convoy n’est
pas validé.

## Validation

- Tests de l’archive réelle : préparation, empreintes, configuration native,
  idempotence, refus d’un fichier altéré, sauvegarde du module remplacé et
  conservation des fichiers voisins.
- Tests TCP des 30 commandes et durées, compte Pro ordinaire avec anciens
  paramètres, refus avant connexion et reprise après déconnexion.
- Tests du lancement unique, du module ancien ou absent, de la réparation
  interdite pendant une partie et du message d’aide après expiration.
- Essais sur ETS2 Steam **1.61.1.9s** : connexion sur 58441 et réponses de succès
  pour feux de détresse, klaxon et essuie-glaces, dans une partie chargée.
- Nouveau démarrage par Steam avec le module final, sans variable de
  compatibilité transmise par le lanceur : mode de compatibilité et connexion
  confirmés dans le journal. Puis arrêt du serveur de test et reconnexion
  automatique, sans fermer le jeu, à l’application ShenPulse 2.0.5 reconstruite.
  Les trois effets ont également réussi via l’API de cette application réelle.
- Vérifications finales : lint réussi, **2 742 tests réussis**, construction de
  l’application autonome réussie et empreinte du module installé vérifiée.

Les réponses du module et les journaux du jeu constituent les preuves des
essais réels ; le contrôle visuel natif du PC était indisponible. La version
locale doit être publiée pour que les autres utilisateurs reçoivent le
correctif, puis ils doivent réparer leur installation d’interactions.

Référence : [documentation du module d’origine](https://crowdcontrol.live/guides/eurotrucksimulator2).
