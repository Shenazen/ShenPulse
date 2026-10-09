"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  ROM_HASHES,
  superMarioKartRomVersion
} = require("../src/main/super-mario-kart-runtime");
const {
  loadShenazenGameCatalog
} = require("../src/main/game-catalog");

const root = path.join(__dirname, "..");

test("publie les 87 interactions natives Super Mario Kart", () => {
  const pack = loadShenazenGameCatalog(
    path.join(root, "resources")
  ).find((entry) => entry.id === "super-mario-kart");

  assert.equal(pack.connector.type, "super-mario-kart-runtime");
  assert.equal(pack.effects.length, 87);
  assert.ok(pack.effects.every((effect) => effect.available));
  assert.ok(pack.effects.some((effect) => effect.id === "coinup"));
  assert.ok(pack.effects.some((effect) => effect.id === "item_mushroom"));
  assert.ok(pack.effects.some((effect) => effect.id === "music_yoshi"));
});

test("traduit en français les 87 interactions Super Mario Kart", () => {
  const pack = loadShenazenGameCatalog(
    path.join(root, "resources")
  ).find((entry) => entry.id === "super-mario-kart");
  const effects = new Map(pack.effects.map((effect) => [effect.id, effect]));

  assert.equal(effects.get("lengthup")?.name, "Ajouter un tour à la course");
  assert.equal(
    effects.get("music_track")?.name,
    "Changer la musique : thème du circuit"
  );
  assert.equal(
    effects.get("item_mushroom")?.name,
    "Donner au joueur 1 : Champignon"
  );
  assert.equal(
    effects.get("useitem2_redshell")?.name,
    "Utiliser pour le joueur 2 : Carapace rouge"
  );
  assert.equal(effects.get("music_yoshi")?.category, "Changer la musique");
  assert.equal(effects.get("item_banana")?.category, "Donner des objets");
  assert.ok(
    pack.effects.every(
      (effect) =>
        !/^(?:Add|Change|Decrease|Give|Increase|Remove|Reverse|Self|Shrink|Sideways|Spin|Spinout|Take|Use)\b/i.test(
          effect.name
        )
    )
  );
});

test("reconnaît les empreintes Super Mario Kart USA prises en charge", () => {
  assert.equal(
    superMarioKartRomVersion(ROM_HASHES.usa).name,
    "Super Mario Kart (USA)"
  );
  assert.equal(
    superMarioKartRomVersion(ROM_HASHES.usaAlternate).name,
    "Super Mario Kart (USA)"
  );
  assert.equal(superMarioKartRomVersion("0".repeat(32)), null);
});
