# Disponibilité Game Pass dans la galerie

Le registre `src/shared/game-pass-catalog.js` a été vérifié le **21 octobre 2026**,
pour le marché France, auprès du [catalogue officiel PC Game Pass](https://www.xbox.com/en-US/games/browse/pc-game-pass-all-games)
et du service de catalogue public Microsoft référencé dans le registre.
Les identifiants produits sont contrôlés dans le catalogue Microsoft Store.
Les variantes Minecraft partagent le produit Java & Bedrock pour PC.

Pour l’instant, les jaquettes affichent le logo uniquement pour ARK: Survival
Ascended, Balatro et Blue Prince, conformément au choix du créateur. Le registre
de disponibilité est conservé pour les autres jeux.

Ces valeurs servent désormais de défaut : dans **Administration → Visibilité →
Jeux → Choisir les logos**, le propriétaire peut sélectionner plusieurs logos
ou tous les retirer. Le choix est publié avec la visibilité de chaque jeu et
repris par les jaquettes et la légende. Changer une portée ou synchroniser le
catalogue conserve les logos choisis. `platformsConfigured` préserve le choix
vide lorsque Firebase supprime le tableau `platforms` vide.

Les boutiques déjà présentes restent affichées. Une mention historique « Game
Pass » dans une description ne suffit pas à ajouter le logo. Le registre ne
change ni la visibilité des jeux, ni les compteurs, ni les achats ou les droits
ShenPulse. La disponibilité dans Game Pass ne certifie pas la compatibilité
d’un mod avec toutes les éditions du jeu.

Fortnite et Rocket League sont référencés comme des **avantages Game Pass
Ultimate**, d’après l’[annonce Xbox sur Fortnite Crew et Rocket Pass](https://news.xbox.com/en-us/2025/11/14/fortnite-crew-xbox-game-pass-ultimate-pc-play-anywhere/).
Leurs logos sont masqués comme ceux des autres jeux hors sélection.

Exécuter `node scripts/verify-game-pass-catalog.js` pour revérifier les produits
du registre. Le contrôle n’écrit aucun réglage de l’application. Si le catalogue
a changé, revoir les entrées avant de publier la prochaine version.
