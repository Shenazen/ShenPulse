"use strict";

/** Dialogue avec les serveurs Minecraft et suivi des compteurs. Les opérations et garde-fous restent identiques. */
const fs = require("node:fs");
const path = require("node:path");
const { safeChildPath } = require("./paths");

async function writeMinecraftEula(installationPath) {
  const eulaPath = safeChildPath(installationPath, "eula.txt");
  await fs.promises.mkdir(path.dirname(eulaPath), { recursive: true });
  await fs.promises.writeFile(
    eulaPath,
    [
      "# Accepted explicitly through ShenPulse.",
      "# https://aka.ms/MinecraftEULA",
      "eula=true",
      ""
    ].join("\r\n"),
    "utf8"
  );
}

async function configureMinecraftServerCommandFeedback(
  installationPath,
  { creativeMode = true } = {}
) {
  const propertiesPath = safeChildPath(
    installationPath,
    "server.properties"
  );
  const original = await fs.promises
    .readFile(propertiesPath, "utf8")
    .catch(() => "");
  let updated = original;
  updated = upsertMinecraftServerProperty(
    updated,
    "broadcast-console-to-ops",
    "false"
  );
  updated = upsertMinecraftServerProperty(
    updated,
    "broadcast-rcon-to-ops",
    "false"
  );
  updated = upsertMinecraftServerProperty(
    updated,
    "gamemode",
    creativeMode ? "creative" : "survival"
  );
  updated = upsertMinecraftServerProperty(
    updated,
    "force-gamemode",
    "true"
  );
  updated = upsertMinecraftServerProperty(
    updated,
    "allow-flight",
    creativeMode ? "true" : "false"
  );
  if (updated !== original) {
    await fs.promises.writeFile(propertiesPath, updated, "utf8");
  }
  return propertiesPath;
}

function upsertMinecraftServerProperty(source, key, value) {
  const newline = String(source).includes("\r\n") ? "\r\n" : "\n";
  const lines = String(source || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  let replaced = false;
  const next = [];
  for (const line of lines) {
    if (!line.startsWith(`${key}=`)) {
      next.push(line);
      continue;
    }
    if (!replaced) next.push(`${key}=${value}`);
    replaced = true;
  }
  if (!replaced) {
    while (next.length && !next[next.length - 1]) next.pop();
    next.push(`${key}=${value}`, "");
  }
  return next.join(newline);
}

async function silenceMinecraftCommandFeedback(record) {
  for (const command of [
    "gamerule sendCommandFeedback false",
    "gamerule commandBlockOutput false",
    "gamerule logAdminCommands false",
    "gamerule announceAdvancements false",
    "gamerule showDeathMessages false"
  ]) {
    await writeMinecraftServerCommand(record, command);
  }
}

async function enforceMinecraftCreativeMode(record) {
  for (const command of [
    "defaultgamemode creative",
    "gamemode creative @a"
  ]) {
    await writeMinecraftServerCommand(record, command);
  }
}

function createMinecraftServerRecord({
  child,
  gameId,
  installationPath,
  javaPath,
  serverPath,
  port,
  onWinCounter = () => {}
}) {
  const record = {
    process: child,
    gameId,
    installationPath,
    javaPath,
    serverPath,
    port,
    logTail: "",
    ready: null
  };
  let settled = false;
  let partial = "";
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  record.ready = ready;
  const timer = setTimeout(() => {
    fail(
      "Le serveur Minecraft n’a pas terminé son premier démarrage dans les cinq minutes."
    );
  }, 300_000);

  const succeed = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    resolveReady(record);
  };
  const fail = (message) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    const detail = record.logTail
      ? `\n\nDernier message PaperMC : ${record.logTail}`
      : "";
    rejectReady(new Error(`${message}${detail}`));
  };
  const remember = (chunk) => {
    partial += String(chunk || "");
    const lines = partial.split(/\r?\n/);
    partial = lines.pop() || "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      record.logTail = line.slice(-800);
      const winCounterEvent = parseMinecraftWinCounterLine(line);
      if (winCounterEvent) {
        Promise.resolve(onWinCounter(winCounterEvent)).catch(() => {});
      }
      if (
        /\bDone \(.+\)! For help, type/i.test(line) ||
        /For help, type "help"/i.test(line)
      ) {
        succeed();
      } else if (
        /FAILED TO BIND TO PORT|Address already in use|Failed to bind to port/i.test(
          line
        )
      ) {
        fail(
          "Le port Minecraft 25565 est déjà utilisé. Fermez l’autre serveur puis réessayez."
        );
      } else if (
        /You need to agree to the EULA|eula\.txt.*false/i.test(line)
      ) {
        fail(
          "PaperMC n’a pas reconnu l’acceptation du CLUF Minecraft."
        );
      }
    }
  };

  child.stdout?.on("data", remember);
  child.stderr?.on("data", remember);
  child.once("error", (error) => {
    fail(`Impossible de lancer Java 21 : ${error.message}`);
  });
  child.once("exit", (code) => {
    if (!settled) {
      fail(
        `Le serveur Minecraft s’est arrêté avant d’être prêt (code ${String(
          code ?? "inconnu"
        )}).`
      );
    }
  });
  return record;
}

function parseMinecraftWinCounterLine(line) {
  const match = String(line || "").match(
    /SHENPULSE_WIN_COUNTER\s+current=(-?\d+)\b[\s\S]*?\bsource=([a-z0-9-]+)/i
  );
  if (!match) return null;
  const source = String(match[2] || "").toLowerCase();
  if (!["auto-win", "bedrock-win", "timer-penalty"].includes(source)) {
    return null;
  }
  return {
    current: Number(match[1]),
    outcome: source === "timer-penalty" ? "loss" : "win",
    source
  };
}

function minecraftServerResult(record) {
  return {
    running: Boolean(
      record?.process &&
        record.process.exitCode === null &&
        !record.process.killed
    ),
    address: `127.0.0.1:${Number(record?.port || 25565)}`,
    host: "127.0.0.1",
    port: Number(record?.port || 25565),
    javaPath: record?.javaPath || "",
    serverPath: record?.serverPath || ""
  };
}

function minecraftAutoClickerResult(record) {
  return {
    installed: Boolean(record?.executablePath),
    running: Boolean(
      record?.process &&
        record.process.exitCode === null &&
        !record.process.killed
    ),
    executablePath: record?.executablePath || ""
  };
}

function sanitizeMinecraftConsoleCommand(value) {
  return String(value || "")
    .replace(/[\0\r\n]/g, " ")
    .trim()
    .replace(/^\/+/, "")
    .slice(0, 2000);
}

function writeMinecraftServerCommand(record, command) {
  const child = record?.process;
  if (
    !child ||
    child.exitCode !== null ||
    child.killed ||
    !child.stdin ||
    child.stdin.destroyed
  ) {
    throw new Error("La console du serveur Minecraft n’est plus disponible.");
  }
  return new Promise((resolve, reject) => {
    child.stdin.write(`${command}\r\n`, "utf8", (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function stopMinecraftServerRecord(record) {
  const child = record?.process;
  if (!child || child.exitCode !== null || child.killed) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    child.stdin?.write("stop\r\n");
    child.stdin?.end();
  } catch {
    // Le serveur peut avoir fermé sa console pendant son arrêt.
  }
  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 10_000))
  ]);
  if (graceful || child.exitCode !== null) return;
  try {
    child.kill();
  } catch {
    // Le processus a pu se fermer entre les deux contrôles.
  }
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 2_000))
  ]);
}

module.exports = {
  writeMinecraftEula,
  configureMinecraftServerCommandFeedback,
  upsertMinecraftServerProperty,
  silenceMinecraftCommandFeedback,
  enforceMinecraftCreativeMode,
  createMinecraftServerRecord,
  parseMinecraftWinCounterLine,
  minecraftServerResult,
  minecraftAutoClickerResult,
  sanitizeMinecraftConsoleCommand,
  writeMinecraftServerCommand,
  stopMinecraftServerRecord,
};

