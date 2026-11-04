# Voix du chat et chatbot

Dans **Voix & sons → Synthèse vocale → Choisir les voix**, choisissez une voix naturelle en ligne ou une voix Windows locale. Le catalogue embarqué propose 322 voix naturelles, dont 13 francophones. Il est disponible pour chaque installation, sans ajouter de langues Windows. Une actualisation automatique récupère les nouvelles voix auprès du service vocal ; un miroir public Backblaze et le catalogue embarqué assurent le repli. Ce catalogue contient les noms des voix, pas les modèles de synthèse : les voix naturelles nécessitent toujours Internet.

Le bouton **Tester** placé à côté du choix de la voix utilise les réglages courants, même avant leur enregistrement, exclusivement sur cet ordinateur. Dans chaque règle TTS, vitesse, hauteur et volume disposent de curseurs. Les rôles et les filtres des commentaires restent modifiables.

Lorsque **Lire les emojis** est décoché, ShenPulse retire les emojis Unicode du téléphone, les codes d’émoticônes TikTok et les jetons d’émoticônes d’abonnés identifiés par TikTok. Un commentaire composé uniquement d’emojis n’est pas lu ; le journal conserve le commentaire original.

Les voix personnelles prennent la priorité suivante : viewer identifié par son @, modérateur, abonné, équipe TikTok, règle, puis voix par défaut du profil. « Une voix française par viewer » attribue une voix stable à chaque identité. Jusqu’à 100 viewers peuvent être personnalisés. Les règles, filtres, sorties et anciens choix sont conservés.

Seul le commentaire autorisé et filtré est envoyé au service vocal Microsoft pour une voix naturelle. Aucun commentaire n’est écrit dans un fichier par le service vocal. Les synthèses sont ordonnées, bornées et annulées si le compte ou le profil change. La connexion vocale est réutilisée entre les commentaires puis fermée après deux minutes d’inactivité. Les règles du chat démarrent sans attendre une réponse conversationnelle distante. Une panne déclenche le secours Windows au plus tard après cinq secondes ; les tentatives sont suspendues pendant 30 secondes. L’audio est identique pour le retour local et la source LIVE. Les aperçus ne sont jamais diffusés sur le LIVE. Les commentaires sont lus dans l’ordre : une lecture déjà en cours reste prioritaire.

Dans **Commandes**, trois onglets séparent les usages :

- **Commandes d’actions** : musique, actions et overlays, sans permission d’envoyer au chat.
- **Réponses du chat** : réponse à une commande `!` ou à des mots-clés. Modèles Discord et salutations disponibles.
- **Messages programmés** : de 1 à 60 minutes, rotation de 1 à 10 messages et minimum de messages reçus entre deux rappels.

Les modèles sont préparés désactivés. Le texte se vérifie dans l’aperçu local, sans appel d’envoi. Les anciens messages masqués restent conservés et ne sont pas réactivés. Les nouvelles entrées portent un consentement explicite (`conversationVersion: 1`).

Pour publier une réponse, il faut une session LIVE, un accès aux commandes et une connexion qui autorise l’envoi. Le bot commun ShenPulse est sélectionné par défaut sur TikTok : les créateurs n’ont aucun identifiant fournisseur à renseigner. Il reste à connecter ce compte bot côté administration avant l’activation du service. Une autorisation personnelle existante reste utilisable en mode avancé ; « Réception uniquement » désactive l’envoi automatique. Les autorisations Kick et Twitch suivent leurs connexions existantes. Le journal distingue publication confirmée, transfert et absence d’envoi.

Les cooldowns par viewer et globaux, le filtrage des propres messages du bot, les files bornées et la revalidation du compte, du profil et de la connexion restent actifs. Les rappels ne rattrapent pas les échéances manquées après une pause.
