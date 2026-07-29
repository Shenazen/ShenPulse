"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);

test("embarque l'identité Microsoft Store réservée", () => {
  assert.equal(packageJson.productName, "ShenPulse");
  assert.equal(packageJson.build.appx.identityName, "ShenPulse.ShenPulse");
  assert.equal(
    packageJson.build.appx.publisher,
    "CN=F6F04997-3A7F-4EC3-8492-5BB9FCC0FE46"
  );
  assert.equal(packageJson.build.appx.publisherDisplayName, "ShenPulse");
  assert.equal(packageJson.build.appx.applicationId, "ShenPulse");
  assert.equal(packageJson.build.appx.minVersion, "10.0.19041.0");
  assert.ok(packageJson.build.appx.capabilities.includes("runFullTrust"));
  assert.ok(packageJson.build.appx.capabilities.includes("internetClient"));
});

test("marque aussi l’exécutable de développement avec l’icône ShenPulse", () => {
  const main = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "main.js"),
    "utf8"
  );
  const branding = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "scripts",
      "brand-dev-executable.js"
    ),
    "utf8"
  );
  assert.match(packageJson.scripts.prestart, /brand:dev/);
  assert.match(packageJson.scripts.start, /start-packaged-dev\.ps1/);
  const packagedStart = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "start-packaged-dev.ps1"),
    "utf8"
  );
  assert.match(packagedStart, /dist\\win-unpacked\\ShenPulse\.exe/);
  assert.match(packagedStart, /Remove-Item Env:ELECTRON_RUN_AS_NODE/);
  assert.match(main, /app\.setName\("ShenPulse"\)/);
  assert.match(main, /setAppUserModelId\("ShenPulse\.ShenPulse"\)/);
  assert.match(branding, /--set-icon/);
  assert.match(branding, /shenpulse\.ico/);
});

test("conserve un renderer Electron isolé", () => {
  const main = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "main.js"),
    "utf8"
  );
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
});
