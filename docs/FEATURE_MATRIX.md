# Matrice fonctionnelle ShenPulse 1.0

Cette matrice distingue ce qui fonctionne dans le package livré de ce qui dépend
d'un service, d'une autorisation ou d'un mod tiers. Elle évite de présenter une
compatibilité théorique comme une intégration testée.

## Livré et testé

| Domaine | Fonctionnalités |
|---|---|
| Événements | Chat, cadeau, like, follow, partage, abonnement, raid, arrivée, événements de test |
| Sources | TikTok LIVE automatique par @, démo, WebSocket générique autorisé, Twitch IRC, HTTP local, WebSocket local |
| Automatisations | Filtres, regex, seuils cumulatifs, probabilités, priorités, cooldown global/par utilisateur, actions multiples |
| Alertes | Texte, image/vidéo distante, son distant, file d'attente, durée, couleurs |
| Voix | Règles TTS pour cadeau, like, follow, chat, partage, abonnement, raid et arrivée ; langue, voix, vitesse, hauteur, volume |
| Catalogues | 122 sons locaux partagés et 932 cadeaux TikTok recherchables depuis le simulateur et les éditeurs |
| Overlays | Alertes, objectifs, activité, effets de jeu, timer, roue ; URLs OBS/LIVE Studio |
| Chatbot | Commandes, réponses, abonnés uniquement, cooldown |
| Streaming | OBS WebSocket 5, webhooks HTTP, relais WebSocket |
| Musique | Connexion Spotify OAuth PKCE, état du compte/appareil, lecture, pause, suivant, volume, recherche et mise en file depuis les actions |
| Jeux | Packs JSON, test manuel, TCP JSON/NUL, WebSocket, HTTP, UDP, Minecraft RCON |
| Packs inclus | Bac à sable, Minecraft Java, SimpleTCP, passerelle GTA V déclarative, WebSocket générique |
| SDK | Serveur SimpleTCP C# et exemple de passerelle |
| Données | Profils, import/export, historique, secrets chiffrés, aucune télémétrie |
| Windows | Renderer isolé, API loopback authentifiée, assets multi-échelles, AppX/AppXUpload Store |

## Nécessite un élément externe avant validation réelle

| Élément | Prérequis |
|---|---|
| TikTok LIVE direct | Compte public ; disponibilité du connecteur tiers et compatibilité avec les évolutions TikTok |
| Cadeaux/événements Kick | Endpoint et identifiants conformes aux conditions Kick |
| Réponses Twitch | Jeton OAuth et compte de bot |
| Spotify | Client ID d'une application Spotify, URI loopback déclarée, compte Premium et appareil de lecture actif |
| OBS | OBS 30+ avec WebSocket activé et mot de passe correspondant |
| Minecraft | Serveur possédé/configuré, RCON activé et mot de passe |
| GTA V et autres jeux | Mod ou plugin autorisé qui implémente le protocole du pack |
| Catalogue massif de jeux | Droits, développement, QA et maintenance pour chaque jeu/version |
| Portail public/payments | Backend, hébergement, comptes marchands, conformité fiscale et modération |
| Microsoft Store | URLs HTTPS légales/support, fiche, captures, classification d'âge et accès Partner Center |

## Non revendiqué

ShenPulse ne reprend aucun code, serveur, marque, pack propriétaire, système de
paiement ou catalogue fermé de TikFinity, Crowd Control ou StreamToEarn. La
compatibilité d'un jeu n'est revendiquée qu'après test du mod correspondant.
