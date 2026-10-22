"use strict";

const fs = require("node:fs/promises"), path = require("node:path"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { cachedGamePack } = require("./lib/game-pack-cache");
const { extractArchiveSafe } = require("../src/main/game-runtime/archives");

async function main() {
  const root = path.resolve(__dirname, ".."), version = "1.1.1";
  execFileSync(process.execPath, [path.join(__dirname, "build-duckov-compatibility.js"), ...process.argv.slice(2)], { stdio: "inherit", windowsHide: true });
  const upstream = await cachedGamePack({ gameId: "escape-from-duckov", id: "upstream", fileName: "CC-EscapeFromDuckov-1.1.0.zip",
    url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/escape-from-duckov/1.1.0/CC-EscapeFromDuckov-1.1.0.zip",
    size: 11664606, sha256: "1c6a8fd96a5e11705e203d0fb19f7279b5a4678093a1dfba24c4e4f71c8ca94d" });
  const outputRoot = path.join(root, ".artifacts/game-pack-builds/escape-from-duckov", version);
  const stage = path.join(outputRoot, `stage-${crypto.randomUUID()}`);
  await extractArchiveSafe(upstream, stage);
  await fs.copyFile(path.join(outputRoot, "ShenPulse.Duckov.Compatibility.dll"), path.join(stage, "Mods/ShenPulse.Duckov.Compatibility.dll"));
  const fileName = `duckov-shenpulse-${version}.zip`, output = path.join(outputRoot, fileName);
  execFileSync("tar.exe", ["-a", "-cf", output, "-C", stage, "."], { windowsHide: true });
  const data = await fs.readFile(output), size = data.length, sha256 = crypto.createHash("sha256").update(data).digest("hex");
  const key = `installer-assets/escape-from-duckov/${version}/${fileName}`;
  const manifestFile = path.join(__dirname, "manifests/game-packs.json"), registry = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  const index = registry.assets.findIndex(asset => asset.gameId === "escape-from-duckov" && asset.id === "mod");
  if (index < 0) throw new Error("Entrée Duckov absente du registre des packs.");
  registry.assets[index] = { gameId: "escape-from-duckov", id: "mod", version, key, size, sha256, buildPath: path.relative(root, output).replace(/\\/g, "/") };
  await fs.writeFile(manifestFile, JSON.stringify(registry, null, 2) + "\n");
  const installer = path.join(root, "src/main/game-installers/escape-from-duckov.js");
  const source = await fs.readFile(installer, "utf8");
  await fs.writeFile(installer, source.replace(/version: "[^"]+"/, `version: "${version}"`).replace(/fileName: "[^"]+"/, `fileName: "${fileName}"`)
    .replace(/size: \d+, sha256: "[a-f0-9]+"/, `size: ${size}, sha256: "${sha256}"`).replace(/url: "[^"]+"/, `url: "https://f003.backblazeb2.com/file/shenpulse-media/${key}"`));
  console.log(JSON.stringify({ output, size, sha256, version }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
