"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { spawn } = require("node:child_process");

const GAME_ID = "pokemon-red-blue";
const NATIVE_CONNECTOR_ID = "Lua";
const NATIVE_PACK_ID = "PokemonRedBlue";
const PACK_FILE_NAME = "PokemonRedBlue.dll";
const RED_PATCH_FILE_NAME = "PokemonRedBlue.Red.ips";
const BLUE_PATCH_FILE_NAME = "PokemonRedBlue.Blue.ips";
const ROM_FILE_NAME = "PokemonRedBlue-Original.gb";
const PATCHED_ROM_FILE_NAME = "PokemonRedBlue-ShenPulse.gb";

const ROM_HASHES = Object.freeze({
  redBase: "3d45c1ee9abd5738df46d2bdda8b57dc",
  blueBase: "50927e843568814f7ed45ec4f944bd8b",
  redPatched: "78ae0f28d31702ceb02fd3809dcc0144",
  bluePatched: "325a11a5f6e46836c8485f9ed4c357ce"
});

class PokemonRedBlueRuntime {
  constructor({ app, store, getWindow, dialog, spawnProcess = spawn }) {
    this.app = app;
    this.store = store;
    this.getWindow = getWindow;
    this.dialog = dialog;
    this.client = new CrowdControlSlimClient({ spawnProcess });
  }

  async prepareInstallation(targetPath, previousInstallation = null) {
    const remembered = String(previousInstallation?.romPath || "").trim();
    const candidates = [];
    if (remembered) candidates.push(remembered);

    const managedRom = path.join(targetPath, "ROM", PATCHED_ROM_FILE_NAME);
    if (!candidates.includes(managedRom)) candidates.push(managedRom);

    for (const candidate of candidates) {
      if (await isCompatiblePokemonRom(candidate)) {
        return pokemonRomState(candidate, await md5File(candidate));
      }
    }

    const bundledRom = path.join(targetPath, "ROM", ROM_FILE_NAME);
    if (await isCompatiblePokemonRom(bundledRom)) {
      return importPokemonRom({ sourcePath: bundledRom, targetPath });
    }

    const documentsRomRoot = path.join(this.app.getPath("documents"), "roms");
    const detected = await findCompatiblePokemonRom(documentsRomRoot);
    if (!detected) return emptyPokemonRomState();
    return importPokemonRom({ sourcePath: detected, targetPath });
  }

  async selectRom() {
    const installation = this.#installation();
    const result = await this.dialog.showOpenDialog(this.getWindow(), {
      title: "Sélectionnez votre copie légale de Pokémon Rouge ou Bleu",
      defaultPath: this.app.getPath("documents"),
      buttonLabel: "Utiliser cette ROM",
      filters: [
        { name: "ROM Game Boy", extensions: ["gb", "gbc"] }
      ],
      properties: ["openFile"]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };

    const rom = await importPokemonRom({
      sourcePath: result.filePaths[0],
      targetPath: installation.path
    });
    this.store.mutate((state) => {
      const current = state.game.installations?.[GAME_ID];
      if (current) Object.assign(current, rom);
    });
    return { ok: true, gameId: GAME_ID, ...rom };
  }

  async launch() {
    const installation = this.#installation();
    const romPath = String(installation.romPath || "").trim();
    if (!installation.romReady || !(await isCompatiblePokemonRom(romPath))) {
      throw new Error(
        "Sélectionnez d’abord votre copie légale de Pokémon Rouge ou Bleu depuis l’étape Installation."
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
      "Le pack Pokémon Rouge/Bleu est introuvable. Réparez l’installation."
    );

    await this.client.ensureStarted(clientPath);
    await this.client.loadPack(packPath);
    const connector = await this.client.call("loadConnector", [
      NATIVE_CONNECTOR_ID,
      10,
      1
    ], 30_000);
    if (!connector.success) {
      throw new Error(
        connector.message || "Le connecteur Lua Pokémon n’a pas démarré."
      );
    }

    const child = spawn(emulatorPath, [`--lua=${connectorPath}`, romPath], {
      cwd: path.dirname(emulatorPath),
      windowsHide: false,
      shell: false,
      stdio: "ignore"
    });
    child.once("error", () => {});
    child.unref();
    return {
      ok: true,
      gameId: GAME_ID,
      path: emulatorPath,
      romPath,
      message: "BizHawk démarre directement avec Pokémon Rouge/Bleu."
    };
  }

  connectionStatus() {
    if (!this.client.isRunning) {
      throw new Error(
        "Le client Pokémon n’est pas actif. Lancez le jeu depuis ShenPulse."
      );
    }
    if (
      this.client.connectionStatus !== "open" &&
      this.client.gameState !== "ready"
    ) {
      throw new Error(
        "BizHawk n’est pas encore connecté au pack Pokémon. Attendez l’écran de jeu puis réessayez."
      );
    }
    return {
      ok: true,
      type: "pokemon-runtime",
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
      throw new Error(result.message || "L’interaction Pokémon a été refusée.");
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
    return { stopped, gameId: GAME_ID, type: "pokemon-runtime" };
  }

  async dispose() {
    await this.client.stop();
  }

  #installation() {
    const installation = this.store.getState().game.installations?.[GAME_ID];
    if (!installation?.path) {
      throw new Error(
        "Installez d’abord BizHawk et le pack Pokémon depuis l’étape Installation."
      );
    }
    return installation;
  }
}

class CrowdControlSlimClient {
  constructor({
    spawnProcess = spawn,
    packId = NATIVE_PACK_ID,
    gameLabel = "Pokémon Rouge/Bleu"
  } = {}) {
    this.spawnProcess = spawnProcess;
    this.packId = packId;
    this.gameLabel = gameLabel;
    this.process = null;
    this.pendingCalls = new Map();
    this.connectionStatus = "";
    this.gameState = "";
    this.packState = "";
    this.lastError = "";
    this.packLoaded = false;
  }

  get isRunning() {
    return Boolean(this.process && this.process.exitCode === null && !this.process.killed);
  }

  async ensureStarted(executablePath) {
    if (this.isRunning) return;
    this.connectionStatus = "";
    this.gameState = "";
    this.packState = "";
    this.lastError = "";
    this.packLoaded = false;

    const child = this.spawnProcess(executablePath, [], {
      cwd: path.dirname(executablePath),
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.process = child;
    const output = readline.createInterface({ input: child.stdout });
    output.on("line", (line) => this.#handleLine(line));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      const message = String(chunk || "").trim();
      if (message) this.lastError = message;
    });
    child.once("exit", () => this.#handleExit());
    child.once("error", (error) => {
      this.lastError = error.message;
      this.#handleExit(error);
    });
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    this.fireAndForget("logLevel", ["warning", "error"]);
  }

  async loadPack(packPath) {
    if (this.packLoaded && this.isRunning) return;
    const result = await this.call(
      "loadPack",
      [
        packPath,
        this.packId,
        {
          name: "ShenPulse",
          id: "00000000-0000-0000-0000-000000000001",
          service: "twitch",
          ccUID: "00000000-0000-0000-0000-000000000002"
        }
      ],
      120_000
    );
    if (!result.success) {
      throw new Error(
        result.message || `Le pack ${this.gameLabel} n’a pas pu être chargé.`
      );
    }
    this.packLoaded = true;
  }

  call(method, args = [], timeoutMs = 5_000) {
    if (!this.isRunning || !this.process.stdin?.writable) {
      return Promise.reject(new Error("Le client local d’interactions est arrêté."));
    }
    const requestId = crypto.randomUUID();
    const payload = JSON.stringify({
      id: requestId,
      type: "call",
      method,
      args
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(requestId);
        reject(new Error(`Délai dépassé en attente du client ${this.gameLabel}.`));
      }, Math.max(1_000, Number(timeoutMs) || 5_000));
      this.pendingCalls.set(requestId, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
      this.process.stdin.write(`${payload}\r\n`, "utf8", (error) => {
        if (!error) return;
        const pending = this.pendingCalls.get(requestId);
        this.pendingCalls.delete(requestId);
        pending?.reject(error);
      });
    });
  }

  fireAndForget(method, args = []) {
    if (!this.isRunning || !this.process.stdin?.writable) return;
    this.process.stdin.write(
      `${JSON.stringify({
        id: crypto.randomUUID(),
        type: "call",
        method,
        args
      })}\r\n`
    );
  }

  async stop() {
    const child = this.process;
    this.process = null;
    this.packLoaded = false;
    if (!child || child.exitCode !== null || child.killed) {
      this.#rejectPending(new Error(`Le client ${this.gameLabel} est arrêté.`));
      return;
    }
    child.kill();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  #handleLine(line) {
    let message;
    try {
      message = JSON.parse(String(line || "").trim());
    } catch {
      return;
    }
    if (message.type === "call") {
      const first = Array.isArray(message.args) ? String(message.args[0] || "") : "";
      if (message.method === "connectionStatusChanged") {
        this.connectionStatus = first;
      } else if (message.method === "packStateChanged") {
        this.packState = first;
      } else if (message.method === "gameStateChanged") {
        this.gameState = first;
      }
      return;
    }
    if (!['return', 'exception'].includes(message.type)) return;
    const pending = this.pendingCalls.get(String(message.id || ""));
    if (!pending) return;
    this.pendingCalls.delete(String(message.id || ""));
    if (message.type === "exception") {
      pending.reject(
        new Error(String(message.message || `Exception du client ${this.gameLabel}.`))
      );
      return;
    }
    const value = message.value;
    if (Array.isArray(value) && typeof value[0] === "boolean") {
      pending.resolve({
        success: value[0],
        message: typeof value[1] === "string" ? value[1] : "",
        value
      });
      return;
    }
    pending.resolve({ success: value !== false, message: "", value });
  }

  #handleExit(error = null) {
    if (error) this.lastError = error.message;
    this.process = null;
    this.packLoaded = false;
    this.connectionStatus = "";
    this.gameState = "";
    this.packState = "";
    this.#rejectPending(
      error || new Error(`Le client ${this.gameLabel} s’est arrêté.`)
    );
  }

  #rejectPending(error) {
    for (const pending of this.pendingCalls.values()) pending.reject(error);
    this.pendingCalls.clear();
  }
}

async function importPokemonRom({ sourcePath, targetPath }) {
  const source = path.resolve(String(sourcePath || ""));
  const sourceStat = await fs.promises.stat(source).catch(() => null);
  if (!sourceStat?.isFile() || !/\.(?:gb|gbc)$/i.test(source)) {
    throw new Error("Sélectionnez une ROM Game Boy .gb ou .gbc.");
  }
  const sourceHash = await md5File(source);
  const version = pokemonRomVersion(sourceHash);
  if (!version) {
    throw new Error(
      "Cette ROM n’est pas compatible. Utilisez Pokémon Red ou Blue (USA/Europe, SGB Enhanced)."
    );
  }

  const romDirectory = safeChildPath(targetPath, "ROM");
  await fs.promises.mkdir(romDirectory, { recursive: true });
  const patchedPath = path.join(romDirectory, PATCHED_ROM_FILE_NAME);
  if (version.patched) {
    await copyFileAtomic(source, patchedPath);
    return pokemonRomState(patchedPath, sourceHash, version.name);
  }

  const originalPath = path.join(romDirectory, ROM_FILE_NAME);
  await copyFileAtomic(source, originalPath);
  const patchPath = safeChildPath(
    targetPath,
    path.join("Patches", version.patchFile)
  );
  await assertFile(
    patchPath,
    "Le correctif Pokémon ShenPulse est introuvable. Réparez l’installation."
  );
  const patched = applyIpsPatch(
    await fs.promises.readFile(originalPath),
    await fs.promises.readFile(patchPath)
  );
  await writeFileAtomic(patchedPath, patched);
  const patchedHash = await md5File(patchedPath);
  if (patchedHash !== version.expectedPatchedHash) {
    await fs.promises.rm(patchedPath, { force: true });
    throw new Error("La ROM Pokémon préparée n’a pas l’empreinte attendue.");
  }
  return pokemonRomState(patchedPath, patchedHash, version.name);
}

function pokemonRomVersion(hash) {
  const clean = String(hash || "").toLowerCase();
  if (clean === ROM_HASHES.redBase) {
    return {
      name: "Pokémon Rouge",
      patchFile: RED_PATCH_FILE_NAME,
      expectedPatchedHash: ROM_HASHES.redPatched,
      patched: false
    };
  }
  if (clean === ROM_HASHES.blueBase) {
    return {
      name: "Pokémon Bleu",
      patchFile: BLUE_PATCH_FILE_NAME,
      expectedPatchedHash: ROM_HASHES.bluePatched,
      patched: false
    };
  }
  if (clean === ROM_HASHES.redPatched) {
    return { name: "Pokémon Rouge", patched: true };
  }
  if (clean === ROM_HASHES.bluePatched) {
    return { name: "Pokémon Bleu", patched: true };
  }
  return null;
}

function pokemonRomState(romPath, romHash, romName = "") {
  const version = pokemonRomVersion(romHash);
  return {
    romPath: path.resolve(romPath),
    romHash: String(romHash || "").toLowerCase(),
    romName: romName || version?.name || "Pokémon Rouge/Bleu",
    romReady: true
  };
}

function emptyPokemonRomState() {
  return { romPath: "", romHash: "", romName: "", romReady: false };
}

async function findCompatiblePokemonRom(rootDirectory, limit = 5_000) {
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
      } else if (entry.isFile() && /\.(?:gb|gbc)$/i.test(entry.name)) {
        if (await isCompatiblePokemonRom(candidate)) return candidate;
      }
    }
  }
  return "";
}

async function isCompatiblePokemonRom(filePath) {
  if (!filePath) return false;
  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat?.isFile()) return false;
  return Boolean(pokemonRomVersion(await md5File(filePath)));
}

function applyIpsPatch(sourceBytes, patchBytes) {
  if (!Buffer.isBuffer(sourceBytes)) sourceBytes = Buffer.from(sourceBytes || []);
  if (!Buffer.isBuffer(patchBytes)) patchBytes = Buffer.from(patchBytes || []);
  if (patchBytes.length < 8 || patchBytes.subarray(0, 5).toString("ascii") !== "PATCH") {
    throw new Error("Correctif IPS Pokémon invalide.");
  }
  let output = Buffer.from(sourceBytes);
  let index = 5;
  while (index < patchBytes.length) {
    if (index + 3 > patchBytes.length) throw new Error("Correctif IPS Pokémon tronqué.");
    if (patchBytes.subarray(index, index + 3).toString("ascii") === "EOF") {
      index += 3;
      break;
    }
    const offset = patchBytes.readUIntBE(index, 3);
    index += 3;
    if (index + 2 > patchBytes.length) throw new Error("Correctif IPS Pokémon tronqué.");
    const size = patchBytes.readUInt16BE(index);
    index += 2;
    if (size === 0) {
      if (index + 3 > patchBytes.length) throw new Error("Correctif IPS Pokémon tronqué.");
      const repeat = patchBytes.readUInt16BE(index);
      const value = patchBytes[index + 2];
      index += 3;
      output = ensureBufferSize(output, offset + repeat);
      output.fill(value, offset, offset + repeat);
    } else {
      if (index + size > patchBytes.length) throw new Error("Correctif IPS Pokémon tronqué.");
      output = ensureBufferSize(output, offset + size);
      patchBytes.copy(output, offset, index, index + size);
      index += size;
    }
  }
  if (index + 3 <= patchBytes.length) {
    const truncateSize = patchBytes.readUIntBE(index, 3);
    if (truncateSize !== output.length) {
      const resized = Buffer.alloc(truncateSize);
      output.copy(resized, 0, 0, Math.min(output.length, truncateSize));
      output = resized;
    }
  }
  return output;
}

function ensureBufferSize(buffer, size) {
  if (size <= buffer.length) return buffer;
  const resized = Buffer.alloc(size);
  buffer.copy(resized);
  return resized;
}

async function md5File(filePath) {
  const hash = crypto.createHash("md5");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

async function copyFileAtomic(sourcePath, destinationPath) {
  if (path.resolve(sourcePath) === path.resolve(destinationPath)) return;
  const temporaryPath = `${destinationPath}.importing`;
  await fs.promises.rm(temporaryPath, { force: true });
  await fs.promises.copyFile(sourcePath, temporaryPath);
  await replaceFile(temporaryPath, destinationPath);
}

async function writeFileAtomic(destinationPath, bytes) {
  const temporaryPath = `${destinationPath}.patching`;
  await fs.promises.rm(temporaryPath, { force: true });
  await fs.promises.writeFile(temporaryPath, bytes);
  await replaceFile(temporaryPath, destinationPath);
}

async function replaceFile(temporaryPath, destinationPath) {
  await fs.promises.rm(destinationPath, { force: true });
  await fs.promises.rename(temporaryPath, destinationPath);
}

function safeChildPath(rootPath, relativePath) {
  const root = path.resolve(rootPath);
  const target = path.resolve(root, relativePath);
  const prefix = `${root}${path.sep}`;
  if (target !== root && !target.startsWith(prefix)) {
    throw new Error("Chemin Pokémon non sûr.");
  }
  return target;
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
  CrowdControlSlimClient,
  GAME_ID,
  PokemonRedBlueRuntime,
  ROM_HASHES,
  applyIpsPatch,
  findCompatiblePokemonRom,
  importPokemonRom,
  isCompatiblePokemonRom,
  md5File,
  pokemonRomVersion
};
