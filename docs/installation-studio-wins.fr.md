# Cadrage des wins dans l’installation studio

Correction du 29 octobre 2026, version applicative conservée à 2.1.0.

Le HUD des wins était installé sur toute la largeur du canevas, alors que la source des interactions utilise un cadre plus étroit. Sa source navigateur gardait aussi une hauteur de 1920 pixels, dont la partie basse transparente n’est pas utile. Le rendu ne tenait compte que de la largeur disponible, ce qui coupait les dernières lignes lorsqu’un navigateur de studio fournissait une hauteur plus petite.

Le module commun `src/main/studio-installation/layout.js` fournit maintenant une source utile de **1080 × 1280** pixels. Sa position horizontale et sa largeur suivent celles des interactions. Son origine verticale place le début du jeu au même niveau que précédemment, avec une marge entre les derniers cadeaux de wins et les interactions du bas. Le dessin interne conserve ses coordonnées 1080 × 1920 : les proportions et placements des widgets du téléphone restent compatibles.

Dans TikTok LIVE Studio, une réinstallation recalcule uniquement le HUD à partir de la position réellement enregistrée pour les interactions. Les coordonnées sont normalisées même lorsque le studio a enregistré des tailles d’aperçu différentes selon les sources. Elle retire l’ancienne découpe, le zoom et les données de cadrage obsolètes du HUD. La commande d’installation du compteur seul conserve intégralement caméra, capture du jeu et interactions. OBS en ligne et hors ligne réinitialisent également les découpes de leur source wins ; Streamlabs reçoit les mêmes dimensions et le cadre commun.

La source publique ajuste maintenant son échelle sur la hauteur utile et la largeur disponibles, en restant centrée horizontalement. Les sources séparées compteur, multiplicateur, timer et mute conservent leur cadrage. La déclaration de thème du HUD n’impose plus un fond opaque dans les iframes.

Validation :

- 92 tests réussis sur le cadrage studio, les widgets de wins et les timers Minecraft ; puis 28 tests du cadrage final, des API studios et des ressources, tous réussis.
- Après ajout du cas TikTok à deux tailles d’aperçu différentes : les 22 tests d’installation et de cadrage passent ; le téléphone et la source mute conservent leur échelle historique.
- Régressions pour une source TikTok décalée, rognée et agrandie, une réinstallation idempotente, la conservation des autres sources et plusieurs canevas portrait/paysage.
- Contrôle visuel avec les véritables pages et une projection fictive de GTA Hiking : deux sources de largeur 546,86 px, même abscisse ; les quatre cadeaux de chaque côté et Reset restent entièrement dans la source. Dernière ligne à y=1212,67 dans le viewport de 1280 px.
- Lint valide. La qualification utilise des données isolées et ne modifie aucune scène personnelle ni aucun compte.
- Paquet natif final construit et vérifié : 153 scripts renderer identiques aux sources ; les quatre modules d’installation et les trois fichiers du HUD correspondent exactement au code qualifié.

Les trois fichiers de la source publique (`game-wins.html`, son CSS et son runtime) sont publiés et leur contenu distant vérifié ; les 426 autres fichiers du site sont conservés. Version Hosting finale : `87548c36486dc353`. Aucun redémarrage du backend ; l’activation du comptage des essais en agence reste en attente, séparément.

La correction des paramètres d’installation fait partie de l’application reconstruite sous `.artifacts/shenpulse-dev-2.1.0-studio-wins-final/win-unpacked/`. Elle nécessite cette application corrigée pour réinstaller une scène déjà mal cadrée. Cette intervention ne remplace pas l’installateur public ou le paquet Microsoft Store ; la mise à jour du site seule ne peut pas modifier les transformations enregistrées dans le studio d’un autre utilisateur.

## Référence Hiking ajustée dans TikTok LIVE Studio

Le 29 octobre, le cadrage a été repris depuis la scène Hiking après le réglage manuel de l’utilisateur. Cette référence remplace le calcul de largeur identique aux interactions décrit plus haut. Sur l’aperçu 675 × 1200, la source native des wins mesure 1080 × 1019, à x=0 et y=78,39580535888672, avec une échelle uniforme de 0,6201910376548767. Le runtime existant ajuste les 1280 pixels utiles du HUD à cette hauteur ; les dernières lignes restent visibles. Le viewport demandé utilise désormais cette taille native pour éviter une différence entre résolution demandée et surface réellement fournie par le studio.

Les valeurs non personnelles sont conservées dans `tests/fixtures/studio-hiking-wins-reference.json`. Le module de disposition commun reproduit exactement cette transformation avec la scène par défaut, puis adapte les proportions aux canevas et aux positions personnalisées des interactions et du jeu. TikTok, OBS et Streamlabs utilisent le même cadrage. Les sources caméra, jeu et interactions restent conservées lors de la réinstallation des wins seuls.

Les 23 tests d’installation et de cadrage passent, dont un parcours de tous les jeux du catalogue dotés de wins. Ils contrôlent la référence exacte, les dimensions native/navigateur, les canevas portrait et paysage, les aperçus TikTok de tailles différentes et les réinstallations sans doublon. Cette correction porte sur les paramètres d’installation de l’application ; aucun changement du backend ou de la source publique n’est nécessaire.

Le rendu généré a été comparé visuellement à la référence enregistrée avec la même projection Hiking : positions, dimensions et dernier cadeau identiques. Lint valide ; les 153 scripts renderer et les modules studios ont été vérifiés dans le paquet `.artifacts/shenpulse-dev-2.1.0-studio-hiking-reference/win-unpacked/`. ShenPulse a été relancé depuis ce paquet. La scène Hiking personnelle sert seulement de référence de lecture et conserve ses réglages ; les autres jeux recevront ce cadrage à leur installation ou réinstallation sur le studio.
