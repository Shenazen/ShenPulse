"use strict";

const fs = require("node:fs"), path = require("node:path"), { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const game = path.resolve(process.argv[2] || process.env.SHENPULSE_DUCKOV_GAME || "C:/Program Files (x86)/Steam/steamapps/common/Escape from Duckov");
const output = path.join(root, ".artifacts/game-pack-builds/escape-from-duckov/1.1.1/ShenPulse.Duckov.Compatibility.dll");
const managed = path.join(game, "Duckov_Data/Managed");
const references = [path.join(game, "MelonLoader/net35/MelonLoader.dll"), path.join(game, "MelonLoader/net35/0Harmony.dll"),
  ...["TeamSoda.Duckov.Core.dll", "ItemStatsSystem.dll", "Sirenix.OdinInspector.Attributes.dll", "UnityEngine.CoreModule.dll", "UnityEngine.dll", "netstandard.dll"].map(file => path.join(managed, file))];
for (const file of references) if (!fs.existsSync(file)) throw new Error(`Référence Duckov absente : ${file}`);
fs.mkdirSync(path.dirname(output), { recursive: true });
execFileSync(path.join(process.env.WINDIR || "C:/Windows", "Microsoft.NET/Framework64/v4.0.30319/csc.exe"),
  ["/nologo", "/target:library", "/optimize+", `/out:${output}`, ...references.map(file => `/r:${file}`), path.join(root, "native/escape-from-duckov/Compatibility.cs")],
  { windowsHide: true, stdio: "inherit" });
console.log("Compatibilité Duckov compilée hors des ressources de l’application.");
