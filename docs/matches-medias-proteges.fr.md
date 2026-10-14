# Médias Matchs protégés et pack Cyber

## Objectif et limite de protection

Les vidéos du catalogue Matchs sont distribuées chiffrées dans l'application,
sans lien d'export, chemin de fichier vidéo à copier ni WebM en clair livré
dans le paquet. Leur lecture conserve le pont local déjà utilisé par TikTok
Studio : aucun stockage vidéo distant ni nouveau service payant n'est ajouté.

Cette mesure empêche la récupération simple d'une vidéo depuis les fichiers
installés ou un bouton ShenPulse. Ce n'est pas un DRM inviolable : la clé et le
déchiffrement restent côté client. Une personne contrôlant son PC peut analyser
l'application, intercepter une lecture autorisée ou enregistrer le rendu vidéo.
Il ne faut donc jamais promettre une impossibilité absolue de copie.

## Import des six vidéos Cyber

Le catalogue contient désormais **21 vidéos réelles** : les 15 vidéos historiques
et les six sources Cyber fournies. Les nouvelles sources sont importées sans
recompression ; leurs empreintes SHA-256 sont vérifiées par le test dédié.

| Source fournie | Ressource de développement | Sélection affichée |
| --- | --- | --- |
| `02_Gant-de-boxe_pack-Cyber.webm` | `guantes-cyber.webm` | Gant de boxe - Cyber |
| `03_Multiplicateur-x2_pack-Cyber.webm` | `x2-cyber.webm` | x2 - Cyber |
| `04_Multiplicateur-x3_pack-Cyber.webm` | `x3-cyber.webm` | x3 - Cyber |
| `05_Tap-Tap_pack-Cyber.webm` | `taptap-cyber.webm` | Tap Tap - Cyber |
| `06_Merci-pour-ton-coeur_pack-Cyber.webm` | `quiereme-cyber.webm` | Merci pour ton cœur - Cyber |
| `07_Snipe_pack-Cyber.webm` | `snipe-cyber.webm` | Snipe - Cyber |

**Aucun Coffre Cyber n'a été fourni.** La variante Cyber n'est donc proposée
ni pour Coffre ni pour Enigma. Une variante explicitement indisponible est
refusée, jamais remplacée silencieusement par une autre vidéo.

Les six vidéos utilisent VP9 avec alpha, 720 × 1280 pixels, 30 images/seconde,
une durée d'environ 12,066 secondes et une piste Opus stéréo. Les aperçus WebP
transparents de 540 × 960 pixels proviennent de vraies images des vidéos.
Un test uniquement visuel doit conserver la vidéo muette.

## Génération et distribution

Après ajout d'une source et de ses options au catalogue, exécuter :

```powershell
npm run matches:protect
```

`scripts/build-protected-match-media.js` produit les ressources privées dans
`resources/protected-match-media/`, hors du dossier public Firebase. Chaque
vidéo est chiffrée avec AES-256-GCM et un nonce aléatoire ; son nom et sa taille
sont liés au contrôle d'intégrité. Le manifeste permet de ne reconstruire que
les ressources modifiées ou dont le fichier chiffré ne correspond plus.

Ce répertoire généré comprend les fichiers `.spm`, le manifeste et la clé de
lecture client. Il est ignoré par Git et ne doit pas être copié dans Hosting,
les journaux, un ticket de support ou une documentation. Le paquet Electron
contient ces ressources privées dans son archive ASAR ; ASAR ne constitue pas,
à lui seul, une protection cryptographique.

Les commandes `verify`, `build:dir`, `build:store` et `build:installer` génèrent
les médias protégés. Les exclusions de packaging retirent les vidéos WebM/MP4
en clair du dossier des overlays. Firebase Hosting exclut également ces vidéos
et n'héberge que leurs posters. Un build réalisé directement sans passer par
ces commandes doit préparer et vérifier les ressources protégées au préalable.

Avant installation, `node scripts/verify-protected-match-package.js <win-unpacked>`
contrôle le paquet complet : absence de vidéos brutes, ressources privées
dans ASAR, concordance des sources et identité des 21 vidéos après déchiffrement
en mémoire. L'audit ne journalise aucune clé et n'écrit aucune vidéo.

## Lecture en mémoire et contrôle d'accès

Le son intégré aux vidéos est conservé par le chiffrement. Les règles du
lecteur sonore et ses vérifications isolées sont décrites dans
[Son des vidéos Matchs](matches-audio.fr.md) ; les aperçus restent muets.

Le service Match ne crée aucun nouveau fichier vidéo déchiffré dans `Temp` ou
un dossier d'export. Il charge la ressource chiffrée, vérifie son intégrité et
sert la vidéo déchiffrée depuis la mémoire. Le cache est borné à **32 Mio**, avec
une durée de conservation de **30 secondes** depuis la dernière acquisition.
Une ressource encore utilisée par un flux n'est libérée qu'à la fin de ce flux ;
les buffers sont ensuite écrasés avant leur retrait du cache.

Les réponses vidéo exigent un ticket opaque temporaire et des droits Pro
actifs. La source Studio et la nouvelle API d'aperçu exigent en plus un compte
authentifié localement et les permissions Matchs. L'ancienne source privée
`/match/...` conserve son contrat historique Pro + capacité privée révocable ;
elle ne constitue pas à elle seule une nouvelle preuve d'authentification.
Le ticket est lié au contexte de lecture et expire au plus tard après
90 secondes. Changement de compte,
profil, LIVE ou capacité d'accès révoque les tickets et le cache concernés.
Les origines sont contrôlées, les réponses ne sont pas mises en cache sur disque
par ShenPulse et les requêtes de lecture sont limitées aux méthodes attendues.
Ces contrôles ne rendent pas inaccessible le flux décodé à son lecteur légitime.

L'effacement porte sur le cache applicatif. ShenPulse ne contrôle pas la
mémoire du navigateur, le fichier d'échange Windows ni les outils de capture.

Les cartes d'overlays et la page Matchs copient la **source HTTPS protégée**,
jamais un chemin de vidéo. Pour TikTok Studio sur le même PC, le bouton dédié
ajoute `transport=local` à l'alias HTTPS existant ; ShenPulse doit rester ouvert.
La source navigateur standard conserve son mode compatible si son accès au
pont local est refusé.

Les aperçus gratuits utilisent les posters ; la vraie lecture animée nécessite
Pro. Ni le mode aperçu ni un paramètre d'URL ne doit contourner les droits.

## Sources et copies déjà présentes

Les vidéos d'origine dans les téléchargements, les sources de développement et
les sauvegardes d'anciens paquets ne sont pas supprimées automatiquement. La
protection s'applique au nouveau paquet distribué et aux nouvelles lectures.
Elle ne peut ni confisquer une copie déjà récupérée ni transformer rétroactivement
un ancien export en fichier protégé. Une suppression de ces fichiers distincts
demande une décision explicite et des cibles précisément vérifiées.

## Vérifications de maintenance

- `tests/matches-cyber-assets.test.js` vérifie les sources exactes, VP9/Opus,
  les posters WebP et leur canal alpha.
- `tests/matches-protected-source-ui.test.js` exerce les vraies cartes et le
  générateur HTTPS : droits, URL invalide, disparition de source, absence de
  secours vidéo brut et retrait des anciennes commandes d'export.
- `tests/match-media-protection.test.js` vérifie le format chiffré, l'intégrité,
  le cache borné, les révocations et les exclusions des vidéos en clair.
- `tests/matches-protected-preview.test.js` vérifie les aperçus et l'exigence
  Pro pour la lecture animée du catalogue protégé.

Ces vérifications locales ne déclenchent aucun effet sur un LIVE réel et ne
publient aucune vidéo. Elles complètent, sans le remplacer, un contrôle visuel
autorisé dans la version de TikTok Studio utilisée.

## Contrôle réalisé le 14 octobre 2026

- Syntaxe/architecture : 647 fichiers JavaScript et 962 sources inventoriées,
  puis suite complète de tests réussie après les derniers contrôles d'accès.
- Lecteur Chromium isolé : Coffre Gladiador et x2 Cyber progressent réellement,
  trois images distinctes chacun, vidéo muette, aucune requête externe ni
  ressource brute ; révocation puis reconnexion sans rejouer un effet.
- Aperçus Chromium : x2 TikControl et Cyber animés via tickets ; gratuit et
  statique sur poster seulement ; aucune connexion SSE au LIVE.
- Paquet complet installé : 1 798 sources/ressources conformes au workspace,
  21 vidéos protégées identiques à leurs originaux après déchiffrement,
  zéro WebM/MP4 brute et zéro ressource privée hors ASAR.
- Hosting existant : runtime `1.0.16-overlay10`, 358 fichiers publics dont
  six posters Cyber ; aucune vidéo, clé ou archive privée téléversée.
- Application relancée avec accord : profils/configurations conservés ; les
  données de match ont repris le LIVE et une URL d'image cadeau a été rafraîchie
  par le catalogue sans changement d'identité ni de déclencheur. Le ticket
  Cyber local répond 200, HEAD 200, Range 206 et le WebM direct 403.

Aucun test d'effet visuel/sonore n'a été envoyé au LIVE lors de ce contrôle.
Le décodage a été vérifié dans Chromium isolé, pas par un nouveau test visuel
dans TikTok Studio. Le contrôle Windows a confirmé le redémarrage/reconnexion,
sans extraire de code ou de secrets de l'application de référence.
