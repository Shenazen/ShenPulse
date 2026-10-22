# Version minimale des jeux

Dans **Administration → Visibilité → Jeux**, chaque ligne propose maintenant
une **Version minimale ShenPulse**, à côté des logos et de la portée.

Le propriétaire peut saisir une version comme `2.0.5`, ou vider le champ pour
revenir à **Toutes les versions**. La version de l’application actuellement
ouverte est indiquée dans le formulaire. Les saisies invalides sont refusées
avant toute publication.

Pour un jeu **Visible par tous**, `2.0.5` signifie : masqué en `2.0.4`, visible
en `2.0.5`, `2.0.10` ou une version ultérieure. La comparaison est numérique ;
une préversion telle que `2.0.5-beta.1` reste antérieure à `2.0.5`.
Les métadonnées de compilation n’affectent pas l’ordre.

La condition s’applique à la galerie, aux catégories, aux compteurs de jeux et
modes, aux lanceurs groupés Minecraft et aux accès directs du backend
(installation, lancement, diagnostic, interactions). Elle s’ajoute aux droits
de visibilité et d’abonnement. Le catalogue complet reste disponible dans la
console propriétaire pour pouvoir modifier un jeu encore masqué.

**Moi uniquement** permet de préparer et tester un jeu avant sa publication,
indépendamment de la borne. **Masqué** reste fermé à tous. La borne enregistrée
est conservée lors des changements de portée, des choix de logos et de la
synchronisation du catalogue. Retirer la borne ne modifie pas les autres
réglages. Aucune association d’action ou de jeu n’est supprimée.

## Stockage et anciens clients

Le réglage privé est `games[id].minAppVersion`, avec la portée choisie dans
`games[id].scope`. Le cache local conserve la même forme logique.

Le document Firebase public publie les jeux publics soumis à une borne avec
`scope: "hidden"`, `versionScope: "public"` et `minAppVersion`. Les nouveaux
clients rétablissent la portée publique puis comparent leur propre version.
Les anciens clients, qui ne savent pas interpréter cette condition, les
gardent masqués. Les jeux sans borne conservent leur format habituel.
Un ancien client doit être mis à jour pour prendre en charge ce réglage.

Un client déjà hors ligne ne reçoit pas une modification tant qu’il ne
resynchronise pas la visibilité. Une fois reçue, la borne reste dans le cache
hors ligne. Une borne distante malformée ou une version courante inconnue
n’ouvre pas le jeu.

Les écritures passent par le service propriétaire existant. Le backend vérifie
la version du paquet installé, indépendamment d’une valeur de formulaire, et
revérifie l’accès avant l’exécution d’une commande en attente.

Tests ciblés : `node --test tests/game-version-visibility.test.js tests/admin-game-visibility-ui.test.js`.
Le script Electron `scripts/verify-admin-game-platforms.js` vérifie la console,
les logos et le formulaire de version sur quatre largeurs, avec un profil
isolé et sans publier de réglage réel.
