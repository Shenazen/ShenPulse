# Son des vidéos Matchs

## Cause du silence

Les 21 vidéos du catalogue possèdent une piste Opus. Leur chiffrement et le
service de tickets conservent les octets originaux, y compris le son. Le silence
provenait du lecteur : les animations et les vidéos personnelles étaient
systématiquement mises en sourdine pour privilégier leur démarrage automatique.
Un son de bibliothèque optionnel ne remplace pas la piste intégrée à la vidéo.

## Règles de lecture

- Source Match du LIVE et vidéos personnelles : piste intégrée activée par
  défaut, volume 100 %, une seule lecture de la vidéo et de son son.
- Aperçu de catalogue, statique ou animé : toujours muet ; aucune diffusion
  sonore pendant la navigation dans ShenPulse.
- Source au repos : aucun média joué, aucun son et aucun test automatique.
- Les sons de bibliothèque restent indépendants, avec leur volume et leur
  destination LIVE/ordinateur existants. Aucune automatisation enregistrée
  n'est modifiée par cette correction.
- Une source peut volontairement utiliser `soundEnabled=false` ou un
  `soundVolume` compris entre 0 et 100. Ces paramètres n'accordent aucun accès
  supplémentaire aux vidéos : compte, droits Pro, visibilité et tickets
  demeurent nécessaires selon le type de source.

## Refus d'autoplay sonore

Le lecteur respecte la politique du navigateur. Si celui-ci refuse uniquement
le démarrage avec son (`NotAllowedError`), la vidéo peut continuer en mode muet,
avec un bouton explicite **Activer le son** et un diagnostic distinct. Ce n'est
pas considéré comme une réussite sonore. Un clic dans la source déclenche
immédiatement la tentative sonore des vidéos encore actives, sans rejouer une
ancienne réaction ni contourner une permission du navigateur.

Une autre erreur de lecture conserve le diagnostic d'échec existant. Arrêt,
changement de vidéo ou révocation annulent aussi les tentatives sonores tardives
et retirent le bouton devenu inutile. Aucun polling sonore n'est lancé au repos.

Dans TikTok Studio, la source « Lien » doit aussi avoir sa diffusion audio
activée et son volume non nul dans le mélangeur. ShenPulse ne peut pas modifier
un réglage sonore que Studio applique après la lecture du navigateur.

## Fichiers et contrôles

- `resources/overlays/runtime/widgets/match-audio.js` : lecture sonore partagée
  et activation après geste utilisateur, réutilisées par les deux lecteurs.
- `match.js` : animations du catalogue et sources individuelles.
- `match-reactions.js` : vidéos personnelles ; piste de bibliothèque séparée.
- `match-preview.js` : posters et chargement protégé, aperçus muets.
- Les chargeurs canonique et historique chargent le même module audio.
- `tests/matches-video-audio.test.js` exerce le vrai helper et ses annulations.
- `tests/matches-public-playback.test.js` couvre les vrais lecteurs/transport.
- `scripts/verify-match-video-audio.js` mesure le signal PCM réellement décodé
  de x2 Cyber et Coffre Gladiador sur un serveur artificiel.

Le smoke sonore isole son profil Chromium, bloque les requêtes externes et
neutralise la sortie matérielle **avant** tout chargement. Il utilise également
un gain nul après l'analyse PCM. Aucun son n'est envoyé au PC ou au LIVE réel.
Son autorisation d'autoplay ne concerne que le processus de test, jamais les
préférences du navigateur ou de Studio de l'utilisateur.

Le smoke visuel historique utilise explicitement `soundEnabled=false`.
Les paquets conservent la protection décrite dans
[Médias Matchs protégés](matches-medias-proteges.fr.md).

## Vérification du 14 octobre 2026

- 14 tests du helper sonore réussis ; test d'intégration supplémentaire contre
  une reprise après `pagehide`, ainsi que vidéos personnelles non muettes.
- Suite complète réussie et lint de 650 fichiers JavaScript/965 sources.
- Smoke sonore isolé : x2 Cyber et Coffre Gladiador présentent un signal PCM
  non nul, des octets audio décodés en augmentation et une vidéo progressive ;
  volume du lecteur 100 %, attribut/propriété muets retirés. Sortie matérielle
  coupée et gain final nul : aucun son réellement diffusé lors du test.
- Paquet installé audité : 1 799 sources/ressources conformes, 21 vidéos
  protégées identiques aux originaux, aucune WebM/MP4 en clair.
- Runtime local et source Hosting existante : `1.0.16-overlay11`.
- Redémarrage autorisé ; profils, règles, commandes, médias, réglages Matchs et
  capacités de source préservés. Aucun test envoyé au LIVE.

Ce contrôle valide le décodage et le lecteur ShenPulse. Il ne constitue pas
un test du mélangeur ou de la diffusion sonore de TikTok Studio en conditions
réelles ; un éventuel volume coupé dans Studio reste à contrôler séparément.
