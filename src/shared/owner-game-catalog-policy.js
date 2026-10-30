"use strict";

// Keep the preparation inventory without offering excluded distribution channels.
// Catalog, installers and regenerated renderer shortcuts share this decision.
const EXCLUDED_OWNER_GAME_PLATFORMS = Object.freeze(["browser", "itch-io", "standalone"]);

function ownerGameListed(record) {
  return record.stage === "prepared" &&
    !record.platforms?.some(platform => EXCLUDED_OWNER_GAME_PLATFORMS.includes(platform));
}

module.exports = { EXCLUDED_OWNER_GAME_PLATFORMS, ownerGameListed };
