# Catégories des jeux

Revue du **22 octobre 2026**, préparée pour la prochaine version. Les **56 fiches** du catalogue, y compris les jeux privés et les trois modes Minecraft, ont été revues parmi les neuf filtres existants.

Un jeu peut appartenir à plusieurs catégories. Chaque filtre présente une seule carte par jeu ; « Tout » et le compteur du menu comptent toujours chaque jeu ou mode visible une seule fois. La somme des catégories peut donc dépasser le total. Recherche, droits d’accès, visibilité administrateur et version minimale continuent à s’appliquer avant les compteurs.

DREDGE rejoint **Horreur**, **Simulation & gestion** et **Aventure & survie** : pêche, commerce, amélioration du bateau, gestion de la cargaison et exploration de son archipel. Ce rapprochement avec les filtres ShenPulse s’appuie sur sa [présentation officielle](https://www.dredge.game/). La présence d’un véhicule ne suffit pas à classer un jeu dans « Course & conduite ».

Les catégories sont un classement éditorial adapté aux familles ShenPulse. Elles décrivent les genres et les activités importantes du jeu ; elles ne recopient pas tous les tags communautaires d’une boutique. Un monde ouvert ne devient pas automatiquement un bac à sable. Les jeux ShenPulse gardent leur famille dédiée et peuvent également apparaître dans un genre correspondant à leur fonctionnement.

Les principaux croisements ont été confrontés aux descriptions et genres publiés par leurs développeurs ou éditeurs : [Cult of the Lamb](https://www.devolverdigital.com/games/cult-of-the-lamb), [Stardew Valley](https://www.stardewvalley.net/about/), [No Man’s Sky](https://www.nomanssky.com/), [Euro Truck Simulator 2](https://store.steampowered.com/app/227300/), [Unturned](https://store.steampowered.com/app/304930/), [ARK](https://store.steampowered.com/app/2399830/), [Palworld](https://store.steampowered.com/app/1623730/), [Fallout 4](https://store.steampowered.com/app/377160/), [The Mortuary Assistant](https://store.steampowered.com/app/1295920/), [Demonologist](https://store.steampowered.com/app/1929610/), [Dead by Daylight](https://store.steampowered.com/app/381210/), [Resident Evil 3](https://store.steampowered.com/app/952060/), [Resident Evil 7](https://store.steampowered.com/app/418370/), [Inscryption](https://store.steampowered.com/app/1092790/), [Terraria](https://store.steampowered.com/app/105600/), [Wobbly Life](https://store.steampowered.com/app/1211020/), [Hollow Knight: Silksong](https://store.steampowered.com/app/1030300/), [Hades](https://store.steampowered.com/app/1145360/), [Duckov](https://store.steampowered.com/app/3167020/), [Egging On](https://store.steampowered.com/app/2897610/) et [Deep Rock Galactic](https://store.steampowered.com/app/548430/).

Le registre partagé est `src/shared/game-categories.js`. Le champ historique `catalogCategory` conserve sa catégorie principale pour compatibilité ; `catalogCategories` contient les catégories utilisées par les filtres. Les parcours d’installation, effets, identifiants et associations ne sont pas modifiés.

Pour Minecraft, Bedrock Box et SandBox 3 restent dans « Minecraft & bac à sable ». Le mode Survival rejoint également « Action & tir » et « Aventure & survie ». Les catégories et compteurs du lanceur sont calculés uniquement sur ses modes visibles ; un filtre de genre présente le sous-ensemble correspondant.

Vérification automatique : `npm run verify`. Contrôle Chromium des neuf filtres à quatre largeurs : `node scripts/verify-game-categories.js`. Les preuves restent dans `.artifacts/game-category-review/`, hors Git.

## Classement revu

<!-- La table ci-dessous couvre les fiches du catalogue, pas le nombre visible d’un compte. -->

| Jeu ou mode | Catégories |
|---|---|
| Crash Bandicoot N. Sane Trilogy | Aventure & survie · Action & tir |
| Unturned | Aventure & survie · Action & tir · Minecraft & bac à sable |
| The Mortuary Assistant | Horreur · Simulation & gestion · Aventure & survie |
| Find The Needle Demo | Simulation & gestion |
| Les Loups-Garous de Thiercelieux | Jeux ShenPulse |
| Coin Pusher Live | Jeux ShenPulse · Simulation & gestion |
| Puissance 4 Arena | Jeux ShenPulse |
| DealOrNoDeal | Jeux ShenPulse |
| Le Pont des Diamants | Jeux ShenPulse · Aventure & survie |
| Diamond Drop Live | Jeux ShenPulse |
| Color Strike | Jeux ShenPulse · Action & tir |
| Climb | Jeux ShenPulse · Action & tir · Aventure & survie |
| ShenPulse Cube Wars | Jeux ShenPulse · Action & tir |
| ShenPulse Stack Tower | Jeux ShenPulse · Simulation & gestion |
| Clash Of ShenPulse | Jeux ShenPulse · Action & tir |
| Pokémon Rouge/Bleu | Aventure & survie |
| Super Mario Kart | Course & conduite |
| Fortnite | Action & tir · Aventure & survie · Minecraft & bac à sable |
| Rocket League | Course & conduite · Action & tir |
| Demonologist | Horreur · Action & tir · Aventure & survie |
| Euro Truck Simulator 2 | Course & conduite · Simulation & gestion |
| Resident Evil 3 | Horreur · Action & tir · Aventure & survie |
| GTA V Mont Chiliad | GTA · Action & tir · Course & conduite · Aventure & survie |
| Minecraft Bedrock Box | Minecraft & bac à sable |
| Minecraft SandBox 3 | Minecraft & bac à sable |
| Minecraft Survival | Minecraft & bac à sable · Action & tir · Aventure & survie |
| Cult of the Lamb | Simulation & gestion · Action & tir · Aventure & survie |
| Stardew Valley | Simulation & gestion · Aventure & survie · Minecraft & bac à sable |
| Terraria | Minecraft & bac à sable · Action & tir · Aventure & survie |
| Hogwarts Legacy | Aventure & survie · Action & tir |
| TCG Card Shop Simulator | Simulation & gestion |
| Supermarket Simulator | Simulation & gestion |
| Shift At Midnight | Horreur · Simulation & gestion |
| Escape From Duckov | Action & tir · Aventure & survie |
| Blue Prince | Aventure & survie |
| Hollow Knight: Silksong | Aventure & survie · Action & tir |
| Hollow Knight | Aventure & survie · Action & tir |
| Egging On | Aventure & survie · Action & tir |
| Balatro | Simulation & gestion |
| Celeste | Aventure & survie · Action & tir |
| Dead by Daylight | Horreur · Action & tir · Aventure & survie |
| Deep Rock Galactic | Action & tir · Aventure & survie |
| DREDGE | Horreur · Simulation & gestion · Aventure & survie |
| Fallout 4 | Action & tir · Aventure & survie · Minecraft & bac à sable |
| Hades | Action & tir · Aventure & survie |
| Inscryption | Horreur · Aventure & survie |
| No Man's Sky | Aventure & survie · Action & tir · Simulation & gestion · Minecraft & bac à sable |
| Palworld | Aventure & survie · Action & tir · Simulation & gestion · Minecraft & bac à sable |
| Resident Evil 7 Biohazard | Horreur · Action & tir · Aventure & survie |
| Vampire Survivors | Action & tir · Aventure & survie |
| ARK: Survival Ascended | Aventure & survie · Action & tir · Minecraft & bac à sable |
| Cities Skylines | Simulation & gestion |
| Kingdom Come: Deliverance II | Aventure & survie · Action & tir |
| Deep Rock Galactic: Survivor | Action & tir · Aventure & survie |
| Hades II | Action & tir · Aventure & survie |
| Wobbly Life | Minecraft & bac à sable · Action & tir · Simulation & gestion · Aventure & survie |
