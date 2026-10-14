# Envoi du ChatBot et confirmations

## Ce qui est réellement pris en charge

La réception du LIVE et l’envoi des commentaires sont deux capacités distinctes.
Une connexion qui reçoit le chat n’a pas nécessairement la permission d’y écrire.
L’application ne considère plus une simple résolution de promesse ou une écriture
sur une socket comme une confirmation de publication.

| Transport | Condition de disponibilité | Sens du journal |
| --- | --- | --- |
| TikTok direct + Euler OAuth | Compte ShenPulse correspondant, clé et jeton dans le coffre, expiration valide, permission `webcast:chat`, LIVE actif | « envoyée » après acceptation de l’API TikTok reçue du fournisseur |
| Relais TikTok | Négociation authentifiée `shenpulse-chat-v1`, salon actif, accusé corrélé | « envoyée » après confirmation explicite du relais |
| Kick natif | Transport Kick connecté et autorisé | Résultat explicite du transport Kick |
| Twitch IRC et WebSocket générique | Transport existant connecté | « transférée — confirmation indisponible », pas une preuve de rendu dans le chat |
| TikTok sans autorisation d’envoi | Réception du LIVE inchangée | Réponse locale, timer d’envoi inactif |

Une acceptation API ne garantit pas que tous les viewers voient le commentaire :
la modération et l’affichage de la plateforme restent hors du contrôle de ShenPulse.
Un timeout est une confirmation inconnue, pas une preuve d’absence de publication.
Il ne provoque jamais une répétition automatique du même POST.

## Configuration Euler OAuth, propre au compte

`settings.tiktok.chat` contient exclusivement des métadonnées :

```js
{
  provider: "euler-oauth", // ou "none", valeur initiale
  accountUid: "propriétaire ShenPulse",
  apiKeySecretId: "référence du coffre local",
  accessTokenSecretId: "référence du coffre local",
  expiresAt: "2026-10-13T23:00:00.000Z", // ISO, exemple uniquement
  scopes: ["webcast:chat"],
  botUsername: "compte_expéditeur"
}
```

L’IPC dédié dérive le propriétaire de la session authentifiée, n’accepte pas de
référence arbitraire vers le coffre et exige une confirmation explicite avant
l’activation des réponses automatiques. Le @ expéditeur empêche une auto-réponse
aux propres commentaires du bot. L’état transmis au renderer expose des booléens
de présence des identifiants, jamais leurs valeurs. La sauvegarde générale des
réglages ne permet pas de contourner cet IPC.

`validateTikTokChatConfiguration()` est pure ;
`tiktokChatConfigurationStatus()` reçoit uniquement des booléens de présence
des secrets et le propriétaire courant. Le statut « configuré » n’est pas une
vérification distante du forfait ou du jeton ; seul le fournisseur décide au POST.
La clé et le jeton OAuth sont relus dans le coffre par le processus principal.
Les snapshots publics, runtime et exports retirent les références d’envoi ainsi
que les champs d’authentification inattendus. Seules les projections internes
explicitement demandées par les services main conservent les références du coffre.
L’annuaire ne reçoit aucune configuration de ChatBot. À l’import, la configuration
d’envoi actuelle du propriétaire est conservée ; les identifiants et consentements
du fichier importé ne sont jamais adoptés, même si celui-ci prétend appartenir au
même UID.

Le transport appelle le serveur public fixé `https://api.eulerstream.com`, route
`POST /webcast/rooms/{room_id}/chat`, avec `x-api-key` et `x-oauth-token` en headers.
Il ne transmet pas ces valeurs dans l’URL, les activités, les overlays ni les
messages d’erreur. Les redirects sont refusés. Une réponse HTTP 200 doit aussi
contenir `code: 200` et `data.status_code: 0` pour confirmer l’acceptation TikTok.
La réponse est bornée à 64 Kio.

### Prérequis externes, non inventés par le code

Le fournisseur documente la permission OAuth `webcast:chat` et une route d’envoi
premium. Une clé sans les droits nécessaires peut recevoir un refus. ShenPulse
ne crée ni abonnement payant ni compte Euler. Ces éléments nécessitent le choix
du propriétaire. [Route documentée et OpenAPI du fournisseur](https://www.eulerstream.com/docs/api/tiktok-live-rooms),
[schéma public versionné](https://github.com/EulerStream/TikTok-Live-Api/blob/master/spec/openapi.json).

Un client OAuth doit être enregistré ; l’utilisateur autorise explicitement
l’envoi. Le fournisseur impose un échange de code et un renouvellement côté
serveur car ils utilisent un `client_secret`. Celui-ci n’est pas ajouté à l’EXE,
et aucun nouveau backend n’est publié automatiquement. Les jetons déjà obtenus
par un parcours autorisé peuvent être utilisés avec ce transport ; leur
expiration bloque l’envoi jusqu’au renouvellement. [Parcours OAuth](https://www.eulerstream.com/docs/oauth/authorization-flow),
[permissions documentées](https://www.eulerstream.com/docs/oauth/scopes).

Il ne s’agit pas du Login Kit officiel de TikTok. La bibliothèque locale
`tiktok-live-connector@2.1.1-beta1` n’est pas remplacée : sa réception actuelle
continue de fonctionner. L’ancienne méthode d’envoi de cette bibliothèque exige
des données de session ; ShenPulse ne demande pas de copier ces cookies.

## Contrat d’un relais TikTok compatible

Il s’agit d’un protocole ShenPulse explicite, pas d’une prétendue API universelle.
Un ancien relais de réception n’est pas supposé le prendre en charge.

À l’ouverture, ShenPulse demande les capacités :

```json
{"action":"chat-capabilities","protocol":"shenpulse-chat-v1","platform":"tiktok"}
```

Le relais doit avoir réellement obtenu le consentement de son expéditeur, puis
annoncer les trois garanties :

```json
{"action":"chat-capabilities","protocol":"shenpulse-chat-v1","platform":"tiktok","canSend":true,"authenticated":true,"acknowledgements":true}
```

Après la découverte explicite d’un LIVE et de son `roomId`, chaque envoi porte
un identifiant UUID indépendant et la salle courante :

```json
{"action":"send-chat","protocol":"shenpulse-chat-v1","platform":"tiktok","requestId":"identifiant unique","roomId":"salon actuel","message":"commentaire"}
```

Le relais répond uniquement après acceptation de la plateforme :

```json
{"action":"chat-delivery","protocol":"shenpulse-chat-v1","platform":"tiktok","requestId":"identifiant unique","roomId":"salon actuel","sent":true}
```

`sent: false` indique le refus. `accepted`, `queued` ou un simple `ok` ne
confirment pas la publication. Un accusé de mauvaise salle, ancien identifiant,
autre plateforme ou mauvais protocole est ignoré. Les paquets de contrôle ne
créent pas d’événements de viewers et n’activent pas à eux seuls un LIVE.

## Sécurité et sobriété

- Maximum 20 requêtes en attente par transport, avec délai maximal de 8 secondes.
- Au moins 1,5 seconde entre les envois, et 500 caractères maximum par commentaire.
- Pas de retry automatique après timeout, refus ou erreur réseau.
- Garde compte/profil/session avant la file et immédiatement avant le POST.
- Changement de salon, ancienne socket ou arrêt : requêtes invalidées, pas de replay.
- Une confirmation tardive ne remplit pas le journal d’un nouveau profil.
- Les erreurs distantes restent privées : seules des catégories locales sont journalisées.
- Les activités de chat ne reconstruisent pas un grand snapshot ; les capacités
  changent sur connexion, autorisation ou négociation du relais.

## Vérifications sans envoi réel

Les tests `chatbot-tiktok-delivery.test.js` utilisent uniquement de fausses
réponses HTTP et sockets. Ils vérifient refus, timeout, bornes, changements de
profil, réponses partielles et absence de secrets dans les résultats.
`source-chat-capabilities.test.js` raccorde les doubles au vrai SourceHub et
confirme que la réception du LIVE continue sans autorisation d’envoi. Les tests
du service vérifient la distinction entre transfert, confirmation et réponse
locale. Aucun commentaire n’est envoyé à un vrai LIVE pendant ces contrôles.
`chatbot-transport-store-security.test.js` vérifie l’isolation du coffre, les
snapshots sans références d’envoi, l’import sans consentement implicite et la
conservation des actions/commandes importées.
