# Module Mont Chiliad pour GTA V Enhanced

Le module ASI relie ShenPulse au script GTA par SimpleTCP local. Il n'expose
aucune nouvelle API publique : `ScriptMain` reste le callback ScriptHookV et
`DllMain` conserve l'attachement/détachement Windows. Le SDK Alexander Blade
dans `sdk/` est une dépendance tierce conservée à l'identique.

## Unités compilées

Chaque fichier `.cpp` est compilé séparément puis lié dans le même ASI. Il ne
s'agit pas de fragments inclus textuellement dans un fichier monolithique.

| Unité | Responsabilité |
| --- | --- |
| `ShenPulseMontChiliadEnhanced.cpp` | Entrées Windows/ScriptHook, boucle de jeu et nettoyage final |
| `runtime.h` | Types internes, déclarations des fonctions et de l'état partagé |
| `state.cpp` | Unique définition des constantes, compteurs, handles et files |
| `protocol-json.h/.cpp` | Lecture des champs et échappement JSON, indépendants de GTA |
| `network.cpp` | Connexion Winsock, trames NUL, file de requêtes et réponses |
| `platform.cpp` | Horloge, journal local, répartition aléatoire et caméra |
| `world.cpp` | Joueur, téléportations, modèles et opérations communes de monde |
| `prison.cpp` | Création, suivi et suppression de la prison |
| `player-effects.cpp` | Ragdoll, ivresse, saut, véhicules et effets sur le joueur |
| `gifts.cpp` | Tables de cadeaux et apparition/nettoyage des entités associées |
| `world-effects.cpp` | Trou noir, train et séquences d'impact |
| `dispatch.cpp` | Aiguillage des codes et consommation limitée de la file |
| `timed-effects.cpp` | Suivi par frame, expiration et restauration des effets |
| `victory.cpp` | Zone, compteurs WINS/morts, HUD, podium et retour à l'aéroport |

L'état reste unique dans l'espace de noms `ShenPulse::MontChiliad`. Les valeurs
par défaut restent dans les déclarations du header ; leurs définitions n'en
répètent pas les valeurs. Le nombre d'unités ne modifie ni le protocole ni le
thread requis par les natives ScriptHookV.

## Invariants et threads

- Le thread réseau se connecte uniquement à `127.0.0.1:58430`. Il ne déclenche
  aucune native GTA ; il place les requêtes dans la file protégée par mutex.
- Le thread de script traite au plus 32 requêtes par passage. Le statut `9`
  replace la requête au début de la file quand le jeu n'est pas prêt.
- La file garde 250 requêtes, les trames reçues 65 536 octets et la population
  de cadeaux 512 entités, conformément aux règles historiques.
- Les enveloppes JSON terminées par NUL, identifiants, statuts et messages
  restent identiques. Le parseur volontairement restreint n'a pas été remplacé
  par un parseur différent qui changerait les entrées acceptées.
- Le transfert du joueur est vérifié avant la suppression de l'ancien véhicule.
  Les compteurs, délais de victoire, ivresse, train et flip gardent leurs valeurs.

## Compilation et vérification sans lancer GTA

Visual Studio Build Tools x64 et `sdk/lib/ScriptHookV.lib` sont requis.
Le script partagé `scripts/lib/visual-studio-environment.ps1` prépare les outils
pour le build et les tests de protocole.

Depuis la racine du dépôt, utiliser une sortie isolée pour vérifier une refonte :

```powershell
.\scripts\build-gtav-enhanced-plugin.ps1 -BuildDirectory "$env:TEMP\ShenPulseGtaVerification"
.\scripts\verify-native-protocols.ps1
node --test tests/native-architecture.test.js tests/gtav-enhanced-plugin.test.js
```

Sans `-BuildDirectory`, le chemin historique `build/` reste utilisé : cette
commande est réservée à la préparation délibérée d'un nouvel artefact. Une
compilation de vérification ne doit jamais écraser le module dont le manifeste
publié contient le SHA-256. Aucun script de vérification n'installe le module,
ne démarre GTA et ne publie un artefact.

Les compilations x64 avant/après découpage ont réussi dans une sortie temporaire.
Les 78 signatures/corps de fonctions et l'ensemble des valeurs d'état sont
comparés à leurs empreintes historiques par les tests. Les treize assertions
JSON s'exécutent sans SDK GTA, réseau ou chargement de jeu. La table d'exports
DLL est inchangée. Les tests du manifeste prouvent que l'ASI empaqueté n'a pas
été remplacé.

Une compilation et un protocole identiques ne remplacent pas un test en jeu :
avant une future publication native, vérifier les transitions et effets visuels
sur la version GTA/ScriptHook ciblée. Le découpage ne promet pas une diminution
de la RAM de ShenPulse : ce module s'exécute dans GTA, pas dans Electron.
