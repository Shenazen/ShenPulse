# Écarts fonctionnels et vérification

Cette révision rapproche les capacités de ShenPulse de la présentation attendue,
sans inventer les contrats privés d'une autre application ni contourner les droits
des plateformes. Les profils, associations de cadeaux et historiques sont conservés.

## Commandes

La page **Commandes** permet de relier une commande `!` à Spotify, une action
du profil actif ou un overlay. Ces effets fonctionnent à la réception du chat,
sans service d'envoi TikTok ni réponse obligatoire. Les rôles et délais
anti-spam sont appliqués avant l'effet. Voir [le moteur des commandes](commandes-runtime.md)
et [leur contrat partagé](architecture/commandes-execution.md).

Les anciennes réponses et messages programmés sont conservés uniquement dans
les données, sans interface ni exécution automatique. La page ne propose que
Musique, Action et Overlay, et se place après Interactions IRL dans le menu.
Les transports d'envoi restent distincts pour les actions « Réponse chat »
existantes et sont configurables depuis Connexions, pas depuis Commandes.

- Une écriture sur Twitch IRC ou une socket est un transfert, pas une preuve de
  publication. Le journal ne dit plus « envoyé » dans ce cas.
- Un relais TikTok doit annoncer son autorisation et retourner un accusé corrélé
  à la requête et au salon. Aucun changement à la réception des anciens relais.
- L'envoi TikTok direct peut utiliser un accès Euler OAuth déjà autorisé. Le
  dialogue « Envoi TikTok » ne crée pas cette autorisation et n'achète rien.
  Le transport est désactivé par défaut. Les secrets sont saisis localement et
  le chiffrement Windows doit être disponible avant toute configuration.
- Le renouvellement OAuth qui exige un secret d'application nécessite un serveur
  sécurisé. Aucun secret d'application n'est embarqué dans l'EXE, aucun serveur
  n'est publié par cette révision.

La validation locale constate qu'une configuration est complète ; elle ne peut
pas prouver les droits du forfait. Le fournisseur reste décisionnaire à l'envoi.
Un timeout n'est pas répété automatiquement, car le message peut avoir été accepté.
Voir [le contrat des transports](chatbot-transports.fr.md).

## Services externes

Spotify et Kick restent soumis à la connexion volontaire du propriétaire. La
présence d'une référence de jeton ne suffit pas à annoncer tous les contrôles
disponibles. Les scopes manquants connus et les prérequis de lecture sont signalés.
Les anciennes autorisations dont les scopes ne sont pas connus ne sont pas
arbitrairement révoquées. Aucun achat, inscription développeur ou ouverture de
webhook public n'est effectué automatiquement.

## Rangs

Les seuils ShenPulse existants sont conservés : l'autre application ne fournit pas
de barème vérifiable. La fiche viewer précise désormais le prochain rang et le
nombre exact de diamants restants. Voir [la base utilisateurs](base-utilisateurs.md).

## Performances et non-régression

Les règles incompatibles ne sont plus recopiées à chaque événement, et les
sélections d'actions sont projetées à la demande. Le rejeu synthétique vérifie
la conservation des actions exécutées ; il ne mesure pas la RAM d'une session
réelle et ne constitue pas une comparaison équivalente de deux applications.
Voir [les mesures du moteur](performances-moteur-regles.fr.md).

Les tests utilisent des doubles de transport et des données temporaires. Ils
n'envoient pas de messages dans le LIVE, ne déclenchent pas les prises IRL et
ne modifient pas les données du créateur. Une publication Store/EXE reste une
opération séparée qui n'est pas incluse dans cette révision locale.
