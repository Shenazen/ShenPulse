# Voix & sons et ChatBot — intégration locale

> Bilan historique : l'atelier audio reste disponible, mais ChatBot a été remplacé
> par Commandes, sans auto-réponses, réponses texte ni messages programmés.
> Les données historiques sont conservées. Voir [la version actuelle](commandes-runtime.md).

## Modifications

- Atelier audio organisé en Synthèse vocale, Alertes sonores et Diffusion LIVE.
- Nouvelle présentation ChatBot : commandes, auto-réponses et timers, avec leurs éditeurs réutilisables.
- Collection et route historiques `commands` conservées : aucune migration destructive des profils ou des droits.
- Journal privé limité aux six dernières réponses du profil, actualisé séparément de la bannière et des cartes.
- Aperçus calculés localement par le même contrat pur que le moteur ; aucun envoi, simulation LIVE ou action matérielle.

La connexion TikTok directe actuelle reçoit les commentaires mais ne possède pas de transport d’envoi : réponses locales explicitement « non envoyées », timers indisponibles. L’envoi réel utilise uniquement une connexion compatible et autorisée. Aucun nouveau flux d’authentification TikTok n’est simulé.

## Illustration

Fichier final : `src/renderer/assets/studio/chatbot.webp`, 2 048 × 768, 148 004 octets. Création avec l’outil intégré de génération d’images, puis encodage WebP local ; aucun service d’images n’est appelé par l’application. L’image conserve exclusivement la marque ShenPulse.

Mode : outil intégré (pas de CLI ni de clé API).

Prompt final exact :

```text
Use case: precise-object-edit. Asset type: panoramic ShenPulse ChatBot header illustration, 2048 x 768, matching the existing app banners. Input images: Image 1 (users.webp) is the edit target; Image 2 is a supporting brand reference, use only its cyan and red heartbeat monogram, not its wordmark or square background. Primary request: change ONLY the two floating server objects held beside the hooded futuristic character in Image 1 into elegant transparent holographic chat panels with abstract chat bubbles. Preserve the exact composition, figure, pose, hands, camera, near-black negative space in the left 35 percent, dark sci-fi backdrop, purple-magenta lighting, and cyan/red ShenPulse monogram on mask and chest. Chat panels should have subtle neon violet and cyan edges and abstract empty message bubbles, no legible writing. The right side carries the character; the left stays very dark and calm for HTML title overlay. Premium gaming illustration, crisp clean details, controlled glow. Constraints: no printed title, no UI buttons, no readable text, no usernames, no watermark, no third-party logos, no additional people. Preserve brand identity and all untouched parts of Image 1.
```

## Vérification

Les tests de contrat et d’interface utilisent des données temporaires ou simulées. Aucun message n’a été envoyé au chat, aucun son joué et aucun profil utilisateur modifié pour les vérifications.

Validation finale locale du 13 octobre 2026 :

- `npm run verify` : 1 202 tests réussis, zéro échec ; syntaxe de 556 fichiers JavaScript et 867 sources inventoriées validée, aucun cycle d’import.
- `npm run build:dir`, puis recompilation locale finale après les régressions de timers historiques : réussies. Aucune release Store/EXE publique ni publication du site.
- 24 fichiers de code, styles et illustration comparés octet par octet avec leur contenu dans `dist/win-unpacked/resources/app.asar` : tous identiques.
- Application native relancée ; les trois sections audio, le nouvel onglet ChatBot, sa bannière et l’éditeur de commande ont été inspectés. Éditeur refermé sans sauvegarde, aucun réglage audio ni contenu de profil modifié.
- Une règle audio seule occupe toute la largeur ; les alertes multiples conservent leur grille responsive.
- Les anciens timers avec réponses de plus de 500 caractères, multilignes et/ou espaces périphériques restent modifiables sans conversion destructive ; les nouvelles réponses gardent leurs limites.

Les journaux locaux de contrôle sont dans `release/voix-chatbot-verification.log`, `release/voix-chatbot-build.log`, `release/voix-chatbot-repack.log` et `release/voix-chatbot-architecture.log`. Aucun gain chiffré CPU/RAM n’est revendiqué : cette intervention évite les reconstructions de page sur les statistiques d’audience, limite le journal et utilise un ordonnanceur partagé uniquement quand nécessaire, mais ne constitue pas un benchmark comparatif.

## Visibilité partagée Firebase

L’ancienne configuration masquait explicitement `navigation.commands`. Après accord de l’utilisateur pour **tous les utilisateurs**, la session Firebase existante du propriétaire vérifié a servi à publier un PATCH atomique limité aux deux feuilles :

```json
{
  "adminSettings/navigation/commands/scope": "public",
  "publicVisibility/navigation/commands/scope": "public"
}
```

Les deux configurations ont été relues après publication et comparées intégralement, hors de ces deux feuilles : aucun autre réglage n’a changé. Les contrôles d’accès restent en place ; la route n’a pas été renommée pour contourner une restriction. L’onglet est maintenant visible dans l’application réelle après redémarrage. Les autres clients récupèrent cette configuration par leur mécanisme habituel ; le nouveau code n’est pas distribué aux anciennes installations sans release.

Le script `scripts/maintenance/publish-chatbot-visibility.js` est une maintenance explicite, non exécutée au démarrage. Il requiert Electron, un dossier de session absolu et `--apply` pour toute publication. ShenPulse doit être fermé : une éventuelle rotation du jeton de session est conservée via le coffre chiffré existant. Il ne lance aucune authentification interactive, ne migre aucun workspace et n’affiche jamais de jeton. En cas d’interruption réseau lors du PATCH, relire les deux feuilles avant de conclure à un échec. Ses diagnostics sont limités à l’étape et à une catégorie d’erreur, jamais à une URL authentifiée.

Voir aussi `chatbot.fr.md` et `voix-et-sons-interface.fr.md`.
