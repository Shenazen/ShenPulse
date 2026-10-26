"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { launchExternalGame, runningGameProcess } = require("../src/main/game-runtime/external-launch");
const { installerForGame } = require("../src/main/game-installer-manifest");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");

async function directory(t) {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-launch-once-"));
  t.after(() => fs.rm(target, { recursive: true, force: true }));
  return target;
}

test("le lancement DBD réutilise le processus GDK ouvert et attend sa vraie fenêtre", async t => {
  const target = await directory(t);
  const executable = path.join(target, "DeadByDaylight/Binaries/WinGDK/DeadByDaylight-WinGDK-Shipping.exe");
  await fs.mkdir(path.dirname(executable), { recursive: true });
  await fs.writeFile(executable, "fixture");
  const helper = path.join(target, "gamelaunchhelper.exe");
  await fs.writeFile(helper, "fixture");
  const calls = [];
  const options = {
    gameId: "dead-by-daylight", manifest: installerForGame("dead-by-daylight"), installation: { path: target },
    shell: { openPath: async file => { calls.push(["open", file]); return ""; } }, assertAccess() {},
    waitForWindowsProcessWindow: async (...args) => calls.push(["wait", ...args]),
    findRunning: async names => { assert.ok(names.includes("DeadByDaylight-WinGDK-Shipping")); return { ProcessId: 42, ExecutablePath: executable }; }
  };
  const result = await launchExternalGame(options);
  assert.equal(result.alreadyRunning, true);
  assert.equal(result.processId, 42);
  assert.deepEqual(calls, [["wait", "DeadByDaylight-WinGDK-Shipping", 180000]]);
  calls.length = 0;
  await launchExternalGame({ ...options, findRunning: async () => null });
  assert.deepEqual(calls, [["open", helper], ["wait", "DeadByDaylight-WinGDK-Shipping", 180000]]);
});

test("la détection des instances accepte les noms GDK et les espaces sans accepter une commande", async () => {
  const calls = [];
  const execute = async (...args) => { calls.push(args); return '{"ProcessId":123,"Name":"Egging On.exe"}'; };
  assert.equal((await runningGameProcess(["Egging On.exe"], { platform: "win32", execute })).ProcessId, 123);
  assert.match(calls[0][1].at(-1), /Get-CimInstance Win32_Process/);
  await assert.rejects(runningGameProcess(["game'; whoami"], { platform: "win32", execute }), /invalide/);
  assert.equal(calls.length, 1);
  assert.equal(await runningGameProcess(["Egging On"], { platform: "linux", execute }), null);
});

test("deux lancements simultanés partagent une seule opération et un échec peut être retenté", async t => {
  const target = await directory(t);
  const state = {
    commerce: { subscription: { tier: "pro", status: "active", source: "subscription" }, gameEntitlements: [] },
    game: { installations: { "dead-by-daylight": { path: target } } }
  };
  const store = authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) });
  const filename = path.resolve(__dirname, "../src/main/game-runtime.js");
  const originalRequire = createRequire(filename);
  let launches = 0;
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  let rejectLaunch = false;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, __dirname: path.dirname(filename), process, Buffer, console, setTimeout, clearTimeout, setInterval, clearInterval,
    require: id => id === "electron" ? { shell: {} } : id === "./game-runtime/external-launch" ? {
      launchExternalGame: async () => { launches++; if (rejectLaunch) throw new Error("fixture failure"); await pending; return { ok: true }; }
    } : originalRequire(id)
  });
  vm.runInContext(await fs.readFile(filename, "utf8"), context, { filename });
  const runtime = new module.exports.GameRuntimeService({ app: { getPath: () => target }, store, getWindow: () => null, notifyRenderer() {} });
  const first = runtime.launch("dead-by-daylight");
  const second = runtime.launch("dead-by-daylight");
  finish();
  assert.equal((await first).ok, true);
  assert.equal((await second).ok, true);
  assert.equal(launches, 1);
  assert.equal(runtime.launchJobs.size, 0);
  rejectLaunch = true;
  await assert.rejects(runtime.launch("dead-by-daylight"), /fixture failure/);
  assert.equal(runtime.launchJobs.size, 0);
  rejectLaunch = false;
  assert.equal((await runtime.launch("dead-by-daylight")).ok, true);
  assert.equal(launches, 3);
});
