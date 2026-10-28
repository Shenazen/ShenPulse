"use strict";

const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

const MAIN_RENDERER_URL = pathToFileURL(path.join(__dirname, "..", "renderer", "index.html")).href;

function sameLocalDocumentUrl(value, expectedUrl, platform = process.platform) {
  try {
    const documentPath = (input) => {
      const url = new URL(input);
      if (url.protocol !== "file:" || url.hostname || url.search || url.hash) return "";
      const windows = platform === "win32";
      const filename = (windows ? path.win32 : path.posix).resolve(fileURLToPath(url, { windows }));
      return windows ? filename.toLowerCase() : filename;
    };
    const filename = documentPath(value);
    return Boolean(filename && filename === documentPath(expectedUrl));
  } catch {
    return false;
  }
}

function assertIntegrationIpcSender(channel, event, mainWindow) {
  if (!["sound:remove", "startup:ready", "overlay:game-pack-presentation", "game:uninstall", "game:interactions:reset", "game:interactions:move", "game:wins:level"].includes(channel) && !["kick:", "controllers:", "live-directory:", "users:", "spotify:", "chatbot:", "irl:", "matches:", "studio:"].some((prefix) => channel.startsWith(prefix))) return;
  let trusted = false;
  try {
    const contents = mainWindow?.webContents;
    const frame = event?.senderFrame;
    trusted = Boolean(
      contents && !mainWindow.isDestroyed() && !contents.isDestroyed() &&
      event?.sender === contents && frame && frame === contents.mainFrame &&
      sameLocalDocumentUrl(contents.getURL(), MAIN_RENDERER_URL) &&
      sameLocalDocumentUrl(frame.url, MAIN_RENDERER_URL)
    );
  } catch {
    // A frame destroyed during dispatch is not a trusted sender.
  }
  if (!trusted) {
    const error = new Error("Cette commande est réservée à la fenêtre principale de ShenPulse.");
    error.code = "IPC_SENDER_FORBIDDEN";
    throw error;
  }
}

module.exports = { assertIntegrationIpcSender, sameLocalDocumentUrl, MAIN_RENDERER_URL };
