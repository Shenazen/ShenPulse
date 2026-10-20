"use strict";

const fs = require("node:fs");
const path = require("node:path");

function streamDeckPluginDestination(appData = process.env.APPDATA) {
  return appData ? path.join(appData, "Elgato", "StreamDeck", "Plugins", "com.shenpulse.control.sdPlugin") : "";
}

/** readFile/writeFile fonctionnent aussi depuis le paquet ASAR, contrairement à cpSync. */
function copyPluginFiles(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyPluginFiles(from, to);
    else if (entry.isFile()) fs.writeFileSync(to, fs.readFileSync(from));
    else throw new Error("Le plugin contient un fichier non pris en charge.");
  }
}

function installStreamDeckPlugin(pluginDirectory, pluginIconPath = "") {
  if (!pluginDirectory || !fs.existsSync(path.join(pluginDirectory, "manifest.json"))) {
    throw new Error("Le plugin Stream Deck est absent de cette version de ShenPulse. Réinstallez l’application.");
  }
  const destination = streamDeckPluginDestination();
  if (!destination) throw new Error("Le dossier utilisateur Windows est indisponible.");
  try {
    copyPluginFiles(pluginDirectory, destination);
    const icon = pluginIconPath || path.resolve(pluginDirectory, "../../../src/renderer/assets/brand/shenpulse-512.png");
    if (fs.existsSync(icon)) {
      const images = path.join(destination, "images");
      fs.mkdirSync(images, { recursive: true });
      const data = fs.readFileSync(icon);
      for (const name of ["plugin.png", "plugin@2x.png", "action.png", "action@2x.png"]) fs.writeFileSync(path.join(images, name), data);
    }
    return { installed: true, path: destination, restartRequired: true };
  } catch (error) {
    if (["EACCES", "EPERM", "EBUSY"].includes(error.code)) {
      throw new Error("Fermez le logiciel Stream Deck, puis relancez l’installation du plugin.", { cause: error });
    }
    throw new Error("L’installation du plugin Stream Deck a échoué. Réessayez après avoir fermé Stream Deck.", { cause: error });
  }
}

module.exports = { installStreamDeckPlugin, streamDeckPluginDestination };
