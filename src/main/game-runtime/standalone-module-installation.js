"use strict";

const fs = require("node:fs/promises"), path = require("node:path"), { createHash } = require("node:crypto");
const MODULES = Object.freeze({
  "blue-prince": {
    relative: "BepInEx/plugins/CrowdControl/CrowdControl.dll", from: 51337, port: 58442, offsets: [5452],
    original: "7953d992d70793751390e0f2f15a224acb361c5d475cde1c9b57abfccef37ea6",
    patched: "37f600d26320bb5a42ec96c8d7b4eeaf7de2954e6809b817144003957e22225c"
  },
  "resident-evil-3": {
    relative: "reframework/plugins/managed/RE3-CrowdControl.dll", from: 58431, port: 58443, offsets: [114533, 114657, 114714, 115383],
    original: "b10896a240408e5709d86f79154f04f08951ef93d10c75a2a5bd2ea54420759e",
    patched: "55f276b514f421b7008a012c1e980ee64eeff9327e821c566f91f5723a97ed41"
  },
  "fallout-4": {
    relative: "Data/F4SE/Plugins/CrowdControl.dll", port: 5846,
    strings: [{ offset: 429144, from: "5420", to: "5846" }],
    original: "510eba7f54fa1ba36a820e6f0f38a4a10519e3fc8b816a241fa33b65e1b5a6d4",
    patched: "46ab6a6d70b839947a28440d5d8bf9697d1e1eb1e2e4e0f98e04f858b06f2176"
  },
  "pokemon-red-blue": {
    relative: "Bridge/ConnectorLib.dll", from: 23884, port: 58444, offsets: [237928],
    original: "104de7739961d972fd39b6ea01c78fe10d9ab2714d15d6c9b52d5dcdc28d395a",
    patched: "975435961601b62bf994e7263c7a00cd8fa2d6d3089f59574eb40939bf3fdeda"
  },
  "super-mario-kart": {
    relative: "Bridge/ConnectorLib.dll", from: 23884, port: 58445, offsets: [237928],
    original: "104de7739961d972fd39b6ea01c78fe10d9ab2714d15d6c9b52d5dcdc28d395a",
    patched: "ea8ec4b1e8138000fc66b4c38403750658a3f2ee20f4d065fbc3195bdf5e6f60"
  }
});
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

function configureStandaloneModule(bytes, spec) {
  if (digest(bytes) === spec.patched) return bytes;
  if (digest(bytes) !== spec.original || (spec.offsets || []).some(offset => bytes[offset - 1] !== 0x20 || bytes.readInt32LE(offset) !== spec.from) ||
      (spec.strings || []).some(edit => edit.from.length !== edit.to.length || bytes.subarray(edit.offset, edit.offset + edit.from.length).toString("ascii") !== edit.from)) {
    throw new Error("Le module d’interactions n’est pas reconnu. Réinstallez les interactions depuis ShenPulse.");
  }
  const result = Buffer.from(bytes);
  for (const offset of spec.offsets || []) result.writeInt32LE(spec.port, offset);
  for (const edit of spec.strings || []) result.write(edit.to, edit.offset, "ascii");
  if (digest(result) !== spec.patched) throw new Error("Le module local n’a pas pu être vérifié.");
  return result;
}

async function stageStandaloneModule({ gameId, deploymentRoot, assertAccess = () => {} }) {
  const spec = MODULES[gameId]; if (!spec) return;
  const file = path.join(deploymentRoot, spec.relative), bytes = configureStandaloneModule(await fs.readFile(file), spec);
  assertAccess(); await fs.writeFile(file, bytes);
  if (["pokemon-red-blue", "super-mario-kart"].includes(gameId)) {
    const connector = path.join(deploymentRoot, "BizHawk/Lua/ShenPulse/connector.lua");
    const source = await fs.readFile(connector, "utf8");
    if (!source.includes("local HOST_PORT = 23884")) throw new Error("Le connecteur BizHawk n’est pas reconnu.");
    assertAccess(); await fs.writeFile(connector, source.replace("local HOST_PORT = 23884", `local HOST_PORT = ${spec.port}`));
  }
}

async function assertStandaloneModuleReady(gameId, targetPath) {
  const spec = MODULES[gameId]; if (!spec) return;
  const bytes = await fs.readFile(path.join(targetPath, spec.relative)).catch(() => null);
  if (!bytes || digest(bytes) !== spec.patched) throw new Error("Le module local doit être mis à jour. Fermez le jeu puis réinstallez ses interactions depuis ShenPulse.");
}

module.exports = { MODULES, configureStandaloneModule, stageStandaloneModule, assertStandaloneModuleReady };
