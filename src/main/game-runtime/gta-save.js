"use strict";

/** Préparation et déploiement sauvegardé des parties GTA Enhanced. Les opérations et garde-fous restent identiques. */
const fs = require("node:fs");
const path = require("node:path");
const { safeChildPath, sha256File, findNamedFile, findLaunchTarget, existingFile } = require("./paths");

async function detectGtaEdition(gamePath) {
  const enhanced = await findLaunchTarget(
    gamePath,
    ["GTA5_Enhanced.exe"],
    false
  );
  return enhanced ? "enhanced" : "legacy";
}

async function stageGtaEnhancedSave(
  extractedDirectory,
  stagingDirectory
) {
  const expectedFiles = ["SGTA50001", "SGTA50015", "SGTA50015.bak"];
  await fs.promises.mkdir(stagingDirectory, { recursive: true });
  for (const fileName of expectedFiles) {
    const source = await findNamedFile(extractedDirectory, fileName);
    if (!source) {
      throw new Error(
        `Fichier de sauvegarde GTA Enhanced absent : ${fileName}.`
      );
    }
    const destination = safeChildPath(stagingDirectory, fileName);
    await fs.promises.copyFile(source, destination);
  }
  const canonical = path.join(stagingDirectory, "SGTA50015");
  const stat = await fs.promises.stat(canonical).catch(() => null);
  if (!stat?.isFile() || stat.size < 512 * 1024) {
    throw new Error("La sauvegarde GTA Enhanced préparée est invalide.");
  }
  return stagingDirectory;
}

async function deployGtaEnhancedSave({
  sourceDirectory,
  backupRoot,
  documentsPath = ""
}) {
  const canonical =
    (await existingFile(path.join(sourceDirectory, "SGTA50015"))) ||
    (await existingFile(path.join(sourceDirectory, "SGTA50001")));
  if (!canonical) {
    return {
      deployed: false,
      pending: true,
      reason: "save-not-staged"
    };
  }
  const profile = await findGtaEnhancedProfile({ documentsPath });
  if (!profile) {
    return {
      deployed: false,
      pending: true,
      reason: "rockstar-profile-not-found"
    };
  }

  const canonicalHash = await sha256File(canonical);
  for (let slot = 1; slot <= 15; slot += 1) {
    const existing = path.join(
      profile,
      `SGTA5${String(slot).padStart(4, "0")}`
    );
    if (!(await existingFile(existing))) continue;
    if ((await sha256File(existing)) === canonicalHash) {
      return {
        deployed: false,
        alreadyPresent: true,
        pending: false,
        profile,
        slot,
        savePath: existing
      };
    }
  }

  let selectedSlot = 0;
  for (let slot = 15; slot >= 1; slot -= 1) {
    const baseName = `SGTA5${String(slot).padStart(4, "0")}`;
    const main = path.join(profile, baseName);
    const backup = `${main}.bak`;
    if (
      !(await fs.promises.stat(main).catch(() => null)) &&
      !(await fs.promises.stat(backup).catch(() => null))
    ) {
      selectedSlot = slot;
      break;
    }
  }
  if (!selectedSlot) selectedSlot = 15;

  const targetName = `SGTA5${String(selectedSlot).padStart(4, "0")}`;
  const target = path.join(profile, targetName);
  const targetBackup = `${target}.bak`;
  const sourceBackup =
    (await existingFile(path.join(sourceDirectory, "SGTA50015.bak"))) ||
    canonical;
  const replaced = [];
  for (const existing of [target, targetBackup]) {
    if (!(await existingFile(existing))) continue;
    await fs.promises.mkdir(backupRoot, { recursive: true });
    const backupDestination = safeChildPath(
      backupRoot,
      path.basename(existing)
    );
    await fs.promises.copyFile(existing, backupDestination);
    replaced.push({
      source: existing,
      backup: backupDestination
    });
  }

  await fs.promises.copyFile(canonical, target);
  await fs.promises.copyFile(sourceBackup, targetBackup);
  if ((await sha256File(target)) !== canonicalHash) {
    throw new Error(
      "La vérification de la sauvegarde GTA Enhanced copiée a échoué."
    );
  }
  return {
    deployed: true,
    alreadyPresent: false,
    pending: false,
    profile,
    slot: selectedSlot,
    savePath: target,
    backupPath: replaced.length ? backupRoot : "",
    replaced
  };
}

async function findGtaEnhancedProfile({ documentsPath = "" } = {}) {
  const testPath = String(
    process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH || ""
  ).trim();
  const profileRoots = testPath
    ? [testPath]
    : gtaEnhancedProfileRoots(documentsPath);
  const profiles = [];
  for (const root of [...new Set(profileRoots.map((item) => path.resolve(item)))]) {
    const entries = await fs.promises
      .readdir(root, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(root, entry.name);
      const files = await fs.promises
        .readdir(directory, { withFileTypes: true })
        .catch(() => []);
      const saves = files.filter(
        (file) => file.isFile() && /^SGTA5\d{4}(?:\.bak)?$/i.test(file.name)
      ).length;
      const stat = await fs.promises.stat(directory).catch(() => null);
      profiles.push({
        directory,
        saves,
        modifiedAt: stat?.mtimeMs || 0
      });
    }
  }
  profiles.sort(
    (left, right) =>
      right.saves - left.saves || right.modifiedAt - left.modifiedAt
  );
  return profiles[0]?.directory || "";
}

function gtaEnhancedProfileRoots(documentsPath = "") {
  const candidates = [
    documentsPath,
    process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, "Documents")
      : "",
    process.env.OneDrive
      ? path.join(process.env.OneDrive, "Documents")
      : "",
    process.env.OneDriveConsumer
      ? path.join(process.env.OneDriveConsumer, "Documents")
      : "",
    process.env.OneDriveCommercial
      ? path.join(process.env.OneDriveCommercial, "Documents")
      : ""
  ].filter(Boolean);
  return candidates.map((root) =>
    path.join(root, "Rockstar Games", "GTAV Enhanced", "Profiles")
  );
}

module.exports = {
  detectGtaEdition,
  stageGtaEnhancedSave,
  deployGtaEnhancedSave,
  findGtaEnhancedProfile,
  gtaEnhancedProfileRoots,
};

