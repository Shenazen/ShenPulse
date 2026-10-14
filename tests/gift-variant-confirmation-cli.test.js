"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { AtomicJsonStorage } = require("../src/main/state/json-storage");
const { accountWorkspaceKey } = require("../src/main/state/account-workspace");
const { parseArguments, isShenPulseRunning, prepareRepair, runRepair, verifyMetadataOnly } = require("../scripts/repair-confirmed-gift-variants");

const gifts = [
  { id: "100", name: "Cadeau choisi", cost: 10, alternateIds: ["ancien-choisi"], imageUrl: "https://example.com/choisi.webp" },
  { id: "101", name: "Cadeau choisi", cost: 1, imageUrl: "https://example.com/autre.webp" },
  { id: "200", name: "Cadeau non choisi", cost: 20, imageUrl: "https://example.com/intact.webp" }
];
const variants = [{ name: "Cadeau choisi", cost: 10 }];
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function rules(tag) {
  return [{ id: tag, name: "Mon action", enabled: false, trigger: { type: "gift", source: "tiktok" },
    conditions: [{ field: "data.giftName", operator: "equals", value: "Cadeau choisi" },
      { field: "data.giftName", operator: "equals", value: "Cadeau non choisi" }],
    actions: [{ type: "audio.play", config: { volume: 0.4, text: "Ne pas toucher" } }],
    cooldown: { globalMs: 3000, perUserMs: 900 } }];
}
function fixture() {
  return { activeAccountUid: "compte-actif", settings: { account: { uid: "compte-actif", secretToken: "jeton-secret" } },
    rules: rules("racine"), profiles: [{ id: "profil", workspace: { rules: rules("profil") } }],
    accountWorkspaces: {
      [accountWorkspaceKey("compte-actif")]: { ownerUid: "compte-actif", rules: rules("copie") },
      [accountWorkspaceKey("autre-compte")]: { ownerUid: "autre-compte", rules: rules("autre") }
    }, unclaimedAccountWorkspace: { rules: rules("non-revendique") } };
}
function temporaryState(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-variantes-test-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const statePath = path.join(directory, "shenpulse-state.json");
  const state = fixture();
  const content = JSON.stringify(state, null, 2);
  fs.writeFileSync(statePath, content, "utf8");
  return { directory, statePath, state, content };
}

test("le CLI exige un état et des variantes explicites, et prévisualise par défaut", () => {
  const options = parseArguments(["--state", "test.json", "--gift", "Cadeau choisi=10", "--gift", "Autre=299"]);
  assert.equal(options.apply, false);
  assert.equal(options.statePath, path.resolve("test.json"));
  assert.deepEqual(options.confirmedVariants, [...variants, { name: "Autre", cost: 299 }]);
  assert.equal(parseArguments(["--state", "test.json", "--gift", "A=1", "--apply"]).apply, true);
  for (const args of [[], ["--state", "x"], ["--state", "x", "--gift", "A=0"],
    ["--state", "x", "--gift", "A=1.5"], ["--state", "x", "--gift", "A=1", "--gift", "a=2"],
    ["--state", "x", "--gift", "A=1", "--state", "y"], ["--state", "--apply"],
    ["--state", "x", "--gift", "A=1", "--apply", "--apply"], ["--inconnu"]]) {
    assert.throws(() => parseArguments(args));
  }
});

test("le plan est pur et limité à la racine, aux profils et à la copie du compte actif", () => {
  const state = fixture();
  const before = copy(state);
  const { repaired, report } = prepareRepair(state, gifts, variants);
  assert.deepEqual(state, before);
  assert.equal(report.references, 3);
  assert.equal(report.applied, false);
  assert.equal(report.changesByGift[0].references, 3);
  for (const entries of [repaired.rules, repaired.profiles[0].workspace.rules,
    repaired.accountWorkspaces[accountWorkspaceKey("compte-actif")].rules]) {
    assert.equal(entries[0].conditions[0].giftId, "100");
    assert.equal(entries[0].conditions[0].giftImageUrl, gifts[0].imageUrl);
    assert.deepEqual(entries[0].conditions[1], before.rules[0].conditions[1]);
    assert.deepEqual(entries[0].actions, before.rules[0].actions);
    assert.deepEqual(entries[0].cooldown, before.rules[0].cooldown);
  }
  assert.deepEqual(repaired.accountWorkspaces[accountWorkspaceKey("autre-compte")], before.accountWorkspaces[accountWorkspaceKey("autre-compte")]);
  assert.deepEqual(repaired.unclaimedAccountWorkspace, before.unclaimedAccountWorkspace);
  assert.ok(!JSON.stringify(report).includes("compte-actif"));
  assert.ok(!JSON.stringify(report).includes("jeton-secret"));
  assert.equal(prepareRepair(repaired, gifts, variants).report.attributes, 0);
});

test("le CLI refuse propriétaires incohérents, compte absent et choix introuvables", () => {
  for (const mutate of [
    (state) => { state.activeAccountUid = ""; },
    (state) => { state.settings.account.uid = "mauvais-compte"; },
    (state) => { state.accountWorkspaces[accountWorkspaceKey("compte-actif")].ownerUid = "autre-compte"; },
    (state) => { delete state.accountWorkspaces[accountWorkspaceKey("compte-actif")]; }
  ]) {
    const state = fixture();
    mutate(state);
    assert.throws(() => prepareRepair(state, gifts, variants), /refusée/);
  }
  assert.throws(() => prepareRepair(fixture(), gifts, [{ name: "Absent", cost: 5 }]), /absente ou ambiguë/);
  assert.throws(() => prepareRepair(fixture(), gifts, []), /doit être confirmée/);
  assert.throws(() => prepareRepair(fixture(), gifts, [...variants, ...variants]), /une fois/);
});

test("les jeux intégrés et roues gardent leurs comportements et reçoivent seulement les métadonnées", () => {
  const state = fixture();
  state.game = { connectorOverrides: { exemple: {
    guardGift: { name: "Cadeau choisi", cost: 10, image: "", seconds: 7, enabled: false }
  } } };
  state.settings.overlayConfigs = { wheel: { wheels: [{ id: "roue", trigger: "Cadeau choisi",
    segments: [{ label: "Ma récompense", actionId: "action-personnalisee" }], cooldownMs: 9000 }] } };
  const before = copy(state);
  const { repaired, report } = prepareRepair(state, gifts, variants);
  assert.equal(report.references, 5);
  const guard = repaired.game.connectorOverrides.exemple.guardGift;
  assert.equal(guard.giftId, "100");
  assert.equal(guard.image, gifts[0].imageUrl);
  assert.equal(guard.cost, 10);
  assert.equal(guard.seconds, 7);
  assert.equal(guard.enabled, false);
  const wheel = repaired.settings.overlayConfigs.wheel.wheels[0];
  assert.equal(wheel.triggerGift.giftId, "100");
  assert.deepEqual(wheel.segments, before.settings.overlayConfigs.wheel.wheels[0].segments);
  assert.equal(wheel.cooldownMs, 9000);
  assert.equal(wheel.trigger, "Cadeau choisi");
  assert.deepEqual(state, before);
});

test("un ID existant ou une autre variante explicitement tarifée ne sont pas réattribués", () => {
  const state = fixture();
  state.rules[0].conditions.push(
    { field: "data.giftName", operator: "equals", value: "Cadeau choisi", giftId: "inconnu", giftImageUrl: "ancienne.webp" },
    { field: "data.giftName", operator: "equals", value: "Cadeau choisi", giftCost: 1 },
    { field: "data.giftName", operator: "equals", value: "Cadeau choisi", giftId: "101", giftCost: 1 }
  );
  const before = copy(state);
  const { repaired } = prepareRepair(state, gifts, variants);
  assert.deepEqual(repaired.rules[0].conditions.slice(2), before.rules[0].conditions.slice(2));
});

test("la prévisualisation n'écrit rien et ne lance aucun contrôle de programme", (context) => {
  const temporary = temporaryState(context);
  const report = runRepair({ statePath: temporary.statePath, confirmedVariants: variants }, {
    gifts, isRunning() { throw new Error("Ce contrôle ne doit pas être exécuté."); }
  });
  assert.equal(report.applied, false);
  assert.ok(report.attributes > 0);
  assert.equal(fs.readFileSync(temporary.statePath, "utf8"), temporary.content);
  assert.deepEqual(fs.readdirSync(temporary.directory), ["shenpulse-state.json"]);
});

test("--apply produit une sauvegarde permanente exacte avant le commit atomique", (context) => {
  const temporary = temporaryState(context);
  const report = runRepair({ statePath: temporary.statePath, confirmedVariants: variants, apply: true }, {
    gifts, isRunning: () => false, now: () => new Date("2026-10-13T12:00:00.000Z")
  });
  assert.equal(report.applied, true);
  assert.equal(path.basename(report.backupPath), "shenpulse-state.before-confirmed-gift-variants-2026-10-13T12-00-00-000Z.json");
  assert.equal(fs.readFileSync(report.backupPath, "utf8"), temporary.content);
  const repaired = JSON.parse(fs.readFileSync(temporary.statePath, "utf8"));
  assert.equal(repaired.rules[0].conditions[0].giftId, "100");
  assert.deepEqual(repaired.accountWorkspaces[accountWorkspaceKey("autre-compte")], temporary.state.accountWorkspaces[accountWorkspaceKey("autre-compte")]);
  assert.ok(!fs.existsSync(`${temporary.statePath}.confirmed-gift-variants.lock`));
});

test("--apply refuse ShenPulse ouvert sans écrire ni sauvegarde ni verrou", (context) => {
  const temporary = temporaryState(context);
  assert.throws(() => runRepair({ statePath: temporary.statePath, confirmedVariants: variants, apply: true }, {
    gifts, isRunning: () => true
  }), /encore ouvert/);
  assert.equal(fs.readFileSync(temporary.statePath, "utf8"), temporary.content);
  assert.deepEqual(fs.readdirSync(temporary.directory), ["shenpulse-state.json"]);
});

test("une écriture concurrente après sauvegarde n'est jamais écrasée", (context) => {
  const temporary = temporaryState(context);
  const storage = new AtomicJsonStorage();
  const originalWrite = storage.atomicWrite.bind(storage);
  const concurrent = JSON.stringify({ ...temporary.state, concurrentMarker: true });
  storage.atomicWrite = (targetPath, ...args) => {
    originalWrite(targetPath, ...args);
    if (targetPath !== temporary.statePath) fs.writeFileSync(temporary.statePath, concurrent, "utf8");
  };
  assert.throws(() => runRepair({ statePath: temporary.statePath, confirmedVariants: variants, apply: true }, {
    gifts, storage, isRunning: () => false
  }), /a changé/);
  assert.equal(fs.readFileSync(temporary.statePath, "utf8"), concurrent);
  assert.ok(!fs.existsSync(`${temporary.statePath}.confirmed-gift-variants.lock`));
});

test("un échec de sauvegarde préalable préserve le fichier et libère le verrou", (context) => {
  const temporary = temporaryState(context);
  const storage = new AtomicJsonStorage();
  storage.atomicWrite = () => { throw new Error("Disque indisponible"); };
  assert.throws(() => runRepair({ statePath: temporary.statePath, confirmedVariants: variants, apply: true }, {
    gifts, storage, isRunning: () => false
  }), /Disque indisponible/);
  assert.equal(fs.readFileSync(temporary.statePath, "utf8"), temporary.content);
  assert.ok(!fs.existsSync(`${temporary.statePath}.confirmed-gift-variants.lock`));
});

test("la vérification Windows est injectable, en lecture seule et refuse les réponses douteuses", () => {
  let calls = 0;
  const execute = (program, args, options) => {
    calls += 1;
    assert.equal(program, "powershell.exe");
    assert.ok(args.includes("-NonInteractive"));
    assert.ok(args.at(-1).includes("Get-CimInstance"));
    assert.ok(!/Stop-Process|Start-Process|taskkill/i.test(args.at(-1)));
    const expression = new RegExp(args.at(-1).match(/-match '([^']+)'/)[1], "i");
    assert.equal(expression.test("C:\\projet\\src\\main\\main.js"), true);
    assert.equal(expression.test("C:/projet/src/main/main.js"), true);
    assert.equal(options.windowsHide, true);
    return "1\r\n";
  };
  assert.equal(isShenPulseRunning({ platform: "win32", execute }), true);
  assert.equal(calls, 1);
  assert.equal(isShenPulseRunning({ platform: "win32", execute: () => "0" }), false);
  assert.throws(() => isShenPulseRunning({ platform: "win32", execute: () => "erreur" }), /inattendue/);
  assert.throws(() => isShenPulseRunning({ platform: "win32", execute: () => { throw new Error(); } }), /Impossible/);
  assert.throws(() => isShenPulseRunning({ platform: "linux", execute }), /refusée/);
});

test("le garde-fou rejette tout changement d'action, de nom ou de seuil métier", () => {
  const state = fixture();
  for (const mutate of [
    (next) => { next.rules[0].actions[0].config.volume = 1; },
    (next) => { next.rules[0].conditions[0].value = "Autre cadeau"; },
    (next) => { next.rules[0].cooldown.globalMs = 0; },
    (next) => { next.rules[0].enabled = true; }
  ]) {
    const next = copy(state);
    mutate(next);
    assert.throws(() => verifyMetadataOnly(state, next), /hors métadonnées/);
  }
});

test("un verrou existant n'est ni ignoré ni effacé", (context) => {
  const temporary = temporaryState(context);
  const lockPath = `${temporary.statePath}.confirmed-gift-variants.lock`;
  fs.writeFileSync(lockPath, "verrou d'une autre réparation", "utf8");
  assert.throws(() => runRepair({ statePath: temporary.statePath, confirmedVariants: variants, apply: true }, {
    gifts, isRunning: () => false
  }), /déjà verrouillée/);
  assert.equal(fs.readFileSync(lockPath, "utf8"), "verrou d'une autre réparation");
  assert.equal(fs.readFileSync(temporary.statePath, "utf8"), temporary.content);
});

test("une sauvegarde homonyme existante reste intacte", (context) => {
  const temporary = temporaryState(context);
  const backupPath = path.join(temporary.directory, "shenpulse-state.before-confirmed-gift-variants-2026-10-13T12-00-00-000Z.json");
  fs.writeFileSync(backupPath, "sauvegarde historique à conserver", "utf8");
  const report = runRepair({ statePath: temporary.statePath, confirmedVariants: variants, apply: true }, {
    gifts, isRunning: () => false, now: () => new Date("2026-10-13T12:00:00.000Z")
  });
  assert.equal(fs.readFileSync(backupPath, "utf8"), "sauvegarde historique à conserver");
  assert.equal(path.basename(report.backupPath), "shenpulse-state.before-confirmed-gift-variants-2026-10-13T12-00-00-000Z-1.json");
  assert.equal(fs.readFileSync(report.backupPath, "utf8"), temporary.content);
});

test("la réouverture de ShenPulse avant commit préserve l'état", (context) => {
  const temporary = temporaryState(context);
  let checks = 0;
  assert.throws(() => runRepair({ statePath: temporary.statePath, confirmedVariants: variants, apply: true }, {
    gifts, isRunning: () => ++checks >= 3
  }), /rouvert/);
  assert.equal(fs.readFileSync(temporary.statePath, "utf8"), temporary.content);
  assert.ok(!fs.existsSync(`${temporary.statePath}.confirmed-gift-variants.lock`));
});

test("un JSON invalide ne divulgue jamais son extrait privé", (context) => {
  const temporary = temporaryState(context);
  fs.writeFileSync(temporary.statePath, '{"uid":"identifiant-secret","token":"jeton-secret" invalid}', "utf8");
  assert.throws(() => runRepair({ statePath: temporary.statePath, confirmedVariants: variants }, { gifts }), (error) => {
    assert.match(error.message, /illisible ou invalide/);
    assert.ok(!error.message.includes("identifiant-secret"));
    assert.ok(!error.message.includes("jeton-secret"));
    return true;
  });
});

test("--apply contrôle l'arrêt même quand aucune référence ne reste à réparer", (context) => {
  const temporary = temporaryState(context);
  const repaired = prepareRepair(temporary.state, gifts, variants).repaired;
  const content = JSON.stringify(repaired);
  fs.writeFileSync(temporary.statePath, content, "utf8");
  assert.throws(() => runRepair({ statePath: temporary.statePath, confirmedVariants: variants, apply: true }, {
    gifts, isRunning: () => true
  }), /encore ouvert/);
  assert.equal(fs.readFileSync(temporary.statePath, "utf8"), content);
});
