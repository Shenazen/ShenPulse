# Minecraft Lava Rise

Mode Minecraft Java autonome ajoute a ShenPulse 2.1.0.

## Installation et jeu

Installer automatiquement le pack depuis la fiche du mode, accepter le CLUF Minecraft et demarrer le serveur. Ouvrir Minecraft Java 26.1.2 et rejoindre 127.0.0.1:25585 en multijoueur. Saisir /lavarise start, puis fermer le chat et grimper.

Tenir dix secondes au sommet donne une win ; toucher la lave en partie en retire une, meme sans bouger. Le multiplicateur actif concerne les deux resultats. Les manches se relancent automatiquement apres leur resultat. /lavarise stop arrete la manche ; /lavarise reset reinitialise l'arene. Fermer ShenPulse arrete le serveur.

Six aides et six pieges sont preconfigures avec les cadeaux habituels. Les 24 effets natifs restent disponibles dans le catalogue. Les regles de wins sont separees des effets du jeu. Les autres modes Minecraft gardent leurs fichiers et reglages.

Minecraft Java doit etre disponible sur le compte du lanceur, y compris avec Xbox / Game Pass lorsque Java Edition est inclus dans ses droits. Bedrock Edition ne peut pas rejoindre ce serveur Java.

## Distribution et qualification du 29 octobre 2026

Prefixe Backblaze : installer-assets/minecraft-lavarise/1.0.0/. Cinq fichiers : Paper 26.1.2, Java 25 portable, shenpulse-lavarise.jar, config.yml, server.properties. Taille et SHA-256 verifies a chaque telechargement. Aucun binaire de jeu ajoute aux sources distribuees.

Le serveur utilise une console locale et le port 25585 lie a 127.0.0.1. Aucun compte, pont REST, proxy, pack de ressources ou application d'interactions tiers n'est necessaire.

36 controles en partie ont valide les 24 effets, leurs parametres, les expirations (potions, gel, glace, plateformes mobiles, equipements), le maintien au sommet de dix secondes et les wins multipliees. Les tests Node couvrent les cadeaux, la commande du viewer, les parametres, l'isolation des sessions et la synchronisation native.

Une installation vierge a telecharge les cinq fichiers depuis Backblaze, verifie leurs empreintes, extrait le Java portable et demarre Paper avec le seul plugin ShenPulse. Le JAR a ete analyse : aucune reference a l'ancienne application. La sonde de qualification est exclue du pack.

Sources d'adaptation et sonde : scripts/minecraft/lavarise/. Construction : scripts/build-minecraft-lavarise.ps1, avec le module autorise, un JDK 25 et les bibliotheques Paper.
