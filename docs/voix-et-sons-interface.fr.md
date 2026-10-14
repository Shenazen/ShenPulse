# Atelier Voix et sons

La refonte concerne uniquement la disposition de l'interface. Elle ne change pas
les profils, les règles, les cadeaux associés, les filtres de modération ni le
moteur de lecture audio.

## Présentation

- La bannière photo locale `voice.webp` est conservée.
- Trois boutons natifs, utilisables au clavier, séparent **Synthèse vocale**,
  **Alertes sonores** et **Diffusion LIVE**. Un état actif explicite et des
  compteurs distincts remplacent les anciens sous-onglets.
- Des cartes compactes résument les règles actives, la voix par défaut ou
  l'écoute locale, et les règles dirigées vers les écrans audio du LIVE.
- Les règles utilisent une grille de cartes à deux colonnes sur les fenêtres
  larges et à une colonne sur les fenêtres plus petites. Leurs commandes restent
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

La visibilité TTS dépend toujours de `tts.voices` et de `tts.speak`. L'import
personnalisé dépend toujours de `backblaze.sounds`. Le mode consultation ne montre
aucune règle privée ni URL de sortie. Les actions audio masquées continuent
d'être filtrées par `soundActionRows`.

Les réglages de TTS, le volume, le choix local/LIVE, les écrans 1 à 8, les règles
de rôle et de contenu restent enregistrés dans les structures existantes.
La refonte n'effectue aucune migration de données.

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

## Vérification

`tests/creator-voice-visual.test.js` vérifie le DOM, les boutons natifs, les états
actifs, les data-attributes audio, la modération, la recherche, les huit sources,
les permissions, les états vides et l'échappement des textes. Il réutilise les
panneaux audio réels sans appeler d'API ou jouer un son.

La validation automatisée ne remplace pas un essai volontaire avec un périphérique
audio ou une source OBS/TikTok LIVE Studio. Aucun test sonore réel n'est réalisé
pendant cette refonte.
