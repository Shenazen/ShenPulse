"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { safeChildPath } = require("./paths");

async function stageBluePrinceInstallation({ targetPath, deploymentRoot, assertAccess = () => {} }) {
  assertAccess();
  const relative = "BepInEx/config/BepInEx.cfg";
  const current = await fs.readFile(safeChildPath(targetPath, relative), "utf8").catch(() => "");
  const section = /(^\[Logging\.Console\]\r?\n)([\s\S]*?)(?=^\[|$(?![\s\S]))/m;
  const match = current.match(section);
  const content = match
    ? current.replace(section, (_all, heading, body) => heading + (/^Enabled\s*=/m.test(body) ? body.replace(/^Enabled\s*=.*$/m, "Enabled = false") : body + "Enabled = false\n"))
    : current + "\n[Logging.Console]\nEnabled = false\n";
  const config = safeChildPath(deploymentRoot, relative);
  await fs.mkdir(path.dirname(config), { recursive: true });
  await fs.writeFile(config, content);
}

module.exports = { stageBluePrinceInstallation };
