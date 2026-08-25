const {
  readOverlayRuntimeSource,
  readOverlayStyles,
  readRendererSource,
  readRendererStyles
} = require("./helpers/source-bundles");

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("le rendu Media ne contient que le média sélectionné", () => {
  const script = readOverlayRuntimeSource();
  const styles = readOverlayStyles();
  const mediaStyles = styles.slice(
    styles.indexOf(".alert-stage.media-only-stage"),
    styles.indexOf(".alert.leaving")
  );

  assert.match(script, /payload\.displayMode === "media-only"/);
  assert.match(script, /class="alert-media-only"/);
  assert.match(script, /mediaOnly\s*\?\s*"alert media-only"/);
  assert.match(mediaStyles, /\.alert-stage\.media-only-stage/);
  assert.match(mediaStyles, /\.alert\.media-only/);
  assert.match(mediaStyles, /border:\s*0/);
  assert.match(mediaStyles, /background:\s*transparent/);
  assert.match(mediaStyles, /box-shadow:\s*none/);
});

test("l'éditeur Media exige un média et masque les réglages d'alerte", () => {
  const renderer = readRendererSource();
  const mediaFields = renderer.slice(
    renderer.indexOf('"overlay.media",', renderer.indexOf("const actionFields")),
    renderer.indexOf('"audio.play",', renderer.indexOf("const actionFields"))
  );
  const mediaSubmit = renderer.slice(
    renderer.indexOf('if (type === "overlay.media")'),
    renderer.indexOf('} else if (type === "audio.play")')
  );

  assert.match(mediaFields, /Média affiché/);
  assert.match(mediaFields, /\{ optional: false \}/);
  assert.doesNotMatch(mediaFields, /field\("title"/);
  assert.doesNotMatch(mediaFields, /field\("message"/);
  assert.doesNotMatch(mediaFields, /overlayColor/);
  assert.match(mediaSubmit, /Choisissez le média à afficher/);
  assert.match(mediaSubmit, /delete nextConfig\.title/);
  assert.match(mediaSubmit, /delete nextConfig\.message/);
  assert.match(mediaSubmit, /delete nextConfig\.color/);
});

test("l'ancien identifiant Alerte est lui aussi rendu en Media seul", () => {
  const runner = fs.readFileSync(
    path.join(root, "src", "main", "action-runner.js"),
    "utf8"
  );
  const mediaBranch = runner.slice(
    runner.indexOf('case "overlay.alert"'),
    runner.indexOf('case "tts.speak"')
  );

  assert.match(mediaBranch, /displayMode:\s*"media-only"/);
  assert.doesNotMatch(mediaBranch, /title:\s*safeString/);
  assert.doesNotMatch(mediaBranch, /message:\s*safeString/);
  assert.doesNotMatch(mediaBranch, /color:\s*safeString/);
});
