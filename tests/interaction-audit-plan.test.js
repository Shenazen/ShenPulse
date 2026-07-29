"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CULT_OF_THE_LAMB_EFFECTS
} = require("../src/main/cult-of-the-lamb-catalog");
const {
  STARDEW_VALLEY_EFFECTS
} = require("../src/main/stardew-valley-catalog");
const {
  TERRARIA_EFFECTS
} = require("../src/main/terraria-catalog");
const {
  orderInteractionAuditEffects
} = require("../src/main/interaction-audit-plan");

const CATALOGS = {
  "cult-of-the-lamb": CULT_OF_THE_LAMB_EFFECTS,
  "stardew-valley": STARDEW_VALLEY_EFFECTS,
  terraria: TERRARIA_EFFECTS
};

test("les campagnes couvrent chaque interaction une seule fois", () => {
  for (const [gameId, effects] of Object.entries(CATALOGS)) {
    const ordered = orderInteractionAuditEffects(gameId, effects);
    assert.equal(ordered.length, effects.length, gameId);
    assert.equal(
      new Set(ordered.map(({ effect }) => effect.id)).size,
      effects.length,
      gameId
    );
  }
});

test("les soins sont toujours précédés des dégâts correspondants", () => {
  assertBefore("cult-of-the-lamb", "cult-take-hp", "cult-add-hp");
  assertBefore("stardew-valley", "stardew-hurt", "stardew-heal");
  assertBefore(
    "stardew-valley",
    "stardew-energy-drain",
    "stardew-energy-restore"
  );
  assertBefore(
    "terraria",
    "terraria-decrease-hp",
    "terraria-increase-hp"
  );
});

test("les paires réversibles restaurent les outils et ressources testés", () => {
  assertBefore(
    "cult-of-the-lamb",
    "cult-cc-lose-faith",
    "cult-cc-increase-faith"
  );
  assertBefore(
    "stardew-valley",
    "stardew-give-money",
    "stardew-take-money"
  );
  for (const tool of [
    "axe",
    "pickaxe",
    "hoe",
    "watering-can",
    "fishing-rod"
  ]) {
    assertBefore(
      "stardew-valley",
      `stardew-${tool}-downgrade`,
      `stardew-${tool}-upgrade`
    );
  }
});

test("les étapes qui nécessitent une situation particulière gardent une préparation", () => {
  const cult = orderInteractionAuditEffects(
    "cult-of-the-lamb",
    CULT_OF_THE_LAMB_EFFECTS
  );
  assert.match(
    cult.find(({ effect }) => effect.id === "cult-cc-spawn-enemies")
      .preparation,
    /croisade/i
  );
  assert.match(
    cult.find(({ effect }) => effect.id === "cult-wipe-resources")
      .preparation,
    /zéro/i
  );
  for (const effectId of [
    "cult-add-follower",
    "cult-move-up-room",
    "cult-move-down-room",
    "cult-move-left-room",
    "cult-move-right-room",
    "cult-kill"
  ]) {
    assert.ok(
      cult.find(({ effect }) => effect.id === effectId)
        .preparation,
      effectId
    );
  }
});

test("les armes Cult of the Lamb utilisent les codes du jeu", () => {
  const weapon = CULT_OF_THE_LAMB_EFFECTS.find(
    (effect) => effect.id === "cult-set-weapon"
  );
  assert.deepEqual(weapon.codeByParameter.values, {
    1: "weapon_0",
    2: "weapon_300",
    3: "weapon_100",
    4: "weapon_200",
    5: "weapon_450"
  });
});

function assertBefore(gameId, firstId, secondId) {
  const ids = orderInteractionAuditEffects(
    gameId,
    CATALOGS[gameId]
  ).map(({ effect }) => effect.id);
  assert.ok(ids.indexOf(firstId) >= 0, firstId);
  assert.ok(ids.indexOf(secondId) > ids.indexOf(firstId), secondId);
}
