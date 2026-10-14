# ChatBot de ShenPulse

> Documentation historique : cette interface a été remplacée par **Commandes**.
> Les auto-réponses, réponses texte et messages programmés sont désormais masqués
> et inactifs, mais leurs données sont conservées. Voir [le fonctionnement actuel](commandes-runtime.md).

L’onglet ChatBot regroupe les commandes du chat, les réponses automatiques et les
messages programmés. La route interne reste `commands` pour conserver les droits
de navigation enregistrés. Les anciennes commandes et les profils restent dans
la collection existante `state.commands` : aucun déplacement de données n’est
nécessaire pour ouvrir la nouvelle interface.

## Trois sections opérationnelles

| Section | Déclencheur et réglages |
| --- | --- |
| Commandes | Nom commençant par `!`, jusqu’à 8 alias, réponse, plateforme, audience et cooldowns. Un espace sépare le nom des arguments. |
| Auto-réponses | Nom facultatif, jusqu’à 20 mots-clés de 200 caractères, correspondance « contient » ou « exact », réponse, plateforme, audience et cooldowns. Un mot-clé correspondant suffit. |
| Timers | Nom, jusqu’à 10 messages de 500 caractères en rotation, plateforme, intervalle de 60 secondes à 1 heure et nombre minimum de commentaires. Le moteur attend une session LIVE active et une connexion autorisant l’envoi. |

Une commande explicite a priorité sur une auto-réponse : le même commentaire ne
reçoit pas deux réponses de ces sections. Les audiences proposées sont tout le
monde, les abonnés et les modérateurs. Les cooldowns par viewer et globaux se
configurent en secondes dans l’interface ; le stockage conserve les millisecondes.

Chaque entrée peut être créée, modifiée, activée, désactivée, prévisualisée ou
supprimée. La suppression demande une confirmation. Un changement de compte ou
de profil invalide les sauvegardes et les opérations asynchrones de l’interface.

Les messages d’un nouveau timer se saisissent à raison d’une ligne par message,
dans leur ordre de diffusion. Un minimum de cinq commentaires est proposé pour
un nouveau timer ; la valeur zéro désactive le seuil. Les anciens timers sans
ce réglage gardent zéro. Leur ancienne réponse unique est conservée intégralement,
y compris ses retours à la ligne et une ancienne longueur supérieure à 500
caractères, lorsque le champ n’est pas modifié : changer l’intervalle ne transforme
pas implicitement cette réponse en plusieurs messages et ne crée pas de champ
`messages`. Une nouvelle réponse doit respecter la limite de 500 caractères.
L’aperçu montre uniquement le premier message et ne fait pas avancer la rotation.

## Réponses et aperçu local

Les nouvelles réponses sont limitées à 500 caractères. Les variables suivantes
restent du texte et ne sont jamais exécutées comme du code :

- `{{user.displayName}}` : nom public du viewer ;
- `{{user.name}}` : identifiant public ;
- `{{args}}` : arguments après le nom de commande ;
- `{{message}}` : commentaire reçu.

Les écritures courtes `{user}`, `{username}`, `{args}` et `{comment}` sont aussi
prises en charge par le contrat partagé. Les variables inconnues restent
littérales. Les alias et noms de commandes ne peuvent pas se chevaucher dans un
profil, sans distinction de majuscules.

L’aperçu utilise un viewer fictif. Il se met à jour pendant la saisie et est aussi
accessible sur chaque entrée enregistrée. Il ne sauvegarde rien, n’appelle aucune
API de plateforme et n’injecte aucun événement dans le moteur d’interactions.
Il ne valide pas les cooldowns, l’état du LIVE ni les permissions d’envoi.

## Transport : limites explicites

La connexion TikTok directe conserve sa réception gratuite. L’envoi utilise un
transport distinct, désactivé par défaut : Euler OAuth, avec une clé donnant accès
à la route d’envoi et un jeton autorisé pour `webcast:chat`. Il ne récupère aucun
cookie et ne remplace pas le LIVE existant. Sans ces prérequis, les réponses
restent locales et les timers TikTok ne tentent aucun envoi.

Un relais TikTok doit annoncer explicitement l’authentification, la capacité
d’envoi et les confirmations du protocole `shenpulse-chat-v1`. Chaque commentaire
attend une confirmation corrélée au bon salon. Le simple transfert WebSocket ne
devient plus un faux « envoyé ». Les relais de réception anciens continuent de
transmettre leurs événements, mais ne sont pas considérés capables de publier.

Kick utilise son transport autorisé. Twitch IRC et les WebSockets génériques
peuvent transférer les messages sans fournir d’accusé plateforme : le journal
affiche alors « transférée — confirmation indisponible », jamais « envoyée ».
La rotation des timers est conservée après un transfert pour éviter de répéter
toujours leur premier message. Une source connectée n’est pas, à elle seule,
une preuve d’autorisation d’envoi. Voir `chatbot-transports.fr.md` pour la
configuration, les protections et les prérequis externes.

Le petit journal présente au maximum six réponses ChatBot, avec distinction
entre réponses réellement envoyées et réponses locales. Il filtre le profil
lorsque les métadonnées de l’entrée le permettent. Les anciennes activités sans
identifiant de profil restent des données du compte, non un historique de profil
reconstitué.

## Organisation et sobriété

- `src/shared/chatbot-command.js` : validation, correspondance, variables et aperçu pur partagés avec le moteur principal ;
- `src/renderer/app/features/creator-chatbot.js` : sections, cartes et journal ;
- `src/renderer/app/features/chatbot/editor.js` : formulaires et aperçu local ;
- `src/renderer/app/actions/handlers/creator-chatbot.js` : opérations de la page, gardées par compte et profil ;
- `src/renderer/styles/creator-chatbot.css` : présentation et adaptation aux petites fenêtres.

La page ne crée aucun polling, lecteur multimédia ni animation continue. Les
changements de sous-onglet mettent à jour les sections sans recréer la bannière.
Une activité LIVE ne rafraîchit que le petit journal ; sa signature stable évite
de reconstruire un journal inchangé, y compris après traduction. Les contenus
saisis sont échappés et exclus des traductions automatiques.

## Vérifications locales

`node --test tests/creator-chatbot.test.js` vérifie les trois sections, les champs
et limites du contrat, les commandes anciennes, les créations et modifications,
la confirmation de suppression, les aperçus sans effet de bord, la protection
contre les contenus HTML, le maintien du profil et du compte, les opérations
asynchrones tardives et le journal borné. Aucun message réel n’est envoyé par ces
tests.
