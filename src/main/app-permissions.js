"use strict";
const { fileURLToPath } = require("node:url");
const path = require("node:path");

function localDocumentPath(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "file:" || url.hostname || url.search || url.hash) return "";
    const filename = path.resolve(fileURLToPath(url));
    return process.platform === "win32" ? filename.toLowerCase() : filename;
  } catch { return ""; }
}

function appPermissionAllowed({ permission, requestingUrl = "", contentsUrl = "", isMainFrame = false, authenticated = false, rendererDirectory, overlayPort }) {
  const rendererBase = process.platform === "win32" ? path.resolve(rendererDirectory).toLowerCase() : path.resolve(rendererDirectory);
  const mainPath = path.join(rendererBase, "index.html");
  const requestPath = localDocumentPath(requestingUrl);
  const contentsPath = localDocumentPath(contentsUrl);
  const main = isMainFrame && requestPath === mainPath && contentsPath === mainPath;
  // Hardware access is restricted to the authenticated main renderer, never an embedded source.
  // Chromium regroupe désormais tout Web MIDI sous midiSysex, y compris
  // requestMIDIAccess({ sysex: false }). L'interface conserve sysex: false.
  // Voir electron v43.2.0/spec/webview-spec.ts (permission request handlers).
  if (["midi", "midiSysex"].includes(permission)) return main && authenticated;
  if (permission === "speaker-selection") return main && authenticated;
  const ownDocument = contentsPath.startsWith(`${rendererBase}${path.sep}`) && requestPath.startsWith(`${rendererBase}${path.sep}`);
  let ownOverlay = false;
  try {
    const url = new URL(requestingUrl);
    ownOverlay = url.protocol === "http:" && url.hostname === "127.0.0.1" && Number(url.port) === Number(overlayPort);
  } catch {}
  if (["loopback-network", "local-network-access", "local-network"].includes(permission)) return ownDocument || ownOverlay;
  if (["pointerLock", "keyboardLock", "clipboard-sanitized-write", "fullscreen"].includes(permission)) return ownDocument;
  return false;
}
module.exports = { appPermissionAllowed };
