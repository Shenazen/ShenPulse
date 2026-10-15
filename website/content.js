export const CLIENT_RELEASE = {
  version: '2.0.2',
  title: 'Tes profils, tes réglages, ton compte.',
  summary: 'Retrouve tes profils et réglages à la reconnexion sur ce même PC, avec des sauvegardes renforcées et des transitions de compte plus sûres.',
  highlights: [
    ['Retrouve ton travail', 'Profils, actions, médias et intégrations restent associés à ton compte sur ce PC. Les changements de compte conservent les sauvegardes existantes.'],
    ['Personnalise chaque profil', 'Voix TTS et réglages des demandes musicales suivent le profil actif. Les réponses retardées d’un ancien compte ne remplacent plus la session courante.'],
    ['Garde l’infrastructure privée', 'Administration, Contrôleurs et Paramètres sont réservés au propriétaire. Les imports de médias restent disponibles pour tous les comptes connectés.']
  ]
}

export const APP_TABS = [
  {
    id: 'accueil',
    group: 'Pilotage',
    title: 'Accueil',
    summary: 'Un point de départ pour préparer le live et retrouver les espaces de création.',
    parts: [
      ['Raccourcis', 'Ouvre les actions, jeux, overlays ou statistiques sans modifier leur configuration.'],
      ['En direct', 'Présente les créateurs qui ont choisi de rendre leur LIVE visible dans l’annuaire.'],
      ['Premiers pas', 'Connecte la plateforme, choisis les interactions et prépare les sources de diffusion.']
    ],
    tips: ['La publication dans l’annuaire est facultative.', 'La barre du haut reste disponible dans tous les espaces.']
  },
  {
    id: 'vue-ensemble',
    group: 'Pilotage',
    title: 'Tableau de bord',
    summary: 'Le tableau de bord résume la session et donne accès aux commandes les plus utilisées.',
    parts: [
      ['Statistiques de session', 'Viewers, likes, cadeaux, diamants et followers du LIVE en cours, ou du dernier LIVE lorsque tu es déconnecté.'],
      ['Démarrer la session', 'Active les sources et automatismes du profil courant. Vérifie le profil, le compte TikTok et le jeu actif avant de cliquer.'],
      ['Simulateur', 'Simule un cadeau, des likes, un follow, un message, un partage, un abonnement ou une arrivée. Le sélecteur de cadeau apparaît uniquement pour les cadeaux. Les actions configurées peuvent réellement être exécutées.'],
      ['Activité récente', 'Affiche les derniers événements, actions, avertissements et erreurs. Le bouton Journal ouvre l’historique complet.']
    ],
    tips: ['Le bilan conservé ne représente pas tous tes lives cumulés.', 'Une session de jeu et une session live sont deux états distincts.']
  },
  {
    id: 'utilisateurs',
    group: 'Pilotage',
    title: 'Utilisateurs',
    summary: 'Retrouve les participants et leurs contributions, avec classements, rangs et blocages.',
    parts: [
      ['Liste et classements', 'Recherche les viewers et compare leurs likes, cadeaux ou participations selon la vue choisie.'],
      ['Rangs', 'Les icônes accompagnent les rangs calculés à partir des données disponibles dans ShenPulse.'],
      ['Utilisateurs bloqués', 'Le bouton dédié ouvre la liste des blocages et permet de débloquer un utilisateur.']
    ],
    tips: ['Un blocage dans ShenPulse ne remplace pas la modération de la plateforme.', 'Les contributions affichées dépendent des événements effectivement reçus.']
  },
  {
    id: 'session-direct',
    group: 'Pilotage',
    title: 'Session en direct',
    summary: 'Cette page permet de suivre ce que ShenPulse reçoit pendant le live.',
    parts: [
      ['État TikTok', 'Indique le compte surveillé, son état hors ligne/en direct et l’heure du dernier événement.'],
      ['Flux des événements', 'Liste cadeaux, likes, messages, follows, partages, abonnements, arrivées et raids dans l’ordre de réception.'],
      ['Filtres', 'Réduit l’affichage à un type d’événement ou à une recherche. Cela ne désactive pas les règles.'],
      ['Contrôles de test', 'Envoie un événement fictif avec un viewer et, si nécessaire, un cadeau du catalogue.']
    ],
    tips: ['Un live peut être détecté après quelques instants.', 'Ne partage jamais un journal contenant des identifiants ou des jetons.']
  },
  {
    id: 'actions',
    group: 'Création',
    title: 'Actions',
    summary: 'Une action décrit ce que ShenPulse doit faire. Un déclencheur précise quand elle se lance.',
    parts: [
      ['Sous-onglet Actions', 'Crée, modifie, duplique, teste ou supprime les actions du profil.'],
      ['Sous-onglet Déclencheurs', 'Associe les événements du live à une ou plusieurs actions existantes.'],
      ['Sous-onglet Timers', 'Planifie une ou plusieurs actions à intervalle régulier.'],
      ['Simulateur du tableau de bord', 'Les événements fictifs se testent dans le tableau de bord ; les Actions conservent leurs tests manuels.'],
      ['Écrans Media', 'Fournit huit files indépendantes et huit URL de sources navigateur pour afficher images, GIF ou vidéos.']
    ],
    tips: ['Teste chaque action avant de lui associer un déclencheur.', 'Plusieurs actions peuvent appartenir à la même règle.']
  },
  {
    id: 'sons',
    group: 'Création',
    title: 'Voix & sons',
    summary: 'Cette page centralise les alertes audio et la lecture des commentaires.',
    parts: [
      ['Bibliothèque', 'Recherche les sons inclus, écoute un aperçu et sélectionne une piste.'],
      ['Alertes sonores', 'Associe un son, un volume et un déclencheur à une règle.'],
      ['Synthèse vocale', 'Choisit une voix, une vitesse, une hauteur et un volume.'],
      ['Filtres TTS', 'Autorise ou bloque emojis, mentions, commandes et liens avant lecture.'],
      ['Actions de ligne', 'Teste, modifie, duplique ou supprime une alerte à l’aide des boutons directs. Une confirmation précède la suppression.']
    ],
    tips: ['Commence avec un volume inférieur à 1.', 'Teste la voix et le périphérique de sortie avant le live.']
  },
  {
    id: 'musique',
    group: 'Création',
    title: 'Musique',
    summary: 'Prépare la lecture musicale, les demandes de titres et les règles Spotify.',
    parts: [
      ['Lecture', 'Après autorisation Spotify, recherche, mets en file, lis, mets en pause ou passe au titre suivant.'],
      ['Demandes du chat', 'Configure les commandes de demande et de passage, puis consulte la file des titres acceptés.'],
      ['Limites', 'Règle les cooldowns, la taille de la file, la durée des titres, le contenu explicite et les artistes bloqués.'],
      ['Règles', 'Associe les événements du live aux contrôles de lecture existants.']
    ],
    tips: ['Spotify et certaines commandes de lecture peuvent nécessiter un compte Spotify Premium.', 'Les résultats de commandes sont consultables dans ShenPulse ; aucun envoi automatique au chat n’est promis.']
  },
  {
    id: 'overlays',
    group: 'Création',
    title: 'Overlays',
    summary: 'Les cartes d’overlay fournissent un aperçu, des réglages persistants et une URL pour le logiciel de diffusion.',
    parts: [
      ['Aperçu', 'Montre le rendu réel avec le thème, les couleurs et la taille configurés.'],
      ['Configurer', 'Ouvre les réglages de placement, contenu, design, lisibilité et visibilité.'],
      ['Copier l’URL', 'Copie la source locale à ajouter dans OBS. Les URL publiques sont utilisées lorsque l’application les fournit.'],
      ['Dimensions', 'Respecte la largeur et la hauteur conseillées sur chaque carte pour éviter un étirement.'],
      ['Réinitialiser', 'Restaure le rendu par défaut de cet overlay uniquement.']
    ],
    tips: ['Active “Rafraîchir quand la scène devient active” dans OBS si nécessaire.', 'Une source transparente ne doit pas recevoir de fond dans OBS.']
  },
  {
    id: 'jeux-effets',
    group: 'Création',
    title: 'Jeux vidéo',
    summary: 'La galerie rassemble uniquement les jeux actuellement publiés dans l’application.',
    parts: [
      ['Recherche et filtres', 'Trouve un jeu, un connecteur ou un effet, puis filtre par niveau d’accès.'],
      ['Fiche du jeu', 'Affiche le type d’intégration, le nombre d’interactions, les prérequis et les avertissements.'],
      ['Installation', 'Détecte le dossier, télécharge les fichiers gérés et conserve une sauvegarde lorsque le jeu est modifié.'],
      ['Configuration', 'Associe cadeaux, coûts, durées, multiplicateurs et paramètres propres au jeu.'],
      ['Interactions', 'Active, teste et ordonne les effets disponibles.'],
      ['Overlays liés', 'Prépare l’image d’interactions et les compteurs utiles au gameplay.'],
      ['Session de jeu', 'Démarre une seule passerelle à la fois. Arrête-la avant de changer de jeu.']
    ],
    tips: ['Un accès ShenPulse Pro ou Premium actif est requis ; certains modules nécessitent aussi leur achat.', 'Ferme toujours le jeu avant une installation ou une réparation.', 'Teste plusieurs effets sur une sauvegarde non critique.']
  },
  {
    id: 'objectifs',
    group: 'Création',
    title: 'Objectifs',
    summary: 'Les objectifs suivent une progression et alimentent les overlays associés.',
    parts: [
      ['Nom', 'Libellé interne qui permet d’identifier l’objectif.'],
      ['Type', 'Détermine la métrique suivie, par exemple les likes.'],
      ['Valeur actuelle', 'Point de départ ou correction manuelle.'],
      ['Cible', 'Valeur à atteindre. Elle doit être supérieure à zéro.'],
      ['Couleur', 'Couleur principale du rendu dans les zones qui la prennent en charge.']
    ],
    tips: ['Vérifie la valeur de départ avant le live.', 'Le Like Goal possède aussi ses réglages détaillés dans Overlays.']
  },
  {
    id: 'machines-irl',
    group: 'Création',
    title: 'Machines IRL',
    summary: 'Associe les prises PlugPlus et tes interactions physiques aux événements du live.',
    parts: [
      ['Mes prises', 'Détecte une prise, ajoute son IP ou associe un appareil neuf. La liste compacte conserve le nom, la connexion et les commandes de test.'],
      ['Mes interactions', 'Crée des actions PlugPlus, relie leurs déclencheurs et règle les durées.'],
      ['Contrôles directs', 'Allumer, éteindre, basculer et impulsions temporisées agissent réellement sur les appareils.'],
      ['Gestion', 'Renomme ou retire un appareil après vérification de la cible.']
    ],
    tips: ['Un accès Pro ou Premium actif est requis.', 'Teste avec une installation sans risque ; ne connecte pas de dispositif dangereux.']
  },
  {
    id: 'commandes',
    group: 'Création',
    title: 'Commandes',
    summary: 'Une commande ! reçue dans le chat peut piloter la musique, une action ou un overlay.',
    parts: [
      ['Commande et alias', 'Choisis un nom commençant par ! et, si nécessaire, des alias.'],
      ['Effet', 'Sélectionne une commande musicale, une action active du profil ou une cible overlay compatible.'],
      ['Permissions et plateformes', 'Limite l’accès aux rôles autorisés et aux plateformes choisies.'],
      ['Cooldowns', 'Configure les pauses globales et par viewer pour éviter les répétitions.'],
      ['Gestion et aperçu', 'Active, modifie ou supprime une commande. L’aperçu reste local ; les résultats d’exécution apparaissent dans l’historique récent.']
    ],
    tips: ['Un accès Pro ou Premium actif est requis.', 'Il ne s’agit pas d’un chatbot de réponses texte ; aucun service d’envoi de messages n’est nécessaire.', 'Une commande reçue peut lancer une action réelle : vérifie ses permissions avant le live.']
  },
  {
    id: 'matchs',
    group: 'Création',
    title: 'Matchs',
    summary: 'Suis les matchs TikTok et prépare leurs widgets et automatisations dans le profil actif.',
    parts: [
      ['Tableau de bord', 'Affiche les matchs et scores dès réception des événements TikTok ; la plateforme reste la source des données.'],
      ['Widgets', 'Configure les compteurs, donateurs, temps restants et rendus associés, puis copie leurs sources navigateur.'],
      ['Automatisations', 'Relie les moments du match aux animations disponibles, aux vidéos personnelles et aux sons.'],
      ['Pack Cyber', 'Six animations : Gant de boxe, x2, x3, Tap Tap, Merci pour ton cœur et Snipe. Aucun Coffre Cyber n’est proposé.'],
      ['Source Studio', 'Copie la source prévue pour TikTok LIVE Studio ; ShenPulse doit rester ouvert sur le même PC. Les vidéos du catalogue sont chiffrées et lues en mémoire, sans export.'],
      ['Audio', 'Le son intégré des vidéos est activé pendant leur lecture sur la source de diffusion ; les aperçus restent muets.']
    ],
    tips: ['Un accès Pro ou Premium actif est requis.', 'Le chiffrement limite la copie directe, mais ne peut empêcher toute extraction experte ou capture vidéo.', 'Les tests de diffusion peuvent produire des images et du son sur le live ; vérifie la scène avant de les lancer.']
  },
  {
    id: 'abonnement',
    group: 'Système',
    title: 'Abonnement',
    summary: 'Cette page affiche l’offre courante, les accès et le renouvellement.',
    parts: [
      ['Offre actuelle', 'Indique Free, Pro ou Premium et l’état de l’accès.'],
      ['Choisir une offre', 'Ouvre PayPal depuis l’application, puis revient par une adresse locale sécurisée. Aucun lien PayPal n’est nécessaire sur le site public.'],
      ['Accès Premium offert', 'Le plan Premium peut attribuer un accès Pro à un autre compte selon les conditions affichées.'],
      ['Jeux achetés', 'Les droits individuels se synchronisent avec le compte ShenPulse.']
    ],
    tips: ['Effectue l’achat uniquement depuis l’application.', 'Après paiement, laisse ShenPulse terminer la synchronisation.']
  },
  {
    id: 'connexions',
    group: 'Système',
    title: 'Connexions',
    summary: 'Les connexions alimentent ShenPulse en événements ou transmettent des commandes.',
    parts: [
      ['TikTok', 'Renseigne uniquement le @ public ; la détection du live est automatique.'],
      ['Démonstration', 'Génère des événements locaux pour tester sans plateforme.'],
      ['WebSocket autorisé', 'Se connecte à un relais qui émet des messages au format prévu par ShenPulse.'],
      ['Twitch IRC', 'Utilise une chaîne, un compte et, si nécessaire, un jeton.'],
      ['Démarrage automatique', 'Reconnecte la source au lancement de ShenPulse.']
    ],
    tips: ['N’utilise que des services et identifiants que tu es autorisé à connecter.', 'Les secrets sont chiffrés localement lorsqu’ils sont enregistrés.']
  },
  {
    id: 'controleurs',
    group: 'Système',
    title: 'Contrôleurs',
    summary: 'Pilote tes actions et la musique depuis Stream Deck ou un contrôleur MIDI compatible.',
    parts: [
      ['Stream Deck', 'Prépare le contrôleur et associe ses boutons aux cibles du profil actif.'],
      ['MIDI', 'Configure les commandes provenant des périphériques disponibles.'],
      ['Cibles', 'Choisis les actions et contrôles pris en charge, puis vérifie leur association.']
    ],
    tips: ['Une commande physique peut exécuter une action réelle.', 'Le périphérique et son logiciel doivent être installés et disponibles.']
  },
  {
    id: 'journal',
    group: 'Système',
    title: 'Journal',
    summary: 'Le journal aide à comprendre un événement manquant, une action bloquée ou une passerelle déconnectée.',
    parts: [
      ['Heure', 'Moment exact de l’événement local.'],
      ['Niveau', 'Information, succès, avertissement ou erreur.'],
      ['Catégorie', 'Source, action, overlay, jeu, compte ou service concerné.'],
      ['Événement', 'Résumé court de ce qui s’est produit.'],
      ['Détail', 'Cause ou donnée utile au diagnostic.']
    ],
    tips: ['Commence par la première erreur, pas la dernière conséquence.', 'Masque les données sensibles avant de partager une capture.']
  },
  {
    id: 'parametres',
    group: 'Système',
    title: 'Paramètres',
    summary: 'Les réglages de l’application, services locaux, voix et intégrations sont regroupés ici.',
    parts: [
      ['Comportement', 'Démarrage des services, fermeture, simulation de touches et télémétrie.'],
      ['Ports & sécurité', 'Ports locaux des overlays et de l’API, plus le jeton local en lecture seule.'],
      ['Synthèse vocale', 'Voix, vitesse, hauteur et volume par défaut.'],
      ['OBS', 'Adresse WebSocket et mot de passe. Utilise le bouton Tester OBS.'],
      ['Spotify', 'Client ID public, port de retour local et état de l’autorisation.'],
      ['Stockage média', 'Bucket, endpoint, région, dossier, URL publique, limite et clés chiffrées.'],
      ['Données locales', 'Exporter, importer ou effacer la configuration de cet appareil.'],
      ['Profils', 'Crée des espaces indépendants pour les actions, overlays et réglages de jeux.']
    ],
    tips: ['Exporte le profil avant une modification importante.', 'Ne publie jamais le jeton API, un mot de passe OBS ou une clé de stockage.']
  }
]

export const ACTION_TYPES = [
  ['Média', 'Choisit l’écran Media 1 à 8, la durée, un média obligatoire, son mode de cadrage et ses options de lecture.'],
  ['Synthèse vocale', 'Lit un texte ou une variable avec la voix, vitesse, hauteur et volume choisis.'],
  ['Son', 'Joue une piste de la bibliothèque ou un média importé, avec le volume configuré.'],
  ['Objectif', 'Ajoute une valeur à l’objectif sélectionné.'],
  ['Minuteur', 'Ajoute ou retire du temps au timer choisi.'],
  ['Roue', 'Lance une roue précise et utilise le résultat configuré.'],
  ['Groupe d’actions', 'Exécute toutes les actions sélectionnées ou un nombre d’entre elles choisi au hasard.'],
  ['Animation Match', 'Lance une animation Match précise avec sa variante et son mode de cadrage.'],
  ['Effet de jeu', 'Envoie un effet à la passerelle du jeu sélectionné.'],
  ['Compteur WINS', 'Ajoute, retire ou remet à zéro les victoires.'],
  ['Commande OBS', 'Envoie une requête OBS WebSocket avec un type et des données JSON.'],
  ['Requête HTTP', 'Appelle une URL avec méthode, délai, en-têtes et corps JSON.'],
  ['Message WebSocket', 'Envoie un objet JSON à la connexion choisie.'],
  ['Réponse chat', 'Publie un message par une connexion qui autorise les réponses.'],
  ['Spotify', 'Recherche, met en file, lit, met en pause, passe au titre suivant ou règle le volume.'],
  ['Raccourci clavier', 'Simule la combinaison choisie si l’autorisation est activée dans Paramètres.'],
  ['Ouvrir une URL', 'Ouvre une adresse explicite dans le navigateur par défaut.'],
  ['Délai', 'Attend le nombre de millisecondes indiqué avant l’action suivante.']
]

export const POPUP_GROUPS = [
  {
    id: 'popup-action',
    title: 'Créer ou modifier une action',
    purpose: 'Le formulaire change selon le type sélectionné. La partie “Déclencheur automatique” peut rester désactivée si l’action sera appelée par un timer, une roue ou une autre règle.',
    fields: [
      ['Nom', 'Nom interne de l’action ou de la règle.'],
      ['Type d’action', 'Détermine les champs spécifiques affichés.'],
      ['Déclencheur automatique', 'Active le lancement direct depuis un événement live.'],
      ['Type de déclencheur', 'Cadeau, like, message, follow, partage, abonnement, arrivée, raid ou test.'],
      ['Seuil', 'Quantité minimale avant lancement.'],
      ['Cadeau précis', 'Filtre facultatif dans le catalogue TikTok.'],
      ['Message contient', 'Filtre facultatif pour les événements chat.'],
      ['Viewer précis', 'Limite la règle à un @.'],
      ['Cooldown global', 'Délai commun avant une nouvelle exécution.'],
      ['Cooldown par viewer', 'Délai individuel pour éviter qu’une personne déclenche en boucle.']
    ]
  },
  {
    id: 'popup-son',
    title: 'Créer une alerte sonore',
    purpose: 'Associe un son à un événement live.',
    fields: [
      ['Nom de l’alerte', 'Nom visible dans les listes.'],
      ['Son', 'Piste choisie dans la bibliothèque ou importée.'],
      ['Volume', 'Valeur de 0 à 1.'],
      ['Déclencheur', 'Événement qui lance l’alerte.'],
      ['Seuil', 'Quantité nécessaire.'],
      ['Cadeau précis', 'Cadeau unique facultatif.'],
      ['Cooldown', 'Pause globale en millisecondes.']
    ]
  },
  {
    id: 'popup-tts',
    title: 'Ajouter une règle TTS',
    purpose: 'Lit les commentaires qui respectent les filtres.',
    fields: [
      ['Nom', 'Nom de la règle.'],
      ['Voix', 'Voix système utilisée.'],
      ['Vitesse', 'De 0,5 à 2.'],
      ['Hauteur', 'De 0 à 2.'],
      ['Volume', 'De 0 à 1.'],
      ['Lire les emojis', 'Conserve ou retire les emojis.'],
      ['Autoriser les mentions', 'Permet les messages contenant @.'],
      ['Autoriser les commandes', 'Permet les messages commençant par une commande.'],
      ['Autoriser les liens', 'Permet les URL dans les commentaires.']
    ]
  },
  {
    id: 'popup-timer',
    title: 'Créer un timer d’actions',
    purpose: 'Exécute une sélection d’actions à intervalle fixe.',
    fields: [
      ['Nom', 'Nom du timer.'],
      ['Timer actif', 'Démarre ou met en pause le planificateur.'],
      ['Exécuter toutes les', 'Valeur de l’intervalle.'],
      ['Unité', 'Secondes, minutes ou heures.'],
      ['Nombre d’exécutions', 'Nombre de répétitions par cycle, de 1 à 100.'],
      ['Pause entre deux exécutions', 'Délai interne au cycle, de 0 à 60 secondes.'],
      ['Actions', 'Une ou plusieurs actions, exécutées dans l’ordre affiché.']
    ]
  },
  {
    id: 'popup-regle',
    title: 'Nouveau déclencheur',
    purpose: 'Crée une règle sans ajouter immédiatement une nouvelle action.',
    fields: [
      ['Nom', 'Nom du déclencheur.'],
      ['Type', 'Événement surveillé.'],
      ['Seuil / quantité', 'Nombre minimal.'],
      ['Cadeau précis', 'Filtre facultatif pour un cadeau.'],
      ['Message contient', 'Filtre facultatif pour le chat.'],
      ['Viewer précis', 'Filtre facultatif par @.']
    ]
  },
  {
    id: 'popup-overlay',
    title: 'Configurer un overlay',
    purpose: 'L’aperçu est mis à jour pendant la saisie. Les réglages disponibles dépendent de l’overlay.',
    fields: [
      ['État', 'Affiche ou masque l’overlay sans supprimer ses réglages.'],
      ['Échelle', 'Agrandit le rendu dans la source sans changer la taille OBS.'],
      ['Décalage X / Y', 'Déplace le rendu horizontalement ou verticalement.'],
      ['Titre', 'Texte principal.'],
      ['Thème / modèle / variante', 'Design appliqué à la source.'],
      ['Valeur actuelle / cible', 'Données de départ et objectif.'],
      ['Couleurs', 'Accent, secondaire, texte, fond et états particuliers.'],
      ['Opacité', 'Transparence du panneau ou des lignes.'],
      ['Police / taille', 'Typographie des textes générés.'],
      ['Saturation / teinte', 'Correction appliquée au rendu complet.'],
      ['Éléments visibles', 'Ombre, titre, pourcentage, rang, avatars, couronne, badges ou métrique.'],
      ['Raccourcis', 'Ajout, retrait et remise à zéro pour les compteurs compatibles.']
    ]
  },
  {
    id: 'popup-roue',
    title: 'Configurer la roue d’actions',
    purpose: 'Chaque roue peut avoir son propre cadeau, design et jeu de segments.',
    fields: [
      ['Nom / état', 'Identifie et active la roue.'],
      ['Design', 'Classique ou Royale Prestige.'],
      ['Cadeau déclencheur', 'Cadeau facultatif qui lance la roue.'],
      ['Texte / couleur du segment', 'Contenu visible dans chaque case.'],
      ['Résultat du segment', 'Affichage simple, lancement d’une action ou nouvelle rotation.'],
      ['Action à lancer', 'Action exécutée si ce résultat est sélectionné.'],
      ['Orientation / rayon / angle', 'Position du texte.'],
      ['Zone / alignement / lignes', 'Dimensions et retour à la ligne.'],
      ['Ombre / espacement / lueur', 'Lisibilité du texte et effet lumineux.'],
      ['Pointeur', 'Côté sur lequel se trouve l’indicateur.'],
      ['Son / durée de rotation', 'Audio et temps exact de l’animation.'],
      ['Attente / résultat', 'Pause, visibilité et durée d’affichage du gagnant.'],
      ['Toujours visible / animations', 'Comportement au repos et transitions d’entrée/sortie.']
    ]
  },
  {
    id: 'popup-medias',
    title: 'Bibliothèque globale de médias',
    purpose: 'Sélectionne un média inclus, distant ou importé.',
    fields: [
      ['Sources', 'Bascule entre les bibliothèques disponibles.'],
      ['Recherche', 'Filtre par nom.'],
      ['Catégories', 'Image, GIF, vidéo, animation ou son selon le contexte.'],
      ['Résultats', 'Affiche l’aperçu, le nom, la source et la licence lorsqu’elle est fournie.'],
      ['Importer mon média', 'Envoie un fichier vers le stockage personnel configuré.'],
      ['Utiliser ce média', 'Valide l’élément sélectionné.']
    ]
  },
  {
    id: 'popup-profils',
    title: 'Gérer les profils',
    purpose: 'Sépare les configurations par jeu, émission ou ambiance.',
    fields: [
      ['Nouveau profil', 'Crée un espace vierge.'],
      ['Nom', 'Nom court du profil.'],
      ['Description', 'Usage prévu.'],
      ['Activer', 'Charge l’espace de travail sélectionné.'],
      ['Modifier', 'Change uniquement le nom et la description.'],
      ['Supprimer', 'Retire le profil après confirmation ; le dernier profil ne peut pas être supprimé.']
    ]
  },
  {
    id: 'popup-connexion',
    title: 'Ajouter une source',
    purpose: 'Connecte un relais WebSocket, Twitch IRC ou le mode Démo.',
    fields: [
      ['Nom', 'Nom affiché dans ShenPulse.'],
      ['Type', 'WebSocket autorisé, Twitch IRC ou Démo.'],
      ['Démarrage automatique', 'Reconnecte la source au lancement.'],
      ['URL WebSocket', 'Adresse ws:// ou wss:// du relais.'],
      ['Chaîne / utilisateur Twitch', 'Identifiants publics de la connexion IRC.'],
      ['Jeton / secret', 'Secret chiffré ; laisse vide pour conserver celui déjà enregistré.']
    ]
  },
  {
    id: 'popup-tiktok',
    title: 'Connecter TikTok LIVE',
    purpose: 'Surveille automatiquement un compte public.',
    fields: [
      ['@ du compte TikTok', 'Pseudo public, avec ou sans @.'],
      ['Détecter le LIVE', 'Enregistre le compte, lance la surveillance et se reconnecte au prochain live.']
    ]
  },
  {
    id: 'popup-jeu',
    title: 'Configurer une passerelle de jeu',
    purpose: 'Les champs dépendent du protocole déclaré par le pack.',
    fields: [
      ['Hôte', 'Adresse locale, généralement 127.0.0.1.'],
      ['Port', 'Port TCP, UDP ou RCON de la passerelle.'],
      ['URL', 'Adresse WebSocket ou HTTP lorsque ce protocole est utilisé.'],
      ['Mot de passe RCON', 'Secret du serveur Minecraft, chiffré localement.'],
      ['Interaction', 'Effet du catalogue associé à un cadeau, un coût et parfois une durée.']
    ]
  },
  {
    id: 'popup-confirmation',
    title: 'Confirmations et progressions',
    purpose: 'Ces fenêtres évitent les actions irréversibles et indiquent l’avancement.',
    fields: [
      ['Confirmation', 'Relis le titre et la cible avant Supprimer, Effacer, Régénérer ou Arrêter.'],
      ['Installation', 'Affiche détection, téléchargement, vérification, copie et sauvegarde. Ne ferme pas le jeu ou ShenPulse.'],
      ['Lancement', 'Indique la préparation de la passerelle, du serveur ou du jeu.'],
      ['Erreur', 'Conserve le message et consulte le Journal avant de recommencer.']
    ]
  }
]

export const OVERLAY_TYPES = [
  ['My Actions', 'File des actions lancées, jusqu’au nombre de lignes configuré.', '720 × 520'],
  ['Interactions en jeu', 'Interaction et viewer à l’origine de l’effet.', 'Taille indiquée sur la carte'],
  ['Like Goal', 'Progression des likes avec 14 thèmes.', '1300 × 200'],
  ['Classement donateurs', 'Top des viewers par pièces, rangs et avatars.', '520 × 640'],
  ['Classement tapoteurs', 'Top des viewers par likes.', '520 × 640'],
  ['Coin Jar', 'Bocal de pièces avec 14 modèles ; il reste vide au repos.', '720 × 520'],
  ['Timer', 'Compte à rebours standard et action à zéro.', '900 × 360'],
  ['Timer multiplicateur', 'Compte à rebours indépendant X2 à X5.', '900 × 360'],
  ['Compteur de wins', 'Victoires, objectif, couleurs négative/neutre/positive.', '720 × 520'],
  ['Wheel Actions', 'Roues multiples, segments et résultats configurables.', '800 × 900'],
  ['Match x2 / x3', 'Animations plein écran pour multiplicateurs.', '1080 × 1920'],
  ['Match Gants', 'Animation de match Gants.', '1080 × 1920'],
  ['Match Coffre', 'Animation de match Coffre.', '1080 × 1920'],
  ['Match Snipe', 'Animation de match Snipe.', '1080 × 1920'],
  ['Match TapTap', 'Animation de match TapTap.', '1080 × 1920'],
  ['Match Quiereme', 'Animation de match Quiereme.', '1080 × 1920'],
  ['Match Enigma', 'Animation Enigma dans la variante disponible.', '1080 × 1920']
]
