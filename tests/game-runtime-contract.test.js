"use strict";
const { readMainSource } = require("./helpers/main-source-bundles");
const { readRendererSource } = require("./helpers/source-bundles");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { commitInstallationDeployment } = require("../src/main/game-runtime");
const root = path.join(__dirname, "..");

/** Déploiement local, sauvegardes et état récupérable des installations. */

test("l’installation sauvegarde les remplacements et supprime seulement le temporaire", () => {
  const runtime = readMainSource("game-runtime.js");
  assert.match(runtime, /game-backups/);
  assert.match(runtime, /installer-downloads/);
  assert.match(runtime, /copyWithBackup/);
  assert.match(runtime, /fs\.promises\.rm\(tempRoot/);
  assert.match(
    runtime,
    /if \(manifest\.temporaryTarget\) \{[\s\S]*?fs\.promises\.rm\(targetPath/
  );
  assert.match(runtime, /Archive refusée : un chemin sort de la destination/);
  assert.match(runtime, /commitInstallationDeployment/);
  assert.match(runtime, /-Verb RunAs/);
  assert.match(runtime, /Confirmez la demande Windows/);
});

test("le déploiement préparé remplace les fichiers seulement après leur sauvegarde", async () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-deployment-")
  );
  try {
    const deploymentRoot = path.join(temporaryRoot, "deployment");
    const targetPath = path.join(temporaryRoot, "game");
    const backupRoot = path.join(temporaryRoot, "backups");
    fs.mkdirSync(path.join(deploymentRoot, "scripts"), {
      recursive: true
    });
    fs.mkdirSync(path.join(targetPath, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(deploymentRoot, "args.txt"), "nouveau");
    fs.writeFileSync(
      path.join(deploymentRoot, "scripts", "bridge.dll"),
      "pont"
    );
    fs.writeFileSync(path.join(targetPath, "args.txt"), "original");

    const result = await commitInstallationDeployment({
      deploymentRoot,
      targetPath,
      backupRoot,
      tempRoot: temporaryRoot
    });
    assert.equal(result.elevated, false);
    assert.equal(result.fileCount, 2);
    assert.equal(
      fs.readFileSync(path.join(backupRoot, "args.txt"), "utf8"),
      "original"
    );
    assert.equal(
      fs.readFileSync(path.join(targetPath, "args.txt"), "utf8"),
      "nouveau"
    );
    assert.equal(
      fs.readFileSync(
        path.join(targetPath, "scripts", "bridge.dll"),
        "utf8"
      ),
      "pont"
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("une réparation ne recopie pas les fichiers déjà identiques", async () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-unchanged-deployment-")
  );
  try {
    const deploymentRoot = path.join(temporaryRoot, "deployment");
    const targetPath = path.join(temporaryRoot, "game");
    const backupRoot = path.join(temporaryRoot, "backups");
    fs.mkdirSync(deploymentRoot, { recursive: true });
    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(deploymentRoot, "paper.jar"), "identique");
    fs.writeFileSync(path.join(targetPath, "paper.jar"), "identique");

    await commitInstallationDeployment({
      deploymentRoot,
      targetPath,
      backupRoot,
      tempRoot: temporaryRoot
    });

    assert.equal(fs.existsSync(path.join(backupRoot, "paper.jar")), false);
    assert.equal(
      fs.readFileSync(path.join(targetPath, "paper.jar"), "utf8"),
      "identique"
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("le chemin du jeu est confirmé puis revérifié avant tout téléchargement", () => {
  const runtime = fs.readFileSync(path.join(root, "src", "main", "game-runtime", "installation.js"), "utf8");
  const targets = fs.readFileSync(path.join(root, "src", "main", "game-runtime", "target-selection.js"), "utf8");
  const pickTargetStart = targets.indexOf("async function pickTarget");
  const validateTargetStart = targets.indexOf(
    "async function validateTarget",
    pickTargetStart
  );
  const picker = targets.slice(pickTargetStart, validateTargetStart);
  const installStart = runtime.indexOf("async function installGame");
  const downloadStart = runtime.indexOf(
    "await runtime.downloadAsset",
    installStart
  );
  const targetSelection = runtime.indexOf(
    "await runtime.pickTarget",
    installStart
  );

  assert.ok(pickTargetStart >= 0);
  assert.match(picker, /Confirmer le dossier de/);
  assert.match(picker, /Oui, installer ici/);
  assert.match(picker, /Non, choisir un autre dossier/);
  assert.match(picker, /Vérifier ce dossier/);
  assert.match(picker, /while \(true\)/);
  assert.match(picker, /await runtime\.validateTarget\(selected, manifest\)/);
  assert.match(picker, /Dossier de jeu incorrect/);
  assert.match(picker, /Choisir un autre dossier/);
  assert.ok(targetSelection >= 0 && targetSelection < downloadStart);
});

test("le suivi d'installation reste recuperable pendant toute l'operation", () => {
  const runtime = readMainSource("game-runtime.js");
  const renderer = readRendererSource();
  const installStart = runtime.indexOf("async function installGame");
  const pickerStart = runtime.indexOf("await runtime.pickTarget", installStart);
  const trackingStart = runtime.indexOf(
    "runtime.activeInstalls.add(gameId)",
    installStart
  );
  const progressListener = renderer.slice(
    renderer.indexOf('api.on("game-install-progress"'),
    renderer.indexOf('api.on("deal-host-state"')
  );

  assert.match(runtime, /this\.installProgress = new Map\(\)/);
  assert.match(
    runtime,
    /installProgress: this\.installProgress\.get\(gameId\) \|\| null/
  );
  assert.match(runtime, /phase: "error"/);
  assert.match(runtime, /phase: "canceled"/);
  assert.ok(trackingStart > installStart && trackingStart < pickerStart);
  assert.match(renderer, /function restoreActiveGameInstallProgress/);
  assert.match(renderer, /api\.getGameRuntimeStatus\(gameId\)/);
  assert.doesNotMatch(
    progressListener,
    /progress\.gameId !== gameInstallBusyId/
  );
  assert.match(renderer, /\$\{pageMarkup\}\$\{installProgressMarkup\}/);
});
