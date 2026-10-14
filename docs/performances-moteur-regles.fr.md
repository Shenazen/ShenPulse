# Performances du moteur de règles — octobre 2026

## Ce qui a été corrigé

Le chemin LIVE copiait encore toutes les règles globales et toutes les règles du
jeu actif avant de vérifier leur type de déclenchement. Chaque exécution de règle
recopiait ensuite les règles globales, même pour une simple action propre.

- `getRuleEngineState(type)` élimine les types incompatibles, les règles
  désactivées et les règles non sélectionnées dans le profil **avant** leur copie.
  Les wildcards restent présentes. Sans argument, la projection garde son contrat
  historique pour les diagnostics.
- Une action propre utilise la règle isolée au déclenchement. Elle ne relit plus
  toute la collection des règles.
- Une sélection inter-règles lit seulement les actions dont les identifiants
  sont demandés, au même moment qu'avant. L'ordre demandé, le tirage aléatoire,
  les identifiants dupliqués et les actions de règles désactivées restent traités
  comme auparavant.
- Les cooldowns expirés sont retirés opportunément, au plus une fois toutes les
  trente secondes lors d'un événement. Aucun timer supplémentaire n'est créé et
  aucun délai actif n'est supprimé.
- Un reliquat de seuil exactement nul est retiré. Les accumulations non nulles
  restent conservées : ce changement ne sacrifie aucun cadeau ou lot de likes.

Il n'y a pas de cache de règles compilées susceptible de rester périmé après une
modification de profil. Les conditions, priorités, chances, seuils et actions
restent évalués par le moteur existant. Les travaux en attente gardent leurs
copies isolées ; les sélections inter-règles conservent la lecture de la
configuration courante au moment de leur exécution.

## Mesure reproductible, sans effets externes

Commande :

```powershell
node scripts/benchmark-rule-engine.js
```

Le script crée un store **uniquement en mémoire**, sans appeler `load()` ; les
écritures sont désactivées. Il ne démarre aucun connecteur et n'exécute aucune
action réelle. Les actions factices ne font qu'incrémenter un compteur.

État synthétique : 1 010 règles globales et 505 règles du jeu actif ; 25 messages
de chat, dont quinze règles applicables à chaque message. Cinq échantillons,
après une chauffe exclue des mesures, ont été pris localement avant et après le
correctif le 13 octobre 2026.

| Mesure pour le même rejeu | Avant | Après |
|---|---:|---:|
| Durée médiane du traitement | 1 155,83 ms | 5,26 ms |
| Règles copiées dans les projections d'événements | 37 875 | 375 |
| Lectures complètes des règles pour résoudre les actions | 375 | 0 |
| Actions factices exécutées | 375 | 375 |

La colonne « règles copiées » ne comptabilise pas les copies supplémentaires des
375 anciennes lectures complètes d'actions. Ce cas riche en règles de cadeaux
incompatibles avec un chat rend le gaspillage particulièrement visible. Le gain
sera moindre sur un profil contenant peu de règles ou lorsqu'une action externe
lente domine le temps total.

Ces résultats ne mesurent **ni la RAM totale d'Electron, ni les FPS des jeux, ni
la consommation de SyncLive**. Ils ne permettent pas d'affirmer une équivalence
de ressources entre les applications. La réception du LIVE, les interactions,
les sons et le traitement en arrière-plan n'ont pas été suspendus pour obtenir
le résultat.

## Non-régression

`tests/rule-engine-performance.test.js` contrôle les filtres de profil/types,
les wildcards, les conditions, les priorités, l'isolation des copies, les
sélections inter-règles et les changements de configuration pendant un travail
en attente. Il couvre aussi les cooldowns encore actifs, les seuils cumulés, les
lots de cadeaux et le repli pour les anciens doubles de store.

La sélection ciblée de validation du moteur, du store, des cadeaux et des groupes
d'actions passe **72 tests, aucun échec**. Le test de rejeu ne vérifie pas un temps
CPU fixe, trop dépendant de la machine : il vérifie les copies évitées et les
375 actions conservées.
