"use strict";

const { readState } = require("../state-projection");

/** Choix et validation du dossier cible, avant tout téléchargement. Dépendances injectées via runtime. */
const fs = require("node:fs");
const path = require("node:path");
const { findLaunchTarget } = require("./paths");
const { detectInstalledGame } = require("./discovery");

async function pickTarget(runtime, gameId, manifest) {
    const previous =
      readState(runtime.store, ["game.installations"]).game.installations?.[gameId]?.path;
    let detected = "";
    if (manifest.autoDetect) {
      detected = await detectInstalledGame(
        gameId,
        manifest,
        previous
      );
    }

    if (detected) {
      const confirmation = await runtime.dialog.showMessageBox(runtime.getWindow(), {
        type: "question",
        title: `Confirmer le dossier de ${manifest.title}`,
        message: `${manifest.title} a été détecté à cet emplacement :`,
        detail: [
          detected,
          "",
          manifest.localArchiveOnly
            ? "ShenPulse installera uniquement le mod ZIP que vous fournissez. Les fichiers remplacés seront sauvegardés et les autres réglages de override.cfg seront conservés. Aucun mod n’est téléchargé par ShenPulse. Fermez le jeu avant de continuer."
            : manifest.setupOnly
            ? "ShenPulse vérifiera puis mémorisera ce dossier dans votre profil. Aucun fichier du jeu ne sera téléchargé, ajouté ou modifié."
            : "ShenPulse vérifiera une dernière fois le dossier avant de télécharger et d’installer les fichiers."
        ].join("\n"),
        buttons: [
          manifest.localArchiveOnly ? "Oui, installer le mod local ici" : manifest.setupOnly ? "Oui, associer ce dossier" : "Oui, installer ici",
          "Non, choisir un autre dossier",
          "Annuler"
        ],
        defaultId: 0,
        cancelId: 2,
        noLink: true
      });
      if (confirmation.response === 2) return "";
      if (confirmation.response === 0) {
        try {
          await runtime.validateTarget(detected, manifest);
          return detected;
        } catch (error) {
          const retry = await runtime.showInvalidTarget(
            detected,
            manifest,
            error
          );
          if (!retry) return "";
        }
      }
    } else if (manifest.autoDetect) {
      const missing = await runtime.dialog.showMessageBox(runtime.getWindow(), {
        type: "info",
        title: `${manifest.title} n’a pas été détecté`,
        message: "Choisissez le dossier d’installation du jeu.",
        detail: `Sélectionnez précisément le ${manifest.targetLabel || "dossier du jeu"}. ShenPulse vérifiera son contenu avant de continuer.`,
        buttons: ["Choisir le dossier", "Annuler"],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (missing.response !== 0) return "";
    }

    let defaultPath = detected || previous || "";
    while (true) {
      const result = await runtime.dialog.showOpenDialog(runtime.getWindow(), {
        title: `Choisissez le ${manifest.targetLabel || `dossier de ${manifest.title}`}`,
        defaultPath: defaultPath || undefined,
        buttonLabel: "Vérifier ce dossier",
        properties: ["openDirectory"]
      });
      if (result.canceled || !result.filePaths[0]) return "";

      const selected = path.resolve(result.filePaths[0]);
      try {
        await runtime.validateTarget(selected, manifest);
        return selected;
      } catch (error) {
        defaultPath = selected;
        const retry = await runtime.showInvalidTarget(
          selected,
          manifest,
          error
        );
        if (!retry) return "";
      }
    }
  }

async function showInvalidTarget(runtime, targetPath, manifest, error) {
    const result = await runtime.dialog.showMessageBox(runtime.getWindow(), {
      type: "error",
      title: "Dossier de jeu incorrect",
      message: `Ce dossier ne correspond pas à ${manifest.title}.`,
      detail: [
        targetPath,
        "",
        error?.message || "L’exécutable attendu n’a pas été trouvé.",
        "",
        `Choisissez précisément le ${manifest.targetLabel || "dossier du jeu"}.`
      ].join("\n"),
      buttons: ["Choisir un autre dossier", "Annuler"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    return result.response === 0;
  }

async function validateTarget(runtime, targetPath, manifest) {
    const absolute = path.resolve(targetPath);
    const parsed = path.parse(absolute);
    if (absolute === parsed.root) {
      throw new Error(
        "Choisissez un dossier de jeu précis, pas la racine du disque."
      );
    }
    const stat = await fs.promises.stat(absolute).catch(() => null);
    if (stat && !stat.isDirectory()) {
      throw new Error("La destination sélectionnée n’est pas un dossier.");
    }
    if (manifest.executables?.length) {
      const found = await findLaunchTarget(absolute, manifest.executables, false);
      if (!found) {
        throw new Error(
          `Ce dossier ne contient pas ${manifest.executables.join(" ou ")}.`
        );
      }
    }
  }

module.exports = { pickTarget, showInvalidTarget, validateTarget };

