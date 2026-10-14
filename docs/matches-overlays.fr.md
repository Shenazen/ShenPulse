# Sources navigateur des Matchs : HTTPS et locales

Les six widgets de la page Matchs et le tableau des scores complémentaire
possèdent des sources navigateur HTTPS sur `shenpulse-overlays.web.app`, à
copier depuis Matchs. Ils ne sont pas dupliqués dans la galerie Overlays.
Les sources locales restent disponibles en interne, sans remplacement
silencieux d'une URL publique manquante par `127.0.0.1`.

| Clé de source | Widget | Données utilisées |
| --- | --- | --- |
| `matchesWins` | Compteur de manches | Duo réellement identifié, manches de cette paire, scores ; compteur manuel hors duo |
| `matchesStarDonor` | Donateur vedette | Dernière contribution réelle : cadeau ou likes, message de remerciement personnalisé |
| `matchesTopDonor` | Plus gros donateur | Cadeaux cumulés pendant le LIVE actuel |
| `matchesDonors` | Classement des donateurs | Cinq premiers contributeurs du LIVE, photo publique, pièces et likes |
| `matchesTimer` | Chronomètre | Heure de fin réelle du match, série de victoires et repère Snipe configurable |
| `matchesVictory` | Victoire | Résultat gagnant confirmé, photo du créateur et manches de sa paire |
| `matchesScoreboard` | Scores complémentaires | Participants et scores disponibles, sans inventer les scores manquants |

Les liens à copier figurent dans `snapshot.overlayUrls`. Ils utilisent
`/m/<numéro de compte>/<canal Match opaque>?widget=<clé>` ; le lecteur
d'animations utilise le même chemin sans paramètre `widget`. La régénération
de la source Match révoque donc aussi les sept sources de widgets.
Chaque widget utilise un canevas de 1080 × 540 pixels, avec un fond transparent
configurable. Le catalogue conserve ses routes locales
`view=match-widget&widget=...`, `requiresPro:true` et `public:false` : une URL
publique générique `channel=...` ne contourne pas le canal Match dédié.

Les alias HTTPS chargent leurs scripts, styles et polices à la racine du site,
pas sous `/m/...`. Le serveur local conserve `/overlay/` et les aperçus fichier
leurs chemins relatifs. `index.html`, le loader et `runtime-version.json`
partagent une version de cache ; une modification du runtime exige une
publication Firebase Hosting, sans déployer les règles RTDB inchangées.

## Droits et isolation

Le document, le bootstrap et l'abonnement SSE exigent un compte ShenPulse
réellement authentifié, Pro actif et l'accès à `navigation.matches`.
`preview=static`, `preview=animated`, `/api/state` et une intégration dans
une scène ne contournent pas ces contrôles.

Les droits sont relus avant chaque publication et par le contrôle périodique
existant. Expiration, déconnexion, restriction de visibilité, changement de
compte ou de profil actualisent ou révoquent la source ouverte.
`access-revoked` arrête son timer et masque son contenu local. `match-state`
reste réservé au SSE local : ni les WebSockets ni le relais général ne le
reçoivent. Sans client local, cette publication n'effectue aucune lecture.

Le relais Firebase publie séparément la projection sûre dans l'alias Match
existant, sous `state.matches`. `matchSource.widgetsEnabled` exige un compte
authentifié, Pro actif et la visibilité de Matchs. Aucun accès au port local
ni au canal des autres overlays n'est nécessaire pour les widgets HTTPS.
L'expiration des droits, une déconnexion du compte ou l'arrêt normal effacent
les données de l'alias. Le navigateur masque et vide son widget lors d'une
révocation ou coupure ; un unique délai de 120 secondes borne aussi une
présence périmée en cas d'arrêt brutal. Un ancien cache ne rétablit pas les droits.

Les scores, réglages et effets ont leur file de publication dédiée, regroupée
sur 8 ms, indépendante des écritures lentes du relais général. Un état identique
n'entraîne pas de PATCH supplémentaire. Les heartbeats de 45 secondes
rafraîchissent uniquement la présence si les données n'ont pas changé.
Le patch runtime de l'application conserve `matchSession` : le tableau de
bord n'attend plus un snapshot complet pour afficher les événements reçus.
Ces délais sont ceux de ShenPulse, pas une garantie de délai de TikTok ou du réseau.

Les canaux `match`, `match-media` et `match-audio` sont des événements éphémères
de l'alias, jamais du relais général. À l'ouverture d'une source, un ancien lot
n'est pas rejoué. Les effets vieux de plus de 15 secondes sont ignorés et les
permissions sont relues avant les reprises d'authentification et d'envoi.
Le lecteur sans `widget` affiche les automatisations ; les liens `?widget=...`
affichent seulement leurs compteurs, dons, scores ou chrono.

Le mode compatible utilise uniquement le poster HTTPS de l'animation choisie
et une animation CSS finie, sans vidéo premium publiée ni nouveau service.
Voir [Lecture publique des Matchs](matches-lecture-publique.fr.md).
Le conditionnement chiffré, le pack Cyber et les limites de protection locale
sont décrits dans [Médias Matchs protégés](matches-medias-proteges.fr.md).

## Projection et données réelles

`src/main/matches-overlay-state.js` lit des chemins explicites, jamais tout
le compte : configuration visuelle et champs publics utiles de `matchSession`.
UID, identifiants techniques des participants, room/battle ID, scope,
historique, paires privées, automatismes, actions, appareils et secrets sont
exclus. Le résultat est `{ config:{widgets}, session:... }` ; le bootstrap
l'encapsule dans `{ matches:... }`.

Le moteur utilise `running`/`finished` et `startedAtMs`/`endsAtMs` à plat.
La projection les transforme en `active`/`ended` et
`timing.startsAtMs`/`timing.endsAtMs`. Le second passage de sécurisation SSE
conserve exactement ce format, le résultat et les compteurs. Manches inconnues
et scores absents restent `null`, rendus par « — ». Les corrections manuelles
ne réécrivent pas les statistiques du LIVE.

Les contributeurs LIVE sont bornés à 200, les participants à 16 et leurs
donateurs à 10. Le widget de classement montre seulement les cinq premiers ;
la page Matchs conserve la liste complète bornée. Les avatars viennent
uniquement de CDN publics TikTok/ByteDance ou Kick autorisés en HTTPS, sans
identifiants ni port personnalisé. Sinon, les initiales restent affichées.
Noms, cadeaux, messages et textes personnalisés passent par `textContent`,
jamais par du HTML. Les couleurs sont limitées aux valeurs hexadécimales.

## Présentation et coût

Les thèmes `classic`, `neon`, `gold`, `minimal`, couleurs, titre, opacité de
fond, rayon et animations d'entrée finies sont pris en charge. Aucun nouveau
média, vidéo, animation permanente ou bibliothèque lourde n'est ajouté.

Le compteur peut montrer les scores et remplacer temporairement la photo du
créateur par celle du dernier donateur (6 secondes par défaut, délai réglable).
Le chrono peut montrer la série de victoires et le repère Snipe (30 secondes
par défaut, entre 1 et 120). La victoire apparaît seulement après un vrai
résultat gagnant et disparaît après le délai configuré (5 secondes par défaut,
entre 1 et 15).

Tester ajoute un marqueur **APERÇU** pendant cinq secondes. Le widget peut
alors être visible malgré sa désactivation, mais reprend seulement les vraies
données ou « — » : aucun spectateur, score, cadeau ou victoire n'est fabriqué.
Un marqueur expiré ou anormalement éloigné est ignoré. Les vrais compteurs et
historiques restent intacts.

Le module et sa feuille de styles sont chargés uniquement pour `match-widget`.
Un payload identique ou une donnée étrangère au widget ne reconstruit pas son
DOM. Un seul timer d'une seconde existe lorsqu'un chrono, un aperçu ou une
disparition temporaire le nécessite ; il s'arrête sinon.

## Vérifications

`tests/matches-overlay.test.js` couvre les routes locales, la projection privée, les droits HTTP
et SSE, tentatives de contournement, expiration, vrais DOM, avatars, insertion
de texte, délais et absence de démo automatique. Un test traverse réellement
l'adaptateur SDK, `MatchesService`, la projection et les widgets pour vérifier
manches manuelles, match actif, chrono, contribution LIVE et victoire.
Le second passage SSE est comparé intégralement au premier résultat.
`tests/matches-public-relay.test.js` couvre les URLs HTTPS, le canal dédié,
les droits, la projection, la coalescence, la révocation et l'isolation du
relais général. `tests/matches-public-runtime.test.js` exécute le vrai moteur
DOM : scores, chrono, dons, aperçu réel, null Firebase, reconnexion, présence
périmée, bail et timers. `tests/overlay-source-paths.test.js` vérifie les chemins
réels des assets sur les alias HTTPS, le serveur local et les aperçus fichier.
Ces contrôles simulés ne modifient aucun LIVE, appareil, compte, abonnement
ou donnée utilisateur et n'effectuent aucune publication réseau.
