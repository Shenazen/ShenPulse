"use strict";

const fs = require("node:fs/promises"), path = require("node:path"), { randomBytes, createHash } = require("node:crypto");
const { safeChildPath } = require("./paths");
const { SHOP_GAMES, ShopGameBridge } = require("../shop-game-bridge");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const execFileAsync = promisify(execFile);

async function hogwartsBinaryDirectory(target, platform = "") {
  const directories = platform === "steam" ? ["Phoenix/Binaries/Win64"] : platform === "xbox" ? ["Phoenix/Binaries/WinGDK"] : ["Phoenix/Binaries/WinGDK", "Phoenix/Binaries/Win64"];
  for (const relative of directories) {
    if ((await fs.stat(safeChildPath(target, relative + "/HogwartsLegacy.exe")).catch(() => null))?.isFile()) return relative;
  }
  throw new Error("L’exécutable Hogwarts Legacy est introuvable dans Phoenix/Binaries. Sélectionnez le dossier racine du jeu installé.");
}

async function stageShopGameInstallation({ gameId, targetPath, deploymentRoot, assertAccess = () => {}, patch = execFileAsync }) {
  if (!Object.hasOwn(SHOP_GAMES, gameId)) return null;
  assertAccess();
  const token = randomBytes(32).toString("hex"), retiredFiles = [];
  let moduleRoot = deploymentRoot;
  if (gameId === "hogwarts-legacy") {
    const platform = await require("./installation-platform").installationPlatform(targetPath, require("../game-installers/shop-games")[gameId]);
    const relative = await hogwartsBinaryDirectory(targetPath, platform);
    moduleRoot = safeChildPath(deploymentRoot, relative);
    await fs.mkdir(moduleRoot, { recursive: true });
    for (const name of ["dwmapi.dll", "ue4ss", "SHENPULSE-MODULE.txt", "shenpulse-module.json", "THIRD-PARTY-NOTICES.txt"]) await fs.rename(safeChildPath(deploymentRoot, name), path.join(moduleRoot, name));
    // Les signatures WinGDK sont propres à cette édition et ne doivent pas être posées sur Steam.
    const variants = safeChildPath(deploymentRoot, ".shenpulse-variants");
    if (relative.endsWith("/WinGDK")) {
      const manifestPath = path.join(moduleRoot, "shenpulse-module.json");
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      for (const name of ["GUObjectArray.lua", "ConsoleManager.lua"]) {
        const file = "ue4ss/UE4SS_Signatures/" + name;
        const bytes = await fs.readFile(safeChildPath(variants, "xbox/UE4SS_Signatures/" + name));
        await fs.mkdir(path.dirname(safeChildPath(moduleRoot, file)), { recursive: true });
        await fs.writeFile(safeChildPath(moduleRoot, file), bytes);
        manifest.files = manifest.files.filter(entry => entry.file !== file);
        manifest.files.push({ file, sha256: createHash("sha256").update(bytes).digest("hex") });
      }
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    }
    await fs.rm(variants, { recursive: true, force: true });
    const currentMods = await fs.readFile(safeChildPath(targetPath, relative + "/ue4ss/Mods/mods.txt"), "utf8").catch(() => "");
    if (currentMods) await fs.writeFile(path.join(moduleRoot, "ue4ss/Mods/mods.txt"), currentMods.replace(/^ShenPulse\s*:.*$/gm, "") + "\nShenPulse : 1\n");
    const existingJson = await fs.readFile(safeChildPath(targetPath, relative + "/ue4ss/Mods/mods.json"), "utf8").then(JSON.parse).catch(() => []);
    if (Array.isArray(existingJson) && existingJson.length) await fs.writeFile(path.join(moduleRoot, "ue4ss/Mods/mods.json"), JSON.stringify([...existingJson.filter(item => item.mod_name !== "ShenPulse"), { mod_name: "ShenPulse", mod_enabled: true }], null, 2));
    await fs.writeFile(path.join(moduleRoot, "ue4ss/Mods/ShenPulse/bridge.json"), JSON.stringify({ gameId, token }));
  } else {
    await fs.mkdir(path.join(moduleRoot, "BepInEx/config"), { recursive: true });
    await fs.writeFile(path.join(moduleRoot, "BepInEx/config", `ShenPulse.${gameId}.json`), JSON.stringify({ gameId, token, port: SHOP_GAMES[gameId].port }));
    // Préserver les préférences BepInEx existantes et masquer seulement la console.
    const relative = "BepInEx/config/BepInEx.cfg";
    const current = await fs.readFile(safeChildPath(targetPath, relative), "utf8").catch(() => "");
    if (current) await fs.writeFile(safeChildPath(deploymentRoot, relative), current);
    let config = await fs.readFile(safeChildPath(deploymentRoot, relative), "utf8");
    config = config.replace(/(\[Logging\.Console\][\s\S]*?^Enabled\s*=).*$/m, "$1 false");
    await fs.writeFile(safeChildPath(deploymentRoot, relative), config);
    if (gameId === "supermarket-simulator") {
      const variants = safeChildPath(deploymentRoot, ".shenpulse-variants");
      if ((await fs.stat(path.join(targetPath, "MicrosoftGame.config")).catch(() => null))?.isFile()) {
        const moduleFile = "BepInEx/plugins/ShenPulse/ShenPulse.Supermarket.Module.dll";
        const bytes = await fs.readFile(path.join(variants, "xbox/ShenPulse.Supermarket.Module.dll"));
        await fs.writeFile(safeChildPath(deploymentRoot, moduleFile), bytes);
        const manifestPath = path.join(deploymentRoot, "shenpulse-module.json");
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
        const entry = manifest.files.find(file => file.file === moduleFile);
        if (!entry) throw new Error("Manifeste Supermarket incomplet.");
        entry.sha256 = createHash("sha256").update(bytes).digest("hex");
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      }
      await fs.rm(variants, { recursive: true, force: true });
    }
    if (gameId === "tcg-card-shop-simulator") {
      const xbox = (await fs.stat(path.join(targetPath, "MicrosoftGame.config")).catch(() => null))?.isFile();
      if (xbox) {
        const managed = "Card Shop Simulator_Data/Managed", tools = safeChildPath(deploymentRoot, ".shenpulse-tcg-patcher");
        const stage = safeChildPath(deploymentRoot, managed);
        await fs.mkdir(stage, { recursive: true });
        const assemblyName = "UnityEngine.CoreModule.dll", currentModule = await fs.readFile(safeChildPath(targetPath, `${managed}/${assemblyName}`));
        await fs.writeFile(path.join(stage, assemblyName), currentModule);
        if (currentModule.includes(Buffer.from("BepInEx.Bootstrap"))) await fs.copyFile(safeChildPath(targetPath, `${managed}/${assemblyName}.bak`), path.join(stage, assemblyName + ".bak"));
        await fs.copyFile(safeChildPath(targetPath, managed + "/mscorlib.dll"), path.join(stage, "mscorlib.dll"));
        assertAccess();
        if (!currentModule.includes(Buffer.from("BepInEx.Bootstrap"))) await fs.copyFile(path.join(stage, assemblyName), path.join(stage, assemblyName + ".bak"));
        const sourceFile = path.join(stage, assemblyName + ".bak");
        const patched = await patch(path.join(tools, "ShenPulse.TcgPatcher.exe"), [sourceFile, path.join(tools, "BepInEx.Bootstrap.dll"), safeChildPath(targetPath, managed)], { encoding: "buffer", windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 30000 });
        await fs.writeFile(path.join(stage, assemblyName), patched.stdout);
        const modified = await fs.readFile(path.join(stage, assemblyName));
        if (!modified.includes(Buffer.from("BepInEx.Bootstrap"))) throw new Error("Le chargement du module TCG Xbox n’a pas pu être préparé.");
        await fs.copyFile(path.join(tools, "BepInEx.Bootstrap.dll"), path.join(stage, "BepInEx.Bootstrap.dll"));
        await fs.unlink(path.join(stage, "mscorlib.dll"));
        const manifestPath = path.join(deploymentRoot, "shenpulse-module.json");
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
        manifest.files = manifest.files.filter(entry => !["winhttp.dll", "doorstop_config.ini"].includes(entry.file));
        for (const file of [assemblyName, "BepInEx.Bootstrap.dll"]) {
          const bytes = await fs.readFile(path.join(stage, file));
          manifest.files.push({ file: `${managed}/${file}`, sha256: createHash("sha256").update(bytes).digest("hex") });
        }
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        for (const proxy of ["winhttp.dll", "version.dll"]) {
          const installed = await fs.readFile(path.join(targetPath, proxy)).catch(() => null);
          if (installed) {
            const included = await fs.readFile(path.join(deploymentRoot, "winhttp.dll"));
            if (createHash("sha256").update(installed).digest("hex") !== createHash("sha256").update(included).digest("hex")) throw new Error(`Un chargeur tiers ${proxy} est installé. Désactivez-le avant d’installer TCG ShenPulse.`);
            retiredFiles.push(proxy);
          }
        }
        await fs.unlink(path.join(deploymentRoot, "winhttp.dll"));
        await fs.unlink(path.join(deploymentRoot, "doorstop_config.ini"));
      }
      // Retrait limité au dossier d’outils créé dans la préparation temporaire.
      const tools = safeChildPath(deploymentRoot, ".shenpulse-tcg-patcher");
      await fs.rm(tools, { recursive: true, force: true });
    }
  }
  assertAccess();
  return { retiredFiles };
}

async function shopInstallationPath(gameId, targetPath) {
  if (gameId !== "hogwarts-legacy") return targetPath;
  const platform = await require("./installation-platform").installationPlatform(targetPath, require("../game-installers/shop-games")[gameId]);
  return safeChildPath(targetPath, await hogwartsBinaryDirectory(targetPath, platform));
}

async function assertShopModuleReady(gameId, targetPath) {
  if (!Object.hasOwn(SHOP_GAMES, gameId)) return;
  const root = await shopInstallationPath(gameId, targetPath);
  const manifest = await fs.readFile(path.join(root, "shenpulse-module.json"), "utf8").then(JSON.parse).catch(() => null);
  const expected = require("../../../resources/catalogs/shop-game-assets.json")[gameId];
  if (manifest?.gameId !== gameId || manifest.version !== expected.version || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error("Le module ShenPulse doit être installé ou mis à jour depuis la fiche du jeu.");
  for (const entry of manifest.files) {
    const bytes = await fs.readFile(safeChildPath(root, entry.file)).catch(() => null);
    if (!bytes || createHash("sha256").update(bytes).digest("hex") !== entry.sha256) throw new Error("Un fichier du module ShenPulse est absent ou modifié. Réinstallez les interactions avant de lancer le jeu.");
  }
  try { await new ShopGameBridge({ gameId, installationPath: root }).config(); }
  catch { throw new Error("La configuration locale du module ShenPulse est absente ou invalide. Réinstallez les interactions avant de lancer le jeu."); }
}

module.exports = { stageShopGameInstallation, hogwartsBinaryDirectory, shopInstallationPath, assertShopModuleReady };
