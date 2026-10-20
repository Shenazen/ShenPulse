# Page Matchs : présentation et modèles par temps fort

Modification locale du 16 octobre 2026, sans publication de version.

- Bannière originale dédiée à Matchs, onglets centrés, guide en trois étapes.
- Le lien commun des animations se trouve uniquement dans Automatisations.
  Les sept widgets d'information conservent leurs propres sources et réglages.
- Chaque sélecteur propose « Aucun » puis les packs réellement livrés pour
  son temps fort : TikControl, Gladiator et Cyber lorsque disponible.
  Début → Coffre ; ×2 → ×2 ; ×3 → ×3 ; carte → Gant ; Tap Tap → Tap Tap ;
  Snipe → Snipe. Aucun clip n'est inventé pour un moment sans vidéo dédiée.
- Les médias personnels, sons et actions liés restent disponibles. Les
  réglages existants incompatibles sont signalés, sans être effacés au rendu.
- Un aperçu local protégé permet de regarder le modèle, sans son ni diffusion
  LIVE. Il ne remplace pas le bouton distinct de test réel, avec confirmation.
- La détection des bonus, le suivi du match et les transports du LIVE ne sont
  pas modifiés par cette refonte d'interface.

## Visuel et proportions

Fichier intégré : `src/renderer/assets/studio/matches-arena-v1.png`.
Dimensions : 2172 × 724 pixels. Le conteneur utilise `object-fit: cover`
et garde le centre de l'illustration : un recadrage vertical est possible,
mais l'image n'est jamais étirée. Le titre accessible reste du texte HTML.

Visuel créé avec le mode intégré du skill `imagegen`, sans appel CLI/API
externe ni modification de la capture SyncLive. L'original généré est conservé.

### Prompt final

> Use case: stylized-concept. Asset type: original wide hero banner for the Matchs page of the ShenPulse Windows livestream app. Create a polished cinematic 3D illustration in an ultra-wide approximately 3:1 landscape composition, a live battle arena at night with two sculptural boxing gloves facing one another above a centered gold crown, violet and magenta neon energy and subtle cyan accents. Floating gold coins, faceted violet crystals, a few roses and wrapped gifts around the outer edges evoke livestream community gifts. Dark midnight-purple backdrop with glossy lighting and depth. The sole text is 'MATCHS' (M A T C H S), large legible metallic silver-violet 3D lettering centered in front of the arena. Keep every letter and the crown entirely within the central safe area with generous upper/lower margin, so the image can sit inside a broad rounded rectangular page header without stretching or losing its title. Match the energetic purple battle mood of the user's reference, but make an original distinct composition. No SyncLive logo, no third-party branding, no UI controls, no URL, no watermark, no extra text.

## Vérification visuelle isolée

`electron scripts/capture-public-site.js --matches-redesign` produit des
captures du vrai renderer, uniquement avec des données fictives, dans
`tmp/matches-page-review-20261016`. L'option `--narrow` vérifie aussi le
format étroit. Ce mode n'écrit aucune capture ni aucun manifeste du site Web.
Les écritures utilisateur, effets, contrôles, lectures audio et appels réseau
réels restent interdits par la fixture.

Validation : lint réussi et 2 554 tests réussis. Six captures du renderer à
1440 × 900 et 980 × 900 pixels ont été contrôlées, sans débordement horizontal,
image manquante, mutation ni appel réseau réel. Le smoke natif isolé
`verify-animated-match-preview.js` confirme la progression des images et des
compteurs de lecture pour les vidéos TikControl et Cyber, toujours muettes,
avec ticket protégé et zéro connexion SSE. Le refus sans Pro et le poster
statique sans ticket sont également vérifiés. Aucun test n'est diffusé sur
le LIVE de l'utilisateur. Le paquet local vérifié contient 1 838 sources et
21 vidéos protégées, sans vidéo brute ni fichier privé décompressé.
