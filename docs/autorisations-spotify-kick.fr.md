# Autorisations et disponibilité Spotify/Kick

## Isolation pendant les opérations asynchrones

Les opérations OAuth, renouvellements de jetons et requêtes sont attachés au
propriétaire ShenPulse initial. Une déconnexion, une nouvelle autorisation ou un
changement de compte invalide la continuation : une réponse tardive ne doit pas
écraser les réglages ou utiliser les secrets du nouveau propriétaire.

Les renouvellements concurrents sont partagés **par propriétaire**, pas entre
deux comptes. Les retries HTTP 401 conservent leur contexte initial. Les étapes
successives d'une commande Spotify — résolution, choix d'appareil, transfert,
lecture — conservent également ce contexte. Une requête déjà partie ne peut pas
être « retirée » : son résultat est cependant rejeté s'il appartient à l'ancien
contexte.

Pour Kick, l'identité renvoyée par `/users` est validée avant de sauvegarder les
nouveaux jetons. Une identité manquante ne remplace donc pas une autorisation
existante. La signature, l'horodatage, la plateforme et le diffuseur des webhooks
restent vérifiés ; une ancienne génération de listener est ignorée.

## Spotify : connecté ne signifie pas lecture disponible

Le statut expose des capacités sans secrets :

- `canSearch` : recherche et demandes locales disponibles avec le compte autorisé.
- `canControlPlayback` : aucun prérequis connu ne s'oppose au contrôle de lecture.
- `canControlVolume` : le contrôle est possible et l'appareil ne déclare pas un
  refus du volume.
- `scopesKnown`, `premium`, `devicesKnown` : provenance des informations utilisées.
- `reason`, `volumeReason` : cause et prochain geste à effectuer, en français.

Une permission d'écriture connue manquante propose **Autoriser à nouveau**.
Un abonnement Spotify `free`/`open` effectivement connu bloque le pilotage et
laisse la recherche disponible. Une liste d'appareils obtenue avec succès mais
vide, ou contenant seulement des appareils restreints, demande d'ouvrir Spotify,
de lancer un titre puis d'actualiser. Le service vérifie encore les appareils
avant toute écriture ; le bouton n'est pas une autorisation suffisante.

Les anciennes configurations sans liste de scopes vérifiée et les produits
inconnus ne sont **pas** arbitrairement déclarés non autorisés. Le champ `product`
étant déprécié, son absence n'est pas assimilée à un compte gratuit. Les nouvelles
autorisations demandent `user-read-private` en plus des scopes existants pour
obtenir le niveau d'abonnement lorsque Spotify le transmet. Le Client ID public
intégré de ShenPulse reste inchangé ; aucun compte développeur supplémentaire
n'est imposé à l'utilisateur pour Spotify.

L'interface désactive seulement les contrôles concernés. La recherche,
l'administration de la file de demandes ShenPulse et la réautorisation restent
accessibles selon leurs propres conditions. La file Spotify native reste en
lecture seule : aucune suppression que l'API ne permet pas n'est annoncée.

Le pilotage concerne la lecture dans Spotify. ShenPulse ne capture ni ne
redistribue l'audio Spotify et ne recommande pas de le diffuser au public : les
conditions de l'API interdisent notamment la diffusion de son contenu ainsi que
les intégrations de streaming commercial. Le fait de pouvoir piloter un titre
ne constitue pas une autorisation de le rediffuser.

Références officielles : [scopes Spotify](https://developer.spotify.com/documentation/web-api/concepts/scopes),
[profil actuel et champ product](https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile),
[appareils disponibles](https://developer.spotify.com/documentation/web-api/reference/get-a-users-available-devices),
[pilotage de lecture Premium](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback).

## Kick : autorisation et réception sont deux états distincts

La carte de connexion affiche le statut réellement renvoyé par le service.
Un ancien `refreshTokenSecretId` n'écrase plus un `connected: false` reçu après
révocation ou secret indisponible. Un renouvellement refusé comme `invalid_grant`
ou un refus 401 final est signalé comme autorisation expirée/révoquée, avec une
réautorisation proposée ; les secrets ne sont pas supprimés sur une simple panne
réseau.

Les scopes fournis par Kick sont conservés. Une permission `chat:write` ou
`events:subscribe` connue manquante est diagnostiquée avant un envoi/abonnement.
Les anciens scopes inconnus restent compatibles. Les événements reçus exigent
toujours un webhook HTTPS public configuré dans l'application Kick : un service
ou tunnel externe n'a pas été créé automatiquement.

Références officielles : [OAuth et renouvellement Kick](https://docs.kick.com/getting-started/generating-tokens-oauth2-flow),
[scopes Kick](https://docs.kick.com/scopes/scopes).

## Vérification sans connexion réelle

`tests/integration-authorization.test.js` utilise uniquement des stores et jetons
factices, HTTP simulé et callbacks OAuth simulés. Il contrôle les réponses
tardives, les comptes différents, la révocation, la permission d'écriture, les
appareils absents/restreints, le volume non supporté et les contrôles de
l'interface. Aucun navigateur réel, compte utilisateur, secret réel, webhook
public ni lecture Spotify n'est utilisé par ces tests.

## Accusé d'envoi du chat Kick

Un HTTP 200 n'est pas à lui seul un message envoyé : le service exige
`data.is_sent === true` dans la réponse de Kick avant de renvoyer `sent: true`,
`acknowledged: true` et `confirmation: "platform"`. Une valeur fausse ou absente
produit `kick-chat-not-confirmed`, sans annoncer de confirmation trompeuse.

Le message est validé avant toute requête : au maximum 500 graphèmes et
2 048 octets UTF-8, sans troncature silencieuse. Les emojis et caractères
combinés sont comptés comme graphèmes ; la limite en octets reste indépendante.
Les tests couvrent les réponses ambiguës, les faux booléens, les textes à la
limite et les emojis multioctets.

Référence officielle : [envoi de chat Kick](https://docs.kick.com/apis/chat).
