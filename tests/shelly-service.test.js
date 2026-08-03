"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createDefaultState } = require("../src/main/defaults");
const { ActionRunner } = require("../src/main/action-runner");
const {
  ShellyService,
  hostsFromMdnsRecords,
  normalizeHost
} = require("../src/main/shelly-service");

function ownerStore(overrides = {}) {
  const state = createDefaultState();
  state.settings.account = {
    ...state.settings.account,
    email: "alexandre.leuridan@gmail.com",
    emailVerified: true,
    uid: "owner-uid",
    refreshTokenSecretId: "secret-owner"
  };
  state.activeAccountUid = "owner-uid";
  state.settings.irl = {
    enabled: true,
    devices: [],
    ...overrides
  };
  return {
    state,
    getState() {
      return structuredClone(state);
    },
    getActiveAccountUid() {
      return "owner-uid";
    },
    getSecret(id) {
      return id === "secret-owner" ? "refresh-token" : "";
    },
    mutate(mutator) {
      mutator(state);
      return this.getState();
    }
  };
}

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value)
  };
}

test("commande une prise Gen2 localement et programme le rallumage dans la prise", async () => {
  const store = ownerStore({
    devices: [
      {
        id: "shellyplusplugs-aabbcc",
        name: "Lampe",
        host: "192.168.1.42",
        generation: 2,
        model: "Shelly Plus Plug S",
        channel: 0
      }
    ]
  });
  const requests = [];
  const service = new ShellyService({
    store,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (url.endsWith("/shelly")) {
        return jsonResponse({
          id: "shellyplusplugs-aabbcc",
          model: "SNPL-00112EU",
          gen: 2
        });
      }
      if (url.endsWith("/rpc/Shelly.GetStatus")) {
        return jsonResponse({ "switch:0": { output: true } });
      }
      return jsonResponse({ was_on: true });
    },
    mdnsDiscoverer: async () => [],
    delayImpl: async () => {}
  });

  const result = await service.control({
    deviceId: "shellyplusplugs-aabbcc",
    operation: "cycle",
    durationMs: 3500
  });

  assert.equal(result.ok, true);
  const command = requests.find((request) =>
    request.url.includes("/rpc/Switch.Set")
  );
  assert.ok(command);
  assert.deepEqual(JSON.parse(command.options.body), {
    id: 0,
    on: false,
    toggle_after: 3.5
  });
  const restoreCommand = requests.find(
    (request, index) =>
      index > requests.indexOf(command) &&
      request.url.includes("/rpc/Switch.Set")
  );
  assert.ok(restoreCommand);
  assert.deepEqual(JSON.parse(restoreCommand.options.body), {
    id: 0,
    on: true
  });
  assert.equal(result.restored, true);
  assert.equal(result.durationMs, 3500);
});

test("convertit 1000 ms en une seconde allumée puis force l'extinction", async () => {
  const store = ownerStore({
    devices: [
      {
        id: "shellyplusplugs-ballon",
        name: "Ballon",
        host: "192.168.1.43",
        generation: 2,
        model: "SNPL-00112EU",
        channel: 0
      }
    ]
  });
  const requests = [];
  const delays = [];
  const service = new ShellyService({
    store,
    delayImpl: async (milliseconds) => delays.push(milliseconds),
    mdnsDiscoverer: async () => [],
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (url.endsWith("/shelly")) {
        return jsonResponse({
          id: "shellyplusplugs-ballon",
          model: "SNPL-00112EU",
          gen: 2
        });
      }
      if (url.endsWith("/rpc/Shelly.GetStatus")) {
        return jsonResponse({ "switch:0": { output: false } });
      }
      return jsonResponse({ was_on: false });
    }
  });

  const result = await service.control({
    deviceId: "shellyplusplugs-ballon",
    operation: "pulse",
    durationMs: 1000
  });

  const commands = requests
    .filter((request) => request.url.endsWith("/rpc/Switch.Set"))
    .map((request) => JSON.parse(request.options.body));
  assert.deepEqual(commands, [
    { id: 0, on: true, toggle_after: 1 },
    { id: 0, on: false }
  ]);
  assert.deepEqual(delays, [1000]);
  assert.equal(result.restored, true);
  assert.equal(result.durationMs, 1000);
});

test("délègue l'action physique au serveur Python fourni", async () => {
  const store = ownerStore({
    devices: [
      {
        id: "shellyplusplugs-python",
        name: "Prise Python",
        host: "192.168.1.44",
        generation: 2,
        model: "Shelly Plus Plug S",
        channel: 0
      }
    ]
  });
  const commands = [];
  const delays = [];
  let releaseDelay;
  let markDelayStarted;
  const delayStarted = new Promise((resolve) => {
    markDelayStarted = resolve;
  });
  const pythonBridge = {
    status: () => ({ kind: "python", state: "idle", giftRules: 0 }),
    async control(device, operation, durationMs) {
      commands.push({ device, operation, durationMs });
      return { ok: true, result: { was_on: true } };
    }
  };
  const requests = [];
  const service = new ShellyService({
    store,
    pythonBridge,
    fetchImpl: async (url) => {
      requests.push(url);
      if (url.endsWith("/rpc/Shelly.GetStatus")) {
        return jsonResponse({ "switch:0": { output: false } });
      }
      return jsonResponse({
        id: "shellyplusplugs-python",
        model: "SNPL-00112EU",
        gen: 2
      });
    },
    mdnsDiscoverer: async () => [],
    delayImpl: async (milliseconds) => {
      delays.push(milliseconds);
      await new Promise((resolve) => {
        releaseDelay = resolve;
        markDelayStarted();
      });
    }
  });

  const controlPromise = service.control({
    deviceId: "shellyplusplugs-python",
    operation: "cycle",
    durationMs: 4200
  });

  await delayStarted;
  assert.equal(commands.length, 1);
  assert.equal(commands[0].operation, "cycle");
  assert.deepEqual(delays, [4200]);
  releaseDelay();
  const result = await controlPromise;

  assert.equal(result.ok, true);
  assert.equal(result.restored, true);
  assert.equal(commands.length, 2);
  assert.equal(commands[0].device.host, "192.168.1.44");
  assert.equal(commands[0].durationMs, 4200);
  assert.equal(commands[1].operation, "on");
  assert.deepEqual(requests, [
    "http://192.168.1.44/shelly",
    "http://192.168.1.44/rpc/Shelly.GetStatus"
  ]);
  assert.equal(service.status().engine.kind, "python");
});

test("le bouton global bloque les règles mais pas les commandes de test", async () => {
  const store = ownerStore({
    enabled: false,
    devices: [
      {
        id: "shellyplug-s-test",
        name: "Test",
        host: "192.168.1.43",
        generation: 1,
        model: "SHPLG-S",
        channel: 0
      }
    ]
  });
  const urls = [];
  const service = new ShellyService({
    store,
    fetchImpl: async (url) => {
      urls.push(url);
      if (url.endsWith("/shelly")) {
        return jsonResponse({ type: "SHPLG-S", mac: "shellyplug-s-test" });
      }
      if (url.endsWith("/status")) {
        return jsonResponse({ relays: [{ ison: false }] });
      }
      return jsonResponse({ ison: false });
    },
    mdnsDiscoverer: async () => [],
    delayImpl: async () => {}
  });

  assert.deepEqual(
    await service.control({ deviceId: "shellyplug-s-test", operation: "off" }),
    { skipped: true, reason: "irl-disabled" }
  );
  assert.equal(urls.length, 0);

  await service.test("shellyplug-s-test", "cycle", 2000);
  assert.ok(
    urls.some((url) =>
      url.includes("/relay/0?turn=off&timer=2")
    )
  );
  assert.ok(urls.some((url) => url.includes("/relay/0?turn=on")));
});

test("refuse clairement un compteur Shelly sans relais", async () => {
  const service = new ShellyService({
    store: ownerStore({
      devices: [
        {
          id: "shellypro3em-aabbcc",
          name: "Pro3EM",
          host: "192.168.1.35",
          generation: 2,
          model: "SPEM-003CEBEU",
          channel: 0
        }
      ]
    }),
    fetchImpl: async () => {
      throw new Error("Aucune requête ne doit être envoyée.");
    }
  });

  await assert.rejects(
    service.test("shellypro3em-aabbcc", "cycle", 1000),
    /aucun relais pilotable/i
  );
});

test("le bouton Tester exécute l'action IRL même quand le mode LIVE est coupé", async () => {
  const calls = [];
  const runner = new ActionRunner({
    store: { getState: () => ({ settings: {} }) },
    overlayServer: {},
    gameHub: {},
    obsClient: {},
    sourceHub: {},
    spotifyService: {},
    shellyService: {
      async control(config, options) {
        calls.push({ config, options });
        return { ok: true };
      }
    },
    notifyRenderer: () => {}
  });
  const action = {
    type: "irl.shelly",
    config: { deviceId: "prise-test", operation: "cycle", durationMs: 1000 }
  };

  await runner.run(action, { source: "manual-preview", event: {} });
  await runner.run(action, { source: "tiktok", event: {} });

  assert.equal(calls[0].options.ignoreGlobalSwitch, true);
  assert.equal(calls[1].options.ignoreGlobalSwitch, false);
});

test("détecte les prises mDNS et les points d’accès Shelly sans cloud", async () => {
  const store = ownerStore();
  const commandRunner = async (_command, args) => {
    if (args.includes("interfaces")) {
      return "    SSID                   : StudioWifi\r\n";
    }
    return [
      "SSID 1 : StudioWifi",
      "SSID 2 : ShellyPlusPlugS-AABBCC",
      "SSID 3 : Guest"
    ].join("\r\n");
  };
  const service = new ShellyService({
    store,
    platform: "win32",
    commandRunner,
    mdnsDiscoverer: async () => ["192.168.1.55"],
    fetchImpl: async (url) => {
      if (url.endsWith("/shelly")) {
        return jsonResponse({
          id: "shellyplusplugs-aabbcc",
          model: "SNPL-00112EU",
          gen: 2
        });
      }
      assert.equal(url, "http://192.168.1.55/rpc/Shelly.GetStatus");
      return jsonResponse({ "switch:0": { output: false } });
    }
  });

  const result = await service.scan();
  assert.equal(result.currentNetwork, "StudioWifi");
  assert.deepEqual(result.accessPoints, [
    { ssid: "ShellyPlusPlugS-AABBCC" }
  ]);
  assert.equal(result.devices[0].host, "192.168.1.55");
  assert.equal(result.devices[0].online, true);
  assert.equal(result.devices[0].controllable, true);
});

test("limite les commandes Shelly au réseau local", () => {
  assert.equal(normalizeHost("192.168.1.20"), "192.168.1.20");
  assert.equal(normalizeHost("shellyplusplug-aabbcc.local"), "shellyplusplug-aabbcc.local");
  assert.equal(normalizeHost("8.8.8.8"), "");
  assert.equal(normalizeHost("example.com"), "");
});

test("résout les hôtes Shelly annoncés dans une réponse mDNS", () => {
  const records = [
    {
      name: "_shelly._tcp.local",
      type: 12,
      target: "shellyplusplugs-aabbcc._shelly._tcp.local"
    },
    {
      name: "shellyplusplugs-aabbcc._shelly._tcp.local",
      type: 33,
      target: "shellyplusplugs-aabbcc.local",
      port: 80
    },
    {
      name: "shellyplusplugs-aabbcc.local",
      type: 1,
      address: "192.168.1.55"
    }
  ];
  assert.deepEqual(hostsFromMdnsRecords(records), [
    "192.168.1.55",
    "shellyplusplugs-aabbcc.local"
  ]);
});

test("raccorde l’onglet, l’action et les IPC IRL au seul espace propriétaire", () => {
  const root = path.join(__dirname, "..");
  const renderer = fs.readFileSync(
    path.join(root, "src", "renderer", "app.js"),
    "utf8"
  );
  const preload = fs.readFileSync(
    path.join(root, "src", "main", "preload.js"),
    "utf8"
  );
  const runner = fs.readFileSync(
    path.join(root, "src", "main", "action-runner.js"),
    "utf8"
  );

  assert.match(renderer, /id: "irl"[\s\S]*ownerOnly: true/);
  assert.match(renderer, /function renderIrl\(/);
  assert.ok(
    renderer.indexOf("irl-actions-panel") <
      renderer.indexOf('class="studio-panel panel-cyan irl-devices-panel"')
  );
  assert.match(
    renderer,
    /game-interaction-card irl-interaction-card configured/
  );
  assert.match(renderer, /game-effect-trigger">\$\{triggerPill\(rule\)\}/);
  assert.match(renderer, /data-search="irl-actions"/);
  const styles = fs.readFileSync(
    path.join(root, "src", "renderer", "styles.css"),
    "utf8"
  );
  assert.match(styles, /\.irl-interaction-card\s*\{/);
  assert.match(styles, /\.irl-interaction-art svg\s*\{/);
  assert.match(renderer, /data-action="irl-toggle"/);
  assert.match(renderer, /Mesure uniquement · aucun relais/);
  assert.match(renderer, /\["pulse", "Allumer puis éteindre"\]/);
  assert.match(renderer, /1000 ms = 1 seconde/);
  assert.match(renderer, /"irl\.shelly": "Prise Shelly"/);
  assert.match(renderer, /defaultScope: id === "irl\.shelly" \? "admin"/);
  assert.match(preload, /pair: \(options\) => invoke\("irl:pair"/);
  assert.match(runner, /case "irl\.shelly"/);
});
