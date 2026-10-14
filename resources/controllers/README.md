# Contrôleurs ShenPulse

Le plugin Stream Deck utilise l’API WebSocket officielle Elgato (SDK 2).
Dans ShenPulse → Contrôleurs, « Installer le plugin » copie le dossier du plugin
dans le répertoire utilisateur Elgato. Relancer Stream Deck après l’installation.

Créer un code d’appairage dans ShenPulse et saisir ce code dans l’inspecteur de la
touche Stream Deck. Les codes sont à usage unique, expirent après deux minutes et
autorisent au maximum six tentatives. Chaque appareil possède un jeton distinct,
révocable depuis ShenPulse. Le jeton donne accès uniquement à la liste des actions
et profils et au déclenchement de ces commandes. Les appels restent sur l’interface
locale 127.0.0.1 (port 21217 par défaut).

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
