# Politique de confidentialité de ShenPulse

Dernière mise à jour : 13 octobre 2026

ShenPulse traite localement les événements de livestream nécessaires aux
automatisations choisies par l'utilisateur : pseudonyme public, avatar public,
contenu de chat, cadeaux, likes, abonnements et événements de session.

Par défaut, ShenPulse :

- n'impose aucun compte ShenPulse pour les fonctions locales gratuites ;
- n'envoie aucune télémétrie ;
- ne vend ni ne partage de données ;
- stocke la configuration et l'historique sur l'appareil ;
- chiffre les jetons de session et autres secrets avec le coffre-fort du système ;
- n'écoute que sur l'interface locale `127.0.0.1`.

Les connecteurs externes configurés par l'utilisateur communiquent directement
avec les services concernés. Leurs propres politiques de confidentialité
s'appliquent. Lorsqu'un utilisateur connecte son compte ShenPulse, son adresse
email et son mot de passe sont transmis directement au service
d'authentification Firebase. Le mot de passe n'est jamais conservé par
ShenPulse ; seul le jeton nécessaire au maintien de la session est chiffré dans
le coffre-fort du système et il est supprimé lors de la déconnexion. Les droits
d'abonnement, les achats de jeux et les bénéficiaires Premium sont rattachés à
l'identifiant Firebase et à l'adresse e-mail du compte, jamais au pseudonyme
TikTok.

## Annuaire public des créateurs en direct

La participation à l'annuaire « En direct avec ShenPulse » est facultative et
désactivée par défaut. Elle nécessite un compte ShenPulse connecté et une
activation explicite dans l'application. Consulter cet annuaire n'active pas
la publication de votre propre live.

Après activation, ShenPulse publie dans Firebase Realtime Database uniquement
les lives TikTok ou Kick réellement détectés par l'application : la plateforme,
le pseudonyme public `@`, l'URL de la photo publique et le nombre de spectateurs
actuels lorsqu'il est disponible. Sont aussi transmis un horodatage serveur,
la version du protocole de l'annuaire et un identifiant aléatoire d'instance de
l'application. L'identifiant Firebase du compte sert de clé publique à cette
entrée ; les informations de l'annuaire sont accessibles publiquement, et pas
seulement sur votre appareil.

Aucun e-mail, mot de passe, jeton d'accès, contenu de chat, cadeau, historique,
profil de configuration ou autre donnée privée du compte n'est publié dans cet
annuaire. La photo affichée est celle du créateur de la plateforme, pas celle
d'un spectateur ou du compte ShenPulse. Un nombre de spectateurs inconnu reste
inconnu : il n'est pas remplacé par une estimation.

Pendant le live et tant que l'application est connectée, la présence est
actualisée au maximum toutes les 30 secondes. ShenPulse retire sa propre
entrée lorsque le live s'arrête, lorsque vous désactivez la participation ou
lorsque vous vous déconnectez du compte ShenPulse. En cas de fermeture brutale,
de panne ou de perte de connexion empêchant cette suppression, les autres
clients ShenPulse cessent d'afficher une présence non renouvelée après
90 secondes. Cette expiration d'affichage ne garantit pas une suppression
immédiate de l'ancienne entrée dans Firebase ; elle peut rester stockée jusqu'à
sa prochaine mise à jour ou sa suppression.

Les informations sont déclarées par les connecteurs de l'application.
L'annuaire ne certifie ni la propriété ni la vérification d'un compte TikTok
ou Kick. L'accès aux autres données Firebase du compte reste privé et réservé
à son propriétaire. Désactiver la participation ne coupe pas votre connexion
TikTok ou Kick et n'empêche pas les interactions locales.

La détection TikTok LIVE transmet uniquement le `@` public au
service technique du connecteur ; ShenPulse ne demande ni mot de passe ni jeton
de compte TikTok. Les données locales peuvent être exportées ou supprimées depuis
Paramètres > Données et confidentialité. La désinstallation supprime le package ;
Windows peut conserver les données d'application selon ses règles de sauvegarde.

Contact confidentialité à renseigner avant publication :
`alexandre.leuridan@gmail.com`.
