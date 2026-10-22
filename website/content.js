export const CLIENT_RELEASE = {
  version: '2.0.5',
  title: 'Des jeux autonomes et des overlays plus simples.',
  summary: 'Installe les packs à la demande, retrouve des conditions de jeu détaillées et configure tes overlays plus facilement.',
  highlights: [
    ['Connecte tes jeux', 'Correction de la connexion Euro Truck Simulator 2 et passerelles locales autonomes. Les conditions de jeu précisent les étapes de préparation et les commandes à configurer.'],
    ['Personnalise tes overlays', 'Roue et Coin Jar disposent de réglages plus lisibles. Les designs et les classements sont adaptés à leurs zones de texte et de photo.'],
    ['Allège ton installation', 'Les packs de jeu sont téléchargés à la demande depuis le stockage ShenPulse, avec contrôle d’intégrité. Les profils et associations existants sont conservés.']
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
      ['En direct', 'Présente les créateurs dont le partage du LIVE dans l’annuaire est actif.'],
      ['Premiers pas', 'Connecte la plateforme, choisis les interactions et prépare les sources de diffusion.']
    ],
    tips: ['Le partage dans l’annuaire est activé par défaut et peut être désactivé dans le menu du compte.', 'La barre du haut reste disponible dans tous les espaces.']
  },
  {
    id: 'vue-ensemble',
    group: 'Pilotage',
    title: 'Tableau de bord',
    summary: 'Le tableau de bord résume la session et donne accès aux commandes les plus utilisées.',
    parts: [
      ['Statistiques du LIVE', 'Viewers, likes, cadeaux, diamants et nouveaux followers du LIVE en cours, ou du dernier LIVE reçu. Les chiffres ne sont pas le cumul de toutes tes diffusions.'],
      ['Simulateur', 'Simule un cadeau, des likes, un follow, un message, un partage, un abonnement ou une arrivée. Le sélecteur de cadeau apparaît uniquement pour les cadeaux. Les actions configurées peuvent réellement être exécutées.'],
      ['Graphiques', 'Les vues Viewers et Engagement suivent les données reçues pendant le LIVE. Une information absente de la plateforme reste indisponible.'],
      ['Top Donateurs', 'Retrouve les principaux contributeurs du LIVE et ouvre Utilisateurs pour consulter leur fiche.'],
      ['Chat et événements', 'Suis les messages et les événements reçus. Le bouton Journal ouvre les informations de diagnostic.']
    ],
    tips: ['Les tests du simulateur ne modifient pas les statistiques réelles du LIVE.', 'Le nombre de diamants ne permet pas de calculer le revenu net en euros.', 'Une session de jeu et une connexion au LIVE sont deux états distincts.']
  },
  {
    id: 'utilisateurs',
    group: 'Pilotage',
    title: 'Utilisateurs',
    summary: 'Retrouve les participants et leurs contributions, avec classements, rangs et blocages.',
    parts: [
      ['Liste et filtres', 'Recherche un pseudo, choisis le streamer, le rang et le tri, puis consulte les contributions et dates d’activité.'],
      ['Fiche utilisateur', 'Consulte les informations et la progression du spectateur. Les données proviennent des événements effectivement reçus.'],
      ['Rangs ShenPulse', 'L’icône et le rang dépendent uniquement de la valeur cumulée des cadeaux. Les paliers sont propres à ShenPulse : ils ne représentent ni le niveau TikTok, ni des permissions supplémentaires.'],
      ['Conditions des rangs', 'Ouvre le guide dans Utilisateurs ou survole un rang pour connaître son palier. Les likes, messages et nouveaux abonnés ne font pas progresser ce rang.'],
      ['Utilisateurs bloqués', 'Le bouton « Utilisateurs bloqués » ouvre la liste et permet de retirer un blocage. Bloquer ne supprime pas la fiche ni ses contributions.']
    ],
    tips: ['Un blocage ShenPulse empêche les effets de ce spectateur dans l’application ; il ne bloque pas son compte sur TikTok ou Kick.', 'Le rang et son cumul sont conservés séparément par spectateur, plateforme et streamer.']
  },
  {
    id: 'actions',
    group: 'Création',
    title: 'Actions',
    summary: 'Une action décrit ce que ShenPulse doit faire. Un déclencheur précise quand elle se lance.',
    parts: [
      ['Sous-onglet Actions', 'Crée, modifie, duplique, teste ou supprime les actions du profil.'],
      ['Sous-onglet Déclencheurs', 'Associe les événements du live à une ou plusieurs actions existantes.'],
      ['Sous-onglet Timers', 'Planifie une ou plusieurs actions à intervalle régulier, avec une fréquence et des répétitions configurables.'],
      ['Simulateur du tableau de bord', 'Les événements fictifs se testent dans le tableau de bord ; les Actions conservent leurs tests manuels.'],
      ['Écrans Media', 'Fournit huit files indépendantes et huit URL de sources navigateur pour afficher images, GIF ou vidéos.']
    ],
    tips: ['Le bouton de lecture exécute réellement l’action : vérifie ses sorties avant de tester.', 'Une recherche ou un filtre ne désactive pas les actions masquées.', 'Les actions de jeu, de match ou de machine restent soumises à leurs droits d’accès.']
  },
  {
    id: 'sons',
    group: 'Création',
    title: 'Voix & sons',
    summary: 'Trois espaces : Synthèse vocale, Alertes sonores et Diffusion LIVE.',
    parts: [
      ['Bibliothèque', 'Recherche les sons inclus, écoute un aperçu local et sélectionne une piste. Les sons importés peuvent être retirés de ta bibliothèque avec confirmation, sans effacer leurs usages existants ni le fichier distant.'],
      ['Alertes sonores', 'Associe un son, un volume et un déclencheur à une règle.'],
      ['Synthèse vocale', 'Choisit une voix, une vitesse, une hauteur et un volume.'],
      ['Filtres TTS', 'Autorise ou bloque emojis, mentions, commandes et liens avant lecture.'],
      ['Importer un son', 'Ajoute ton fichier depuis le PC. Le stockage Backblaze est géré par ShenPulse pour tous les comptes connectés, sans clé personnelle à renseigner.'],
      ['Diffusion LIVE', 'Choisis une sortie locale ou un écran audio du LIVE, puis utilise l’URL correspondante dans ton logiciel de diffusion.'],
      ['Actions de ligne', 'Teste, modifie, duplique ou supprime une alerte avec les boutons directs. Une confirmation précède la suppression.']
    ],
    tips: ['Les voix proposées dépendent de celles disponibles dans Windows.', 'La préécoute reste locale. Une règle « Moi uniquement » ne transmet rien à l’URL audio ; « Tout le monde » ajoute la diffusion sur l’écran choisi.', 'Une capture séparée du son du bureau peut aussi transmettre le retour local : évite les doublons dans ton logiciel de diffusion.', 'La voix par défaut suit le profil actif ; une règle peut définir ses propres paramètres.']
  },
  {
    id: 'musique',
    group: 'Création',
    title: 'Musique',
    summary: 'Prépare la lecture musicale, les demandes de titres et les règles Spotify.',
    parts: [
      ['Lecteur', 'Consulte le titre en cours et utilise lecture, pause, précédent, suivant, position et volume lorsque l’appareil Spotify le permet.'],
      ['File d’attente', 'Gère les demandes ShenPulse avec « Lire la suivante », retirer et vider. La file native Spotify est consultable, mais ne peut pas être vidée ou modifiée titre par titre depuis cette intégration.'],
      ['Rechercher', 'Recherche un titre Spotify, puis ajoute-le aux demandes ou utilise les contrôles proposés.'],
      ['Mes playlists', 'Parcours les playlists accessibles à ton compte et leurs titres.'],
      ['Paramètres de musique', 'Active les Song Requests, règle les commandes !sr, !skip, !np et !queue, les limites, le contenu explicite et les artistes bloqués.'],
      ['Règles Spotify', 'La section repliable conserve les actions musicales associées aux événements du LIVE ; ce n’est pas un sixième sous-onglet.']
    ],
    tips: ['Autorise Spotify, ouvre-le sur un appareil contrôlable et lance un titre. Spotify Premium et la permission de piloter la lecture sont nécessaires aux commandes de lecture.', 'L’audio reste dans Spotify : ShenPulse ne le capture ni ne le redistribue.', 'Les préférences des demandes suivent le profil. Le compte Spotify, la file et l’historique restent communs aux profils du même compte ShenPulse.', 'Les résultats des commandes se consultent dans ShenPulse ; aucun message automatique n’est envoyé au chat.']
  },
  {
    id: 'overlays',
    group: 'Création',
    title: 'Overlays',
    summary: 'Les cartes d’overlay fournissent un aperçu, des réglages persistants et une URL pour le logiciel de diffusion.',
    parts: [
      ['Aperçu', 'Montre le rendu réel avec le thème, les couleurs et la taille configurés.'],
      ['Configurer', 'Ouvre les réglages de placement, contenu, design, lisibilité et visibilité.'],
      ['Copier l’URL', 'Utilise le lien fourni par la carte dans OBS ou TikTok LIVE Studio. Pour les matchs, choisis le bouton « Copier pour TikTok Studio » plutôt que de reconstruire une adresse.'],
      ['Dimensions', 'Respecte la largeur et la hauteur conseillées sur chaque carte pour éviter un étirement.'],
      ['Compteurs', 'Les raccourcis disponibles ajoutent, retirent ou réinitialisent une valeur. Réinitialiser un compteur n’est pas la même chose que supprimer sa configuration.'],
      ['Like Goal', 'S’appuie sur les mêmes likes du LIVE que le tableau de bord. Configure la cible et le comportement à l’atteinte de l’objectif.']
    ],
    tips: ['ShenPulse doit rester ouvert pour alimenter les sources.', 'Les liens protégés donnent accès à tes sources : ne les publie pas.', 'Certains widgets et les animations de match nécessitent Pro ou Premium ; l’application indique les accès disponibles.']
  },
  {
    id: 'jeux-effets',
    group: 'Création',
    title: 'Jeux vidéo',
    summary: 'La galerie rassemble uniquement les jeux actuellement publiés dans l’application.',
    parts: [
      ['Recherche et filtres', 'Trouve un jeu, un connecteur ou un effet, puis filtre par niveau d’accès.'],
      ['Fiche du jeu', 'Affiche le type d’intégration, le nombre d’interactions, les prérequis et les avertissements.'],
      ['Installation', 'Selon le jeu, suis l’assistant de détection et de téléchargement, ou les étapes manuelles indiquées sur sa fiche. Les jeux externes peuvent nécessiter une installation ou une licence séparée.'],
      ['Configuration', 'Associe cadeaux, coûts, durées, multiplicateurs et paramètres propres au jeu.'],
      ['Interactions', 'Active, teste et ordonne les effets disponibles.'],
      ['Overlays liés', 'Prépare l’image d’interactions et les compteurs utiles au gameplay.'],
      ['Session de jeu', 'Lance le jeu ou sa passerelle avec les boutons de sa fiche, puis arrête la session avant d’en ouvrir une autre.']
    ],
    tips: ['Un accès ShenPulse Pro ou Premium actif est requis ; certains modules nécessitent aussi leur achat.', 'Ferme toujours le jeu avant une installation ou une réparation.', 'Teste plusieurs effets sur une sauvegarde non critique.']
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
    tips: ['Un accès Pro ou Premium actif est requis, y compris pour les tests.', 'Les prises restent associées au compte ; les règles d’interaction appartiennent au profil.', 'Utilise uniquement des appareils et charges électriques compatibles, sans dispositif dangereux.']
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
    tips: ['Un accès Pro ou Premium actif est requis.', 'Les nouvelles commandes sont réservées par défaut aux modérateurs et au créateur du LIVE. Un viewer ordinaire ne les déclenche pas tant que l’accès n’est pas ouvert.', 'Il ne s’agit pas d’un chatbot de réponses texte : aucun service d’envoi n’est nécessaire.', 'L’aperçu est une explication locale, pas un test réel du LIVE, des connexions ou des cooldowns.']
  },
  {
    id: 'matchs',
    group: 'Création',
    title: 'Matchs',
    summary: 'Suis les matchs TikTok et prépare leurs widgets et automatisations dans le profil actif.',
    parts: [
      ['Tableau de bord', 'Détecte les manches à partir des événements de bataille TikTok reçus. Retrouve participants, scores, résultats, contributeurs et historique ; un score absent n’est pas présenté comme zéro.'],
      ['Widgets', 'Prépare compteur de manches, dernier donateur, plus gros donateur, classement des donateurs, chronomètre, animation de victoire et scores du match.'],
      ['Automatisations', 'Choisis un temps fort : début, bonus ×2/×3, reprise de tête, remontée, égalité finale, Tap Tap, dernières secondes, victoire ou défaite. Ajoute une animation, une vidéo, un son ou une action et active la règle.'],
      ['Pack Cyber', 'Six animations : Gant de boxe, x2, x3, Tap Tap, Merci pour ton cœur et Snipe. Aucun Coffre Cyber n’est proposé.'],
      ['Source Studio', 'Dans Widgets, copie la source destinée à TikTok Studio pour les animations, vidéos et sons LIVE. ShenPulse et le logiciel de diffusion doivent rester ouverts sur le même PC. Les vidéos du catalogue sont chiffrées et lues en mémoire, sans bouton d’export.'],
      ['Audio', 'Le son intégré des vidéos est activé pendant leur lecture sur la source de diffusion ; les aperçus restent muets.'],
      ['Lecture visuelle locale', 'Option Windows désactivée par défaut : choisis une fenêtre montrant le bandeau actif et ton @, puis délimite les deux zones. Les images restent en mémoire sur le PC, sans cloud ni enregistrement. Ce mode ne lit pas un téléphone et exige que la fenêtre soit visible et lisible.']
    ],
    tips: ['Un accès Pro ou Premium actif est requis.', 'La vitesse et la précision dépendent des événements transmis par TikTok. Une connexion en cours de match peut attendre le prochain événement.', 'Les cartes de match ne sont pas détectées automatiquement par toutes les connexions : vérifie l’indication affichée avant d’utiliser ce déclencheur.', 'Le chiffrement limite la copie directe, sans empêcher toute extraction experte ou capture vidéo.', 'Les tests de diffusion exécutent réellement les sorties configurées après confirmation ; ils ne modifient pas les scores ni l’historique.']
  },
  {
    id: 'abonnement',
    group: 'Système',
    title: 'Abonnement',
    summary: 'Cette page affiche l’offre courante, les accès et le renouvellement.',
    parts: [
      ['Offre actuelle', 'Indique Free, Pro ou Premium et l’état de l’accès.'],
      ['Choisir une offre', 'Compare les prix et avantages affichés dans l’application. Le bouton de souscription ouvre PayPal et le retour validé synchronise l’accès.'],
      ['Accès Premium offert', 'Le plan Premium peut attribuer un accès Pro à un autre compte selon les conditions affichées.'],
      ['Jeux achetés', 'Les droits individuels se synchronisent avec le compte ShenPulse ; certains modules restent des achats distincts de l’abonnement.'],
      ['Accès Pro', 'Jeux vidéo, Machines IRL, Commandes et Matchs nécessitent au moins Pro. Une restriction spécifique affichée dans l’application reste applicable.']
    ],
    tips: ['Effectue l’achat uniquement depuis l’application.', 'Après paiement, laisse ShenPulse terminer la synchronisation.']
  },
  {
    id: 'connexions',
    group: 'Système',
    title: 'Connexions',
    summary: 'Les connexions alimentent ShenPulse en événements ou transmettent des commandes.',
    parts: [
      ['TikTok', 'Renseigne le @ public dans la barre du haut, puis clique sur Connecter. Le bouton indique l’attente du LIVE ou permet de déconnecter la source.'],
      ['Kick', 'Configure et autorise le compte avec les commandes dédiées de la page. Les prérequis et l’état de la connexion sont affichés dans l’application.'],
      ['Démonstration', 'Génère des événements locaux pour tester sans plateforme.'],
      ['WebSocket autorisé', 'Se connecte à un relais qui émet des messages au format prévu par ShenPulse.'],
      ['Twitch IRC', 'Utilise une chaîne, un compte et, si nécessaire, un jeton.'],
      ['Démarrage automatique', 'Les sources autorisées peuvent être reconnectées au lancement. La source Démo reste manuelle et n’émet pas toute seule.']
    ],
    tips: ['N’utilise que des services et identifiants que tu es autorisé à connecter.', 'Les secrets restent dans le coffre local ; Windows fournit leur chiffrement quand cette fonction est disponible.']
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
  }
]

export const ACTION_TYPES = [
  ['Média', 'Choisit l’écran Media 1 à 8, la durée, un média obligatoire, son mode de cadrage et ses options de lecture.'],
  ['Synthèse vocale', 'Lit un texte ou une variable avec la voix, vitesse, hauteur et volume choisis.'],
  ['Son', 'Joue une piste de la bibliothèque ou un média importé, avec le volume configuré.'],
  ['Objectif', 'Ajoute une valeur à un objectif existant lorsque ce type d’action est disponible dans ton espace. Le Like Goal se règle dans Overlays.'],
  ['Minuteur', 'Ajoute ou retire du temps au timer choisi.'],
  ['Roue', 'Lance une roue précise et utilise le résultat configuré.'],
  ['Groupe d’actions', 'Exécute toutes les actions sélectionnées ou un nombre d’entre elles choisi au hasard.'],
  ['Animation Match', 'Lance une animation Match précise avec sa variante et son mode de cadrage.'],
  ['Effet de jeu', 'Envoie un effet à la passerelle du jeu sélectionné.'],
  ['Compteur WINS', 'Ajoute, retire ou remet à zéro les victoires.'],
  ['Commande OBS', 'Envoie une requête OBS WebSocket avec un type et des données JSON.'],
  ['Requête HTTP', 'Appelle une URL avec méthode, délai, en-têtes et corps JSON.'],
  ['Message WebSocket', 'Envoie un objet JSON à la connexion choisie.'],
  ['Spotify', 'Recherche, met en file, lit, met en pause, passe au titre suivant ou règle le volume.'],
  ['Prise PlugPlus', 'Commande l’appareil IRL choisi, avec l’opération et la durée autorisées. Pro ou Premium est requis.'],
  ['Raccourci clavier', 'Simule la combinaison choisie uniquement si l’autorisation locale de simulation de touches est déjà active.'],
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
      ['Type de déclencheur', 'Événement du LIVE disponible dans le formulaire : cadeau, likes, message, follow ou autre événement pris en charge.'],
      ['Seuil', 'Quantité minimale avant lancement.'],
      ['Cadeau précis', 'Recherche un cadeau du catalogue TikTok et vérifie son image, son nom et son coût. Ne confonds pas deux variantes portant un nom proche.'],
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
    purpose: 'Lit les commentaires qui respectent les filtres et les rôles autorisés. La voix peut être propre à la règle ou reprendre le défaut du profil.',
    fields: [
      ['Nom', 'Nom de la règle.'],
      ['Voix', 'Voix système utilisée.'],
      ['Vitesse', 'De 0,5 à 2.'],
      ['Hauteur', 'De 0 à 2.'],
      ['Volume', 'De 0 à 1.'],
      ['Accès et longueur', 'Choisit les rôles autorisés et la longueur maximale du commentaire.'],
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
    purpose: 'Associe un événement à une ou plusieurs actions déjà créées dans le profil actif.',
    fields: [
      ['Nom', 'Nom du déclencheur.'],
      ['Type', 'Événement surveillé.'],
      ['Seuil / quantité', 'Nombre minimal.'],
      ['Cadeau précis', 'Filtre facultatif pour un cadeau.'],
      ['Message contient', 'Filtre facultatif pour le chat.'],
      ['Viewer précis', 'Filtre facultatif par @.'],
      ['Actions à exécuter', 'Sélectionne les actions, leur mode d’exécution et, si proposé, le nombre à tirer au hasard.'],
      ['Accès et cooldowns', 'Vérifie les conditions d’accès et les délais avant de rendre le déclencheur actif.']
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
    title: 'Bibliothèque de médias et imports',
    purpose: 'Sélectionne un média du catalogue ou importe un fichier dans ta bibliothèque personnelle. Les importations sont disponibles pour tous les comptes ShenPulse connectés.',
    fields: [
      ['Sources', 'Bascule entre les bibliothèques disponibles.'],
      ['Recherche', 'Filtre par nom.'],
      ['Catégories', 'Image, GIF, vidéo, animation ou son selon le contexte.'],
      ['Résultats', 'Affiche l’aperçu, le nom, la source et la licence lorsqu’elle est fournie.'],
      ['Importer mon média', 'Choisis un son, une image, un GIF, une vidéo MP4 ou WebM selon le contexte. ShenPulse utilise le stockage Backblaze géré côté serveur ; aucune clé B2 personnelle n’est demandée.'],
      ['Validation', 'Un format non pris en charge, un fichier vide ou trop volumineux est refusé. Respecte la limite indiquée et les droits de diffusion de ton fichier.'],
      ['Utiliser ce média', 'Valide l’élément sélectionné.']
    ]
  },
  {
    id: 'popup-profils',
    title: 'Gérer les profils',
    purpose: 'Ouvre le sélecteur de profil dans la barre du haut puis sa gestion. Les profils appartiennent au compte connecté et restent enregistrés sur ce PC : ce n’est pas une synchronisation cloud entre ordinateurs.',
    fields: [
      ['Nouveau profil', 'Crée un espace vierge.'],
      ['Nom', 'Nom court du profil.'],
      ['Description', 'Usage prévu.'],
      ['Activer', 'Charge les actions, déclencheurs, commandes, timers, overlays et réglages de jeu du profil, ainsi que sa voix TTS et ses préférences de demandes musicales.'],
      ['Modifier', 'Change uniquement le nom et la description.'],
      ['Supprimer', 'Retire le profil après confirmation ; le dernier profil ne peut pas être supprimé.'],
      ['Reconnexion', 'Le même compte retrouve ses profils et son profil sélectionné sur ce PC. Un autre compte possède son propre espace.'],
      ['Données communes au compte', 'Le compte Spotify, sa file et son historique, les appareils IRL et les autorisations ne sont pas copiés dans chaque profil.']
    ]
  },
  {
    id: 'popup-connexion',
    title: 'Ajouter une source',
    purpose: 'Connecte un relais WebSocket, Twitch IRC ou le mode Démo.',
    fields: [
      ['Nom', 'Nom affiché dans ShenPulse.'],
      ['Type', 'WebSocket autorisé, Twitch IRC ou Démo.'],
      ['Démarrage automatique', 'Reconnecte la source autorisée au lancement, sauf la source Démo qui reste manuelle.'],
      ['URL WebSocket', 'Adresse ws:// ou wss:// du relais.'],
      ['Chaîne / utilisateur Twitch', 'Identifiants publics de la connexion IRC.'],
      ['Jeton / secret', 'Secret du coffre local ; laisse vide pour conserver celui déjà enregistré. Ne le copie pas dans un message de support.']
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
    id: 'popup-commande',
    title: 'Créer une commande !',
    purpose: 'Dans Commandes, clique sur « Nouvelle commande ». Les effets sont exécutés à la réception d’un message autorisé, sans publier de réponse texte.',
    fields: [
      ['Commande et alias', 'Un nom commençant par !, sans espace ; les arguments viennent après un espace. Jusqu’à huit alias peuvent être définis.'],
      ['Musique', 'Choisis une opération Spotify : lecture, pause, précédent, suivant, titre, playlist, mise en file ou volume. Les prérequis Spotify restent applicables.'],
      ['Action', 'Sélectionne une action disponible et active dans le profil courant. Une action supprimée ou désactivée ne peut pas être exécutée.'],
      ['Overlay', 'Choisis l’opération compatible d’un timer, compteur, Like Goal, Coin Jar ou d’une roue configurée dans le profil.'],
      ['Plateforme et audience', 'Choisis TikTok, Kick, Twitch ou toutes les plateformes et le public autorisé. Par défaut, la commande est réservée aux modérateurs et au créateur du LIVE.'],
      ['Cooldowns', 'Règle séparément le délai par viewer et le délai global.'],
      ['Aperçu local', 'Affiche un exemple et l’effet prévu. Aucun son, action, overlay ou message n’est réellement déclenché par cet aperçu.'],
      ['Exécutions récentes', 'Après un vrai message, consulte le résultat, le refus ou l’erreur dans le journal de Commandes.']
    ]
  },
  {
    id: 'popup-match-widget',
    title: 'Configurer un widget de match',
    purpose: 'Dans Matchs → Widgets, ouvre Configurer sur la carte souhaitée. L’enregistrement ne lance pas de test.',
    fields: [
      ['Présentation', 'Choisis titre, thème, couleurs, opacité et arrondi parmi les options du widget.'],
      ['Options propres au widget', 'Selon la carte : compteur de manches, photos, scores, messages de remerciement, alerte de fin de match ou durée d’apparition.'],
      ['Widget actif', 'Active son affichage. Les widgets sont désactivés par défaut.'],
      ['Copier la source', 'Ajoute l’URL du widget dans le logiciel de diffusion. Pour les animations dans TikTok Studio, utilise la source dédiée au transport local.'],
      ['Tester', 'Un test peut apparaître dans la scène ouverte. Vérifie la source et la confirmation avant de le lancer.']
    ]
  },
  {
    id: 'popup-match-automatisation',
    title: 'Configurer un temps fort de match',
    purpose: 'Dans Matchs → Automatisations, configure une carte ou ajoute une règle. Rien ne se lance tant qu’un effet n’a pas été choisi et activé.',
    fields: [
      ['Moment', 'Début, bonus, reprise de tête, remontée, égalité finale, Tap Tap, dernières secondes ou résultat confirmé du match.'],
      ['Seuils', 'Les règles concernées proposent seuil de likes, fenêtre de temps, retard en points ou secondes restantes.'],
      ['Animation', 'Choisis seulement une variante proposée dans la liste ; aucun Coffre Cyber n’est disponible.'],
      ['Vidéo et son', 'Ajoute un média personnel et règle sa durée, son cadrage ou son volume. Le son peut être dirigé vers la source Match ou l’écoute locale.'],
      ['Action enregistrée', 'Une règle ajoutée peut viser une action active du profil, avec ses éventuelles autorisations de jeu ou de machine IRL.'],
      ['Test sur le LIVE', 'Après confirmation, exécute réellement les sorties configurées sans fabriquer de score ou de résultat de match.']
    ]
  },
  {
    id: 'popup-cadeau',
    title: 'Choisir un cadeau TikTok',
    purpose: 'Le même sélecteur sert aux actions, aux sons, aux interactions de jeu et aux autres réglages compatibles.',
    fields: [
      ['Recherche', 'Filtre le catalogue par nom, identifiant ou nombre de pièces.'],
      ['Image et coût', 'Vérifie l’illustration et le montant pour différencier les cadeaux homonymes.'],
      ['Sélection', 'Le cadeau choisi reste lié à sa référence de catalogue ; son nom seul ne suffit pas à identifier toutes les variantes.'],
      ['Cadeau indisponible', 'Ne remplace pas au hasard un cadeau absent : vérifie sa variante avant de modifier une association existante.']
    ]
  },
  {
    id: 'popup-abonnement',
    title: 'Consulter les offres',
    purpose: 'Ouvre les offres depuis le bouton Pro lorsqu’il est affiché ou depuis Abonnement. Consulter les offres ne lance pas de paiement.',
    fields: [
      ['Offre et prix', 'Lis les accès, le tarif et les conditions effectivement affichés pour ton compte.'],
      ['Souscrire', 'Le choix d’une offre ouvre le parcours PayPal autorisé. Ne ferme pas ShenPulse avant la confirmation du retour.'],
      ['État de l’accès', 'L’offre active apparaît sous le nom du compte. Jeux vidéo, Machines IRL, Commandes et Matchs exigent Pro ou Premium.'],
      ['Renouvellement', 'Consulte les informations et les changements programmés disponibles dans Abonnement.']
    ]
  },
  {
    id: 'popup-confirmation',
    title: 'Confirmations et progressions',
    purpose: 'Ces fenêtres évitent les actions irréversibles et indiquent l’avancement.',
    fields: [
      ['Confirmation', 'Relis le titre et la cible avant Supprimer, Effacer, Régénérer ou Arrêter.'],
      ['Installation', 'Ferme le jeu avant une installation ou une réparation. Laisse ShenPulse terminer les étapes et la sauvegarde prévues par l’assistant.'],
      ['Lancement', 'Indique la préparation de la passerelle, du serveur ou du jeu.'],
      ['Erreur', 'Conserve le message et consulte le Journal avant de recommencer.']
    ]
  }
]

export const OVERLAY_TYPES = [
  ['My Actions', 'File des actions lancées, jusqu’au nombre de lignes configuré.', '720 × 520'],
  ['Interactions en jeu', 'Pro : interaction et viewer à l’origine de l’effet reçu.', 'Taille indiquée sur la carte'],
  ['Like Goal', 'Progression basée sur les mêmes likes du LIVE que le tableau de bord, avec 14 thèmes.', '1300 × 200'],
  ['Classement donateurs', 'Top des viewers par pièces, rangs et avatars.', '520 × 640'],
  ['Classement tapoteurs', 'Top des viewers par likes.', '520 × 640'],
  ['Coin Jar', 'Bocal de pièces avec 14 modèles ; il reste vide au repos.', '720 × 520'],
  ['Timer', 'Compte à rebours standard et action à zéro.', '900 × 360'],
  ['Timer multiplicateur', 'Pro : compte à rebours indépendant avec multiplicateur.', '900 × 360'],
  ['Compteur de wins', 'Pro : victoires, objectif et présentation configurable.', '720 × 520'],
  ['Wheel Actions', 'Roues multiples, segments et résultats configurables.', '800 × 900'],
  ['Match x2', 'Pro : animation multiplicateur, versions TikControl, Gladiador et Cyber.', '1080 × 1920'],
  ['Match x3', 'Pro : animation multiplicateur, versions TikControl, Gladiador et Cyber.', '1080 × 1920'],
  ['Match Gants', 'Pro : animation de gant, avec variante Cyber disponible.', '1080 × 1920'],
  ['Match Coffre', 'Pro : animation Coffre en version TikControl ou Gladiador, sans variante Cyber.', '1080 × 1920'],
  ['Match Snipe', 'Pro : animation des dernières secondes, avec variante Cyber disponible.', '1080 × 1920'],
  ['Match TapTap', 'Pro : animation de tapotages, avec variante Cyber disponible.', '1080 × 1920'],
  ['Match Cœur du jour', 'Pro : animation de remerciement, avec variante Cyber « Merci pour ton cœur ».', '1080 × 1920'],
  ['Match Enigma', 'Pro : animation Enigma en version TikControl uniquement.', '1080 × 1920'],
  ['Matchs · Compteur de manches', 'Pro : manches du duo identifié, distinctes du bilan des victoires.', 'Selon le widget'],
  ['Matchs · Dernier donateur', 'Pro : remerciement pour le dernier cadeau ou tapotage reçu.', 'Selon le widget'],
  ['Matchs · Plus gros donateur', 'Pro : premier contributeur du LIVE, selon pièces puis tapotages.', 'Selon le widget'],
  ['Matchs · Classement des donateurs', 'Pro : contributions du LIVE avec photos, pièces et likes.', 'Selon le widget'],
  ['Matchs · Chronomètre', 'Pro : temps restant, alerte snipe et série de victoires.', 'Selon le widget'],
  ['Matchs · Animation de victoire', 'Pro : rendu du résultat confirmé avec les photos et les manches.', 'Selon le widget'],
  ['Matchs · Scores', 'Pro : participants et scores transmis par TikTok.', 'Selon le widget']
]
