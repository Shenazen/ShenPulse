"use strict";

const fs = require("node:fs/promises"), path = require("node:path"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { cachedGamePack } = require("./lib/game-pack-cache");
const { verifyLocalAsset } = require("./lib/installer-assets");
const { extractArchiveSafe } = require("../src/main/game-runtime/archives");
const inputs = require("./manifests/emulator-host-build.json");
const root = path.resolve(__dirname, ".."), outputRoot = path.join(root, ".artifacts/game-pack-builds/emulator-common/1.0.0");

function managed(bytes) {
  if (bytes.toString("ascii", 0, 2) !== "MZ") return false;
  const opt = bytes.readUInt32LE(60) + 24;
  return bytes.readUInt32LE(opt + (bytes.readUInt16LE(opt) === 0x20b ? 112 : 96) + 14 * 8) !== 0;
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true });
  const stage = path.join(outputRoot, `stage-${crypto.randomUUID()}`);
  await fs.mkdir(stage);
  const directories = {};
  for (const name of ["sdk", "lua", "apphost"]) {
    const asset = inputs[name]; let archive;
    if (name === "apphost") {
      archive = path.join(outputRoot, "apphost.nupkg");
      try { await verifyLocalAsset(archive, asset); } catch {
        const response = await fetch(asset.url); if (!response.ok) throw new Error(`Apphost HTTP ${response.status}`);
        await fs.writeFile(archive, Buffer.from(await response.arrayBuffer())); await verifyLocalAsset(archive, asset);
      }
    } else archive = await cachedGamePack(asset);
    directories[name] = path.join(stage, name);
    await extractArchiveSafe(archive, directories[name]);
  }
  const sdk = directories.sdk, deployment = path.join(stage, "deployment"), bridge = path.join(deployment, "Bridge");
  await fs.mkdir(bridge, { recursive: true });
  const references = [], native = new Set(["coreclr.dll", "clrjit.dll", "hostfxr.dll", "hostpolicy.dll", "clrgc.dll", "clretwrc.dll", "mscordaccore.dll", "mscordbi.dll", "msvcp140_cor3.dll", "System.IO.Compression.Native.dll", "System.Net.Security.Native.dll"]);
  for (const file of await fs.readdir(sdk)) {
    if (!file.endsWith(".dll") || /^(?:CrowdControl\.(?:Client|Packs)\.|Microsoft\.CodeAnalysis|Microsoft\.DiaSymReader)/.test(file)) continue;
    const bytes = await fs.readFile(path.join(sdk, file));
    if (managed(bytes)) { references.push(`-r:"${path.join(sdk, file)}"`); await fs.copyFile(path.join(sdk, file), path.join(bridge, file)); }
    else if (native.has(file)) await fs.copyFile(path.join(sdk, file), path.join(bridge, file));
  }
  const dll = path.join(bridge, "ShenPulse.EmulatorHost.dll"), responseFile = path.join(stage, "compile.rsp");
  await fs.writeFile(responseFile, ["/nologo", "/nostdlib+", "/target:exe", "/langversion:latest", "/deterministic+", "/optimize+", `/out:"${dll}"`, ...references, `"${path.join(root, "native/emulator-host/Program.cs")}"`].join("\n"));
  execFileSync(path.join(sdk, "roslyn/csc.exe"), ["/noconfig", `@${responseFile}`], { windowsHide: true, stdio: "inherit" });
  await fs.writeFile(path.join(bridge, "ShenPulse.EmulatorHost.runtimeconfig.json"), JSON.stringify({ runtimeOptions: { tfm: "net8.0", includedFrameworks: [{ name: "Microsoft.NETCore.App", version: "8.0.30" }] } }));
  const runtime = {}, nativeFiles = {};
  for (const file of await fs.readdir(bridge)) {
    if (!file.endsWith(".dll") || file === "ShenPulse.EmulatorHost.dll") continue;
    (managed(await fs.readFile(path.join(bridge, file))) ? runtime : nativeFiles)[file] = {};
  }
  const targetName = ".NETCoreApp,Version=v8.0/win-x64";
  await fs.writeFile(path.join(bridge, "ShenPulse.EmulatorHost.deps.json"), JSON.stringify({
    runtimeTarget: { name: targetName, signature: "" }, targets: { [targetName]: {
      "ShenPulse.EmulatorHost/1.0.0": { dependencies: { "ShenPulse.Local.Libraries": "1.0.0" }, runtime: { "ShenPulse.EmulatorHost.dll": {} } },
      "ShenPulse.Local.Libraries/1.0.0": { runtime, native: nativeFiles }
    } }, libraries: {
      "ShenPulse.EmulatorHost/1.0.0": { type: "project", serviceable: false, sha512: "" },
      "ShenPulse.Local.Libraries/1.0.0": { type: "project", serviceable: false, sha512: "" }
    }
  }));
  const apphost = await fs.readFile(path.join(directories.apphost, "runtimes/win-x64/native/apphost.exe"));
  const placeholder = Buffer.from("c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2"), offset = apphost.indexOf(placeholder);
  if (offset < 0 || apphost.indexOf(placeholder, offset + 1) >= 0) throw new Error("Apphost Microsoft non reconnu.");
  apphost.fill(0, offset, offset + placeholder.length); apphost.write("ShenPulse.EmulatorHost.dll", offset, "utf8");
  await fs.writeFile(path.join(bridge, "ShenPulse.EmulatorHost.exe"), apphost);
  const lua = path.join(deployment, "BizHawk/Lua/ShenPulse");
  await fs.mkdir(path.dirname(lua), { recursive: true }); await fs.cp(path.join(directories.lua, "bizhawk"), lua, { recursive: true });
  await fs.cp(path.join(sdk, "Licenses"), path.join(bridge, "Licenses"), { recursive: true });
  await fs.writeFile(path.join(bridge, "THIRD-PARTY-NOTICES.txt"), "ShenPulse offline emulator host.\nConsole effect packs and ConnectorLib / CrowdControl libraries: Warp World and their respective authors.\n.NET runtime and apphost: Microsoft, MIT license.\nSee Licenses for the distributed third-party notices.\nNo Crowd Control desktop client, Slim client or account service is distributed or started.\n");
  const zip = path.join(outputRoot, "emulator-bridge-1.0.0.zip");
  execFileSync("tar.exe", ["-a", "-cf", zip, "-C", deployment, "."], { windowsHide: true });
  const bytes = await fs.readFile(zip), asset = { fileName: path.basename(zip), size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), buildPath: path.relative(root, zip).replace(/\\/g, "/") };
  await fs.writeFile(path.join(outputRoot, "asset.json"), JSON.stringify(asset, null, 2));
  await fs.writeFile(path.join(root, ".artifacts/cc-audit/host-build.json"), JSON.stringify({ ...asset, deployment, bridge, sdk }));
  console.log(JSON.stringify(asset));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
