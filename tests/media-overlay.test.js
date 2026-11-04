const { readMainSource } = require("./helpers/main-source-bundles");

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
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");

function alertFixture(payloads) {
  const source = fs.readFileSync(path.join(root, "resources/overlays/runtime/alerts-feed.js"), "utf8");
  const dom = new JSDOM('<section class="view active native-overlay-canvas"><div id="alert-stage" class="alert-stage"></div></section>');
  const timers = [];
  const context = vm.createContext({
    document: dom.window.document, alertQueue: [...payloads], alertRunning: false,
    parameters: new URLSearchParams(), overlayAnimation: "none", overlayDisplayTime: 5,
    overlaySoundEnabled: false, overlayPauseTime: 0,
    escapeHtml: value => String(value), actionMediaMarkup: () => '<img src="test.gif">',
    setTimeout: callback => timers.push(callback)
  });
  vm.runInContext(source.slice(source.indexOf("async function drainAlerts("), source.indexOf("const liveAudioQueue")), context);
  const document = dom.window.document;
  return { document, context, timers, close: () => dom.window.close() };
}

test("le cadrage média suit chaque alerte puis restitue le cadrage des alertes avec texte", async () => {
  const fixture = alertFixture([
    { displayMode: "media-only", mediaUrl: "test.gif" },
    { title: "Follow", message: "Bienvenue" }
  ]);
  const { document, context, timers } = fixture;
  try {
    void vm.runInContext("drainAlerts()", context);
    assert.equal(document.querySelector(".view").classList.contains("media-only-view"), true);
    assert.equal(document.querySelector("#alert-stage").classList.contains("media-only-stage"), true);
    timers.shift()();
    await new Promise(resolve => setImmediate(resolve));
    timers.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(document.querySelector(".view").classList.contains("media-only-view"), false);
    assert.equal(document.querySelector("#alert-stage").classList.contains("media-only-stage"), false);
    assert.equal(document.querySelector(".view").classList.contains("native-overlay-canvas"), true);
    assert.equal(document.querySelector(".alert strong").textContent, "Follow");
    timers.shift()();
    await new Promise(resolve => setImmediate(resolve));
    timers.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(document.querySelector("#alert-stage").childElementCount, 0);
    assert.equal(context.alertRunning, false);
  } finally { fixture.close(); }
});

test("un média manquant ne bloque pas le média suivant", async () => {
  const fixture = alertFixture([
    { displayMode: "media-only" },
    { displayMode: "media-only", mediaUrl: "test.webm" }
  ]);
  try {
    void vm.runInContext("drainAlerts()", fixture.context);
    assert.equal(fixture.document.querySelectorAll(".alert.media-only").length, 1);
    assert.equal(fixture.document.querySelector(".view").classList.contains("media-only-view"), true);
    assert.equal(fixture.context.alertQueue.length, 0);
  } finally { fixture.close(); }
});

test("l’alerte seule affiche le nom et le texte comme du texte, sans HTML exécutable ni faux média", () => {
  const fixture = alertFixture([{ displayMode: "media-only", alert: { username: '<img src=x onerror="x()">', message: "Merci <script>x()</script>", color: "bad-color" } }]);
  // Le vrai échappement du runtime est le contrat utilisé par tous les widgets.
  fixture.context.escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  try {
    void vm.runInContext("drainAlerts()", fixture.context);
    assert.ok(fixture.document.querySelector(".alert.text-only"));
    assert.equal(fixture.document.querySelector("img,video,script,.alert-media-only"), null);
    assert.equal(fixture.document.querySelector("strong").textContent, '<img src=x onerror="x()">');
    assert.equal(fixture.document.querySelector(".action-alert-caption span").textContent, "Merci <script>x()</script>");
    assert.match(fixture.document.querySelector(".action-alert-caption").getAttribute("style"), /#ffffff/);
  } finally { fixture.close(); }
});

test("le rendu Media ne contient que le média sélectionné", () => {
  const script = readOverlayRuntimeSource();
  const styles = readOverlayStyles();
  const mediaStyles = styles.slice(
    styles.indexOf(".alert-stage.media-only-stage"),
    styles.indexOf(".alert.leaving")
  );

  assert.match(script, /payload\.displayMode === "media-only"/);
  assert.match(script, /class="alert-media-only"/);
  assert.match(script, /mediaOnly\s*\?\s*`alert media-only/);
  assert.match(mediaStyles, /\.alert-stage\.media-only-stage/);
  assert.match(mediaStyles, /\.alert\.media-only/);
  assert.match(mediaStyles, /border:\s*0/);
  assert.match(mediaStyles, /background:\s*transparent/);
  assert.match(mediaStyles, /box-shadow:\s*none/);
});

test("la légende en haut utilise sa police et son contour sans bloc de fond", () => {
  const fixture = alertFixture([{ displayMode: "media-only", mediaUrl: "test.gif", alert: { username: "Alice", font: "Georgia", strokeColor: "#112233", position: "top" } }]);
  try {
    void vm.runInContext("drainAlerts()", fixture.context);
    assert.ok(fixture.document.querySelector(".alert.caption-top"));
    const style = fixture.document.querySelector(".action-alert-caption").style;
    assert.equal(style.getPropertyValue("--action-alert-stroke"), "#112233");
    assert.match(style.getPropertyValue("--action-alert-font"), /Georgia/);
    assert.equal(style.background, "");
  } finally { fixture.close(); }
});

test("l'éditeur Media exige un média quand l'alerte facultative est désactivée", () => {
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
  assert.match(mediaFields, /\{ optional: true \}/);
  assert.doesNotMatch(mediaFields, /field\("title"/);
  assert.doesNotMatch(mediaFields, /field\("message"/);
  assert.doesNotMatch(mediaFields, /overlayColor/);
  assert.match(mediaSubmit, /Choisissez le média à afficher/);
  assert.match(mediaSubmit, /!mediaUrl && !alertDisplay\.enabled/);
  assert.match(mediaSubmit, /delete nextConfig\.title/);
  assert.match(mediaSubmit, /delete nextConfig\.message/);
  assert.match(mediaSubmit, /delete nextConfig\.color/);
});

test("l'ancien identifiant Alerte est lui aussi rendu en Media seul", () => {
  const runner = readMainSource("action-runner.js");
  const mediaBranch = runner.slice(
    runner.indexOf('case "overlay.alert"'),
    runner.indexOf('case "tts.speak"')
  );

  assert.match(mediaBranch, /displayMode:\s*"media-only"/);
  assert.doesNotMatch(mediaBranch, /title:\s*safeString/);
  assert.doesNotMatch(mediaBranch, /message:\s*safeString/);
  assert.doesNotMatch(mediaBranch, /color:\s*safeString/);
});
