"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const overlayExport = fs.readFileSync(
  path.join(
    root,
    "src",
    "renderer",
    "app",
    "features",
    "games",
    "overlay-export.js"
  ),
  "utf8"
);
const overlayCards = fs.readFileSync(
  path.join(
    root,
    "src",
    "renderer",
    "app",
    "features",
    "games",
    "overlay-cards.js"
  ),
  "utf8"
);
const overlayGenerator = fs.readFileSync(
  path.join(root, "src", "renderer", "game-overlay-generator.js"),
  "utf8"
);
const navigation = fs.readFileSync(
  path.join(
    root,
    "src",
    "renderer",
    "app",
    "actions",
    "handlers",
    "navigation-games.js"
  ),
  "utf8"
);
const styles = fs.readFileSync(
  path.join(root, "src", "renderer", "styles", "dialogs-game.css"),
  "utf8"
);

test("le téléchargement d’overlay propose les interactions seules ou un choix d’actions", () => {
  assert.match(overlayExport, /function openGameOverlayDownloadChoice\(/);
  assert.match(overlayExport, /Interactions du jeu uniquement/);
  assert.match(overlayExport, /Interactions \+ actions/);
  assert.match(overlayExport, /function openGameOverlayActionPicker\(/);
  assert.match(overlayExport, /name="overlayAction"/);
  assert.match(navigation, /return openGameOverlayDownloadChoice\(/);
  assert.match(navigation, /action === "download-game-overlay-only"/);
  assert.match(navigation, /action === "open-game-overlay-action-picker"/);
  assert.match(styles, /dialog\[data-variant="game-overlay-actions"\]/);
  assert.match(styles, /\.game-overlay-action-option:has\(input:checked\)/);
});

test("le sélecteur retrouve les actions reliées par un déclencheur réutilisable", () => {
  const start = overlayExport.indexOf(
    "function normalizedOverlayTriggerType(rule)"
  );
  const end = overlayExport.indexOf("function overlayTriggerKey(", start);
  const source = overlayExport.slice(start, end);
  const directAction = {
    id: "direct_action",
    type: "goal.add",
    config: {}
  };
  const reusedAction = {
    id: "reused_action",
    type: "overlay.media",
    config: {}
  };
  const directRule = {
    id: "direct_rule",
    enabled: true,
    trigger: { enabled: true, type: "follow" },
    actions: [directAction]
  };
  const ownerRule = {
    id: "owner_rule",
    enabled: false,
    trigger: { enabled: false },
    actions: [reusedAction]
  };
  const reusableTrigger = {
    id: "reusable_trigger",
    enabled: true,
    trigger: { enabled: true, type: "gift" },
    actions: [],
    actionSelection: {
      mode: "all",
      actionIds: [reusedAction.id]
    }
  };
  const context = {
    snapshot: {
      state: { rules: [directRule, ownerRule, reusableTrigger] }
    },
    flattenActions: () => [
      { rule: directRule, action: directAction, actionIndex: 0 },
      { rule: ownerRule, action: reusedAction, actionIndex: 0 }
    ],
    canAccessActionType: () => true,
    hasAutomaticTrigger: (rule) => rule.trigger?.enabled !== false
  };

  vm.runInNewContext(
    `${source}\nglobalThis.result = triggeredOverlayActions();`,
    context
  );

  assert.equal(context.result.length, 2);
  assert.deepEqual(
    Array.from(context.result, (row) => [
      row.action.id,
      Array.from(row.triggerRules, (rule) => rule.id)
    ]),
    [
      ["direct_action", ["direct_rule"]],
      ["reused_action", ["reusable_trigger"]]
    ]
  );
});

test("une action utilisant le même cadeau est insérée auprès de l’interaction du jeu", () => {
  const start = overlayExport.indexOf(
    "function gameOverlayEntryTriggerIdentity(entry)"
  );
  const end = overlayExport.indexOf(
    "function overlayTriggerPickerVisual(",
    start
  );
  const source = overlayExport.slice(start, end);
  const context = {
    giftForIdentity: () => null,
    normalizeGiftName: (value) => String(value || "").toLowerCase()
  };
  vm.runInNewContext(
    `${source}\n` +
      `globalThis.result = mergeGameOverlayEntries(` +
      `[{ title: "Jeu Rose", triggerType: "gift", triggerKey: "rose", giftLabel: "Rose" },` +
      `{ title: "Follow jeu", triggerType: "follow", triggerKey: "Follow" }],` +
      `[{ title: "Action Rose", triggerType: "gift", triggerKey: "rose", giftLabel: "Rose" },` +
      `{ title: "Action Lion", triggerType: "gift", triggerKey: "lion", giftLabel: "Lion" }]` +
      `);` +
      `globalThis.identities = [` +
      `gameOverlayEntryTriggerIdentity({ triggerType: "follow", triggerKey: "Follow jeu" }),` +
      `gameOverlayEntryTriggerIdentity({ triggerType: "follow", triggerKey: "Follow action" }),` +
      `gameOverlayEntryTriggerIdentity({ triggerType: "likes", triggerKey: "500 likes", likeAmount: 500 }),` +
      `gameOverlayEntryTriggerIdentity({ triggerType: "likes", triggerKey: "500 tapotages", likeAmount: 500 })` +
      `];`,
    context
  );

  assert.deepEqual(
    Array.from(context.result, (entry) => entry.title),
    ["Jeu Rose", "Action Rose", "Follow jeu", "Action Lion"]
  );
  assert.deepEqual(Array.from(context.identities), [
    "follow",
    "follow",
    "likes:500",
    "likes:500"
  ]);
});

test("les cadeaux, follows et paliers de likes identiques partagent leur case", () => {
  const start = overlayCards.indexOf(
    "function gameOverlayEntryEffectIdentity(entry)"
  );
  const end = overlayCards.indexOf(
    "function gtaInteractionOverlayEntries(pack)",
    start
  );
  const source = overlayCards.slice(start, end);
  const context = {
    gameOverlayEntryTriggerIdentity: (entry) =>
      `${entry.triggerType}:${entry.triggerKey}`
  };
  vm.runInNewContext(
    `${source}\n` +
      `globalThis.result = groupGameOverlayEntriesByGift([` +
      `{ title: "CHANGER VEHICULE", groupKey: "vehicle", triggerType: "gift", triggerKey: "rose" },` +
      `{ title: "CHANGER VEHICULE", groupKey: "vehicle", triggerType: "follow", triggerKey: "follow" },` +
      `{ title: "CHANGER VEHICULE", groupKey: "vehicle", triggerType: "likes", triggerKey: "500" },` +
      `{ title: "PING-PONG 1", groupKey: "ping", triggerType: "follow", triggerKey: "follow" },` +
      `{ title: "LUMIERE 6", groupKey: "light", triggerType: "likes", triggerKey: "500" },` +
      `{ title: "MORT INSTANTANEE", groupKey: "death", triggerType: "gift", triggerKey: "sax" },` +
      `{ title: "ORBEEZ 5", groupKey: "orbeez", triggerType: "gift", triggerKey: "sax" },` +
      `{ title: "TROU NOIR", groupKey: "black-hole", triggerType: "gift", triggerKey: "panda" }` +
      `]);` +
      `globalThis.caseCount = gameOverlayRenderedCaseCount(globalThis.result);`,
    context
  );

  const grouped = Array.from(context.result);
  const sharedFollow = grouped.find(
    (entry) => entry.triggerType === "follow"
  );
  const sharedCardEntries = grouped.filter(
    (entry) => entry.groupKey === sharedFollow.groupKey
  );
  const saxGiftEntries = grouped.filter(
    (entry) => entry.triggerType === "gift" && entry.triggerKey === "sax"
  );

  assert.equal(context.caseCount, 3);
  assert.equal(saxGiftEntries.length, 1);
  assert.deepEqual(
    Array.from(sharedCardEntries, (entry) => entry.triggerType),
    ["gift", "follow", "likes"]
  );
  assert.deepEqual(
    Array.from(sharedFollow.actionLabels),
    ["CHANGER VEHICULE", "PING-PONG 1", "LUMIERE 6"]
  );
  assert.deepEqual(
    Array.from(saxGiftEntries[0].actionLabels),
    ["MORT INSTANTANEE", "ORBEEZ 5"]
  );
});

test("le texte conserve deux lignes en solo et ajoute une troisieme ligne jaune", () => {
  const start = overlayGenerator.indexOf(
    "function overlayActionTextLines(item)"
  );
  const end = overlayGenerator.indexOf(
    "function drawBottomPanel(ctx, items, logo, assets)",
    start
  );
  const source = overlayGenerator.slice(start, end);
  const context = {
    mergeOverlayActionLabels: (labels) => labels
  };
  vm.runInNewContext(
    `${source}\n` +
      `globalThis.solo = overlayActionTextLines({ actionLabels: ["MORT INSTANTANEE"], effect: {} });` +
      `globalThis.neutralSolo = overlayActionTextLines({ actionLabels: ["PING-PONG 15"], effect: {} });` +
      `globalThis.grouped = overlayActionTextLines({ actionLabels: ["MORT INSTANTANEE", "ORBEEZ 5"], effect: {} });`,
    context
  );

  assert.deepEqual(
    Array.from(context.solo, (line) => [line.label, line.color]),
    [["MORT", "#ff354d"], ["INSTANTANEE", "#ffffff"]]
  );
  assert.deepEqual(
    Array.from(context.grouped, (line) => [line.label, line.color]),
    [
      ["MORT", "#ff354d"],
      ["INSTANTANEE", "#ffffff"],
      ["ORBEEZ 5", "#f4da3d"]
    ]
  );
  assert.equal(context.neutralSolo[0].color, "#ff354d");
  assert.match(overlayGenerator, /function drawOverlayActionLines\(/);
  assert.match(overlayGenerator, /lines\.forEach\(\(line, index\) =>/);
  assert.doesNotMatch(overlayCards, /titles\.join\(" \+ "\)/);
});
