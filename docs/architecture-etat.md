# Architecture de l'état local

L'entrée historique reste [store.js](../src/main/store.js). Tous les consommateurs
CommonJS continuent à importer les mêmes exports. Le schéma de données reste en
version 2 ; ce découpage ne déplace pas les fichiers utilisateurs, ne réinitialise
pas leurs profils et ne modifie pas les droits d'abonnement.

## Responsabilités

| Module | Responsabilité |
| --- | --- |
| `store.js` | Façade publique, mutations, coffre de secrets et cadence des sauvegardes. |
| `defaults.js` | Façade compatible des fabriques de valeurs initiales. |
| `state/defaults/state.js` | État complet et profil vierge ; objets toujours indépendants. |
| `state/defaults/overlays.js` | Configurations d'overlays, roues et segments initiaux. |
| `state/defaults/preferences.js` | Valeurs et héritage des préférences TTS de profil. |
| `spotify/song-request-settings.js` | Normalisation pure des préférences musicales, commune au service et aux profils. |
| `state/constants.js` | Versions, délais et périmètre des données de compte. |
| `state/json-storage.js` | Écriture atomique, vérification, sauvegarde et récupération. |
| `state/migrations.js` | Mise à niveau des configurations et réinitialisation du runtime au démarrage. |
| `state/workspace-manager.js` | Chargement et synchronisation des comptes et des profils. |
| `state/account-workspace.js` | Capture, normalisation et application des données d'un propriétaire. |
| `state/profile-workspace.js` | Normalisation et capture de la configuration d'un profil. |
| `state/overlay-configs.js` | Normaliseur unique des Like Goal et roues hérités. |
| `state/rule-normalization.js` | Règles globales, TTS et interactions réparties par jeu. |
| `state/legacy-demo.js` | Compatibilité des anciennes démonstrations automatiques. |
| `state/projections.js` | Copies minimales, filtres de confidentialité et formes de tableaux. |
| `state/normalization-utils.js` | Copie des dictionnaires de réglages valides. |
| `state-projection.js` | Adaptateur de lecture pour les services et les anciens doubles de test. |

Les fabriques et normaliseurs sont des fonctions indépendantes de l'interface,
du réseau et de l'écriture disque. Le gestionnaire de workspaces orchestre leur
usage ; seul le store décide quand sauvegarder. Les dépendances vont des services
vers la façade, puis vers ces responsabilités internes, sans importer le store
depuis les normaliseurs.

## Contrats à préserver

- `getState()` renvoie une copie isolée du snapshot public. Les workspaces de
  comptes inactifs sont exclus **avant** le clonage. Une connexion expose
  `hasSecret`, jamais sa propriété `secret` en clair.
- `getStateProjection(paths)` conserve la structure objet/tableau et copie
  seulement les chemins demandés. Les chemins privés, vides ou dirigés vers
  `__proto__`, `prototype` ou `constructor` sont refusés. Les propriétés
  héritées ne sont pas traversées.
- `getRuleEngineState()` ne contient ni les workspaces de profils ni les
  catalogues de jeux inactifs. Les règles du jeu actif ne sont incluses que
  lorsque son profil correspond au profil de session.
- `getLiveDirectoryState()` reste une lecture interne du service de présence.
  Ce n'est pas le document publié sur Firebase : le protocole du service
  sélectionne et valide ensuite les seuls champs publics.
- Chaque UID conserve ses profils, réglages, achats, médias et compteurs.
  Se déconnecter affiche un espace anonyme vierge sans effacer le propriétaire.
- Le changement de profil conserve les droits du compte et arrête uniquement
  le jeu lié à l'ancien profil.
- Une configuration importée ne reprend pas le consentement de publication
  publique de la personne qui l'a exportée.

## Réglages de compte et de profil

Le workspace de profil passe en version 2, sans changer le schéma global 2.
Il conserve désormais l'ensemble des préférences TTS (`enabled`, `language`,
`voice`, `rate`, `pitch`, `volume`, `profanityFilter`) et `songRequestSettings`.
Ce dernier correspond aux paramètres présentés comme `songRequests.settings`
dans l'interface, stockés à l'exécution dans `settings.spotify.songRequests`.

Un ancien profil sans ces champs hérite des valeurs sauvegardées dans son
propre compte, jamais de celles du compte précédemment connecté. Les valeurs
déjà spécifiques au profil sont prioritaires. La normalisation et la capture
conservent ensuite une copie indépendante par profil ; changer de profil,
se reconnecter ou relancer l'application recharge la même configuration.
Les anciens imports récupèrent également ces préférences sans adopter les
identifiants Spotify de l'exporteur.

Les comptes et jetons Spotify, la file et l'historique musical, les appareils
IRL, les ports, les autorisations système, les droits d'abonnement et les
références du coffre restent au niveau du compte. Ils ne sont jamais copiés
dans les préférences de profil. Les règles et interactions IRL sont déjà
isolées dans les actions du profil ; les appareils physiques restent communs
aux profils du même compte.

## Sauvegarde et récupération

Une modification de configuration garde un délai de regroupement de 200 ms,
à l'exception de la création, du renommage et de la suppression d'un profil,
confirmés sur disque avant le retour de l'opération.
Une mutation de runtime LIVE n'alloue pas de snapshot complet et dispose d'une
échéance fixe de 5 secondes : les événements suivants ne la repoussent pas.
Une écriture immédiate et `flush()` annulent les deux temporisateurs et
enregistrent les dernières données. La fermeture normale appelle la sauvegarde
finale ; un arrêt brutal peut perdre au maximum les modifications depuis le
dernier checkpoint.

Le contenu JSON est validé, écrit dans un temporaire créé exclusivement,
synchronisé avec `fsync`, puis relu avant renommage. Le fichier `.bak`
conserve la génération précédente valide. Une génération corrompue ne doit
jamais écraser une sauvegarde valide ; les fichiers de récupération restent
disponibles pour inspection.

Les activations et désactivations de comptes sont préparées sur une copie :
l'espace de compte et son identité sont écrits dans la même génération, avant
de remplacer l'état en mémoire. Un échec disque laisse les profils et le compte
actifs intacts. Si une ancienne génération a perdu son entrée de workspace mais
possède encore sa configuration active identifiée, celle-ci est récupérée
uniquement sous cet UID. La génération originale est conservée dans
`shenpulse-state.before-account-workspace-recovery-v1.json`. Sans session valide,
les données restent cachées jusqu'à la reconnexion du même propriétaire ; elles
ne sont jamais attribuées au prochain compte connecté.

Les secrets restent dans le coffre local séparé. `safeStorage` est utilisé
quand le système le permet ; ce refactoring ne change pas le mécanisme existant
ni ses conditions de disponibilité.

## Optimisations structurelles vérifiées

Le normaliseur d'overlays précédemment répété dans le chargement global et les
profils est partagé. La capture du profil actif est aussi utilisée pendant la
migration des anciennes configurations : ses collections sont toujours copiées.

Une modification ne synchronise plus deux fois le même profil avant de
capturer son compte. La capture n'effectue plus une normalisation complète du
catalogue précédent alors que toutes ses collections sont immédiatement
remplacées par l'état actif. Les extensions de configuration du jeu précédent
restent conservées. Le checkpoint réalise toujours sa propre synchronisation
pour intégrer les événements arrivés depuis la modification initiale.

## Vérification et extension

Les tests `profile-store.test.js`, `account-workspace.test.js`,
`store-performance.test.js` et `state-architecture.test.js` couvrent
la migration, l'isolation, les droits, les secrets, les reprises de fichiers et
la compatibilité des façades. Les tests de performance du core vérifient que
les flux d'événements ne réintroduisent pas de copie complète.

Pour ajouter un champ de compte, mettre à jour son défaut et
`ACCOUNT_SETTING_KEYS`, puis tester un changement de propriétaire. Pour ajouter
un réglage de profil, mettre à jour le défaut, la normalisation, la capture et
l'application, puis tester changement de profil et redémarrage. Ne jamais
ajouter un champ sensible à une projection publique par commodité.
