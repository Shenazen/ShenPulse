"use strict";
const { GTA_ASSET_BASE } = require("./constants");

// The same verified Story save is used before each mode selects its own course.
module.exports = Object.freeze({
  id: "enhancedsave",
  fileName: "GTA V Enhanced Mont Chiliad Save.zip",
  action: "gta-enhanced-save",
  editions: ["enhanced"],
  size: 789698,
  sha256: "13f06f99c75c913b2ce6c953e7bd1d545f14f47c369520cab3e6b681e448111e",
  url: `${GTA_ASSET_BASE}/gta-v-enhanced-mont-chiliad-save.zip`
});
