"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  FORTNITE_DEFAULT_MAPPINGS,
  FORTNITE_EFFECTS
} = require("../src/main/fortnite-catalog");
const { GameHub } = require("../src/main/game-hub");
const {
  WindowsInputService,
  applyKeyboardLayout,
  normalizeKeyboardInputMode,
  normalizeProcessName,
  normalizeWindowsInputSequence
} = require("../src/main/windows-input-service");

const resourcesDirectory = path.join(__dirname, "..", "resources");

test("ne conserve que les effets Fortnite dont la séquence réelle est nommée précisément", () => {
  assert.equal(FORTNITE_EFFECTS.length, 22);
  assert.equal(FORTNITE_DEFAULT_MAPPINGS.length, 22);
  assert.equal(
    new Set(FORTNITE_EFFECTS.map((effect) => effect.id)).size,
    22
  );
  assert.ok(
    FORTNITE_DEFAULT_MAPPINGS.every(
      (mapping) => mapping.triggerEnabled === false
    )
  );

  const effectsBySourceId = new Map(
    FORTNITE_EFFECTS.map((effect) => [effect.sourceEffectId, effect])
  );
  assert.equal(
    effectsBySourceId.get("f_disco_fever").name,
    "Six sauts en rythme"
  );
  assert.equal(
    effectsBySourceId.get("f_panic_sprint").name,
    "Sprint avant-gauche-droite-avant"
  );
  assert.equal(
    effectsBySourceId.get("f_circle_runner").name,
    "Déplacement diagonal avant-gauche"
  );
  assert.match(
    effectsBySourceId.get("f_circle_runner").description,
    /ne tire pas/
  );

  for (const excluded of [
    "defaultdance_sfx",
    "f_pickaxe_runner",
    "f_pickaxe"
  ]) {
    assert.equal(effectsBySourceId.has(excluded), false);
  }

  assert.deepEqual(
    FORTNITE_EFFECTS
      .filter((effect) => effect.keyboardInputMode === "hybrid")
      .map((effect) => effect.sourceEffectId),
    ["f_weapon_carousel"]
  );
  assert.deepEqual(
    FORTNITE_EFFECTS
      .filter((effect) => effect.available === false)
      .map((effect) => effect.sourceEffectId),
    ["f_weapon_1", "f_weapon_2", "f_weapon_3", "f_weapon_4", "f_weapon_5"]
  );
  assert.ok(
    FORTNITE_EFFECTS
      .filter((effect) => effect.available === false)
      .every((effect) => /verrouillée/i.test(effect.unavailableReason))
  );
  assert.deepEqual(
    FORTNITE_DEFAULT_MAPPINGS
      .filter((mapping) => /^fortnite-weapon-slot-[1-5]$/.test(mapping.effectId))
      .map((mapping) => mapping.enabled),
    [false, false, false, false, false]
  );
});

test("valide les séquences Crowd Control et adapte uniquement les déplacements AZERTY", () => {
  for (const effect of FORTNITE_EFFECTS) {
    assert.ok(normalizeWindowsInputSequence(effect.inputSequence).length >= 2);
  }
  assert.deepEqual(
    applyKeyboardLayout(
      normalizeWindowsInputSequence(
        "k,0,87,0;k,10,65,0;k,10,83,0;k,10,68,0"
      ),
      "azerty"
    ).map((event) => event.keyCode),
    [90, 81, 83, 68]
  );
  assert.deepEqual(
    applyKeyboardLayout(
      normalizeWindowsInputSequence("k,0,82,0;k,40,82,1"),
      "azerty"
    ).map((event) => event.keyCode),
    [82, 82]
  );
  assert.equal(
    normalizeProcessName("FortniteClient-Win64-Shipping.exe"),
    "FortniteClient-Win64-Shipping"
  );
  assert.throws(
    () => normalizeProcessName("another.exe; calc.exe"),
    /processus Windows ciblé est invalide/
  );
  assert.throws(
    () => normalizeWindowsInputSequence("m,0,1,0"),
    /Événement d’entrée invalide/
  );
  assert.equal(normalizeKeyboardInputMode("scan-code"), "scan-code");
  assert.equal(normalizeKeyboardInputMode("hybrid"), "hybrid");
  assert.equal(normalizeKeyboardInputMode("invalid"), "virtual-key");
});

test("Windows PowerShell 5 déplie chaque frappe JSON sans tableau imbriqué", () => {
  const serviceSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "windows-input-service.js"),
    "utf8"
  );
  assert.match(
    serviceSource,
    /\$events = \$eventsJson \| ConvertFrom-Json/
  );
  assert.doesNotMatch(
    serviceSource,
    /\$events = @\(\$eventsJson \| ConvertFrom-Json\)/
  );
  assert.match(serviceSource, /\[System\.UInt16\]\$keyCode/);
  assert.doesNotMatch(serviceSource, /\[ushort\]/i);
  assert.match(serviceSource, /KEYEVENTF_SCANCODE = 0x0008/);
  assert.match(serviceSource, /MapVirtualKeyEx/);
  assert.match(serviceSource, /GetKeyboardLayout/);
  assert.match(serviceSource, /FindWindowForProcess/);
  assert.match(serviceSource, /SetWindowPos/);

  const encodedEvents = Buffer.from(
    JSON.stringify([
      { delayMs: 0, keyCode: 32, keyUp: false },
      { delayMs: 40, keyCode: 32, keyUp: true }
    ]),
    "utf8"
  ).toString("base64");
  const script = [
    "$json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:SHENPULSE_TEST_EVENTS))",
    "$events = $json | ConvertFrom-Json",
    "$delays = foreach ($event in $events) { [int]$event.delayMs }",
    "$delays -join ','"
  ].join("; ");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        SHENPULSE_TEST_EVENTS: encodedEvents
      }
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "0,40");

  const typeResult = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "[System.UInt16]32 | Write-Output"
    ],
    { encoding: "utf8" }
  );
  assert.equal(typeResult.status, 0, typeResult.stderr);
  assert.equal(typeResult.stdout.trim(), "32");
});

test("le connecteur Fortnite reste réservé au propriétaire et ne route aucun autre jeu", async () => {
  const state = ownerState();
  state.game.connectorOverrides.fortnite = {
    type: "demo",
    processName: "AnotherGame.exe",
    keyLayout: "azerty"
  };
  const calls = [];
  const windowsInputService = {
    status: async (processName) => {
      calls.push({ operation: "status", processName });
      return { ok: true, processId: 42 };
    },
    play: async (
      processName,
      sequence,
      keyLayout,
      keyboardInputMode
    ) => {
      calls.push({
        operation: "play",
        processName,
        sequence,
        keyLayout,
        keyboardInputMode
      });
      return { ok: true, eventsSent: 2 };
    }
  };
  const hub = new GameHub({
    store: storeFor(state),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs"),
    windowsInputService
  });
  hub.loadPacks();

  const fortnite = hub.listPacks().find((pack) => pack.id === "fortnite");
  assert.equal(fortnite.ownerOnly, true);
  assert.equal(fortnite.connector.type, "windows-input");
  assert.equal(
    fortnite.connector.processName,
    "FortniteClient-Win64-Shipping.exe"
  );
  assert.equal(hub.initializeDefaultInteractions("fortnite").added, 22);
  assert.equal(
    state.game.interactionRulesByPack.fortnite.filter(
      (rule) => /^fortnite-weapon-slot-[1-5]$/.test(
        rule.actions?.[0]?.config?.effectId || ""
      )
    ).every((rule) => rule.enabled === false),
    true
  );

  await hub.testConnection("fortnite");
  await hub.trigger(
    "fortnite-jump",
    { user: { id: "viewer", displayName: "Viewer" } },
    { packId: "fortnite" }
  );
  await assert.rejects(
    () => hub.trigger(
      "fortnite-weapon-slot-1",
      { user: { id: "viewer", displayName: "Viewer" } },
      { packId: "fortnite" }
    ),
    /la sélection directe d’un emplacement d’arme n’est pas compatible avec Fortnite/i
  );
  assert.deepEqual(
    calls.map((call) => [call.operation, call.processName]),
    [
      ["status", "FortniteClient-Win64-Shipping.exe"],
      ["play", "FortniteClient-Win64-Shipping.exe"]
    ]
  );
  assert.equal(calls[1].keyLayout, "azerty");
  assert.equal(calls[1].keyboardInputMode, undefined);

  const nonOwnerHub = new GameHub({
    store: storeFor(ownerState("viewer@example.com")),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs"),
    windowsInputService
  });
  nonOwnerHub.loadPacks();
  assert.throws(
    () => nonOwnerHub.assertAccess("fortnite"),
    /pas autorisé à administrer ShenPulse/
  );
  assert.equal(calls.length, 2);
});

test("désactive au chargement les anciennes règles Fortnite utilisant les emplacements verrouillés", () => {
  const state = ownerState();
  state.game.interactionRulesByPack.fortnite = [
    {
      id: "ancienne-regle-emplacement",
      enabled: true,
      actions: [
        {
          type: "game.effect",
          config: {
            packId: "fortnite",
            effectId: "fortnite-weapon-slot-3"
          }
        }
      ]
    },
    {
      id: "regle-saut",
      enabled: true,
      actions: [
        {
          type: "game.effect",
          config: { packId: "fortnite", effectId: "fortnite-jump" }
        }
      ]
    }
  ];
  const hub = new GameHub({
    store: storeFor(state),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs")
  });

  hub.loadPacks();

  assert.equal(
    state.game.interactionRulesByPack.fortnite[0].enabled,
    false
  );
  assert.equal(
    state.game.interactionRulesByPack.fortnite[1].enabled,
    true
  );
});

test("le service transmet le mode hybride uniquement aux interactions concernées", async () => {
  const calls = [];
  const service = new WindowsInputService({
    execute: async (operation, processName, events, keyboardInputMode) => {
      calls.push({ operation, processName, events, keyboardInputMode });
      return { ok: true };
    }
  });

  await service.play(
    "FortniteClient-Win64-Shipping.exe",
    "k,0,49,0;k,40,49,1",
    "azerty",
    "hybrid"
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].keyboardInputMode, "hybrid");
  assert.deepEqual(
    calls[0].events.map((event) => event.keyCode),
    [49, 49]
  );
});

test("sérialise les séquences destinées au même processus Fortnite", async () => {
  const releases = [];
  const starts = [];
  const service = new WindowsInputService({
    execute: (operation) => {
      starts.push(operation);
      if (operation === "status") return Promise.resolve({ ok: true });
      return new Promise((resolve) => releases.push(resolve));
    }
  });
  const first = service.play(
    "FortniteClient-Win64-Shipping.exe",
    "k,0,32,0;k,40,32,1"
  );
  const second = service.play(
    "FortniteClient-Win64-Shipping.exe",
    "k,0,82,0;k,40,82,1"
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(starts, ["play"]);
  releases.shift()({ ok: true });
  await first;
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(starts, ["play", "play"]);
  releases.shift()({ ok: true });
  await second;
});

test("sérialise aussi l’activation d’un jeu avant un test manuel", async () => {
  const calls = [];
  const service = new WindowsInputService({
    execute: async (operation, processName, events) => {
      calls.push({ operation, processName, events });
      return { ok: true };
    }
  });

  await service.activate("re3.exe");

  assert.deepEqual(calls, [
    { operation: "activate", processName: "re3", events: [] }
  ]);
});

function ownerState(email = "alexandre.leuridan@gmail.com") {
  return {
    settings: {
      account: {
        email,
        emailVerified: true,
        uid: "owner-uid",
        refreshTokenSecretId: "owner-secret"
      }
    },
    session: { activeGamePackId: "coin-pusher" },
    commerce: {
      subscription: {
        tier: "pro",
        source: "subscription",
        status: "active"
      },
      gameEntitlements: []
    },
    game: {
      recentPacks: [],
      connectorOverrides: {},
      interactionCatalogVersions: {},
      interactionRulesByPack: {}
    },
    rules: []
  };
}

function storeFor(state) {
  return {
    getState: () => state,
    getSecret: (secretId) =>
      secretId === "owner-secret" ? "refresh-token" : "",
    mutate: (callback) => callback(state)
  };
}
