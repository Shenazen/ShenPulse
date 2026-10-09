"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  CrowdControlSlimClient,
  md5File
} = require("./pokemon-red-blue-runtime");

const GAME_ID = "super-mario-kart";
const NATIVE_CONNECTOR_ID = "Lua";
const NATIVE_PACK_ID = "SuperMarioKart";
const PACK_FILE_NAME = "SuperMarioKart.dll";
const ROM_FILE_NAME = "SuperMarioKart-Original.sfc";

const ROM_HASHES = Object.freeze({
  usa: "7f25ce5a283d902694c52fb1152fa61a",
  usaAlternate: "8b13d7d413545582099ab35298405417"
});

class SuperMarioKartRuntime {
  constructor({ app, store, spawnProcess = spawn }) {
    this.app = app;
    this.store = store;
    this.spawnProcess = spawnProcess;
    this.client = new CrowdControlSlimClient({
      spawnProcess,
      packId: NATIVE_PACK_ID,
      gameLabel: "Super Mario Kart"
    });
  }

  async prepareInstallation(targetPath, previousInstallation = null) {
    const remembered = String(previousInstallation?.romPath || "").trim();
    const bundledRom = path.join(targetPath, "ROM", ROM_FILE_NAME);
    const candidates = [remembered, bundledRom].filter(
      (candidate, index, entries) => candidate && entries.indexOf(candidate) === index
    );

    for (const candidate of candidates) {
      if (await isCompatibleSuperMarioKartRom(candidate)) {
        return superMarioKartRomState(candidate, await md5File(candidate));
      }
    }

    const detected = await findCompatibleSuperMarioKartRom(
      path.join(this.app.getPath("documents"), "roms")
    );
    if (!detected) {
      throw new Error(
        "La ROM Super Mario Kart USA incluse est introuvable ou invalide. Réparez l’installation."
      );
    }
    return superMarioKartRomState(detected, await md5File(detected));
  }

  async launch() {
    const installation = this.#installation();
    const romPath = String(installation.romPath || "").trim();
    if (!installation.romReady || !(await isCompatibleSuperMarioKartRom(romPath))) {
      throw new Error(
        "La ROM Super Mario Kart USA n’est pas prête. Réparez l’installation."
      );
    }

    const emulatorPath = await findNamedFile(
      path.join(installation.path, "BizHawk"),
      "EmuHawk.exe"
    );
    const connectorPath = await findNamedFile(
      path.dirname(emulatorPath || path.join(installation.path, "BizHawk")),
      "connector.lua",
      (candidate) => candidate.toLowerCase().includes(`${path.sep}crowdcontrol${path.sep}`)
    );
    const clientDirectory = path.join(installation.path, "CrowdControl");
    const clientPath = path.join(clientDirectory, "CrowdControl.Client.Slim.exe");
    const packPath = path.join(clientDirectory, "Packs", PACK_FILE_NAME);

    await assertFile(emulatorPath, "BizHawk est introuvable. Réparez l’installation.");
    await assertFile(
      connectorPath,
      "Le connecteur Lua de BizHawk est introuvable. Réparez l’installation."
    );
    await assertFile(
      clientPath,
      "Le client local d’interactions est introuvable. Réparez l’installation."
    );
    await assertFile(
      packPath,
      "Le pack Super Mario Kart est introuvable. Réparez l’installation."
    );

    await this.client.ensureStarted(clientPath);
    await this.client.loadPack(packPath);
    const connector = await this.client.call(
      "loadConnector",
      [NATIVE_CONNECTOR_ID, 10, 1],
      30_000
    );
    if (!connector.success) {
      throw new Error(
        connector.message || "Le connecteur Lua Super Mario Kart n’a pas démarré."
      );
    }

    const child = this.spawnProcess(
      emulatorPath,
      [`--lua=${connectorPath}`, romPath],
      {
        cwd: path.dirname(emulatorPath),
        windowsHide: false,
        shell: false,
        stdio: "ignore"
      }
    );
    child.once("error", () => {});
    child.unref();
    return {
      ok: true,
      gameId: GAME_ID,
      path: emulatorPath,
      romPath,
      message: "BizHawk démarre directement avec Super Mario Kart."
    };
  }

  connectionStatus() {
    if (!this.client.isRunning) {
      throw new Error(
        "Le client Super Mario Kart n’est pas actif. Lancez le jeu depuis ShenPulse."
      );
    }
    if (
      this.client.connectionStatus !== "open" &&
      this.client.gameState !== "ready"
    ) {
      throw new Error(
        "BizHawk n’est pas encore connecté au pack Super Mario Kart. Attendez l’écran de jeu puis réessayez."
      );
    }
    return {
      ok: true,
      type: "super-mario-kart-runtime",
      connectionStatus: this.client.connectionStatus,
      gameState: this.client.gameState,
      packState: this.client.packState
    };
  }

  async trigger(effectId, effectName = "") {
    this.connectionStatus();
    const requestId = crypto.randomUUID();
    const result = await this.client.call(
      "effectRequest",
      [
        {
          requestID: requestId,
          effect: {
            id: String(effectId || "").trim(),
            name: String(effectName || effectId || "").trim()
          },
          quantity: 1,
          requester: {
            service: "twitch",
            serviceID: "shenpulse-local",
            crowdControlID: "00000000-0000-0000-0000-000000000001",
            name: "ShenPulse",
            login: "shenpulse",
            avatarURL: ""
          },
          sourceDetails: { type: "shenpulse" },
          free: true,
          admin: true,
          localTest: true,
          ignoreStateChecks: true,
          skipPipelineDelay: true
        }
      ],
      5_000
    );
    if (!result.success) {
      throw new Error(
        result.message || "L’interaction Super Mario Kart a été refusée."
      );
    }
    return {
      status: "success",
      sent: true,
      requestId,
      effectId: String(effectId || "")
    };
  }

  async stop() {
    const stopped = this.client.isRunning;
    await this.client.stop();
    return { stopped, gameId: GAME_ID, type: "super-mario-kart-runtime" };
  }

  async dispose() {
    await this.client.stop();
  }

  #installation() {
    const installation = this.store.getState().game.installations?.[GAME_ID];
    if (!installation?.path) {
      throw new Error(
        "Installez d’abord BizHawk et le pack Super Mario Kart depuis l’étape Installation."
      );
    }
    return installation;
  }
}

function superMarioKartRomVersion(hash) {
  const clean = String(hash || "").toLowerCase();
  return Object.values(ROM_HASHES).includes(clean)
    ? { name: "Super Mario Kart (USA)" }
    : null;
}

function superMarioKartRomState(romPath, romHash) {
  return {
    romPath: path.resolve(romPath),
    romHash: String(romHash || "").toLowerCase(),
    romName: "Super Mario Kart (USA)",
    romReady: true
  };
}

async function isCompatibleSuperMarioKartRom(filePath) {
  if (!filePath || !/\.(?:sfc|smc)$/i.test(filePath)) return false;
  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat?.isFile()) return false;
  return Boolean(superMarioKartRomVersion(await md5File(filePath)));
}

async function findCompatibleSuperMarioKartRom(rootDirectory, limit = 5_000) {
  const root = path.resolve(String(rootDirectory || ""));
  const rootStat = await fs.promises.stat(root).catch(() => null);
  if (!rootStat?.isDirectory()) return "";
  const pending = [root];
  let visited = 0;
  while (pending.length && visited < limit) {
    const current = pending.shift();
    const entries = await fs.promises
      .readdir(current, { withFileTypes: true })
      .catch(() => []);
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (++visited > limit) break;
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(candidate);
      } else if (
        entry.isFile() &&
        /\.(?:sfc|smc)$/i.test(entry.name) &&
        (await isCompatibleSuperMarioKartRom(candidate))
      ) {
        return candidate;
      }
    }
  }
  return "";
}

async function assertFile(filePath, message) {
  const stat = filePath
    ? await fs.promises.stat(filePath).catch(() => null)
    : null;
  if (!stat?.isFile()) throw new Error(message);
}

async function findNamedFile(directory, fileName, predicate = null) {
  const root = path.resolve(String(directory || ""));
  const stat = await fs.promises.stat(root).catch(() => null);
  if (!stat?.isDirectory()) return "";
  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      if (!predicate || predicate(candidate)) return candidate;
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = await findNamedFile(path.join(root, entry.name), fileName, predicate);
    if (match) return match;
  }
  return "";
}

module.exports = {
  GAME_ID,
  ROM_HASHES,
  SuperMarioKartRuntime,
  findCompatibleSuperMarioKartRom,
  isCompatibleSuperMarioKartRom,
  superMarioKartRomVersion
};
