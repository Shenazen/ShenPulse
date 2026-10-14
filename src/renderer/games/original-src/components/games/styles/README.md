# Styles scoped des jeux

Chaque jeu conserve un seul bloc Vue `<style scoped>`, dont la source est `index.generated.css`. Les petites sections CSS dans le même dossier sont les fichiers à modifier ; leur ordre est celui de `scripts/build-original-game-styles.js`.

Le fichier assemblé est généré avant `games:build`. Une concaténation unique est nécessaire : Vue renomme les animations scoped au niveau d’un bloc. Plusieurs blocs séparés feraient perdre le lien entre une déclaration `animation` et ses `@keyframes` définis ailleurs.

Les chemins des ressources sont relatifs au dossier du jeu sous `styles/`, et non au fichier Vue. Les imports de polices conservent leur point-virgule.

`tests/original-game-styles.test.js` compare les règles compilées, sélecteurs scoped, valeurs, animations et chemins de ressources aux empreintes d’avant migration. Deal possède en plus une fixture de ses 104 règles compilées originales comparées structurellement ; le test ne dépend pas de Git à l’exécution.
