"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MOD_ARCHIVE_SHA256, MOD_FILES, mergeNeedleOverride, validateExtractedMod, assertSafeModTargets, readVerifiedArchive, installFindTheNeedleMod } = require("../src/main/game-runtime/find-the-needle-mod-installation");
const manifest = require("../src/main/game-installers/find-the-needle-demo");

const GAME_ID = "find-the-needle-demo";
const defaultConfig = { port: 55001, token: "", overlay: true, pauseWhenUnfocused: true };

async function fixture(t) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shenpulse-needle-mod-test-"));
  t.after(async () => {
    assert.ok(path.basename(root).startsWith("shenpulse-needle-mod-test-"));
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  const target = path.join(root, "game");
  const directories = { downloads: path.join(root, "downloads"), temp: path.join(root, "temp"), userData: path.join(root, "app-data") };
  await Promise.all([target, ...Object.values(directories)].map((directory) => fs.promises.mkdir(directory, { recursive: true })));
  const archivePath = path.join(directories.downloads, "user-owned-fixture.zip");
  await fs.promises.writeFile(archivePath, "fixture non exécutable, aucun mod tiers redistribué");
  const state = { game: { installations: {}, connectorOverrides: {} } };
  const secrets = new Map();
  const progress = [];
  const runtime = {
    app: { getPath: (name) => { assert.ok(directories[name], `répertoire ${name} explicitement isolé`); return directories[name]; } },
    getWindow: () => null,
    dialog: { async showOpenDialog() { throw new Error("Le chemin du ZIP fourni doit être réutilisé, sans nouveau dialogue."); } },
    store: {
      getState: () => structuredClone(state),
      setSecret(id, value) { const secretId = id || "fixture-encrypted-secret"; secrets.set(secretId, value); return secretId; },
      mutate(fn) { fn(state); }
    },
    progress(id, value) { assert.equal(id, GAME_ID); progress.push(value); }
  };
  const dependencies = {
    assertGameClosed: async () => {},
    async readVerifiedArchive(file) { assert.equal(file, archivePath); return { archive: Buffer.from("fixture zip"), hash: MOD_ARCHIVE_SHA256 }; },
    async extractArchiveSafe(file, destination) {
      assert.equal(await fs.promises.readFile(file, "utf8"), "fixture zip");
      for (const relative of MOD_FILES) {
        const filename = path.join(destination, relative);
        await fs.promises.mkdir(path.dirname(filename), { recursive: true });
        await fs.promises.writeFile(filename, relative.endsWith("/config.json") ? JSON.stringify(defaultConfig) : "fixture uniquement, aucun code du mod tiers");
      }
      for (const filename of ["override.cfg", "README.txt", "s2e_info.json", "find-the-needle-commands.json"]) {
        await fs.promises.writeFile(path.join(destination, filename), "fixture exclue du déploiement");
      }
    }
  };
  const options = { gameId: GAME_ID, manifest, targetPath: target, previousInstallation: { archivePath }, assertAccess: () => {} };
  return { root, target, directories, archivePath, state, secrets, progress, runtime, dependencies, options };
}

test("la fusion override conserve rendu, autres autoloads et CRLF et reste idempotente", () => {
  const original = '[rendering]\r\nrenderer/rendering_method="gl_compatibility"\r\n\r\n[autoload]\r\nOtherMod="*other.gd"\r\nS2EFindTheNeedle="*old.gd"\r\n\r\n[application]\r\nconfig/name="Mon jeu"\r\n';
  const merged = mergeNeedleOverride(original);
  assert.ok(merged.includes('renderer/rendering_method="gl_compatibility"\r\n'));
  assert.ok(merged.includes('OtherMod="*other.gd"\r\n'));
  assert.ok(merged.includes('[application]\r\nconfig/name="Mon jeu"\r\n'));
  assert.equal((merged.match(/S2EFindTheNeedle=/g) || []).length, 1);
  assert.match(merged, /S2EFindTheNeedle="\*mods\/s2e-find-the-needle\/s2e.gd"/);
  assert.equal(merged.includes("old.gd"), false);
  assert.equal(merged.includes("d3d12"), false);
  assert.equal(mergeNeedleOverride(merged), merged);
  assert.equal((mergeNeedleOverride("").match(/\[autoload\]/g) || []).length, 1);
});

test("l’installation locale sauvegarde les remplacements, ne déploie que le mod utile et chiffre le nouveau jeton", async (t) => {
  const f = await fixture(t);
  const originalOverride = '[rendering]\nrenderer/rendering_method="gl_compatibility"\n[autoload]\nOther="*other.gd"\n';
  await fs.promises.writeFile(path.join(f.target, "override.cfg"), originalOverride);
  await fs.promises.mkdir(path.join(f.target, "mods", "s2e-find-the-needle"), { recursive: true });
  await fs.promises.writeFile(path.join(f.target, "mods/s2e-find-the-needle/effects.gd"), "ancien fichier de fixture à sauvegarder");
  const result = await installFindTheNeedleMod(f.runtime, f.options, f.dependencies);
  assert.equal(result.modInstalled, true);
  assert.equal(await fs.promises.readFile(path.join(result.backupPath, "override.cfg"), "utf8"), originalOverride);
  assert.equal(await fs.promises.readFile(path.join(result.backupPath, "mods/s2e-find-the-needle/effects.gd"), "utf8"), "ancien fichier de fixture à sauvegarder");
  const config = JSON.parse(await fs.promises.readFile(path.join(f.target, "mods/s2e-find-the-needle/config.json"), "utf8"));
  assert.match(config.token, /^[0-9a-f]{64}$/);
  assert.equal(f.secrets.get("fixture-encrypted-secret"), config.token);
  assert.equal(config.port, 55001);
  const connector = f.state.game.connectorOverrides[GAME_ID];
  assert.equal(connector.secretId, "fixture-encrypted-secret");
  assert.equal(connector.url, "http://127.0.0.1:55001");
  assert.equal(JSON.stringify(f.state).includes(config.token), false, "aucun jeton brut dans l’état exporté au renderer");
  assert.equal(f.state.game.installations[GAME_ID].assetCount, MOD_FILES.length + 1);
  assert.equal(f.state.game.installations[GAME_ID].source, "user-provided-mod");
  assert.equal(f.state.game.installations[GAME_ID].modArchiveSha256, MOD_ARCHIVE_SHA256);
  assert.equal((await fs.promises.readFile(path.join(f.target, "override.cfg"), "utf8")).includes('Other="*other.gd"'), true);
  for (const rootFile of ["README.txt", "s2e_info.json", "find-the-needle-commands.json", "user-mod.zip"]) {
    assert.equal(fs.existsSync(path.join(f.target, rootFile)), false);
  }
  assert.deepEqual(await fs.promises.readdir(f.directories.temp), []);
  assert.equal(f.progress.at(-1).phase, "complete");
});

test("une configuration existante reste identique et son port et jeton sont réutilisés sans fuite", async (t) => {
  const f = await fixture(t);
  const original = '{\r\n  "port": 55123, "token": "fixture-private-token", "overlay": false, "pauseWhenUnfocused": false\r\n}\r\n';
  const configPath = path.join(f.target, "mods/s2e-find-the-needle/config.json");
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, original);
  await installFindTheNeedleMod(f.runtime, f.options, f.dependencies);
  assert.equal(await fs.promises.readFile(configPath, "utf8"), original);
  assert.equal(f.state.game.connectorOverrides[GAME_ID].url, "http://127.0.0.1:55123");
  assert.equal(f.secrets.get("fixture-encrypted-secret"), "fixture-private-token");
  assert.equal(JSON.stringify(f.state).includes("fixture-private-token"), false);
});

test("une configuration existante invalide est refusée avant le déploiement", async (t) => {
  const f = await fixture(t);
  const configPath = path.join(f.target, "mods/s2e-find-the-needle/config.json");
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, '{"port":80,"token":""}');
  await assert.rejects(installFindTheNeedleMod(f.runtime, f.options, f.dependencies), /port ou un jeton invalide/);
  assert.equal(await fs.promises.readFile(configPath, "utf8"), '{"port":80,"token":""}');
  assert.equal(fs.existsSync(path.join(f.target, "override.cfg")), false);
  assert.deepEqual(await fs.promises.readdir(f.directories.temp), []);
});

test("les jetons existants incompatibles avec HTTP et le stockage non chiffré sont refusés avant déploiement", async (t) => {
  for (const token of ["x".repeat(513), "fixture\r\nheader-injection", "trailing-space ", "nul\0token", "emoji-🔒"]) {
    const f = await fixture(t);
    const configPath = path.join(f.target, "mods/s2e-find-the-needle/config.json");
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, JSON.stringify({ ...defaultConfig, token }));
    await assert.rejects(installFindTheNeedleMod(f.runtime, f.options, f.dependencies), /port ou un jeton invalide/);
    assert.equal(fs.existsSync(path.join(f.target, "override.cfg")), false);
  }
  const unavailable = await fixture(t);
  unavailable.runtime.store.safeStorage = { isEncryptionAvailable: () => false };
  await assert.rejects(installFindTheNeedleMod(unavailable.runtime, unavailable.options, unavailable.dependencies), /chiffrement local du jeton/);
  assert.deepEqual(await fs.promises.readdir(unavailable.target), []);
});

test("un changement de config externe ou du compte pendant la préparation annule avant déploiement", async (t) => {
  const f = await fixture(t);
  const configPath = path.join(f.target, "mods/s2e-find-the-needle/config.json");
  let checks = 0;
  f.dependencies.assertGameClosed = async () => {
    if (++checks === 2) {
      await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
      await fs.promises.writeFile(configPath, "modification externe conservée");
    }
  };
  await assert.rejects(installFindTheNeedleMod(f.runtime, f.options, f.dependencies), /config.json a changé/);
  assert.equal(await fs.promises.readFile(configPath, "utf8"), "modification externe conservée");
  assert.equal(fs.existsSync(path.join(f.target, "override.cfg")), false);
  const changed = await fixture(t);
  let allowed = true;
  checks = 0;
  changed.options.assertAccess = () => { if (!allowed) throw new Error("Compte ou profil modifié"); };
  changed.dependencies.assertGameClosed = async () => { if (++checks === 2) allowed = false; };
  await assert.rejects(installFindTheNeedleMod(changed.runtime, changed.options, changed.dependencies), /Compte ou profil modifié/);
  assert.deepEqual(await fs.promises.readdir(changed.target), []);
});

test("un échec du coffre interrompt avant de modifier le jeu et un échec de copie ne remplace pas l’ancien secret", async (t) => {
  const unavailable = await fixture(t);
  unavailable.runtime.store.setSecret = () => { throw new Error("Coffre indisponible"); };
  await assert.rejects(installFindTheNeedleMod(unavailable.runtime, unavailable.options, unavailable.dependencies), /Coffre indisponible/);
  assert.deepEqual(await fs.promises.readdir(unavailable.target), []);
  const failedCommit = await fixture(t);
  failedCommit.secrets.set("old-secret", "old-value");
  failedCommit.state.game.connectorOverrides[GAME_ID] = { secretId: "old-secret" };
  failedCommit.dependencies.commitInstallationDeployment = async ({ backupRoot }) => {
    await fs.promises.mkdir(backupRoot, { recursive: true });
    await fs.promises.writeFile(path.join(backupRoot, "fixture-backup.txt"), "sauvegarde à conserver");
    throw new Error("Copie interrompue");
  };
  let backupPath;
  await assert.rejects(installFindTheNeedleMod(failedCommit.runtime, failedCommit.options, failedCommit.dependencies), (error) => {
    backupPath = error.backupPath;
    return error.message.includes("Copie interrompue") && error.message.includes(backupPath) && error.message.includes("fichiers déjà sauvegardés");
  });
  assert.equal(await fs.promises.readFile(path.join(backupPath, "fixture-backup.txt"), "utf8"), "sauvegarde à conserver");
  assert.equal(failedCommit.secrets.get("old-secret"), "old-value");
  assert.equal(failedCommit.state.game.connectorOverrides[GAME_ID].secretId, "old-secret");
  assert.deepEqual(await fs.promises.readdir(failedCommit.target), []);
});

test("le jeu ouvert bloque toute préparation et l’archive altérée est refusée avant extraction", async (t) => {
  const f = await fixture(t);
  const running = { ...f.dependencies, assertGameClosed: async () => { throw new Error("Fermez le jeu"); } };
  await assert.rejects(installFindTheNeedleMod(f.runtime, f.options, running), /Fermez le jeu/);
  const unknown = path.join(f.directories.downloads, "unknown.zip");
  await fs.promises.writeFile(unknown, Buffer.alloc(37888));
  await assert.rejects(readVerifiedArchive(unknown), /inconnu ou modifié/);
  await assert.rejects(readVerifiedArchive(f.archivePath), /ne correspond pas/);
  assert.deepEqual(await fs.promises.readdir(f.target), []);
});

test("les fichiers supplémentaires ou manquants ne passent pas l’allowlist du ZIP", async (t) => {
  const f = await fixture(t);
  const extracted = path.join(f.root, "extracted");
  const archiveFile = path.join(f.root, "fixture.zip");
  await fs.promises.writeFile(archiveFile, "fixture zip");
  await f.dependencies.extractArchiveSafe(archiveFile, extracted);
  assert.equal((await validateExtractedMod(extracted)).length, 19);
  await fs.promises.writeFile(path.join(extracted, "extra.exe"), "interdit");
  await assert.rejects(validateExtractedMod(extracted), /non autorisé/);
  await fs.promises.unlink(path.join(extracted, "extra.exe"));
  await fs.promises.unlink(path.join(extracted, "override.cfg"));
  await assert.rejects(validateExtractedMod(extracted), /incomplet/);
});

test("une jonction de destination ne permet jamais d’écrire hors du dossier du jeu", async (t) => {
  const f = await fixture(t);
  const other = path.join(f.root, "other");
  await fs.promises.mkdir(other);
  try { await fs.promises.symlink(other, path.join(f.target, "mods"), process.platform === "win32" ? "junction" : "dir"); }
  catch (error) { if (error.code === "EPERM") { t.skip("Création de liens interdite sur cet environnement"); return; } throw error; }
  await assert.rejects(assertSafeModTargets(f.target, MOD_FILES), /lien ou une jonction/);
  assert.deepEqual(await fs.promises.readdir(other), []);
});
