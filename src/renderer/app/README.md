# Architecture du renderer

Le renderer ShenPulse utilise des scripts classiques chargés explicitement par
`src/renderer/index.html`. Ce choix conserve le comportement Electron existant
sans introduire de bundler dans l'application principale, tout en donnant une
frontière claire à chaque domaine.

## Règles de dépendance

L'ordre des balises `script` dans `index.html` est un contrat :

1. les catalogues sans état (`visibility-catalog`, `overlay-catalog`) ;
2. `core/bootstrap.js`, qui déclare les références DOM et l'état d'interface ;
3. les utilitaires et pages dans `core/` et `features/` ;
4. les éditeurs dans `editors/` ;
5. les commandes dans `actions/` ;
6. les écouteurs et le démarrage dans `core/events/`.

Un module de fonctionnalité peut lire l'état partagé du bootstrap et appeler les
utilitaires chargés avant lui. Il ne doit pas :

- redéclarer le catalogue ou les droits d'un autre domaine ;
- démarrer un service au chargement ;
- ajouter directement un nouvel écouteur global si une délégation existe déjà ;
- dépasser 800 lignes. Le test `overlay-catalog.test.js` fait respecter cette
  dernière limite.

## Répertoires

- `core/` : démarrage, navigation, rendu racine, synchronisation et événements ;
- `core/components.js` : champs HTML communs, aides accessibles et formats Intl
  réutilisés ; `field`, `overlayField` et `overlaySelect` gardent leurs interfaces
  métier et délèguent la construction du champ à ces composants ;
- `core/automation-table.js` : listes compactes des actions, déclencheurs, voix,
  sons et règles Spotify ; sélection et tri locaux sans modifier le profil.
  Les événements restent délégués dans `core/events/content.js` ;
- `features/` : une page ou une capacité utilisateur par fichier ;
- `features/media/` : sélecteurs cadeaux, médiathèque et intégration Spotify ;
- `features/overlays/` : présentation des overlays uniquement. `catalog.js`
  construit les URL et diffère les sources OBS, `placeholders.js` dessine les
  aperçus instantanés avec les médias embarqués, `cards.js` assemble les cartes
  et `editor.js` gère leur configuration ;
- `features/games/` : accès, paramètres par jeu, sources et export des overlays ;
  les exports sont séparés en `overlay-export-canvas.js` (gabarit GTA),
  `overlay-export-entries.js` (interactions), `overlay-export-dialogs.js` (choix)
  et `overlay-export.js` (orchestration du téléchargement) ;
- `editors/` : formulaires réutilisables ;
- `actions/handlers/` : commandes regroupées par domaine ;
- `actions/dispatcher.js` : précontrôles et routage, sans logique métier.

Le générateur Canvas partagé est maintenu dans `../game-overlays/`, avec des
imports ES modules explicites et son propre README. Son bundle navigateur est
généré ; il ne constitue pas une nouvelle source à modifier manuellement.

Pour ajouter une commande, l'implémenter dans le groupe approprié sous
`actions/handlers/` et ajouter son identifiant au `Set` placé en tête du même
fichier. Ne pas agrandir `handleAction`.

## Styles

`styles.css` est uniquement le point d'entrée de la cascade. Les feuilles sous
`styles/` sont chargées dans un ordre explicite et limitées à 1 200 lignes. Une
modification d'overlay doit aller dans `styles/overlay-catalog.css` ou dans une
feuille plus précise, jamais dans les fondations globales sans nécessité.

## Tests de sources

`tests/helpers/source-bundles.js` relit les scripts et imports CSS dans l'ordre
réel des pages. Les tests peuvent donc inspecter une fonction sans dépendre du
nombre de fichiers. Les nouveaux tests doivent néanmoins préférer les contrats
exécutables et les tests DOM aux recherches par expression régulière.

## Studio créateur

La navigation regroupe désormais le tableau de bord, les jeux, les
utilisateurs, les actions et règles avancées, la voix et les sons, la musique et
les contrôleurs. Les anciens liens vers les règles et les sons restent valides.
L’ancien Studio Live redirige vers le catalogue Jeux ; son doublon visuel est
supprimé. Le simulateur unique du tableau de bord conserve ses sept événements
et utilise les commandes existantes, sans modifier leurs effets.

`games/community.js` conserve le helper de catalogue communautaire pour les
consommateurs compatibles. L’accueil ne charge plus cette galerie ni ses images ;
ses raccourcis ouvrent toujours la page Jeux.
`creator-sidebar.js` rend la promotion Pro et la signature vectorielle locale,
sans bitmap lourd ni animation. La carte et le bouton supérieur utilisent le
même critère d’abonnement actif ; les essais permettent encore de s’abonner.
Le compositeur de scène n’apparaît plus dans Overlays ; les configurations et
anciennes URL de scènes restent conservées pour ne pas casser les sources OBS.

`creator-performance.js` regroupe les événements par trame et actualise seulement
les zones nécessaires du tableau de bord et des utilisateurs. Les formulaires
actifs ne sont pas reconstruits pendant le live. Le mode léger réduit les effets
visuels et la fréquence de rafraîchissement. Les préférences FR/EN et mode léger
sont propres au poste ; la traduction conserve les noms et contenus saisis.

La fenêtre masquée ou réduite suspend uniquement les comparaisons et le rendu
visuels ; les snapshots reçus, les interactions, l'audio et le TTS restent
actifs. Le signal natif `renderer-visibility` complète `visibilitychange`, car
les transports et lecteurs Electron ne sont pas ralentis en arrière-plan.
Les sources d'aperçu OBS ne sont chargées que dans la galerie visible ou un
éditeur ouvert, puis détruites hors écran ; seuls leurs petits descripteurs et
les brouillons sont conservés pour la reprise. Aucun iframe n'est préchargé à
l'accueil.

La scène composite est persistée par profil, utilise un transport unique et
fournit une URL OBS locale. Sa publication HTTPS nécessite encore le déploiement
du runtime public ; l'interface le signale. Les Matchs vidéo protégés restent
des sources séparées.

Les contrôleurs proposent l'appairage local, les mappings MIDI et le plugin
Stream Deck embarqué. Leur validation automatisée ne remplace pas un essai avec
un périphérique physique. Kick nécessite la configuration d'une application
OAuth et d'un webhook HTTPS joignable : aucune connexion fictive n'est affichée.

Les limites locales Free sont de trois actions et un profil, sans suppression
des configurations historiques dépassant ces limites. Les jeux vidéo compatibles
gratuits ne nécessitent plus Pro ; un module payant exige toujours son achat.
Les jeux communautaires inclus et les scènes composites conservent leurs droits
Pro. Les prix et abonnements distants n'ont pas été modifiés.

## Bannières ShenPulse

Les six fichiers finaux sont sauvegardés dans
`src/renderer/assets/studio/` : `actions.webp`, `dashboard.webp`, `voice.webp`,
`music.webp`, `overlays.webp` et `users.webp`. Ils font ensemble 868 004 octets.
Ils ont été adaptés avec l'outil de génération d'images intégré, puis encodés en
WebP (qualité 82), sans génération par CLI. Les originaux restent dans le dossier
Codex `generated_images/01a13478-198a-7162-956d-4b21332010a0/`.

Jeu de prompts de production :

> Use case: precise-object-edit. Asset type: panoramic application hero banner,
> 2048 × 768. Use the provided banner as the composition reference and the
> ShenPulse logo as the identity insert. Extract the artwork, with no application
> interface, buttons, text or watermark. Preserve the purple futuristic lighting,
> hooded character, pose and scene composition. Replace the original chest
> emblem with the supplied cyan/red ShenPulse heartbeat logo, integrated into
> the material and lighting. No other brand or lettering. Keep the left area
> suitable for the application's own title overlay.

Variantes : Actions (commandes et énergie), Tableau de bord (poste de pilotage),
Voix (microphone et émission vocale), Musique (écoute et équipement audio),
Overlays (régie et écrans), Utilisateurs (personnage masqué et identité ShenPulse,
avec emblème sur le masque et le torse). Ce sont des adaptations visuelles, pas
une promesse de reproduction pixel à pixel.

## Accueil ShenPulse

La route `home` ouvre l’application et précède le tableau de bord. Elle affiche
une illustration locale, des accès aux pages autorisées, trois étapes pour
préparer son live, sans galerie de jeux. Les quatre cartes de raccourcis restent
publiques selon les pages autorisées. Le bloc « En direct avec ShenPulse » combine les présences
publiques consenties de l'annuaire Firebase et les sources TikTok/Kick réellement
LIVE sur cet appareil, sans doubler un même créateur.
Il se place après les plateformes dans l’illustration d’accueil : point rouge,
nombre de lives détectés et cartes sombres à contour doré, badge LIVE,
audience actuelle, avatar et nom de plateforme. TikTok expose
`settings.tiktok.broadcaster` (propriétaire de la room) et `currentViewers`
(nombre mesuré, zéro compris, ou `null` si indisponible). La photo d’un
spectateur ou du compte ShenPulse et le total des participants ne servent jamais
de remplacement à ces données. Les métadonnées sont remises à zéro quand la
source s’arrête ; aucun polling d’audience supplémentaire n’est ajouté.
`live-directory-service.js` gère le flux Firebase, les écritures regroupées
(au plus une toutes les dix secondes) et un heartbeat de trente secondes.
Les présences expirent après quatre-vingt-dix secondes. Publier sa présence est
désactivé par défaut et nécessite un compte authentifié et un choix explicite.
Seuls le @ public, la photo HTTPS, la plateforme et l'audience disponible sont
affichés : pas d'e-mail, de jeton ni d'identité de spectateur. Aucun nombre
d'audience fictif n'est publié. Le bloc se synchronise
indépendamment : les événements du live ne reconstruisent pas l’accueil. Les sections secondaires
chargent leurs images à la demande ; aucun média animé ou service n’est ajouté.

Les retouches de présentation (photos du dashboard et des utilisateurs, cartes
d’accueil, espaces IRL et Abonnement, sous-navigation Musique) sont documentées
dans [Retouches visuelles](../../../docs/retouches-visuelles.fr.md). Elles réutilisent
les illustrations WebP et les commandes existantes, sans nouveau service.

Visuel final : `src/renderer/assets/studio/home.webp` (1672 × 941, 125 660 octets).
Il a été créé avec la génération d’images intégrée, en utilisant uniquement le
logo ShenPulse comme référence, puis encodé en WebP qualité 82/effort 6.
L’original PNG est conservé dans
`C:/Users/alexa/.codex/generated_images/01a134a4-802f-7ba0-a2d0-0c8c1a2a5cc3/exec-cf33afde-96c1-4759-b36c-ccf4ee77a948.png`.
La sortie native est conservée sans agrandissement malgré les dimensions
2048 × 1152 demandées. Les sept illustrations font ensemble 993 664 octets.

Prompt exact de génération (mode intégré, sans CLI) :

> Use case: stylized-concept. Asset type: ShenPulse desktop application welcome hero, panoramic 2048 x 1152. Primary request: cinematic immersive interactive livestreaming studio illustration. Input image: supplied ShenPulse cyan/red heartbeat monogram, exact brand insert only. Scene: a creator seen from behind sitting in a gaming chair on the right half, headset, microphone arm and three large monitors showing colorful fantasy game worlds, neon gift diamonds and hearts floating above screens, violet/cyan LED-lit streaming room. The chair back prominently bears the provided ShenPulse monogram, accurate cyan/red shape. Composition: wide cinematic scene; left 45 percent is very dark navy-purple with subtle blurred lighting and clean negative space for the application heading; the creator, bright monitors and gifts occupy the right half. Style: polished high-end 3D concept art, violet neon bloom, deep contrast, cyan and restrained red brand accents. Text: none. Constraints: no words, no third-party branding, no interface chrome, no buttons, no fake dashboards, no watermark; only the supplied ShenPulse logo. Keep the whole chair emblem within the central vertical 70 percent so the hero can crop responsively.

## Barre créateur et offres

`creator-topbar.js` place la barre de titre à droite de la colonne de navigation,
qui conserve le logo et le slogan jusqu’en haut de l’application. Le badge LIVE
se place immédiatement après le champ TikTok. Aucune page n’ajoute d’en-tête
global redondant ; le nom de la page reste le libellé accessible du contenu.
Le slogan est centré sous le logo. Les commandes du jeu actif restent dans la
barre supérieure, et l’ancien bouton de durée de session est masqué.
Le module déplace les contrôles existants sans recréer les profils ni leurs gestionnaires.
Le compte est présenté en haut à droite, avec photo HTTPS (ou initiales de secours),
nom et badge d’accès. L’adresse e-mail reste dans le menu du compte.
La barre tient sur 64 pixels aux largeurs desktop ; ses contrôles ont une
hauteur réduite et l’éclair Pro est un SVG local. Le bouton d’offre affiche
`Pro - 9,99 €` à partir du tarif Pro existant ; il reste visible pendant l’essai
et disparaît pour les accès Pro/Premium actifs hors essai (siège offert compris).
Le menu du compte conserve l’accès aux offres et contient désormais les mêmes
commandes de langue et de mode léger, sans changer leurs gestionnaires.

Le champ TikTok conserve son brouillon pendant les mises à jour du live et ne
sauvegarde rien à la frappe ou à la perte de focus. Le clic sur Connecter ou Entrée
normalise le nom, appelle `saveTikTok` uniquement si nécessaire, puis `startTikTok`.
Le champ est verrouillé pendant la surveillance et l’opération en cours ; l’attente
du live reste annulable. Déconnecter persiste `autoConnect=false` et
`source_tiktok.enabled=false`, sans arrêter la session, ses compteurs ou Kick.
Reconnecter réactive explicitement ces deux réglages.

`membership-popup.js` crée le dialogue de comparaison à la demande. Il réutilise
les offres Free, Pro et Premium, les tarifs et les actions de paiement existants.
Aucune offre annuelle ni droit commercial supplémentaire n’est inventé. Un invité
peut consulter les offres, mais leur choix ouvre la connexion. Fermer, Échap,
retour du focus, traductions et annulation d’un checkout restent pris en charge.

## Illustration des trois étapes

Le visuel `src/renderer/assets/studio/home-steps.webp` est une image statique
locale de 1800 × 600, 41 090 octets, créée avec l’outil de génération d’image
intégré (pas de génération CLI). L’encodage WebP réduit le coût de chargement ;
aucune vidéo, animation canvas ou requête réseau de présence n’est ajoutée.
L’original reste dans le dossier Codex `generated_images`.

Prompt exact de génération :

> Use case: stylized-concept. Asset type: static background illustration for the 'How it works' three-step section of the ShenPulse livestream desktop app. Primary request: a polished cinematic abstract ribbon of luminous violet, purple, magenta and cyan energy particles flowing horizontally across the upper part of a deep near-black navy background. Wide panoramic composition, approximately 3:1. A delicate thin neon wave starts on the left edge and crosses the upper quarter, branching into a rich but refined sparkling cloud on the upper right, luminous threads, tiny crystalline points and volumetric trails. The bottom two thirds stay almost black, calm and spacious so real HTML headings and three columns can be placed over it. Premium interactive streaming aesthetic matching the user's reference section, not a screenshot or UI mockup. Very crisp high-quality light detail with restrained bloom. No text, no letters, no logos, no icons, no people, no watermark, no borders. Still image only.

## Atelier audio et Commandes

`creator-voice.js` réutilise les cartes, éditeurs et sorties du module audio :
la refonte ne duplique aucun gestionnaire de lecture. Son style est isolé dans
`styles/creator-voice.css` et sa navigation regroupe trois sections.

La route historique `commands` ouvre `renderCreatorChatbot()` sous le nom
**Commandes**, avec les mêmes droits de navigation. Le contrat pur
`shared/command-execution.js` doit précéder `shared/chatbot-command.js` ; le
module de champs `features/chatbot/execution.js` précède `creator-chatbot.js`,
puis `features/chatbot/editor.js` ; le
gestionnaire `actions/handlers/creator-chatbot.js` est chargé après le registre
commun des actions. Les commandes, auto-réponses et timers restent dans la
collection `state.commands` du profil actif.

L'éditeur propose uniquement des effets Musique, Action et Overlay. Une cible
`execution` est requise pour une commande créée ou modifiée depuis l'interface ;
les effets sont exécutés par le moteur principal à la réception du commentaire,
sans service d'envoi. Les anciennes réponses, auto-réponses et messages
programmés sont conservés dans les données, mais masqués et non exécutés.
Les brouillons par type/opération et les références manquantes sont conservés.
Un aperçu reste descriptif, jamais exécutable. La route apparaît après
Interactions IRL et ne sépare plus les deux outils audio dans la navigation.

`syncCreatorChatbotRuntime()` actualise uniquement la liste lors du CRUD
des commandes. `syncCreatorChatbotActivity()` actualise le petit journal des
exécutions à partir des patches runtime, sans reconstruire la bannière ni les
cartes. Le cache de page compare les définitions et références d'effets, pas
les capacités d'envoi ni les variations d'audience. La mise en veille visuelle
conserve les données et reprend le dernier
journal visible au retour. Les aperçus ne déclenchent jamais le moteur LIVE.

Le contrat des effets et les gardes de profil sont décrits dans
`docs/architecture/commandes-execution.md` et `docs/commandes-runtime.md`.
Les limites de transport et les tests historiques sont décrits dans `docs/chatbot.fr.md`,
`docs/chatbot-moteur.fr.md`, `docs/voix-et-sons-interface.fr.md` et
`docs/voix-chatbot-verification.fr.md` à la racine du dépôt.
