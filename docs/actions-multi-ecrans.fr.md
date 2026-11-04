# Actions, viewer et écrans Media

Une action peut contenir plusieurs effets. Sa ligne présente un seul bouton Lecture, Modifier, Dupliquer et Supprimer. Lecture exécute tout le scénario ; la duplication conserve tous les effets et leurs références internes.

Le type « Viewer et/ou texte » affiche directement le viewer sans case d’activation supplémentaire. Le texte initial est `{avatar} Merci {username} !`. Les textes personnalisés existants restent conservés. Chaque variable possède une aide accessible au survol et au clavier. `{avatar}` insère la photo reçue dans l’événement ; une initiale apparaît si aucune photo n’est disponible.

Les huit URL Media transportent les images, les textes, les sons et les TTS vers l’écran choisi. Un média et un texte d’un même scénario, sur le même écran, sont présentés ensemble. Sur des écrans distincts, ils sont transmis indépendamment.

## Disposition d’essai sur Minecraft Box Cyber

Le bouton « Personnaliser l’affichage », placé au-dessus du téléphone, ouvre une popup avec les réglages et le même aperçu en direct. Les changements restent dans un brouillon isolé : « Enregistrer » les applique au profil et à son URL, « Annuler », la croix et Échap les abandonnent.

Le modèle 1 propose les cartes en bas ou sur les côtés, la caméra en haut ou en bas, l’ordre aides/pièges et une taille de 80 à 160 %. Les réglages restent propres au pack et au profil. Les URL restent identiques. Les autres jeux conservent leur présentation.

L’aperçu et les sources publiques utilisent la même géométrie que l’installation des studios. Après un déplacement de la caméra ou de la capture du jeu, réinstaller la scène applique leurs nouveaux placements dans le studio. La pagination ajuste le nombre de cartes pour conserver leur lisibilité et éviter les débordements.

Vérifications : huit écrans et leurs sons ; 272 combinaisons de dispositions, tailles et modes ; tests de duplication complète, de séparation des écrans, de données du viewer et d’isolation des autres jeux.


La configuration « Viewer et/ou texte » permet de régler la taille du texte de 8 à 240 px et l’épaisseur du contour de 0 à 20 px. Un contour à 0 px est invisible. Les anciens affichages conservent leur taille adaptative tant qu’ils ne sont pas modifiés.

Le bouton « Tester », entre Annuler et Enregistrer, envoie le viewer et le texte du brouillon sur l’URL de chaque écran Media choisi, pour les voir dans le studio. Il ne crée aucun aperçu dans la configuration et ne sauvegarde pas l’action. Les autres effets du scénario ne sont pas exécutés par ce test du viewer.

Le lien « Copier l’URL des cadeaux » utilise un cadrage dédié aux cartes (`fit=cards`). Sur Box Cyber, il retire l’espace transparent de la caméra et du jeu, y compris lorsque les cartes changent de côté ou de taille. L’aperçu complet et l’installation automatique conservent leur géométrie de scène. Les liens Cult of the Lamb et Euro Truck Simulator 2 restent inchangés. Une source créée avec un ancien lien doit recevoir l’URL recopiée depuis l’application mise à jour.
