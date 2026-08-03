"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("affiche automatiquement la version de ShenPulse sous les ports locaux", () => {
  const main = source("src/main/main.js");
  const core = source("src/main/core.js");
  const renderer = source("src/renderer/app.js");
  const html = source("src/renderer/index.html");

  assert.match(
    main,
    /packageMetadata\.build\?\.buildVersion \|\| app\.getVersion\(\)/
  );
  assert.match(main, /appVersion: getApplicationVersion\(\)/);
  assert.match(core, /this\.appVersion = String\(appVersion \|\| ""\)/);
  assert.match(core, /appVersion: this\.appVersion/);
  assert.match(html, /<small id="app-version">/);
  assert.match(
    renderer,
    /appVersion\.textContent = `Version : \$\{snapshot\.appVersion \|\| "—"\}`/
  );
});
