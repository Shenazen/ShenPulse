# Cadeaux sauvegardés : affichage et édition

L'interface charge le catalogue complet au démarrage, avant le premier affichage.
La limite précédente de 1 000 résultats excluait des cadeaux coûteux : les badges
affichaient alors une icône générique malgré une association correcte.
Les recherches interactives restent limitées à 1 000 résultats ; le chargement
initial est limité à 10 000. Aucun minuteur de synchronisation supplémentaire
n'est ajouté.

Pendant le LIVE, une notification `gift-catalog-updated` contient uniquement les
cadeaux effectivement modifiés. Le cache et les images des badges sont mis à
jour sans supprimer une saisie en cours. Le regroupement des rafales et la
suspension des affichages masqués restent gérés par le mécanisme existant. À la
réapparition de la fenêtre, les badges et sélecteurs reprennent les visuels du
cache actualisé.

## Une identité commune

`src/shared/gift-identity.js` est chargé aussi dans le renderer. La résolution
utilise l'ID et ses alias confirmés. Sans ID, un nom ou alias exact et non ambigu
peut être utilisé, avec le coût sauvegardé lorsqu'il est disponible. Deux cadeaux
ne sont jamais liés simplement parce qu'ils ont le même prix, une image semblable
ou des noms proches.

Exception d'affichage seulement : sans ID et sans image sauvegardée, plusieurs
entrées au même nom exact peuvent partager un même prix et un même dessin.
`giftVisualUrl` autorise ce dessin commun, mais ne choisit aucun ID, ne crée pas
d'alias et ne change pas les conditions de déclenchement. Si les images ou les
prix diffèrent, ou si un ID inconnu est présent, ce repli n'est pas utilisé.

`giftForIdentity` recherche une entrée réelle du catalogue.
`giftForSavedReference` ajoute le repli d'affichage à partir des métadonnées
sauvegardées : nom, ID, image, coût et famille. Une référence inconnue reste
visible sans être remplacée par un cadeau différent.
`giftReferenceForSave` conserve l'ID choisi, les alias et le coût déjà enregistrés
tant que le cadeau n'a pas changé. Une image actualisée du même ID peut corriger
son ancien visuel. Ces fonctions servent aux règles, aux sélecteurs, aux jeux
intégrés, aux roues et aux exports d'overlays.

## Protection lors de l'édition

Le sélecteur conserve les métadonnées de sa sélection, même après une recherche
ou un rafraîchissement de catalogue. Modifier le texte volontairement retire
l'ancien ID ; choisir un résultat définit le nouvel ID. Effacer la sélection ou
passer au filtre de valeur supprime uniquement le cadeau précis, pas les autres
conditions de la règle.

Les associations existantes ne sont donc pas effacées en ouvrant puis enregistrant
un formulaire lorsqu'un cadeau n'est temporairement plus proposé par TikTok.
Les noms personnalisés, nombres de pièces, seuils, effets et cooldowns restent
indépendants du visuel affiché.

## Jeux intégrés

Les jeux Vue conservent désormais l'ID numérique des cadeaux du catalogue, y
compris lorsqu'aucun alias historique n'était connu. Leurs sélecteurs ne
fusionnent plus des IDs différents parce que le nom, le prix ou le dessin est
identique. Les alias déclarés restent disponibles et un nom ambigu n'est pas
choisi arbitrairement ; un nom partiel ne remplace pas automatiquement un cadeau.

Coin Pusher partage une seule comparaison pour les règles de pièces et les
cadeaux désignés des barrières, du dé et des tickets. Deux IDs explicites
différents ne correspondent pas par leur seul nom. Le repli par nom exact reste
possible lorsque le fournisseur omet l'ID. Les alias confirmés et la famille du
cœur personnalisé sont préservés lors de la normalisation et de l'enregistrement
des profils. L'ancien format des profils sans ces champs reste compatible.

## Contrôles

`tests/gift-renderer-recovery.test.js` vérifie le chargement du catalogue complet,
les homonymes, les alias, l'actualisation de visuel, les références absentes et des
allers-retours de véritables formulaires DOM. Il vérifie également les jeux
intégrés, les roues et les images exportées. Aucun cadeau réel n'est envoyé par
ces tests.
`tests/gift-game-identity-recovery.test.js` exécute aussi les vrais modules
TypeScript regroupés : sélecteurs, déduplication, événements LIVE et calculs de
Coin Pusher. Les tests de traces historiques des 78 exports Coin Pusher restent
inchangés.
