"use strict";

/** Un bloc scoped par jeu conserve la résolution Vue des animations entre sections. */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "src", "renderer", "games", "original-src", "components", "games", "styles");
const sectionsByGame = { "coin-pusher": 4, "mystery-reveal": 2, "connect-four": 3, "deal-or-no-deal": 3, thiercelieux: 1 };

function buildOriginalGameStyles({ write = true } = {}) {
  const outputFiles = Object.entries(sectionsByGame).map(([game, count]) => ({
    path: path.join(root, game, "index.generated.css"),
    text: "/* FICHIER GÉNÉRÉ — modifier les sections voisines ; garder un seul bloc Vue scoped. */\n" +
      Array.from({ length: count }, (_, index) => fs.readFileSync(path.join(root, game, `section-${index + 1}.css`), "utf8")).join("\n")
  }));
  if (write) for (const file of outputFiles) fs.writeFileSync(file.path, file.text);
  return { outputFiles };
}

if (require.main === module) {
  buildOriginalGameStyles();
  process.stdout.write("Styles scoped des jeux générés avec résolution commune des animations.\n");
}

module.exports = { buildOriginalGameStyles, sectionsByGame };
