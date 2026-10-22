"use strict";

/** Audit explicite du registre Game Pass ; aucune requête réseau au rendu de l’application. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const catalog = require("../src/shared/game-pass-catalog");

(async () => {
  const response = await fetch(catalog.catalogUrl);
  if (!response.ok) throw new Error(`Catalogue Microsoft indisponible : ${response.status}`);
  const listing = await response.json();
  assert.equal(listing[0]?.title, "All PC Games", "la source doit être le catalogue PC");
  const products = new Set(listing.slice(1).map(product => product.id));
  const entries = { ...catalog.products, ...catalog.benefits };
  const missing = Object.entries(entries).filter(([, id]) => !products.has(id)).map(([id]) => id);
  const output = path.resolve(__dirname, "../.artifacts/game-pass-review");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify({ checkedAt: new Date().toISOString(), source: catalog.catalogUrl, count: products.size, entries, missing }, null, 2));
  assert.deepEqual(missing, [], "le registre doit être revu si un titre quitte le catalogue");
  console.log(`Game Pass : ${Object.keys(entries).length} références de jeux et modes confirmées dans le catalogue Microsoft PC.`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
