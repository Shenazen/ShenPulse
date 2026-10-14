"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** Lit exactement les scripts de l’hôte historique, dans l’ordre livré au navigateur. */
function readLegacyGameHostSource() {
  const directory = path.resolve(__dirname, "..", "..", "src", "renderer", "games");
  const html = fs.readFileSync(path.join(directory, "host.html"), "utf8");
  return [...html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)]
    .map((match) => fs.readFileSync(path.join(directory, match[1]), "utf8")).join("\n\n");
}

module.exports = { readLegacyGameHostSource };
