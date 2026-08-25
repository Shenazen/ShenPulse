"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const handlersDirectory = path.join(
  __dirname,
  "..",
  "src",
  "renderer",
  "app",
  "actions",
  "handlers"
);

test("les groupes d'actions s'enregistrent sans doublon ni dépendance DOM", () => {
  const sources = [
    "contracts.js",
    "admin-irl.js",
    "navigation-games.js",
    "content-commerce.js",
    "entities-games.js"
  ].map((file) => fs.readFileSync(path.join(handlersDirectory, file), "utf8"));
  sources.push(`
    globalThis.__actionContract = {
      groups: ACTION_HANDLERS.length,
      actions: [...REGISTERED_ACTIONS]
    };
  `);

  const context = {};
  vm.runInNewContext(sources.join("\n\n"), context, {
    filename: "renderer-action-handlers.js"
  });

  const { groups, actions } = context.__actionContract;
  assert.equal(groups, 4);
  assert.ok(actions.length >= 100);
  assert.equal(new Set(actions).size, actions.length);
  assert.equal(actions.every((action) => typeof action === "string" && action), true);
});
