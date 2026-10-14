"use strict";

const { spawn } = require("node:child_process");

/** Lance uniquement le sous-processus demandé, sans shell, depuis un répertoire explicite. */
function runElectronAsNode(cwd, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd, windowsHide: true, shell: false, stdio: "inherit",
      env: { ...process.env, ...environment, ELECTRON_RUN_AS_NODE: "1" }
    });
    child.once("error", reject);
    child.once("close", resolve);
  });
}

module.exports = { runElectronAsNode };
