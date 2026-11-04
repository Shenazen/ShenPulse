# Contrôleurs ShenPulse

Le plugin Stream Deck utilise l’API WebSocket officielle Elgato (SDK 2).
Dans ShenPulse → Contrôleurs, « Installer le plugin » copie le dossier du plugin
dans le répertoire utilisateur Elgato. Relancer Stream Deck après l’installation.

La connexion à ShenPulse ouvert sur le même PC est automatique. Aucun code ni
jeton n’est à recopier dans une touche. Les identifiants restent dans le fichier
local de connexion, révocable depuis ShenPulse → Contrôleurs. Les appels restent
sur l’interface locale 127.0.0.1 (port 21217 par défaut), avec authentification et
contrôle du compte, de l’abonnement et du profil actif. L’accès bêta aux contrôleurs
reste réservé au compte administrateur.

Le plugin propose neuf familles de touches : animations de match, compteur de wins,
timer et bonus, musique Spotify, automatisations de match, roue, règles, actions et
profils. Glissez une famille sur une touche libre puis sélectionnez sa commande.
Les paramètres supplémentaires apparaissent selon la commande : pack visuel,
affichage, nombre de wins, durée ou multiplicateur. « Tester » exécute réellement
la commande. Les anciennes touches Actions et Profils restent compatibles.

Les animations ×2, ×3, Gants, Snipe, Tap Tap et Cœur proposent notamment Cyber et
Dragon. Coffre et Mystère ne proposent que les packs disponibles pour ces vidéos.
Ces commandes utilisent la source navigateur Matchs déjà installée dans le studio.
Déclencher une animation ne modifie ni les scores TikTok ni la détection du match.
Le multiplicateur de wins et le timer multiplicateur sont des commandes distinctes.

Après une mise à jour du plugin, relancez Stream Deck pour charger les nouvelles
familles. Une indisponibilité de ShenPulse ou une commande refusée est signalée
dans l’inspecteur et sur la touche, sans afficher un faux succès.

Les entrées MIDI sont reçues par Web MIDI sans accès SysEx. Le contrat commun est
dans `src/shared/controller-contract.js`. Les associations, seuils et délais sont
persistés dans `settings.controllers`; le service principal exécute les commandes.

Pour Kick, le navigateur système autorise le compte par OAuth avec PKCE. Les
identifiants de l’application Kick sont créés dans les réglages développeur Kick.
Les événements officiels exigent un webhook HTTPS publiquement accessible. Le
webhook enregistré doit transmettre les requêtes et leurs en-têtes, sans modifier
le corps, à `http://127.0.0.1:21218/kick/webhook`. Le callback OAuth enregistré est
`http://127.0.0.1:21218/kick/callback`. Aucun relais externe n’est créé automatiquement.
Les secrets restent dans le coffre local; les signatures RSA de Kick sont vérifiées
avec sa clé publique récupérée sur l’API officielle. Les répétitions d’événements,
les horodatages périmés et les événements d’un autre compte sont rejetés.

Références officielles :

- https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/
- https://github.com/KickEngineering/KickDevDocs/blob/main/getting-started/generating-tokens-oauth2-flow.md
- https://github.com/KickEngineering/KickDevDocs/blob/main/events/webhook-security.md
- https://api.kick.com/swagger/doc.yaml
