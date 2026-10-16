# Atelier Voix et sons

L'atelier conserve les profils, les règles, les cadeaux associés et les filtres
de modération. La correction de lecture locale distingue désormais explicitement
la préécoute privée et la diffusion sur le LIVE.

## Présentation

- La bannière photo locale `voice.webp` est conservée.
- Trois boutons natifs, utilisables au clavier, séparent **Synthèse vocale**,
  **Alertes sonores** et **Diffusion LIVE**. Un état actif explicite et des
  compteurs distincts remplacent les anciens sous-onglets.
- Des cartes compactes résument les règles actives, la voix par défaut ou
  l'écoute locale, et les règles dirigées vers les écrans audio du LIVE.
- Les règles utilisent le tableau compact partagé avec les Actions. Leurs commandes restent
  présentes : aperçu, activation, sortie, configuration, volume pour les sons,
  modification et suppression.
- Le résumé **Accès & filtres** se déplie pour consulter les rôles autorisés,
  la longueur et le filtrage des liens, commandes et mentions. **Configurer**
  ouvre toujours l'éditeur TTS existant.
- Un seul bouton général de test TTS reste affiché. Le doublon « Écouter un
  exemple » a été retiré ; les tests individuels des règles sont conservés.
- Les alertes gardent la recherche, l'import personnalisé si autorisé, et la
  création. Les compteurs résument le profil complet même pendant une recherche.
- Les huit sources navigateur restent accessibles en grand dans **Diffusion
  LIVE**, et dans un panneau dépliable sous les deux autres sections.

## Contrats conservés

`creator-voice.js` utilise les fonctions partagées `renderTtsRules`,
`renderAudioAlerts`, `renderMediaScreensPanel` et `soundRowAttributes` sans en
recopier les éditeurs ou l'exécution. Les identifiants `data-rule`, `data-id`,
`data-index` et les commandes `data-action` restent identiques.

La visibilité TTS dépend toujours de `tts.voices` et de `tts.speak`. Depuis la
version 2.0.1, l'import personnalisé est disponible pour tous les comptes
authentifiés (Free, Pro, Premium et administrateur), sans configuration Backblaze
locale. `backblaze.sounds` et `backblaze.media` ont une portée publique fixe ; les
anciennes restrictions et l'alias `maintenanceFeatures.storageSummary` ne bloquent
plus les imports. Le stockage reste géré côté serveur et les bibliothèques restent
propres à chaque compte. Le mode consultation ne montre
aucune règle privée ni URL de sortie. Les actions audio masquées continuent
d'être filtrées par `soundActionRows`.

Les réglages de TTS, le volume, le choix local/LIVE, les écrans 1 à 8, les règles
de rôle et de contenu restent enregistrés dans les structures existantes.
La refonte n'effectue aucune migration des règles ni des profils. La mise à jour
2.0.1 migre uniquement les anciennes portées de visibilité du stockage partagé.

## Architecture et coût

- `src/renderer/app/features/creator-voice.js` compose l'atelier à partir des
  panneaux communs et de petits helpers de présentation.
- `src/renderer/styles/creator-voice.css` cible uniquement l'atelier ; les listes
  d'Actions et les éditeurs globaux ne changent pas d'apparence.
- Les icônes sont des SVG locaux de la navigation. Aucune dépendance, police,
  vidéo, piste audio ou image supplémentaire n'est chargée.
- Le tableau des règles audio est récupéré une fois puis passé à la navigation
  et au contenu. Le rendu ne lance aucune requête, minuterie ou lecture.
- Le mode léger et les préférences de mouvement réduit restent compatibles.

## Écoute locale et diffusion

| Utilisation | Dans ShenPulse | Source navigateur LIVE |
| --- | --- | --- |
| Écouter un son dans la bibliothèque, l'éditeur ou le tableau | Oui | Jamais |
| Déclenchement d'une règle « Moi uniquement » | Oui | Non |
| Déclenchement d'une règle « Tout le monde » | Oui | Oui, sur l'écran choisi |

La préécoute ne nécessite aucune URL dans OBS ou TikTok LIVE Studio. Le bouton
de lecture reste privé même si la règle est réglée sur « Tout le monde ».
Pour tester la diffusion réelle, utiliser le déclencheur ou le simulateur :
ceux-ci peuvent exécuter les effets configurés sur le LIVE.

`ActionRunner.#queueAudioPlayback` partage ce routage entre sons et TTS. Les
réactions Matchs conservent leur source dédiée, sans ajouter un deuxième retour
local aux vidéos déjà sonorisées. Les réglages enregistrés restent inchangés.

`core/audio-playback.js` gère le lecteur local unique : résolution des médias
locaux, volume borné, lecture non muette, erreurs explicites et annulation des
anciennes opérations asynchrones. Fermer une préécoute, changer de profil ou de
compte empêche un ancien son de démarrer après coup. Les erreurs de média ou de
périphérique sont signalées dans ShenPulse au lieu d'être ignorées.

« Moi uniquement » signifie que ShenPulse n'envoie aucun son aux sources
navigateur. Une capture séparée du bureau ou de l'application dans Studio peut
néanmoins retransmettre ce son : l'application ne peut pas empêcher cette
capture externe. Pour éviter les doublons, ne pas capturer le retour local en
plus de l'URL audio, ni ajouter deux fois la même source.

## Vérification

`tests/creator-voice-visual.test.js` vérifie le DOM, les boutons natifs, les états
actifs, les data-attributes audio, la modération, la recherche, les huit sources,
les permissions, les états vides et l'échappement des textes. Il réutilise les
panneaux audio réels sans appeler d'API ou jouer un son.

`tests/renderer-local-audio.test.js` vérifie la lecture locale et les courses
asynchrones sans son réel. `tests/tts-action.test.js` vérifie le routage privé,
LIVE et Matchs. La validation automatisée ne remplace pas un essai volontaire
avec un périphérique audio ou une source OBS/TikTok LIVE Studio.

`node scripts/verify-local-sound-playback.js` contrôle le vrai lecteur Chromium,
avec la politique d'autoplay standard : fichier WAV sur 127.0.0.1, chemin relatif
authentifié et données audio en mémoire. L'horloge média et le signal PCM sont
mesurés, avec sortie matérielle coupée avant chargement et gain nul. L'option
`--remote-url=https://...` ajoute au maximum deux sondes de décodage distantes,
sans enregistrer les fichiers ni charger de compte utilisateur. Les sondes
MyInstants MP3 et Backblaze MP4 ont également été validées le 15 octobre 2026.

Si la lecture avance mais reste inaudible, vérifier le mixeur Windows : le
volume propre à ShenPulse peut être à zéro ou coupé indépendamment du volume
principal et de TikTok LIVE Studio. L'application ne réécrit pas ce réglage
système automatiquement ; sa modification nécessite une intervention voulue.
