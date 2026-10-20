"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/** Identité locale remise au plugin installé du même utilisateur Windows. */
function writeLocalControllerConnection(directory, connection) {
  if (!directory || !fs.existsSync(path.join(directory, "manifest.json"))) return false;
  const target = path.join(directory, "local-connection.js");
  const temporary = `${target}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    const value = JSON.stringify(connection).replaceAll("<", "\\u003c");
    fs.writeFileSync(temporary, `window.ShenPulseLocalConnection = ${value};\n`, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, target);
    return true;
  } finally { fs.rmSync(temporary, { force: true }); }
}

module.exports = { writeLocalControllerConnection };
