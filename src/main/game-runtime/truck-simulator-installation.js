"use strict";

const fs = require("node:fs/promises"), path = require("node:path"), { createHash } = require("node:crypto");
const MODULE_PATH = "bin/win_x64/plugins/crowdcontrol.trucksimulator.dll";
const MODULE_HASHES = Object.freeze({
  original: "5c292c0a4039710fef6f1a033682743da8e97e338d40f168acfee073626347a5",
  patched: "aef534bcaff932117eda7edc9c4f91e0770ba40debf28bda572e4282ad698712"
});
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

function configureTruckModule(bytes) {
  const hash = digest(bytes);
  if (hash === MODULE_HASHES.patched) return bytes;
  // x64 MOV CX,51337 followed by htons; preserve every instruction address.
  // Enable the plugin's existing compatibility mode at initialization as well:
  // Steam can restart the executable without inheriting a launcher's variables.
  // This flag only removes its Crowd Control process-presence requirement.
  if (hash !== MODULE_HASHES.original || bytes.subarray(53837, 53841).toString("hex") !== "66b989c8" ||
      bytes.subarray(11552, 11554).toString("hex") !== "20c1" ||
      bytes.subarray(353353, 353358).toString("ascii") !== "51337") {
    throw new Error("La version du module Euro Truck Simulator 2 n’est pas reconnue. Réinstallez les interactions depuis ShenPulse.");
  }
  const result = Buffer.from(bytes);
  result.writeUInt16LE(58441, 53839);
  result.write("58441", 353353, "ascii");
  result[11552] = 0xb1; // MOV CL,1 instead of AND CL,AL (same instruction size).
  result[11553] = 0x01;
  if (digest(result) !== MODULE_HASHES.patched) throw new Error("Le module Euro Truck Simulator 2 n’a pas pu être configuré.");
  return result;
}

async function stageTruckSimulatorInstallation({ deploymentRoot, assertAccess = () => {} }) {
  const file = path.join(deploymentRoot, MODULE_PATH);
  const result = configureTruckModule(await fs.readFile(file));
  assertAccess();
  await fs.writeFile(file, result);
}

async function assertTruckSimulatorReady(targetPath) {
  const bytes = await fs.readFile(path.join(targetPath, MODULE_PATH)).catch(() => null);
  if (!bytes || digest(bytes) !== MODULE_HASHES.patched) {
    throw new Error("Le module Euro Truck Simulator 2 doit être mis à jour. Fermez le jeu, puis cliquez sur Réinstaller les interactions dans Installation. Relancez ensuite le jeu depuis ShenPulse.");
  }
}

module.exports = { MODULE_PATH, MODULE_HASHES, configureTruckModule, stageTruckSimulatorInstallation, assertTruckSimulatorReady };
