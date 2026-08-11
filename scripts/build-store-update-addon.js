"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

if (process.platform !== "win32") {
  process.stdout.write(
    "Pont Microsoft Store ignoré : la compilation requiert Windows.\n"
  );
  process.exit(0);
}

const projectRoot = path.resolve(__dirname, "..");
const nativeDirectory = path.join(projectRoot, "native", "store-update");
const nodeGyp = require.resolve("node-gyp/bin/node-gyp.js");
const builtAddon = path.join(
  nativeDirectory,
  "build",
  "Release",
  "shenpulse_store_update.node"
);
const destinationDirectory = path.join(
  projectRoot,
  "resources",
  "store-update"
);
const destination = path.join(
  destinationDirectory,
  "shenpulse_store_update.node"
);

if (!fs.existsSync(nodeGyp)) {
  throw new Error(`node-gyp introuvable : ${nodeGyp}`);
}

const result = spawnSync(
  process.execPath,
  [nodeGyp, "rebuild", "--arch=x64"],
  {
  cwd: nativeDirectory,
  env: {
    ...process.env,
    npm_config_arch: "x64"
  },
  encoding: "utf8",
    stdio: "pipe"
  }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0 || !fs.existsSync(builtAddon)) {
  throw new Error(
    `La compilation du pont Microsoft Store a échoué (code ${result.status}).`
  );
}

fs.mkdirSync(destinationDirectory, { recursive: true });
fs.copyFileSync(builtAddon, destination);
process.stdout.write(`Pont Microsoft Store prêt : ${destination}\n`);
