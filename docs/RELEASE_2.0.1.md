# ShenPulse 2.0.1 — Stockage média partagé

## Correction

Les imports de sons, vidéos, images et GIF passent désormais par le service
ShenPulse authentifié avec Firebase. Chaque compte connecté, gratuit ou abonné,
peut utiliser le stockage Backblaze commun sans configurer de clés sur son PC.
Les clés d’administration restent sur le serveur ; seuls des liens d’envoi
temporaires et limités à un objet sont transmis à l’application.

## Sécurité et compatibilité

- Conservation des bibliothèques et URL déjà enregistrées.
- Validation des formats, tailles et réponses du service avant l’envoi.
- Refus de l’enregistrement si le compte change pendant l’import.
- Messages d’erreur réseau/session lisibles, sans diagnostic privé du serveur.
- Migration ciblée des anciennes restrictions d’affichage du stockage média,
  sans changer les droits des autres fonctionnalités.

Le stockage reste soumis aux coûts et limites du compte Backblaze existant.
Cette correction n’ajoute aucun nouveau service et ne rend pas le bucket
publiquement modifiable. La limite applicative demeure de 200 Mio par fichier.
Le service de signature historique n’impose pas encore de quota de stockage
cumulé par utilisateur ; cette version ne prétend pas en ajouter un.
