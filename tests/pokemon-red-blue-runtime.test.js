"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ROM_HASHES,
  applyIpsPatch,
  pokemonRomVersion
} = require("../src/main/pokemon-red-blue-runtime");
const {
  loadShenazenGameCatalog
} = require("../src/main/game-catalog");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("publie les 313 interactions natives Pokémon Rouge/Bleu", () => {
  const pack = loadShenazenGameCatalog(
    path.join(root, "resources")
  ).find((entry) => entry.id === "pokemon-red-blue");

  assert.equal(pack.connector.type, "pokemon-runtime");
  assert.equal(pack.effects.length, 313);
  assert.ok(pack.effects.every((effect) => effect.available));
  assert.ok(pack.effects.some((effect) => effect.id === "heal_all"));
  assert.ok(pack.effects.some((effect) => effect.id === "fightrandompokemon"));
  assert.ok(pack.effects.some((effect) => effect.id === "warp"));
});

test("traduit en français les 313 interactions Pokémon", () => {
  const pack = loadShenazenGameCatalog(
    path.join(root, "resources")
  ).find((entry) => entry.id === "pokemon-red-blue");
  const effects = new Map(pack.effects.map((effect) => [effect.id, effect]));

  assert.equal(effects.get("statusall_burn")?.name, "Brûler toute l'équipe");
  assert.equal(effects.get("givepokemon_aerodactyl")?.name, "Donner Ptéra");
  assert.equal(effects.get("givepokemon_charizard")?.name, "Donner Dracaufeu");
  assert.equal(effects.get("giveitem_ether")?.name, "Donner Huile");
  assert.equal(effects.get("giveitem_tm50")?.name, "Donner CT50");
  assert.equal(effects.get("giveitem_hm05")?.name, "Donner CS05");
  assert.equal(effects.get("status_sleep")?.category, "Statuts");
  assert.equal(effects.get("giveitem_potion")?.category, "Objets");
  assert.ok(
    pack.effects.every(
      (effect) =>
        !/^(?:Give|Burn|Freeze|Fully|Fight|Lower|Raise|Perfect|Paralyze|Poison|Sleep|Take away|Terrible|Warp|Evolve|Faint)\b/i.test(
          effect.name
        )
    )
  );
});

test("reconnaît uniquement les quatre empreintes Pokémon prises en charge", () => {
  assert.equal(pokemonRomVersion(ROM_HASHES.redBase).name, "Pokémon Rouge");
  assert.equal(pokemonRomVersion(ROM_HASHES.blueBase).name, "Pokémon Bleu");
  assert.equal(pokemonRomVersion(ROM_HASHES.redPatched).patched, true);
  assert.equal(pokemonRomVersion(ROM_HASHES.bluePatched).patched, true);
  assert.equal(pokemonRomVersion("0".repeat(32)), null);
});

test("applique les écritures simples et RLE d’un correctif IPS", () => {
  const patch = Buffer.concat([
    Buffer.from("PATCH", "ascii"),
    Buffer.from([0x00, 0x00, 0x02, 0x00, 0x02, 0xaa, 0xbb]),
    Buffer.from([0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x03, 0xcc]),
    Buffer.from("EOF", "ascii")
  ]);
  const result = applyIpsPatch(Buffer.alloc(10), patch);

  assert.deepEqual([...result], [0, 0, 0xaa, 0xbb, 0, 0, 0xcc, 0xcc, 0xcc, 0]);
});
