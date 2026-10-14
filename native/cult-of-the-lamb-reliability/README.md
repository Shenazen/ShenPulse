# Correctifs Cult of the Lamb

Ce module BepInEx complète le bridge ShenPulse existant sans modifier
`CrowdControl.dll`. Il remplace uniquement les interactions dont le chemin
historique n'est plus fiable dans les versions actuelles du jeu.

## Organisation

`ShenPulseCultReliability.cs` conserve les attributs BepInEx, l'identité/version
du plugin, Harmony et les événements Unity `Awake`, `Update`, `OnDestroy`.
Les fichiers `Domains/*.cs` sont des parties de la **même classe partial** et
forment le même DLL ; ils ne créent pas de plugin ou d'instance supplémentaire.

| Domaine | Responsabilité |
| --- | --- |
| `Interception` | Préfixe Harmony, aiguillage des codes et gestion des erreurs |
| `TimeEffects` | Vitesse du temps et restauration de sa valeur précédente |
| `Enemies` | Apparitions, gel, vie et suppression des ennemis |
| `RewardsAndPlayer` | Fidèles, armes, tarot, vie du joueur et mort forcée |
| `Dungeon` | Conditions du donjon, déplacements et destination de téléportation |
| `Barriers` | Recherche bornée et prolongation des barrières déjà apparues |
| `Reflection` | Recherche des types, membres et surcharges compatibles du jeu |
| `Protocol` | Lecture des durées, réponses JSON et message racine d'erreur |

Les listes des ennemis gelés et barrières appartiennent toujours à l'instance
du plugin. Les durées utilisent toujours `Time.realtimeSinceStartup`. Le préfixe
laisse le bridge traiter les codes non interceptés ; il conserve également les
préparations de téléportation et barrières avant le traitement historique.
Les surcharges trouvées par réflexion gardent l'ordre et les critères existants.
Aucun cache susceptible de retenir un ancien type du jeu n'a été introduit.

## Compilation et validation

La compilation requiert le compilateur .NET Framework présent dans Windows et
les DLL BepInEx, Harmony, Unity et netstandard de l'installation locale du jeu.
Elle ne lance pas le jeu et n'exécute aucune méthode Unity.

Compilation historique :

```powershell
.\native\cult-of-the-lamb-reliability\build.ps1
```

Le DLL produit doit être installé dans `BepInEx\plugins` à côté de
`ShenPulseCultBridge.dll`.

Pour une refonte, utiliser une sortie isolée afin de ne pas remplacer un DLL
déjà empaqueté dans les assets d'installation :

```powershell
.\native\cult-of-the-lamb-reliability\build.ps1 -OutputPath "$env:TEMP\ShenPulseCultVerification\ShenPulseCultReliability.dll"
.\scripts\verify-native-protocols.ps1
node --test tests/native-architecture.test.js
```

Le script compile la façade et toutes ses vraies unités `Domains`. Les fichiers
`Tests` n'entrent jamais dans le DLL du plugin. Les neuf assertions du protocole
compilent uniquement `Domains/Protocol.cs` avec son harness partial : elles ne
chargent ni BepInEx ni Unity. Les 36 méthodes historiques conservent leur
signature et leur corps exacts, vérifiés par empreintes dans la suite Node.

Les builds avant/après découpage ont réussi dans un répertoire temporaire.
Les binaires distribués n'ont pas été remplacés. Une future publication nécessite
encore une vérification en jeu des interactions et de la version du bridge.
