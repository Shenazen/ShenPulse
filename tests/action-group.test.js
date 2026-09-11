"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ActionRunner } = require("../src/main/action-runner");
const {
  readRendererSource
} = require("./helpers/source-bundles");

function createHarness(rules, randomValues = [], options = {}) {
  const requests = [];
  const state = {
    settings: { tts: { enabled: true } },
    rules
  };
  const samples = [...randomValues];
  const runner = new ActionRunner({
    store: { getState: () => state },
    overlayServer: { publish: () => {} },
    gameHub: {},
    obsClient: {
      request: async (requestType, requestData) => {
        requests.push({ requestType, requestData });
        if (options.obsRequest) {
          return options.obsRequest(requestType, requestData);
        }
        return { requestType };
      }
    },
    sourceHub: {},
    spotifyService: {},
    shellyService: options.shellyService,
    notifyRenderer: () => {},
    randomImpl: () => samples.shift() ?? 0
  });
  return { requests, runner };
}

function obsAction(id, requestType, requestData = {}) {
  return {
    id,
    type: "obs.request",
    config: { requestType, requestData }
  };
}

test("un groupe démarre toutes les actions sélectionnées en parallèle", async () => {
  const first = obsAction("first", "First", {
    viewer: "{{user.displayName}}"
  });
  const second = obsAction("second", "Second");
  const group = {
    id: "group",
    type: "action.group",
    config: {
      mode: "all",
      actionIds: [first.id, second.id],
      randomCount: 2
    }
  };
  let blocking = true;
  const releases = [];
  const { requests, runner } = createHarness(
    [
      { id: "rule-group", name: "Tout", actions: [group] },
      { id: "rule-first", name: "Première", actions: [first] },
      { id: "rule-second", name: "Deuxième", actions: [second] }
    ],
    [],
    {
      obsRequest: async (requestType) =>
        new Promise((resolve) => {
          if (!blocking) {
            resolve({ requestType });
            return;
          }
          releases.push(() => resolve({ requestType }));
        })
    }
  );

  const runPromise = runner.run(group, {
    user: { displayName: "Alice" }
  });
  await new Promise((resolve) => setImmediate(resolve));
  const startedBeforeRelease = requests.length;
  blocking = false;
  releases.forEach((release) => release());
  const result = await runPromise;

  assert.equal(startedBeforeRelease, 2);
  assert.equal(result.mode, "all");
  assert.equal(result.executed, 2);
  assert.equal(result.failed, 0);
  assert.equal(result.partial, false);
  assert.deepEqual(result.actionIds, ["first", "second"]);
  assert.deepEqual(requests, [
    { requestType: "First", requestData: { viewer: "Alice" } },
    { requestType: "Second", requestData: {} }
  ]);
});

test("un groupe aléatoire tire exactement le nombre demandé sans doublon", async () => {
  const actions = [
    obsAction("first", "First"),
    obsAction("second", "Second"),
    obsAction("third", "Third")
  ];
  const group = {
    id: "random-group",
    type: "action.group",
    config: {
      mode: "random",
      actionIds: actions.map(({ id }) => id),
      randomCount: 2
    }
  };
  const { requests, runner } = createHarness(
    [
      { id: "rule-group", actions: [group] },
      ...actions.map((action) => ({ id: `rule-${action.id}`, actions: [action] }))
    ],
    [0, 0]
  );

  const result = await runner.run(group, {});

  assert.equal(result.mode, "random");
  assert.equal(result.selected, 2);
  assert.equal(new Set(result.actionIds).size, 2);
  assert.deepEqual(
    requests.map(({ requestType }) => requestType),
    ["Second", "Third"]
  );
});

test("un lien supprimé est signalé sans annuler les actions restantes", async () => {
  const valid = obsAction("valid", "Valid");
  const group = {
    id: "missing-group",
    type: "action.group",
    config: {
      mode: "all",
      actionIds: ["deleted-action", valid.id]
    }
  };
  const { requests, runner } = createHarness([
    { id: "rule-group", actions: [group] },
    { id: "rule-valid", actions: [valid] }
  ]);

  const result = await runner.run(group, {});

  assert.equal(result.executed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.partial, true);
  assert.match(result.failures[0].message, /Action liée introuvable : deleted-action/);
  assert.deepEqual(
    requests.map(({ requestType }) => requestType),
    ["Valid"]
  );
});

test("les références circulaires sont isolées sans empêcher les autres actions", async () => {
  const valid = obsAction("valid", "Valid");
  const firstGroup = {
    id: "group-a",
    type: "action.group",
    config: { mode: "all", actionIds: ["group-b", valid.id] }
  };
  const secondGroup = {
    id: "group-b",
    type: "action.group",
    config: { mode: "all", actionIds: [firstGroup.id] }
  };
  const { requests, runner } = createHarness([
    { id: "rule-a", actions: [firstGroup] },
    { id: "rule-b", actions: [secondGroup] },
    { id: "rule-valid", actions: [valid] }
  ]);

  const result = await runner.run(firstGroup, {});

  assert.equal(result.executed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.partial, true);
  assert.match(result.failures[0].message, /Référence circulaire détectée/);
  assert.deepEqual(
    requests.map(({ requestType }) => requestType),
    ["Valid"]
  );
});

test("un groupe échoue si aucune de ses sous-actions ne peut s’exécuter", async () => {
  const firstGroup = {
    id: "group-a",
    type: "action.group",
    config: { mode: "all", actionIds: ["group-b"] }
  };
  const secondGroup = {
    id: "group-b",
    type: "action.group",
    config: { mode: "all", actionIds: [firstGroup.id] }
  };
  const { runner } = createHarness([
    { id: "rule-a", name: "A", actions: [firstGroup] },
    { id: "rule-b", name: "B", actions: [secondGroup] }
  ]);

  await assert.rejects(
    () => runner.run(firstGroup, {}),
    /Référence circulaire détectée/
  );
});

test("une interaction IRL désactivée devient un diagnostic partiel nommé", async () => {
  const irlAction = {
    id: "irl-action",
    type: "irl.shelly",
    config: { deviceId: "prise-test", operation: "pulse", durationMs: 1000 }
  };
  const valid = obsAction("valid", "Valid");
  const group = {
    id: "mixed-group",
    type: "action.group",
    config: { mode: "all", actionIds: [irlAction.id, valid.id] }
  };
  const { runner } = createHarness(
    [
      { id: "rule-group", name: "Tout", actions: [group] },
      { id: "rule-irl", name: "Ballon 5", actions: [irlAction] },
      { id: "rule-valid", name: "OBS", actions: [valid] }
    ],
    [],
    {
      shellyService: {
        control: async () => ({ skipped: true, reason: "irl-disabled" })
      }
    }
  );

  const result = await runner.run(group, {});

  assert.equal(result.executed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.partial, true);
  assert.equal(result.failures[0].actionName, "Ballon 5");
  assert.match(result.failures[0].message, /Interactions IRL désactivées/);
});

test("le Play manuel du groupe conserve le mode test des interactions IRL", async () => {
  const calls = [];
  const irlAction = {
    id: "irl-preview",
    type: "irl.shelly",
    config: { deviceId: "prise-test", operation: "pulse", durationMs: 1000 }
  };
  const group = {
    id: "preview-group",
    type: "action.group",
    config: { mode: "all", actionIds: [irlAction.id] }
  };
  const { runner } = createHarness(
    [
      { id: "rule-group", name: "Tout", actions: [group] },
      { id: "rule-irl", name: "Ballon 5", actions: [irlAction] }
    ],
    [],
    {
      shellyService: {
        control: async (_config, options) => {
          calls.push(options);
          return { ok: true };
        }
      }
    }
  );

  const result = await runner.run(group, { source: "manual-preview" });

  assert.equal(result.executed, 1);
  assert.equal(result.failed, 0);
  assert.equal(calls[0].ignoreGlobalSwitch, true);
});

test("le test manuel autorise les groupes d’actions via IPC", () => {
  const ipcSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "ipc.js"),
    "utf8"
  );
  const handlerStart = ipcSource.indexOf('handle("action:test"');
  const handlerEnd = ipcSource.indexOf('handle("timer:test"', handlerStart);

  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  assert.match(ipcSource.slice(handlerStart, handlerEnd), /"action\.group"/);
});

test("le test manuel affiche les éventuelles sous-actions en erreur", () => {
  const handlerSource = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "renderer",
      "app",
      "actions",
      "handlers",
      "content-commerce.js"
    ),
    "utf8"
  );

  assert.match(handlerSource, /Action partiellement exécutée/);
  assert.match(handlerSource, /failure\.actionName/);
});

test("l’éditeur expose le groupe d’actions et ses deux modes", () => {
  const renderer = readRendererSource();
  const editorStart = renderer.indexOf("function openActionEditor(row)");
  const editorEnd = renderer.indexOf("function openTtsEditor", editorStart);
  const editor = renderer.slice(editorStart, editorEnd);

  assert.match(renderer, /"action\.group": "Groupe d’actions"/);
  assert.match(renderer, /"action\.group": "🔀"/);
  assert.match(editor, /conditionalFields\(\s*"action\.group"/);
  assert.match(editor, /name="groupActionIds"/);
  assert.match(editor, /name="actionGroupMode"/);
  assert.match(editor, /Toutes les actions sélectionnées/);
  assert.match(editor, /Un nombre obligatoire au hasard/);
  assert.match(editor, /Les actions sélectionnées démarrent ensemble/);
  assert.match(renderer, /function syncActionGroupEditor\(\)/);
});
