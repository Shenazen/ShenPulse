# Visibilité configurable des jeux

Dans **Administration → Visibilité → Jeux**, le propriétaire peut choisir pour chaque jeu, individuellement ou en masse :

- **Public** : visible et utilisable par les comptes disposant des droits nécessaires ; l’abonnement Pro/Premium et les éventuels achats restent vérifiés.
- **Moi uniquement** : réservé au compte propriétaire vérifié.
- **Masqué** : absent de la galerie et inutilisable, même par le propriétaire. Le propriétaire conserve sa ligne dans la console pour pouvoir le réactiver.

## Défaut privé et choix explicite

Pour les jeux, `pack.ownerOnly: true` signifie désormais **privé par défaut**, pas verrou définitif. Cela concerne actuellement Fortnite et Find The Needle Demo. Sans réglage valide, ils restent réservés au propriétaire. Le propriétaire peut ensuite choisir Public ou Masqué et ce choix est conservé.

Le contrat partagé `gameScopeFor` / `canAccessGame` est appliqué au rendu, aux instantanés transmis aux autres comptes et au contrôle principal avant diagnostic, lancement, installation ou effet. Une valeur invalide ne devient jamais une publication explicite. Le choix Public ne confère aucun droit d’administration.

## Reprise des installations existantes

Le schéma de visibilité passe à **11**. Avant cette correction, une ancienne valeur Public pouvait être stockée alors que le verrou compilé maintenait le jeu privé. La migration convertit ces anciens Public en Moi uniquement pour les deux jeux concernés : **aucun jeu n’est ouvert automatiquement**. Masqué et Moi uniquement sont conservés. Un choix Public enregistré avec le schéma 11 est pleinement respecté, y compris hors ligne via le cache.

Les pages Administration, Contrôleurs et Paramètres restent strictement réservées au propriétaire. Les fonctions de stockage partagé conservent leur portée publique fixe pour les comptes connectés. Aucun réglage distant n’est modifié par l’installation du correctif.

L’enregistrement depuis la console publie la configuration et son miroir selon le mécanisme existant, puis rafraîchit immédiatement l’instantané local. Les autres installations doivent charger cette visibilité et disposer de ce correctif ; les anciennes versions contenant le verrou compilé ne peuvent pas être déverrouillées uniquement par une configuration distante.

Le catalogue marketing du site garde son filtre statique des jeux privés : ce correctif concerne leur visibilité **dans l’application**, pas leur publication automatique sur le site public.

## Vérifications locales

Le 15 octobre 2026 : lint valide, **2 113 tests réussis**, paquet local contrôlé puis ShenPulse relancé. Les listes Find The Needle Demo et Fortnite sont confirmées actives dans l’interface native, avec leur valeur Moi uniquement conservée. Aucun choix de visibilité distant n’a été enregistré pendant cette qualification.
