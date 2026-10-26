"use strict";

/** Builds hors des ressources distribuées. Aucun identifiant personnel des packs
 * fournis n’est copié. Les modules à licence tierce sont remplacés par nos sources. */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."), version = process.env.SHENPULSE_SHOP_PACK_VERSION || "1.0.16";
const gameIds = ["hogwarts-legacy", "tcg-card-shop-simulator", "supermarket-simulator", "shift-at-midnight"];
const selected = process.argv.filter(argument => argument.startsWith("--game=")).map(argument => argument.slice(7));
if (selected.some(id => !gameIds.includes(id))) throw new Error("Jeu inconnu pour la préparation de ces modules.");
const wanted = id => !selected.length || selected.includes(id);
const sources = process.env.SHENPULSE_GETGAME || path.join(os.homedir(), "Downloads/GetGame");
const build = path.join(root, ".artifacts/game-pack-builds/shop-games-tools");
const compiler = process.env.SHENPULSE_CSC || path.join(root, ".artifacts/cc-audit/super-mario-kart/client/roslyn/csc.exe");
const cecil = process.env.SHENPULSE_CECIL || path.join(root, ".tmp-cecil/package/lib/net40/Mono.Cecil.dll");
const runtime = process.env.SHENPULSE_DOTNET_REFERENCES || "C:/Program Files/dotnet/shared/Microsoft.NETCore.App/6.0.36";
const resourceEditor = process.env.SHENPULSE_RCEDIT || path.join(root, "node_modules/electron-winstaller/vendor/rcedit.exe");
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const expect = (file, sha) => { if (hash(file) !== sha) throw new Error(`Source inattendue : ${path.basename(file)}`); };
const managed = file => { const bytes = fs.readFileSync(file); if (bytes.toString("ascii", 0, 2) !== "MZ") return false; const offset = bytes.readUInt32LE(60) + 24; return bytes.readUInt32LE(offset + (bytes.readUInt16LE(offset) === 0x20b ? 112 : 96) + 112) !== 0; };
function compile(output, files, references, options = []) {
  if (!options.includes("/nostdlib+")) references = [...references, ...["System.dll", "System.Core.dll"].map(file => path.join(process.env.WINDIR || "C:/Windows", "Microsoft.NET/Framework64/v4.0.30319", file))];
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const response = output + ".rsp";
  fs.writeFileSync(response, ["/nologo", "/target:library", "/langversion:latest", "/optimize+", "/deterministic+", ...options, `/out:"${output}"`, ...references.map(file => `-r:"${file}"`), ...files.map(file => `"${path.join(root, file)}"`)].join("\n"));
  execFileSync(compiler, ["/noconfig", "@" + response], { windowsHide: true, stdio: "inherit" });
  fs.rmSync(response);
}
function copy(source, destination) { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.cpSync(source, destination, { recursive: true }); }
function metadataReferences(directory) { return fs.readdirSync(directory).filter(name => name.endsWith(".dll") && managed(path.join(directory, name))).map(name => path.join(directory, name)); }
function brandVersionResource(file) {
  // Les informations Windows du fichier sont distinctes des métadonnées .NET.
  // Les champs de droits d'auteur d'origine restent intacts.
  execFileSync(resourceEditor, [file, "--set-version-string", "InternalName", path.basename(file), "--set-version-string", "OriginalFilename", path.basename(file)], { windowsHide: true });
}
function stage(id) { const output = path.join(root, ".artifacts/game-pack-builds", id, version); fs.mkdirSync(output, { recursive: true }); const deployment = fs.mkdtempSync(path.join(root, ".artifacts/shop-stage-")); fs.writeFileSync(path.join(output, "stage.json"), JSON.stringify({ deployment })); return { output, deployment }; }
function pack(id, deployment, output) {
  if (id !== "hogwarts-legacy") copy(path.join(root, "native/shop-games/licenses"), path.join(deployment, "ShenPulse-Licenses"));
  fs.writeFileSync(path.join(deployment, "THIRD-PARTY-NOTICES.txt"), id === "hogwarts-legacy"
    ? "UE4SS — copyright Narknon and contributors, MIT. See ue4ss/LICENSE.\nThe ShenPulse Hogwarts module is a separate local implementation.\n"
    : "BepInEx — LGPL-2.1, see ShenPulse-Licenses/BepInEx.txt.\n.NET runtime — Microsoft and contributors, MIT; third-party notices included.\nMono.Cecil and Newtonsoft.Json — their respective authors, MIT notices included.\nThe TCG module is a separate ShenPulse implementation. The other modules use the user-supplied game interaction binary with an adapted local transport.\n");
  const relative = id === "hogwarts-legacy" ? ["dwmapi.dll", "ue4ss/UE4SS.dll", "ue4ss/UE4SS-settings.ini", "ue4ss/Mods/ShenPulse/Scripts/main.lua"] : id === "tcg-card-shop-simulator" ? ["winhttp.dll", "doorstop_config.ini", "BepInEx/core/BepInEx.dll", "BepInEx/plugins/ShenPulseTCG/ShenPulse.TCG.dll"] : ["winhttp.dll", "doorstop_config.ini", "BepInEx/core/BepInEx.Core.dll", "BepInEx/core/BepInEx.Unity.IL2CPP.dll", "dotnet/coreclr.dll", "BepInEx/plugins/ShenPulse/ShenPulse.ShopAdapter.dll", `BepInEx/plugins/ShenPulse/${id === "shift-at-midnight" ? "ShenPulse.ShiftAtMidnight.Module.dll" : "ShenPulse.Supermarket.Module.dll"}`];
  fs.writeFileSync(path.join(deployment, "shenpulse-module.json"), JSON.stringify({ gameId: id, version, files: relative.map(file => ({ file, sha256: hash(path.join(deployment, file)) })) }, null, 2));
  const fileName = `${id}-shenpulse-${version}.zip`, file = path.join(output, fileName);
  fs.writeFileSync(path.join(deployment, "SHENPULSE-MODULE.txt"), `${id}\nShenPulse module ${version}\nInstallation depuis ShenPulse uniquement. Les réglages du canal local sont créés par l’installation.\n`);
  execFileSync("tar.exe", ["-a", "-cf", file, "-C", deployment, "."], { windowsHide: true });
  const asset = { gameId: id, id: "module", version, key: `installer-assets/${id}/${version}/${fileName}`, size: fs.statSync(file).size, sha256: hash(file), buildPath: path.relative(root, file).replace(/\\/g, "/") };
  fs.writeFileSync(path.join(output, "asset.json"), JSON.stringify(asset, null, 2));
  return asset;
}
async function pinnedFramework(name, url, sha256) {
  const directory = path.join(root, ".artifacts/shop-game-sources", name), archive = directory + ".zip";
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  if (!fs.existsSync(archive)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Téléchargement du chargeur ${name} : HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`Empreinte du chargeur ${name} incorrecte.`);
    fs.writeFileSync(archive, bytes);
  }
  expect(archive, sha256);
  const extracted = fs.mkdtempSync(directory + "-");
  execFileSync("tar.exe", ["-xf", archive, "-C", extracted], { windowsHide: true });
  return extracted;
}
async function main() {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Version de pack invalide.");
  const marketFramework = wanted("supermarket-simulator") ? await pinnedFramework("supermarket-0.12.0", "https://github.com/toebeann/BepInEx.SupermarketSimulator/releases/download/v6.0.0-pack.0.12.0/Tobey.s.BepInEx.Pack.for.Supermarket.Simulator.zip", "fa318c921543f0c152000fa34f680308e7511a3db5f01b5562de618c9260a26d") : null;
  const hogwartsFramework = wanted("hogwarts-legacy") ? await pinnedFramework("ue4ss-83330635", "https://github.com/UE4SS-RE/RE-UE4SS/releases/download/experimental-latest/UE4SS_v3.0.1-1181-g83330635.zip", "b9a166a756605b21058a64cde93bcaab1a855dba3553e5c7e6ce0fa8fdfad7b9") : null;
  fs.mkdirSync(build, { recursive: true });
  const prepared = path.join(build, "PrepareModules.exe");
  compile(prepared, ["native/shop-games/PrepareModules.cs"], [cecil], ["/target:exe"]);
  copy(cecil, path.join(build, "Mono.Cecil.dll"));
  const assets = [];
  for (const [id, folder, plugin, originalHash] of [
    ["shift-at-midnight", "ShiftAtMidnight", "ShiftAtMidnightTikTok/ShiftAtMidnightTikTok.dll", "dbd47bb9dcac427f8ed43866e5e4d76e30ec87520056053a9495447ce3208da3"],
    ["supermarket-simulator", "Supermarket Simulator", "SyncLive_Supermarket/SyncLive_Supermarket.dll", "0d96bdd9be3be24dc783840ba3268f8dcec6a9f628c8fbc32619fd561523b019"]
  ]) {
    if (!wanted(id)) continue;
    const source = path.join(sources, folder), input = path.join(source, "BepInEx/plugins", plugin);
    const framework = id === "supermarket-simulator" ? marketFramework : source;
    expect(input, originalHash);
    const { output, deployment } = stage(id);
    copy(path.join(framework, "BepInEx/core"), path.join(deployment, "BepInEx/core"));
    copy(path.join(framework, "dotnet"), path.join(deployment, "dotnet"));
    copy(path.join(framework, "winhttp.dll"), path.join(deployment, "winhttp.dll"));
    copy(path.join(framework, "doorstop_config.ini"), path.join(deployment, "doorstop_config.ini"));
    if (id === "supermarket-simulator") copy(path.join(framework, "BepInEx/unity-libs"), path.join(deployment, "BepInEx/unity-libs"));
    copy(path.join(source, "BepInEx/config/BepInEx.cfg"), path.join(deployment, "BepInEx/config/BepInEx.cfg"));
    const destination = path.join(deployment, "BepInEx/plugins/ShenPulse"), adapter = path.join(destination, "ShenPulse.ShopAdapter.dll");
    fs.mkdirSync(destination, { recursive: true });
    const json = path.join(root, ".artifacts/duckov/ilspy/tools/net8.0/any/Newtonsoft.Json.dll");
    const refs = [...metadataReferences(runtime), ...metadataReferences(path.join(source, "BepInEx/core")).filter(file => /BepInEx\.Core\.dll$/.test(file)), json];
    const runtimeSources = id === "shift-at-midnight" ? ["native/shop-games/TemporaryEffects.cs", "native/shop-games/QueuedViewerNames.cs", "native/shop-games/ShiftRuntime.cs"] : ["native/shop-games/TemporaryEffects.cs", "native/shop-games/ViewerSpawnQueue.cs", "native/shop-games/EmployeeOperations.cs", "native/shop-games/ProductReturnPlan.cs", "native/shop-games/MarketStock.cs", "native/shop-games/MarketTeleport.cs", "native/shop-games/MarketTime.cs", "native/shop-games/MarketRuntime.cs"];
    {
      const installedGame = id === "shift-at-midnight" ? process.env.SHENPULSE_SHIFT_GAME || "C:/XboxGames/Shift At Midnight/Content" : process.env.SHENPULSE_MARKET_GAME || "C:/XboxGames/Supermarket Simulator/Content";
      refs.push(...metadataReferences(path.join(installedGame, "BepInEx/interop")).filter(file => path.basename(file) !== "Newtonsoft.Json.dll"), ...metadataReferences(path.join(installedGame, "BepInEx/core")).filter(file => /(?:0Harmony|Il2CppInterop.Runtime)\.dll$/.test(file)));
    }
    compile(adapter, ["native/shop-games/Transport.cs", "native/shop-games/Il2CppAdapter.cs", ...runtimeSources], refs, ["/nostdlib+", id === "shift-at-midnight" ? "/define:SHENPULSE_SHIFT" : "/define:SHENPULSE_MARKET"]);
    copy(json, path.join(destination, "Newtonsoft.Json.dll"));
    const moduleFile = path.join(destination, id === "shift-at-midnight" ? "ShenPulse.ShiftAtMidnight.Module.dll" : "ShenPulse.Supermarket.Module.dll");
    fs.writeFileSync(moduleFile, execFileSync(prepared, [id, input, moduleFile, adapter], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }));
    brandVersionResource(moduleFile);
    if (id === "supermarket-simulator") {
      const variant = path.join(deployment, ".shenpulse-variants/xbox/ShenPulse.Supermarket.Module.dll");
      fs.mkdirSync(path.dirname(variant), { recursive: true });
      fs.writeFileSync(variant, execFileSync(prepared, [id, input, variant, adapter, "xbox"], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }));
      brandVersionResource(variant);
    }
    assets.push(pack(id, deployment, output));
  }
  if (wanted("tcg-card-shop-simulator")) {
    const id = "tcg-card-shop-simulator", source = path.join(sources, "TCG Card Shop Simulator"), { output, deployment } = stage(id);
    // Le module protégé fourni n’est pas distribué ; seules les dépendances BepInEx sont copiées.
    copy(path.join(source, "BepInEx/core"), path.join(deployment, "BepInEx/core"));
    copy(path.join(source, "winhttp.dll"), path.join(deployment, "winhttp.dll"));
    copy(path.join(source, "doorstop_config.ini"), path.join(deployment, "doorstop_config.ini"));
    copy(path.join(source, "BepInEx/config/BepInEx.cfg"), path.join(deployment, "BepInEx/config/BepInEx.cfg"));
    const managedPath = process.env.SHENPULSE_TCG_MANAGED || "C:/XboxGames/TCG Card Shop Simulator/Content/Card Shop Simulator_Data/Managed";
    const destination = path.join(deployment, "BepInEx/plugins/ShenPulseTCG");
    const refs = [...metadataReferences(managedPath), path.join(source, "BepInEx/core/BepInEx.dll"), path.join(source, "BepInEx/core/0Harmony.dll")];
    compile(path.join(destination, "ShenPulse.TCG.dll"), ["native/shop-games/Transport.cs", "native/shop-games/CustomerAttribution.cs", "native/shop-games/TemporaryEffects.cs", "native/shop-games/TcgShopOperations.cs", "native/shop-games/TcgPlugin.cs"], refs, ["/nostdlib+"]);
    const tools = path.join(deployment, ".shenpulse-tcg-patcher");
    compile(path.join(tools, "BepInEx.Bootstrap.dll"), ["native/shop-games/TcgBootstrap.cs"], []);
    compile(path.join(tools, "ShenPulse.TcgPatcher.exe"), ["native/shop-games/TcgBootstrapPatcher.cs"], [cecil], ["/target:exe"]);
    copy(cecil, path.join(tools, "Mono.Cecil.dll"));
    assets.push(pack(id, deployment, output));
  }
  if (wanted("hogwarts-legacy")) {
    const id = "hogwarts-legacy", source = path.join(sources, "Hogwarts Legacy/Phoenix/Binaries/Win64"), { output, deployment } = stage(id);
    expect(path.join(source, "ue4ss/UE4SS.dll"), "d936fd2d66ae9287f0b32aec5f698aa81ff20ef744eac43bf62d8475469393df");
    for (const name of ["dwmapi.dll", "ue4ss/UE4SS.dll", "ue4ss/LICENSE"]) copy(path.join(hogwartsFramework, name), path.join(deployment, name));
    copy(path.join(root, "native/shop-games/hogwarts/UE4SS-settings.ini"), path.join(deployment, "ue4ss/UE4SS-settings.ini"));
    copy(path.join(root, "native/shop-games/hogwarts/xbox"), path.join(deployment, ".shenpulse-variants/xbox"));
    copy(path.join(root, "native/shop-games/hogwarts/main.lua"), path.join(deployment, "ue4ss/Mods/ShenPulse/Scripts/main.lua"));
    fs.writeFileSync(path.join(deployment, "ue4ss/Mods/ShenPulse/enabled.txt"), "");
    fs.writeFileSync(path.join(deployment, "ue4ss/Mods/mods.txt"), "ShenPulse : 1\n");
    fs.writeFileSync(path.join(deployment, "ue4ss/Mods/mods.json"), JSON.stringify([{ mod_name: "ShenPulse", mod_enabled: true }], null, 2));
    assets.push(pack(id, deployment, output));
  }
  const registryPath = path.join(root, "scripts/manifests/game-packs.json"), registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  for (const asset of assets) {
    const previous = registry.assets.find(item => item.gameId === asset.gameId && item.id === asset.id);
    if (previous && previous.version === asset.version && previous.sha256 !== asset.sha256) throw new Error(`Version immuable déjà enregistrée : ${asset.gameId}. Incrémentez le pack.`);
    registry.assets = registry.assets.filter(item => !(item.gameId === asset.gameId && item.id === asset.id)); registry.assets.push(asset);
  }
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
  const currentAssets = registry.assets.filter(asset => gameIds.includes(asset.gameId));
  fs.writeFileSync(path.join(root, "resources/catalogs/shop-game-assets.json"), JSON.stringify(Object.fromEntries(currentAssets.map(({ gameId, version: packVersion, size, sha256, key }) => [gameId, { version: packVersion, size, sha256, url: "https://f003.backblazeb2.com/file/shenpulse-media/" + key, fileName: path.basename(key) }])), null, 2) + "\n");
  fs.writeFileSync(path.join(build, "assets.json"), JSON.stringify(currentAssets, null, 2));
  console.log(JSON.stringify(assets, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
