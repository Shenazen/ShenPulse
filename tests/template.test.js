"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { renderTemplate, renderValue } = require("../src/main/template");

const context = {
  user: { displayName: "Nova" },
  data: { count: 5, giftName: "Rose" }
};

test("hydrate les chemins imbriqués", () => {
  assert.equal(
    renderTemplate("{{user.displayName}} → {{data.giftName}} ×{{data.count}}", context),
    "Nova → Rose ×5"
  );
});

test("hydrate récursivement objets et tableaux", () => {
  assert.deepEqual(renderValue({ title: "{{user.displayName}}", values: ["{{data.count}}"] }, context), {
    title: "Nova",
    values: ["5"]
  });
});

