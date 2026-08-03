"use strict";

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 9000;

class IrlPythonBridge {
  constructor({
    scriptPath,
    platform = process.platform,
    spawnImpl = spawn,
    commandCandidates
  }) {
    this.scriptPath = resolveScriptPath(scriptPath);
    this.spawn = spawnImpl;
    this.commandCandidates = commandCandidates || pythonCandidates(platform);
    this.child = null;
    this.reader = null;
    this.startPromise = null;
    this.readyInfo = null;
    this.interpreter = "";
    this.lastError = "";
    this.stderr = "";
    this.pending = new Map();
    this.stopping = false;
  }

  status() {
    return {
      kind: "python",
      state: this.child && this.readyInfo ? "running" : this.lastError ? "unavailable" : "idle",
      interpreter: this.interpreter,
      protocol: Number(this.readyInfo?.protocol || 0),
      giftRules: Number(this.readyInfo?.giftRules || 0),
      error: this.lastError
    };
  }

  health() {
    return this.#request("health");
  }

  identify(host) {
    return this.#request("shelly.identify", { host });
  }

  provision({ host, generation, ssid, password }) {
    return this.#request("shelly.provision", {
      host,
      generation,
      ssid,
      password
    });
  }

  control(device, operation, durationMs) {
    return this.#request("shelly.control", {
      device: {
        host: device?.host,
        generation: device?.generation,
        channel: device?.channel
      },
      operation,
      durationMs
    });
  }

  async stop() {
    const child = this.child;
    if (!child) return;
    this.stopping = true;
    try {
      if (this.readyInfo) {
        await this.#requestStarted("shutdown", {}, 1800).catch(() => {});
      }
    } finally {
      if (this.child === child) {
        child.kill();
        this.#clearChild(child);
      }
      this.stopping = false;
    }
  }

  async #request(command, params = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    await this.#ensureStarted();
    return this.#requestStarted(command, params, timeoutMs);
  }

  #requestStarted(command, params, timeoutMs = REQUEST_TIMEOUT_MS) {
    const child = this.child;
    if (!child || !this.readyInfo || !child.stdin?.writable) {
      return Promise.reject(unavailableError("Le moteur Python IRL n'est pas démarré."));
    }
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(unavailableError(`Le moteur Python IRL ne répond pas à ${command}.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      const message = `${JSON.stringify({ id, command, params })}\n`;
      child.stdin.write(message, "utf8", (error) => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(id);
        pending.reject(unavailableError(error.message));
      });
    });
  }

  async #ensureStarted() {
    if (this.child && this.readyInfo) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.#start().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async #start() {
    if (!fs.existsSync(this.scriptPath)) {
      throw unavailableError("Le serveur Python IRL embarqué est introuvable.");
    }
    let failure = null;
    for (const candidate of this.commandCandidates) {
      try {
        await this.#launch(candidate);
        this.lastError = "";
        return;
      } catch (error) {
        failure = error;
      }
    }
    this.lastError = cleanMessage(failure?.message || "Python 3 est introuvable.");
    throw unavailableError(this.lastError);
  }

  #launch(candidate) {
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = this.spawn(
          candidate.command,
          [...(candidate.args || []), this.scriptPath],
          {
            cwd: path.dirname(this.scriptPath),
            env: {
              ...process.env,
              PYTHONIOENCODING: "utf-8",
              PYTHONUNBUFFERED: "1",
              PYTHONUTF8: "1"
            },
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true
          }
        );
      } catch (error) {
        reject(unavailableError(error.message));
        return;
      }

      this.child = child;
      this.readyInfo = null;
      this.stderr = "";
      let settled = false;
      const finishFailure = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.#clearChild(child);
        reject(unavailableError(error.message));
      };
      const timer = setTimeout(() => {
        child.kill();
        finishFailure(new Error("Le démarrage du moteur Python IRL a expiré."));
      }, START_TIMEOUT_MS);

      this.reader = readline.createInterface({ input: child.stdout });
      this.reader.on("line", (line) => {
        const message = parseMessage(line);
        if (!message) return;
        if (message.type === "ready" && !settled) {
          settled = true;
          clearTimeout(timer);
          this.readyInfo = message;
          this.interpreter = path.basename(candidate.command);
          resolve();
          return;
        }
        this.#handleResponse(message);
      });
      child.stderr.on("data", (chunk) => {
        this.stderr = `${this.stderr}${String(chunk)}`.slice(-2000);
      });
      child.once("error", (error) => {
        if (!settled) {
          finishFailure(error);
          return;
        }
        this.#handleExit(child, error);
      });
      child.once("exit", (code, signal) => {
        const suffix = this.stderr.trim();
        const detail = suffix || `arrêt ${signal || (code ?? "inconnu")}`;
        const error = new Error(`Le moteur Python IRL s'est arrêté (${detail}).`);
        if (!settled) {
          finishFailure(error);
          return;
        }
        this.#handleExit(child, error);
      });
    });
  }

  #handleResponse(message) {
    const id = String(message?.id || "");
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    if (message.ok === true) {
      pending.resolve(message.result);
      return;
    }
    const error = new Error(cleanMessage(message.error || "Erreur Python IRL."));
    error.code = "IRL_PYTHON_ERROR";
    pending.reject(error);
  }

  #handleExit(child, error) {
    if (this.child !== child) return;
    if (!this.stopping) this.lastError = cleanMessage(error.message);
    this.#clearChild(child, error);
  }

  #clearChild(child, error = null) {
    if (this.child !== child) return;
    this.reader?.close();
    this.reader = null;
    this.child = null;
    this.readyInfo = null;
    if (error) {
      const failure = unavailableError(error.message);
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(failure);
      }
      this.pending.clear();
    }
  }
}

function pythonCandidates(platform) {
  const candidates = [];
  const configured = String(process.env.SHENPULSE_PYTHON_PATH || "").trim();
  if (configured) candidates.push({ command: configured, args: [] });
  if (platform === "win32") {
    candidates.push(
      { command: "py.exe", args: ["-3"] },
      { command: "python.exe", args: [] }
    );
  } else {
    candidates.push(
      { command: "python3", args: [] },
      { command: "python", args: [] }
    );
  }
  return candidates;
}

function resolveScriptPath(value) {
  const original = path.resolve(String(value || ""));
  const unpacked = original.replace(
    /([\\/])app\.asar([\\/])/i,
    "$1app.asar.unpacked$2"
  );
  return unpacked !== original && fs.existsSync(unpacked) ? unpacked : original;
}

function parseMessage(line) {
  try {
    return JSON.parse(String(line || ""));
  } catch {
    return null;
  }
}

function cleanMessage(value) {
  return String(value || "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 500);
}

function unavailableError(message) {
  const error = new Error(cleanMessage(message));
  error.code = "IRL_PYTHON_UNAVAILABLE";
  return error;
}

module.exports = {
  IrlPythonBridge,
  pythonCandidates,
  resolveScriptPath
};
