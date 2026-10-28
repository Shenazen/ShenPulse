# Maintenance de ShenPulse

## Principe

Un comportement a un propriétaire unique. Extraire une fonction réutilisée
seulement si ses consommateurs partagent réellement le même contrat.
Ne pas fusionner deux validations de sécurité ou politiques métier simplement
parce qu'elles se ressemblent. Préférer des paramètres explicites et des modules
cohésifs aux contextes globaux opaques, patches de prototypes et cycles.

La carte des domaines est dans [ARCHITECTURE.md](ARCHITECTURE.md).
Les façades historiques conservent leurs API publiques.

## Procédure de modification

1. Identifier le domaine propriétaire et ses consommateurs.
2. Ajouter un test reproduisant le besoin ou la régression.
3. Modifier la source maintenue, jamais un bundle généré.
4. Reconstruire les sorties concernées.
5. Exécuter les tests ciblés, puis `npm run verify`.
6. Vérifier visuellement les pages ou jeux concernés.
7. Documenter les contrats, contraintes et limitations en français.

Les tests emploient des fixtures et transports simulés. Ne pas lancer par défaut
une installation, publication cloud, transaction ou action sur du matériel réel.

## Commandes locales

```powershell
npm run architecture:audit
npm run architecture:audit -- --json
npm run overlays:build
npm run games:build
npm run verify
npm run benchmark:live
npm --prefix website run check
npm run build:dir
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-native-protocols.ps1
```

L'audit est en lecture seule : inventaire, tailles, imports et corps de fonctions
ayant les mêmes tokens. Ce signal n'est pas une preuve d'équivalence :
closures, contexte et insertion automatique de points-virgules peuvent différer.
Il ne déclenche aucune fusion automatique.

Le lint vérifie JS classique, ESM, syntaxe TypeScript/Vue, ordre des scripts HTML,
imports CSS et cycles d'import locaux. Il ne remplace pas une vérification
sémantique TypeScript complète ni la compilation C++/C#/Java/Python.
Ces sources sont inventoriées ; bundles et dépendances tierces sont distingués.

## Sources et sorties générées

| Modifier | Puis reconstruire |
|---|---|
| `src/renderer/game-overlays/*.mjs` | `npm run overlays:build` |
| `resources/overlays/runtime/widgets/` | `npm run overlays:build` |
| jeux/styles sous `games/original-src/` | `npm run games:build` |
| `website/styles/` | `npm --prefix website run build` |
| module natif | suivre son guide de compilation |

Les sections CSS des jeux forment une seule feuille scopée par composant :
plusieurs blocs pourraient renommer différemment les keyframes.
Les styles du site restent une seule ressource HTTP.
Préserver la file ordonnée des événements reçus pendant le chargement différé
d'un jeu et sa destruction.

## Garde-fous

Budget des modules extraits, renderer et runtime overlay : 800 lignes ;
manifestes overlay : 250 ; feuilles CSS renderer/overlay : 1 200.
Les traductions sont séparées par langue et domaine. Les traces de référence
comparent opérations Canvas, géométries, styles compilés et flux des jeux.

Les seuils ne justifient pas un découpage artificiel : une frontière doit avoir
une responsabilité et réduire le couplage. Garder les limites des files/caches,
nettoyage des timers, annulation des requêtes et libération des textures.
Les tests doivent lire les vraies dépendances ou exécuter les exports.

## Données, sécurité et publication

Ne pas réinitialiser les profils pour tester une refonte. Les migrations restent
compatibles avec le schéma existant. Ne pas afficher les secrets dans les logs,
fixtures ou rapports. Les tests de paiement/OAuth n'effectuent aucune transaction.

`build:dir` prépare une application locale. Store, installateur, upload,
déploiement Firebase et publication du site sont des opérations distinctes,
réservées à une release autorisée.

La suite Node utilise l’isolation par fichier et une concurrence limitée à deux
processus. Cela libère les contextes DOM/VM entre fichiers et évite qu’une suite
complète conserve plusieurs gigaoctets de fixtures dans un seul processus.
