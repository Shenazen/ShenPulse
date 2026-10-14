"use strict";

/** Catalogue communautaire partagé par l’accueil et l’espace de jeux. */
function creatorCommunityGames() {
  return visibleGamePacks().filter((pack) =>
    SHENPULSE_PLATFORM_GAME_IDS.has(pack.id) || pack.guide?.mode === "integrated"
  );
}
