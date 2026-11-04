"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { installObsOffline, prepareCollection } = require("../src/main/studio-installation/obs");
const { obsSetupName, value } = require("../src/main/studio-installation/obs-profile");
const { stableId } = require("../src/main/studio-installation/layout");
const { StudioInstallationService } = require("../src/main/studio-installation/service");

function fixture(t) {
  const configRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-obs-names-"));
  t.after(() => fs.rmSync(configRoot, { recursive: true, force: true }));
  return { id: "obs", name: "OBS Studio", configRoot, installed: true, process: "obs64.exe", executable: "obs64.exe" };
}
function gamePlan(packId, gameName) {
  return { identity: "account:profile:" + packId, packId, gameName, profileId: "profile",
    sceneName: gameName + " · ShenPulse · Mon profil", executable: "game.exe",
    overlayUrl: "https://overlay.example/game-pack.html?jeu=" + packId, assertScope() {} };
}

test("OBS : chaque jeu possède son propre nom de profil, de collection et de scène", t => {
  const target = fixture(t);
  const games = [["fortnite", "Fortnite"], ["supermarket-simulator", "Supermarket Simulator"], ["gta-hiking", "GTA V Hiking Enhanced"]];
  const files = [];
  for (const [packId, name] of games) {
    const plan = gamePlan(packId, name), id = stableId(plan.identity).slice(0, 8);
    const expected = obsSetupName(name, id), result = installObsOffline(target, plan);
    assert.deepEqual(result.launchArgs, ["--profile", expected, "--collection", expected]);
    const file = path.join(target.configRoot, "basic/scenes", "ShenPulse_" + stableId(plan.identity).slice(0, 12) + ".json");
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(doc.name, expected); assert.equal(doc.current_scene, plan.sceneName);
    assert.equal(doc.sources.find(source => source.id === "game_capture").settings.window.split(":")[0], name);
    const ini = fs.readFileSync(path.join(target.configRoot, "basic/profiles", "ShenPulse_" + id, "basic.ini"), "utf8");
    assert.equal(value(ini, "General", "Name"), expected);
    assert.equal(value(ini, "Video", "BaseCX"), "1080");
    files.push([file, fs.readFileSync(file, "utf8")]);
  }
  for (const [file, text] of files) assert.equal(fs.readFileSync(file, "utf8"), text, "installer un autre jeu ne modifie pas sa collection");
});

test("réinstaller Fortnite corrige les anciens noms Supermarket au même emplacement, sans dupliquer les sources", t => {
  const target = fixture(t), plan = gamePlan("fortnite", "Fortnite"), id = stableId(plan.identity).slice(0, 8);
  const sceneFolder = path.join(target.configRoot, "basic/scenes"), profileFolder = path.join(target.configRoot, "basic/profiles", "ShenPulse_" + id);
  fs.mkdirSync(sceneFolder, { recursive: true }); fs.mkdirSync(profileFolder, { recursive: true });
  const file = path.join(sceneFolder, "ShenPulse_" + stableId(plan.identity).slice(0, 12) + ".json");
  const old = prepareCollection(null, plan, { video_device_id: "camera-fixture" }).document;
  old.name = "ShenPulse Supermarket " + id; old.unrelatedSetting = "conservé";
  fs.writeFileSync(file, JSON.stringify(old));
  fs.writeFileSync(path.join(profileFolder, "basic.ini"), "[General]\nName=ShenPulse Supermarket " + id + "\n[Output]\nMode=Advanced\n");
  const result = installObsOffline(target, plan), second = installObsOffline(target, plan);
  const current = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(current.name, obsSetupName("Fortnite", id)); assert.equal(current.unrelatedSetting, "conservé");
  assert.equal(current.sources.length, old.sources.length); assert.equal(current.scene_order.length, 1);
  assert.equal(current.sources.find(source => source.id === "dshow_input").settings.video_device_id, "camera-fixture");
  assert.deepEqual(second.sources, result.sources); assert.deepEqual(second.launchArgs, result.launchArgs);
  assert.equal(fs.readdirSync(sceneFolder).filter(name => name.endsWith(".json")).length, 1);
  assert.equal(value(fs.readFileSync(path.join(profileFolder, "basic.ini"), "utf8"), "Output", "Mode"), "Advanced");
});

test("le bouton Installer sur le studio transmet le vrai jeu jusqu'au profil OBS et aux arguments de lancement", async t => {
  const target = fixture(t), launches = [];
  const state = { settings: { account: { uid: "user" } }, session: { profileId: "profile" }, profiles: [{ id: "profile", name: "Mon profil" }], game: {} };
  const core = { snapshot: () => ({ state, packs: [{ id: "fortnite", name: "Fortnite" }], overlayUrls: { gamePack: "https://overlay.example/game-pack.html?channel=fixture" } }) };
  const service = new StudioInstallationService({ store: { getState: () => state }, core,
    requireGameAccess: id => assert.equal(id, "fortnite"), discoverImpl: () => [target], runningImpl: async () => false,
    launchImpl: async (_target, args) => launches.push(args) });
  const result = await service.install({ studioId: "obs", packId: "fortnite", profileId: "profile", accountUid: "user" });
  assert.equal(result.status, "installed"); assert.match(result.sceneName, /^Fortnite · ShenPulse/);
  assert.match(launches[0][1], /Fortnite/); assert.match(launches[0][3], /Fortnite/);
  assert.doesNotMatch(launches[0].join(" "), /Supermarket/);
});
