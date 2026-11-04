# Bot TikTok commun ShenPulse

Le bot est sélectionné automatiquement dans l’application. Les créateurs n’ont pas à saisir de clés TikTok ou fournisseur. Les droits Pro/Premium (y compris les essais actifs reconnus par le serveur) restent nécessaires pour les commandes conversationnelles.

## État de préparation

Le code serveur et le client sont préparés. Le serveur existant n’a actuellement aucun compte bot ni autorisation d’envoi configurés. Aucun message réel n’a été publié par cette intégration. Ne pas annoncer le service comme actif avant la connexion du bot et un contrôle réel autorisé.

## Prérequis d’activation

1. L’administrateur crée un compte TikTok dédié au bot et valide lui-même son authentification.
2. Il dispose d’un accès fournisseur autorisant l’envoi et d’un client OAuth enregistré. Le bot doit accorder `webcast:chat`. Les autorisations obtenues sont conservées uniquement sur le serveur.
3. Il configure `/var/lib/shenpulse/tiktok-bot.json` (ou `SHENPULSE_TIKTOK_BOT_FILE`) avec des permissions privées permettant au service Node de lire et renouveler le fichier. Les champs attendus sont `enabled`, `botUsername`, `apiKey`, `accessToken`, `refreshToken`, `clientId`, `clientSecret`, `expiresAt` et `scopes`. Aucun secret ne doit être envoyé dans un chat, commité ou incorporé dans l’EXE.
4. Déployer le paquet généré par `node backend/chatbot-tiktok/prepare.mjs` après comparaison des empreintes de la baseline, avec sauvegarde et retour arrière. Les routes sont `/api/chatbot/tiktok/status` et `/api/chatbot/tiktok/send`.
5. Vérifier le compte expéditeur, un envoi accepté dans une partie LIVE autorisée, puis le renouvellement et la révocation. Un compte restreint, un chat fermé ou un refus TikTok ne peut pas être forcé par ShenPulse.

L’application utilise seulement le jeton Firebase du compte ShenPulse. Les jetons TikTok ne quittent pas le serveur. L’envoi n’est annoncé confirmé qu’après acceptation du fournisseur et corrélation de l’identifiant de requête.

## Contrôles

Chaque requête est authentifiée ; les droits sont relus côté serveur. Les messages sont limités à 500 caractères, avec une temporisation par utilisateur et salon, et la limite globale du fournisseur. Les requêtes sont idempotentes et ne sont pas rejouées après un refus ou un délai dépassé. Les commentaires ne sont pas journalisés par ce service.

Les autorisations personnelles déjà configurées restent prioritaires. Un créateur peut choisir « Réception uniquement » ; ce choix est conservé et coupe le bot automatique. Le compte du bot est exclu des réponses pour éviter les boucles.
