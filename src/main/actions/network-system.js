"use strict";

/** Actions réseau et système : validation HTTP(S), timeout et permissions explicites.
 * Electron est injecté uniquement pour l’ouverture d’une URL externe.
 */
const { spawn } = require("node:child_process");
const { clamp, safeString } = require("../utils");
const { readState } = require("../state-projection");

async function runHttpAction(config) {
  const url = String(config.url || "");
  if (!/^https?:\/\//i.test(url)) throw new Error("URL HTTP(S) requise.");
  const controller = new AbortController();
  const timeoutMs = clamp(config.timeoutMs || 10000, 500, 30000);
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );
  try {
    const response = await fetch(url, {
      method: config.method || "POST",
      headers: { "Content-Type": "application/json", ...(config.headers || {}) },
      body:
        ["GET", "HEAD"].includes(String(config.method || "POST").toUpperCase())
          ? undefined
          : JSON.stringify(config.body || {}),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
    return { status: response.status, body: text.slice(0, 5000) };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `Délai HTTP dépassé après ${timeoutMs} ms pour ${url}. Augmentez le délai maximal de cette action.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function runSpotifyAction(spotifyService, config, context = {}) {
  if (!spotifyService) throw new Error("Service Spotify indisponible.");
  const prefix = safeString(config.chatCommand, 80).trim();
  if (prefix && ["queue", "request"].includes(String(config.operation || "request"))) {
    const message = safeString(context.event?.data?.message, 1000).trim();
    const command = message.split(/\s/, 1)[0];
    if (context.event?.type !== "chat" || command.toLowerCase() !== prefix.toLowerCase()) {
      return { skipped: true, reason: "song-command" };
    }
    const query = message.slice(command.length).trim();
    if (!query) return { skipped: true, reason: "empty-song-request" };
    return spotifyService.control({ ...config, query, uri: "", track: "" }, { shouldExecute: context.shouldExecute });
  }
  return spotifyService.control(config, { shouldExecute: context.shouldExecute });
}

function sendKeyAction(store, config) {
  if (!readState(store, ["settings.allowKeystrokes"]).settings.allowKeystrokes) {
    throw new Error("La simulation de touches doit être autorisée dans Paramètres.");
  }
  const keys = safeString(config.keys, 200);
  if (!keys) throw new Error("Séquence de touches vide.");
  return new Promise((resolve, reject) => {
    const script =
      "Add-Type -AssemblyName System.Windows.Forms; " +
      "[System.Windows.Forms.SendKeys]::SendWait($args[0])";
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script, keys],
      { windowsHide: true, stdio: "ignore" }
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve({ sent: true });
      else reject(new Error(`Simulation de touches échouée (${code}).`));
    });
  });
}

async function openUrlAction(shell, config) {
  const url = String(config.url || "");
  if (!/^https?:\/\//i.test(url)) throw new Error("Seules les URL HTTP(S) sont permises.");
  await shell.openExternal(url);
  return { opened: true };
}

module.exports = { runHttpAction, runSpotifyAction, sendKeyAction, openUrlAction };
