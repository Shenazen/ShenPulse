"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createPackage } = require("@electron/asar");
const { installStreamDeckPlugin } = require("../src/main/controller-plugin");
const root = path.join(__dirname, "..");

test("le plugin fourni dans une archive Electron s’installe avec ses scripts, sous-dossiers et icônes", { skip: process.platform !== "win32" }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-controller-plugin-test-"));
  t.after(() => {
    assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), "shenpulse-controller-plugin-test-")));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const input = path.join(directory, "input");
  fs.mkdirSync(input);
  const source = path.join(root, "resources/controllers/com.shenpulse.control.sdPlugin");
  fs.cpSync(source, path.join(input, "plugin"), { recursive: true });
  fs.writeFileSync(path.join(input, "brand.png"), "fixture-icon");
  const archive = path.join(directory, "app.asar");
  await createPackage(input, archive);
  const probe = path.join(directory, "probe.cjs");
  fs.writeFileSync(probe, `
    const fs = require('node:fs'), path = require('node:path');
    const { installStreamDeckPlugin } = require(process.argv[2]);
    const source = path.join(process.argv[3], 'plugin');
    const first = installStreamDeckPlugin(source, path.join(process.argv[3], 'brand.png'));
    const manifest = JSON.parse(fs.readFileSync(path.join(first.path, 'manifest.json')));
    if (manifest.UUID !== 'com.shenpulse.control') throw Error('Invalid plugin');
    for (const file of ['plugin.js', 'plugin.html', 'inspector.js', 'inspector.html']) fs.accessSync(path.join(first.path, file));
    if (fs.readFileSync(path.join(first.path, 'images/action.png'), 'utf8') !== 'fixture-icon') throw Error('Missing icon');
    fs.writeFileSync(path.join(first.path, 'user-data.txt'), 'keep');
    installStreamDeckPlugin(source, path.join(process.argv[3], 'brand.png'));
    if (fs.readFileSync(path.join(first.path, 'user-data.txt'), 'utf8') !== 'keep') throw Error('User data lost');
    console.log('ASAR installation verified');
  `);
  const result = spawnSync(require("electron"), [probe, path.join(root, "src/main/controller-plugin.js"), archive], {
    env: { ...process.env, APPDATA: path.join(directory, "appdata"), ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8", windowsHide: true, timeout: 15000
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /ASAR installation verified/);
});

test("un plugin absent est refusé explicitement avant toute installation", () => {
  assert.throws(() => installStreamDeckPlugin(""), /absent de cette version/);
});
