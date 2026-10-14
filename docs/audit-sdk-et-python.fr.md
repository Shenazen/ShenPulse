# Audit des petits bridges .NET et Python

## SDK .NET

`sdk/dotnet/ShenPulse.GameSdk` contient un serveur de 119 lignes et des modèles
de 61 lignes, déjà séparés par responsabilité. L'exemple de bridge est distinct.
Ils n'entrent pas dans le processus Electron : les découper davantage ne réduirait
pas sa consommation mémoire.

Le protocole reste JSON UTF-8 terminé par NUL, avec `requestId`, `type`, `effect`
et les résultats `success`, `temporary-failure`, `permanent-failure`. Le serveur
utilise Loopback par défaut ; le constructeur permet explicitement une autre
adresse. La trame reste bornée à un mébioctet et le traitement par client séquentiel.

Points à couvrir dans une future évolution versionnée : arrêt d'une attente
`AcceptTcpClientAsync` par le seul token externe, supervision des tâches clients
et déconnexion des clients inactifs. Une limite de clients ou un timeout ne
doivent pas être ajoutés sans tests : ils changeraient un contrat actuellement
accepté. Le code n'a pas été modifié gratuitement pour des gains non mesurés.

Cette machine dispose du runtime .NET, mais `dotnet --list-sdks` ne retourne aucun
SDK. Le SDK ciblant netstandard2.0 n'a donc pas été recompilé. Aucun téléchargement
de SDK ou changement de dépendance n'a été réalisé pour cet audit.

## Sidecar IRL Python

`resources/irl-python/shenpulse_irl_server.py` contient 247 lignes. Il est déjà
organisé en fonctions réutilisées pour la validation d'hôte, les bornes numériques,
les requêtes HTTP et l'aiguillage des trois opérations Shelly. Les contrôles
réseau ne s'exécutent que sur commande ; aucun polling permanent n'est ajouté.

Ses contrats sont JSON par ligne sur stdin/stdout, annonce `ready`, protocole 1,
commande `health` sans interaction physique et arrêt explicite `shutdown`.
Les hôtes locaux, la durée maximale de 60 secondes et les timeouts par opération
restent inchangés. Le self-test utilise uniquement `health` et ne contacte pas
une prise ni ne configure un réseau Wi-Fi.

`scripts/patch-unity-texture.py`, outil ponctuel de 73 lignes, n'est pas un service
du LIVE. Il reste distinct du sidecar, car ses dépendances et responsabilités
ne justifient pas une mutualisation.

Le maintien de ces petits fichiers est un choix d'architecture : une extraction
de quelques lignes vers de nouveaux modules ne constitue pas à elle seule une
optimisation CPU/RAM. Aucun protocole public ou réglage de matériel n'a été changé.
