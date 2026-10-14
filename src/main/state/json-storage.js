"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** Persistance JSON atomique, validation, génération précédente et récupération non destructive. */
class AtomicJsonStorage {
  /** Lit le fichier valide ou récupère sa génération précédente, sans effacer le fichier corrompu. */
  readJson(filePath, fallback) {
    const primaryExists = fs.existsSync(filePath);
    try {
      if (primaryExists) return this.parseJsonFile(filePath).value;
    } catch (error) {
      const corruptPath = `${filePath}.corrupt-${Date.now()}`;
      try {
        fs.copyFileSync(filePath, corruptPath);
      } catch {
        // Les autres générations restent inspectables même si cette copie échoue.
      }
    }

    const recovered = this.latestValidJsonBackup(filePath);
    if (!recovered) return fallback;
    try {
      this.atomicWrite(filePath, recovered.content, false);
    } catch {
      // La génération récupérée reste utilisable en mémoire même si sa restauration échoue.
    }
    return recovered.value;
  }

  /** Valide qu'un fichier contient bien un objet JSON non vide. */
  parseJsonFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.trim()) throw new Error("The JSON file is empty.");
    const value = JSON.parse(content);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("The JSON file does not contain a valid object.");
    }
    return { content, value };
  }

  /** Privilégie le .bak valide, puis essaie les autres générations par date décroissante. */
  latestValidJsonBackup(filePath) {
    const directory = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const stem = fileName.endsWith(".json")
      ? fileName.slice(0, -".json".length)
      : fileName;
    let candidates = [];
    try {
      candidates = fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter(
          (name) =>
            name === `${fileName}.bak` ||
            (name.startsWith(`${fileName}.`) && name.endsWith(".tmp")) ||
            (name.startsWith(`${stem}.before-`) && name.endsWith(".json")) ||
            name.startsWith(`${fileName}.corrupt-`)
        )
        .map((name) => {
          const candidatePath = path.join(directory, name);
          return {
            candidatePath,
            modifiedAt: fs.statSync(candidatePath).mtimeMs,
            priority: name === `${fileName}.bak` ? 2 : 1
          };
        })
        .sort(
          (left, right) =>
            right.priority - left.priority || right.modifiedAt - left.modifiedAt
        );
    } catch {
      return null;
    }
    for (const candidate of candidates) {
      try {
        return this.parseJsonFile(candidate.candidatePath);
      } catch {
        // Essayer la génération suivante.
      }
    }
    return null;
  }

  /** Récupère seulement les références Backblaze dont la valeur existe encore dans le coffre. */
  recoverBackblazeSecretReferences(state, secrets, filePath) {
    const backblaze = state.settings.backblaze || {};
    const referenceKeys = [
      "keyIdSecretId",
      "applicationKeySecretId"
    ];
    const missingKeys = new Set(
      referenceKeys.filter((key) => !String(backblaze[key] || "").trim())
    );
    if (!missingKeys.size) return;

    const fileName = path.basename(filePath);
    const stem = fileName.endsWith(".json")
      ? fileName.slice(0, -".json".length)
      : fileName;
    let candidates = [];
    try {
      candidates = fs
        .readdirSync(path.dirname(filePath), { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter(
          (name) =>
            name !== fileName &&
            (name === `${fileName}.bak` ||
              (name.startsWith(`${fileName}.`) && name.endsWith(".tmp")) ||
              (name.startsWith(`${stem}.before-`) && name.endsWith(".json")))
        )
        .map((name) => ({
          name,
          modifiedAt: fs.statSync(path.join(path.dirname(filePath), name)).mtimeMs
        }))
        .sort((left, right) => right.modifiedAt - left.modifiedAt);
    } catch {
      return;
    }

    for (const candidate of candidates) {
      let savedBackblaze;
      try {
        savedBackblaze = this.parseJsonFile(
          path.join(path.dirname(filePath), candidate.name)
        ).value.settings?.backblaze;
      } catch {
        continue;
      }
      for (const key of [...missingKeys]) {
        const secretId = String(savedBackblaze?.[key] || "").trim();
        if (secretId && secrets[secretId]?.value) {
          backblaze[key] = secretId;
          missingKeys.delete(key);
        }
      }
      if (!missingKeys.size) break;
    }
  }

  /** Écrit, fsync et relit le temporaire avant renommage ; conserve une ancienne génération valide. */
  atomicWrite(filePath, content, preserveBackup = true) {
    JSON.parse(content);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const suffix = `${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
    const temporaryPath = `${filePath}.${suffix}.tmp`;
    this.writeSyncedFile(temporaryPath, content);
    const verified = this.parseJsonFile(temporaryPath).content;
    if (verified !== content) {
      throw new Error("The ShenPulse state write could not be verified.");
    }

    if (preserveBackup && fs.existsSync(filePath)) {
      try {
        const previous = this.parseJsonFile(filePath).content;
        const backupPath = `${filePath}.bak`;
        const backupTemporaryPath = `${backupPath}.${suffix}.tmp`;
        this.writeSyncedFile(backupTemporaryPath, previous);
        if (this.parseJsonFile(backupTemporaryPath).content !== previous) {
          throw new Error("The ShenPulse backup is incomplete.");
        }
        fs.renameSync(backupTemporaryPath, backupPath);
      } catch {
        // Un fichier précédent invalide ne doit jamais remplacer une sauvegarde valide.
      }
    }

    fs.renameSync(temporaryPath, filePath);
  }

  /** Création exclusive et synchronisation disque avec permissions limitées. */
  writeSyncedFile(filePath, content) {
    const descriptor = fs.openSync(filePath, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, content, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  }
}

module.exports = { AtomicJsonStorage };
