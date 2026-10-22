"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { runProcess } = require("../src/main/game-runtime/processes");

async function main() {
  const root = path.resolve(__dirname, "..");
  const native = path.join(root, "native/balatro");
  const stage = path.join(root, ".artifacts/balatro-build", crypto.randomBytes(8).toString("hex"));
  const moduleRoot = path.join(stage, ".shenpulse-balatro/gamepass");
  const steam = path.join(stage, ".shenpulse-balatro-mods/CrowdControl");
  await fs.mkdir(moduleRoot, { recursive: true });
  await fs.mkdir(steam, { recursive: true });
  await fs.cp(path.join(native, "gamepass"), moduleRoot, { recursive: true });
  await fs.copyFile(path.join(native, "upstream/balamod.lua"), path.join(moduleRoot, "effects.lua"));
  await fs.copyFile(path.join(native, "upstream/json.lua"), path.join(moduleRoot, "json.lua"));
  for (const destination of [moduleRoot, steam]) {
    await fs.copyFile(path.join(native, "upstream/LICENSE"), path.join(destination, "LICENSE"));
    await fs.copyFile(path.join(native, "upstream/NOTICE"), path.join(destination, "NOTICE"));
  }
  const source = await fs.readFile(path.join(native, "upstream/steamodded.lua"), "utf8");
  const start = source.indexOf("CC.util = {}");
  if (start < 0) throw new Error("Le module Balatro source n’est plus reconnu.");
  await fs.writeFile(path.join(steam, "main.lua"), "CC = SMODS.current_mod\nCC.hidden = false\n" + source.slice(start) + "\nassert(SMODS.load_file('transport.lua'))()\n");
  await fs.copyFile(path.join(native, "steam/transport.lua"), path.join(steam, "transport.lua"));
  await fs.copyFile(path.join(native, "upstream/json.lua"), path.join(steam, "json.lua"));
  await fs.writeFile(path.join(steam, "manifest.json"), JSON.stringify({ id: "CrowdControl", name: "ShenPulse", author: ["ShenPulse", "The Crowd Control Team"], version: "1.0.0", prefix: "crowd", main_file: "main.lua", dependencies: ["Steamodded (>=1.*~)"] }));
  const codes = require("../resources/catalogs/balatro-effects.json").map(effect => effect.code);
  await fs.writeFile(path.join(steam, "allowed.lua"), "return {\n" + codes.map(code => `  [${JSON.stringify(code)}] = true,`).join("\n") + "\n}\n");
  const output = path.join(root, ".artifacts/game-pack-builds/balatro/1.0.0/balatro-shenpulse-1.0.0.zip");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await runProcess("tar.exe", ["-a", "-cf", output, "-C", stage, ".shenpulse-balatro", ".shenpulse-balatro-mods"]);
  const data = await fs.readFile(output);
  const size = data.length, sha256 = crypto.createHash("sha256").update(data).digest("hex");
  const manifest = path.join(root, "src/main/game-installers/balatro.js");
  const text = await fs.readFile(manifest, "utf8");
  await fs.writeFile(manifest, text.replace(/size: \d+, sha256: "(?:pending|[a-f0-9]{64})"/, `size: ${size}, sha256: "${sha256}"`));
  console.log(JSON.stringify({ output, size, sha256 }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
