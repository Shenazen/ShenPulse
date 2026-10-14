"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { readVueStyles, scopedStyleSignature, compiledScopedStyleTree } = require("./helpers/original-game-sources");
const traces = require("./fixtures/original-game-style-traces.json");
const fs = require("node:fs");
const { buildOriginalGameStyles, sectionsByGame } = require("../scripts/build-original-game-styles");
const dealBaseline = require("./fixtures/deal-original-scoped-styles.json");

test("le CSS compilé de Deal garde les 104 règles originales et leurs valeurs exactes", () => {
  const file = path.join(__dirname, "..", dealBaseline.file);
  const tree = compiledScopedStyleTree(file);
  assert.equal(tree.length, 104);
  assert.deepEqual(tree, dealBaseline.nodes);
});

test("les styles générés correspondent exactement aux petites sections maintenables", () => {
  for (const file of buildOriginalGameStyles({ write: false }).outputFiles) {
    assert.equal(fs.readFileSync(file.path, "utf8"), file.text);
    const count = sectionsByGame[path.basename(path.dirname(file.path))];
    for (let index = 1; index <= count; index += 1) {
      assert.ok(fs.readFileSync(path.join(path.dirname(file.path), `section-${index}.css`), "utf8").split(/\r?\n/).length <= 600);
    }
  }
});

for (const trace of traces) {
  test(`${trace.file} garde les mêmes sélecteurs scoped, animations, règles et ressources`, () => {
    const file = path.join(__dirname, "..", "src", "renderer", "games", "original-src", "components", "games", trace.file);
    assert.equal(scopedStyleSignature(file), trace.hash);
    for (const style of readVueStyles(file)) {
      assert.equal(style.scoped, true);
    }
  });
}
