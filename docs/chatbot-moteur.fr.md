# ChatBot : moteur local, profils et transports

> Documentation du moteur compatible historique. En production, ShenPulse utilise
> uniquement les commandes avec effet Musique, Action ou Overlay ; aucun ancien
> scheduler de messages ne fonctionne. Voir [le moteur actuel](commandes-runtime.md).

## Organisation

La page ChatBot utilise la collection historique `commands` du profil actif. Les créations, modifications, bascules et suppressions passent par `entity:upsert` et `entity:remove` ; il n'existe pas de second magasin ni de copie Firebase des réponses.

- `src/shared/chatbot-command.js` : contrat pur partagé entre l'interface et Node, validation, recherche et aperçu des réponses.
- `src/main/chatbot-service.js` : réception du chat, permissions, cooldowns, file d'envoi bornée et scheduler unique.
- `src/main/core/live-event-actions.js` : point d'entrée historique, conservé pour le flux LIVE.
- `src/main/ipc/workspace.js` : validation avant écriture et synchronisation après modification du profil.

Le champ `kind` distingue `command`, `auto-reply` et `timer`. Les entrées historiques sans ce champ restent des commandes. Aucun identifiant de commande, de profil, d'action ou de cadeau n'est réécrit.

## Commandes et auto-réponses

Une commande commence par `!` et contient de 1 à 31 lettres, chiffres, tirets ou underscores. Jusqu'à 8 alias sont possibles. La correspondance est insensible à la casse mais exige une limite de mot : `!hello` ne déclenche pas `!helloworld`. Le texte qui suit constitue `{{args}}`.

Les auto-réponses acceptent jusqu'à 20 mots-clés de 200 caractères chacun. Ils sont combinés par « OU », avec une correspondance exacte ou « contient », sans expression régulière. Le champ historique `matchText` reste pris en charge. Une commande explicite a priorité sur les auto-réponses : au maximum une réponse est produite pour un commentaire.

Les autorisations sont « tout le monde », « abonnés » ou « modérateurs ». Elles reposent exclusivement sur les rôles réellement transmis par la source. `subscriberOnly` reste synchronisé pour les anciens lecteurs. Un modérateur non abonné ne contourne pas une restriction aux abonnés. Les participants bloqués sont arrêtés avant l'entrée dans le ChatBot par le flux commun de modération.

Les cooldowns par viewer et globaux sont indépendants et isolés par compte, profil, source et entrée. Les nouvelles valeurs vont de 0 à 1 heure. La table runtime est plafonnée à 2 000 clés. Les valeurs historiques non modifiées restent sauvegardées ; aucune migration ne tronque une ancienne réponse ou ne supprime une option lors d'une simple bascule.

## Aperçu et variables

Les variables reconnues sont `{{user.displayName}}`, `{{user.name}}`, `{{args}}` et `{{message}}`. Les alias simples `{user}`, `{username}`, `{args}`, `{comment}` et `{message}` sont également acceptés. Les variables inconnues restent littérales. Le remplacement est unique, borné à 500 caractères et n'exécute jamais de code.

L'aperçu est un calcul pur, avec des données fictives explicitement présentées dans l'interface. Il ne sauvegarde rien, ne consomme pas de cooldown, ne contacte pas une plateforme et n'appelle jamais les tests d'actions/règles, susceptibles d'avoir des effets réels.

## Timers

Un timer contient de 1 à 10 messages de 500 caractères chacun, un intervalle de 60 secondes à 1 heure et un minimum de 0 à 1 000 commentaires reçus depuis le dernier envoi sur sa source. Les nouvelles créations peuvent utiliser le minimum de 5 proposé par l'interface ; une ancienne entrée sans ce champ conserve le minimum de 0.

Les messages tournent après chaque envoi réussi, indépendamment pour chaque source. Les commentaires reçus pendant l'envoi restent comptés pour le prochain message. Les messages du propre bot, lorsqu'il est identifiable, ne sont pas comptés. Une ancienne réponse contenant plusieurs lignes reste un seul message tant qu'elle n'est pas explicitement convertie en liste.

Le scheduler est unique, réveillé toutes les 5 secondes et présent uniquement lorsqu'un timer peut réellement utiliser une source connectée dans une session LIVE active. Il n'existe pas de timer par entrée. Les échéances les plus anciennes ont priorité, au maximum une candidature par source et par réveil ; une source lente ne cumule pas plusieurs envois périodiques en attente. Avec beaucoup de timers, les envois peuvent être décalés pour respecter cette limite.

La veille ou la reconnexion ne provoque pas de rattrapage en rafale. Une réponse composée seulement de variables de viewer vides n'est jamais envoyée. L'arrêt de session, la suspension du compte, la fermeture de l'application et les changements de compte/profil nettoient la planification, les compteurs et les messages en attente.

## File d'envoi et limites des plateformes

Les envois sont détachés du traitement des règles LIVE : une API lente ne retarde pas la voix, les interactions de jeux ou les autres actions du même commentaire. La file garde au maximum 50 réponses, avec 2 workers globaux et un seul envoi concurrent par source. Elle ne conserve ni snapshot complet ni payload brut. Les nouveaux candidats sont ignorés lorsque la file est pleine ; il n'y a pas de croissance mémoire non bornée.

Avant chaque envoi, le service revalide le compte authentifié, les scopes historiques `navigation.commands` et `actionTypes.chat.reply`, le profil, la session, la source et l'entrée encore active. La même garde est propagée en interne jusqu'au transport Kick et vérifiée après un éventuel rafraîchissement OAuth, juste avant chaque POST `/chat`, y compris un retry HTTP 401. Une réponse pas encore partie peut donc être annulée pendant l'attente OAuth, sans modifier le fonctionnement de l'authentification. Les mutations IPC du ChatBot sont réservées à la fenêtre principale locale. Une réponse devenue obsolète pendant une requête ne peut pas inscrire son résultat dans le journal du nouveau compte ou profil.

- **TikTok direct** : la source existante reçoit le chat mais ne sait pas y envoyer des messages. Les commandes et auto-réponses restent consultables dans le journal privé comme « réponse locale — non envoyée ». Les timers ne fonctionnent pas sur ce transport et ne génèrent pas de faux journal périodique.
- **Kick natif** : le transport existant envoie via le compte Kick autorisé. Un échec de l'API conserve la réponse locale pour une commande/auto-réponse. L'identifiant du compte expéditeur permet d'éviter de répondre à ses propres messages.
- **Twitch IRC** : le transport existant envoie sur le canal configuré. La session LIVE ShenPulse doit être explicitement active : cette connexion ne fournit pas de détection du statut vidéo. Le nom OAuth configuré permet de filtrer les propres messages du bot.
- **WebSocket/relais TikTok** : ShenPulse transmet le JSON au relais connecté ; le relais décide s'il peut réellement publier sur la plateforme. Cela n'est pas une preuve de réception dans le chat. Un `botUsername` configuré permet de filtrer les échos identifiables ; un relais qui n'identifie pas l'expéditeur ne permet pas cette protection d'identité.

Le topic historique `chatbot` est conservé pour compatibilité, sans promettre qu'un overlay affiche le message. Le journal privé contient le profil, l'entrée, la source, la plateforme et le résultat d'envoi. Une requête réseau déjà partie ne peut pas être retirée ; la protection de transition annule les autres messages en attente et empêche les résultats obsolètes de contaminer le nouveau profil.

## Vérification

Les tests `chatbot-contract.test.js`, `chatbot-service.test.js` et `chatbot-workspace.test.js` couvrent les trois types, les variables, l'aperçu sans envoi, les rôles, les alias, les mots-clés, les limites, l'isolement de profil, le scheduler, la rotation, le seuil de chat, la file bornée, les transports indisponibles et les transitions pendant une requête. Les régressions du flux LIVE, de Kick et des projections ont également été exécutées.

`chatbot-kick-delivery.test.js` couvre également la propagation de la garde dans les services réels avec un faux HTTP : refresh lent, changements de profil/compte/session/source, retry 401, envoi normal et requête déjà partie.

Ces contrôles utilisent exclusivement des transports fictifs en mémoire. Ils n'envoient aucun message réel, n'ouvrent aucun OAuth et ne modifient aucun compte ou fichier utilisateur.
