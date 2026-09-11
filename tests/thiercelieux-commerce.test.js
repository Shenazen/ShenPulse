"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  THIERCELIEUX_EXTENSION_PRODUCTS,
  ownedThiercelieuxPackIds,
  sanitizeThiercelieuxEntitlements
} = require("../src/shared/thiercelieux-products");
const {
  normalizeCommerceCatalog
} = require("../src/main/admin-service");

function state(gameEntitlements = []) {
  return { commerce: { gameEntitlements } };
}

test("les quatre extensions Thiercelieux coûtent exactement 3,99 €", () => {
  assert.equal(THIERCELIEUX_EXTENSION_PRODUCTS.length, 4);
  assert.deepEqual(
    THIERCELIEUX_EXTENSION_PRODUCTS.map((product) => product.price),
    [3.99, 3.99, 3.99, 3.99]
  );
  assert.equal(
    new Set(THIERCELIEUX_EXTENSION_PRODUCTS.map((product) => product.id)).size,
    4
  );
});

test("sans achat, seul le jeu de base reste disponible", () => {
  const sanitized = sanitizeThiercelieuxEntitlements({
    packs: ["base", "nouvelle-lune", "village", "personnages", "25-ans"],
    roleIds: [
      "voyante",
      "salvateur",
      "corbeau",
      "renard",
      "colosse"
    ],
    selectedVariantIds: ["clair-de-lune"],
    buildingsEnabled: true,
    eventsEnabled: true
  }, state());

  assert.deepEqual(sanitized.packs, ["base"]);
  assert.deepEqual(sanitized.roleIds, [
    "voyante",
    "simple-villageois",
    "simple-villageois",
    "simple-villageois",
    "simple-villageois"
  ]);
  assert.deepEqual(sanitized.selectedVariantIds, []);
  assert.equal(sanitized.buildingsEnabled, false);
  assert.equal(sanitized.eventsEnabled, false);
});

test("chaque achat débloque uniquement le contenu de son extension", () => {
  const entitlements = [
    {
      productId: "thiercelieux-extension-nouvelle-lune",
      source: "purchase",
      status: "paid"
    },
    {
      gameId: "thiercelieux-extension-le-village",
      source: "purchase",
      status: "active"
    },
    {
      productId: "thiercelieux-extension-personnages",
      status: "cancelled"
    }
  ];
  assert.deepEqual(
    [...ownedThiercelieuxPackIds(state(entitlements))].sort(),
    ["base", "nouvelle-lune", "village"]
  );

  const sanitized = sanitizeThiercelieuxEntitlements({
    packs: ["base", "nouvelle-lune", "village", "personnages"],
    roleIds: ["salvateur", "corbeau", "renard"],
    selectedVariantIds: ["clair-de-lune"],
    buildingsEnabled: true,
    eventsEnabled: true
  }, state(entitlements));
  assert.deepEqual(sanitized.packs, ["base", "nouvelle-lune", "village"]);
  assert.deepEqual(sanitized.roleIds, [
    "salvateur",
    "corbeau",
    "simple-villageois"
  ]);
  assert.deepEqual(sanitized.selectedVariantIds, ["clair-de-lune"]);
  assert.equal(sanitized.buildingsEnabled, true);
  assert.equal(sanitized.eventsEnabled, true);
});

test("le catalogue commercial publie les extensions comme achats non essayables", () => {
  const catalog = normalizeCommerceCatalog({});
  for (const product of THIERCELIEUX_EXTENSION_PRODUCTS) {
    assert.deepEqual(catalog.products[product.id], {
      accessMode: "purchase",
      baseAmount: "3.99",
      currency: "EUR",
      enabled: true,
      id: product.id,
      sortOrder: 500,
      title: product.name,
      trialEligible: false
    });
  }
});

test("chaque extension possède une jaquette locale originale", () => {
  for (const name of [
    "extension-nouvelle-lune.png",
    "extension-le-village.png",
    "extension-personnages.png",
    "extension-25-ans.png"
  ]) {
    const file = path.join(
      __dirname,
      "..",
      "src",
      "renderer",
      "assets",
      "games",
      "thiercelieux",
      name
    );
    assert.ok(fs.statSync(file).size > 100000, `${name} doit être une vraie jaquette`);
  }
});
