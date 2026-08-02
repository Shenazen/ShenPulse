# Politique de confidentialité de ShenPulse

Dernière mise à jour : 29 juillet 2026

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

La détection TikTok LIVE transmet uniquement le `@` public au
service technique du connecteur ; ShenPulse ne demande ni mot de passe ni jeton
de compte TikTok. Les données locales peuvent être exportées ou supprimées depuis
Paramètres > Données et confidentialité. La désinstallation supprime le package ;
Windows peut conserver les données d'application selon ses règles de sauvegarde.

Contact confidentialité à renseigner avant publication :
`alexandre.leuridan@gmail.com`.
