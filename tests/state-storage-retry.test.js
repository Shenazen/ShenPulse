"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { AtomicJsonStorage } = require("../src/main/state/json-storage");
const { StateStore } = require("../src/main/store");

function directory(context) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-storage-retry-"));
  context.after(() => fs.rmSync(target, { recursive: true, force: true }));
  return target;
}
const failure = (code = "EPERM") => Object.assign(new Error("fixture-only private path or data must never reach diagnostics"), { code });
const saved = (store) => JSON.parse(fs.readFileSync(store.filePath, "utf8"));
function fixture(context, { onPersistenceStatus } = {}) {
  if (!context.storageRetryTimersEnabled) {
    context.mock.timers.enable({ apis: ["setTimeout"] }); context.storageRetryTimersEnabled = true;
  }
  const warnings = context.mock.method(console, "warn", () => {}), statuses = [];
  const store = new StateStore(directory(context), { isEncryptionAvailable: () => false }, {
    onPersistenceStatus: (status) => { statuses.push(status); onPersistenceStatus?.(status); }
  });
  store.load(); store.flush();
  const atomicWrite = store.storage.atomicWrite.bind(store.storage);
  context.after(() => { store.storage.atomicWrite = atomicWrite; store.flush(); });
  statuses.length = 0;
  return { store, statuses, warnings, atomicWrite, tick: (ms) => context.mock.timers.tick(ms) };
}

test("an atomic rename retries only transient Windows locks and never removes the previous valid file", (context) => {
  for (const code of ["EPERM", "EACCES", "EBUSY"]) {
    const target = path.join(directory(context), "state.json"), old = JSON.stringify({ value: "old" }), next = JSON.stringify({ value: "new" });
    fs.writeFileSync(target, old); let attempts = 0; const waits = [];
    const storage = new AtomicJsonStorage({ wait: (ms) => waits.push(ms), renameSync: (source, destination) => {
      if (destination === target && ++attempts < 3) {
        assert.equal(fs.readFileSync(target, "utf8"), old); assert.equal(fs.readFileSync(source, "utf8"), next); throw failure(code);
      }
      fs.renameSync(source, destination);
    } });
    storage.atomicWrite(target, next);
    assert.equal(attempts, 3); assert.deepEqual(waits, [2, 4]);
    assert.equal(fs.readFileSync(target, "utf8"), next); assert.equal(fs.readFileSync(`${target}.bak`, "utf8"), old);
  }
});

test("exhausted atomic lock retries preserve both the old destination and the verified recovery temporary", (context) => {
  const target = path.join(directory(context), "state.json"), old = JSON.stringify({ value: "old" }), next = JSON.stringify({ value: "latest" });
  fs.writeFileSync(target, old); let attempts = 0; const waits = [];
  const storage = new AtomicJsonStorage({ wait: (ms) => waits.push(ms), renameSync: (source, destination) => {
    if (destination === target) { attempts += 1; throw failure(); } fs.renameSync(source, destination);
  } });
  assert.throws(() => storage.atomicWrite(target, next), { code: "EPERM" });
  assert.equal(attempts, 4); assert.deepEqual(waits, [2, 4, 6]); assert.equal(fs.readFileSync(target, "utf8"), old);
  assert.equal(fs.readFileSync(`${target}.bak`, "utf8"), old);
  const temporary = fs.readdirSync(path.dirname(target)).find((name) => name.startsWith("state.json.") && name.endsWith(".tmp"));
  assert.ok(temporary); assert.equal(storage.parseJsonFile(path.join(path.dirname(target), temporary)).content, next);
});

test("permanent atomic errors and malformed JSON are never retried or reported as successful", (context) => {
  const target = path.join(directory(context), "state.json"); let attempts = 0, waits = 0;
  const storage = new AtomicJsonStorage({ wait: () => { waits += 1; }, renameSync: () => { attempts += 1; throw failure("ENOSPC"); } });
  assert.throws(() => storage.atomicWrite(target, JSON.stringify({ keep: true })), { code: "ENOSPC" });
  assert.equal(attempts, 1); assert.equal(waits, 0);
  assert.throws(() => storage.atomicWrite(target, "invalid-json"), SyntaxError); assert.equal(attempts, 1);
});

test("short synchronous retries across backup and primary are bounded to twenty-four milliseconds in total", (context) => {
  const target = path.join(directory(context), "state.json"), attempts = new Map(), waits = [];
  fs.writeFileSync(target, JSON.stringify({ generation: 1 }));
  const storage = new AtomicJsonStorage({ wait: (ms) => waits.push(ms), renameSync: (source, destination) => {
    const count = (attempts.get(destination) || 0) + 1; attempts.set(destination, count);
    if (count < 4) throw failure(); fs.renameSync(source, destination);
  } });
  storage.atomicWrite(target, JSON.stringify({ generation: 2 }));
  assert.equal(waits.reduce((total, ms) => total + ms, 0), 24);
  assert.equal(JSON.parse(fs.readFileSync(target, "utf8")).generation, 2);
  assert.equal(JSON.parse(fs.readFileSync(`${target}.bak`, "utf8")).generation, 1);
});

test("a failed deferred configuration save cannot escape its timer and eventually persists the newest memory", (context) => {
  const f = fixture(context); let failures = 2, attempts = 0;
  f.store.storage.atomicWrite = (...args) => { attempts += 1; if (failures-- > 0) throw failure(); return f.atomicWrite(...args); };
  f.store.set("settings.theme", "light");
  assert.doesNotThrow(() => f.tick(200)); assert.equal(saved(f.store).settings.theme, "dark");
  assert.deepEqual(f.store.getPersistenceStatus(), { pending: true, errorCode: "EPERM", retryScheduled: true, attempts: 1 });
  f.store.state.statistics.lifetimeEvents = 19;
  assert.doesNotThrow(() => f.tick(250)); assert.equal(f.store.getPersistenceStatus().attempts, 2);
  f.store.state.statistics.lifetimeEvents = 29;
  assert.doesNotThrow(() => f.tick(1000)); assert.equal(attempts, 3);
  assert.equal(saved(f.store).settings.theme, "light"); assert.equal(saved(f.store).statistics.lifetimeEvents, 29);
  assert.deepEqual(f.store.getPersistenceStatus(), { pending: false, errorCode: "", retryScheduled: false, attempts: 0 });
  assert.equal(f.warnings.mock.calls.length, 1, "One sanitized warning per failure streak, not per LIVE event");
  assert.equal(JSON.stringify(f.statuses).includes("private path"), false);
});

test("a runtime checkpoint failure is equally contained and resumes without waiting for a new LIVE event", (context) => {
  const f = fixture(context); let fail = true;
  f.store.storage.atomicWrite = (...args) => { if (fail) throw failure("EBUSY"); return f.atomicWrite(...args); };
  f.store.mutateRuntime((state) => { state.statistics.lifetimeEvents = 12; });
  assert.doesNotThrow(() => f.tick(5000)); assert.equal(f.store.getPersistenceStatus().pending, true);
  fail = false; f.tick(250); assert.equal(saved(f.store).statistics.lifetimeEvents, 12);
  assert.equal(f.store.getPersistenceStatus().pending, false);
});

test("persistent lock retries are bounded and leave the old valid file and all in-memory changes intact", (context) => {
  const f = fixture(context), before = fs.readFileSync(f.store.filePath, "utf8"); let attempts = 0;
  f.store.storage.atomicWrite = () => { attempts += 1; throw failure(); };
  f.store.mutateRuntime((state) => { state.statistics.lifetimeEvents = 81; });
  for (const elapsed of [5000, 250, 1000, 3000, 60000]) assert.doesNotThrow(() => f.tick(elapsed));
  assert.equal(attempts, 4);
  assert.equal(f.store.state.statistics.lifetimeEvents, 81); assert.equal(fs.readFileSync(f.store.filePath, "utf8"), before);
  assert.deepEqual(f.store.getPersistenceStatus(), { pending: true, errorCode: "EPERM", retryScheduled: false, attempts: 3 });
  assert.equal(f.warnings.mock.calls.length, 1);
  f.store.storage.atomicWrite = f.atomicWrite; f.store.flush(); assert.equal(saved(f.store).statistics.lifetimeEvents, 81);
});

test("a nontransient deferred failure is explicit in diagnostics without an unhandled timer or retry loop", (context) => {
  const f = fixture(context); let attempts = 0;
  f.store.storage.atomicWrite = () => { attempts += 1; throw failure("ENOSPC"); };
  f.store.set("settings.theme", "light"); assert.doesNotThrow(() => f.tick(200)); f.tick(60000);
  assert.equal(attempts, 1); assert.deepEqual(f.store.getPersistenceStatus(), {
    pending: true, errorCode: "ENOSPC", retryScheduled: false, attempts: 0
  });
  assert.equal(f.store.state.settings.theme, "light");
});

test("explicit flush and immediate save failures still throw, never pretending the disk commit succeeded", (context) => {
  const f = fixture(context), before = fs.readFileSync(f.store.filePath, "utf8");
  f.store.storage.atomicWrite = () => { throw failure(); };
  assert.throws(() => f.store.mutate((state) => { state.settings.theme = "light"; }, true), { code: "EPERM" });
  assert.throws(() => f.store.flush(), { code: "EPERM" });
  assert.equal(f.store.getPersistenceStatus().pending, true); assert.equal(f.store.persistenceRetryTimer, null);
  assert.equal(fs.readFileSync(f.store.filePath, "utf8"), before);
});

test("successful import and flush cancel pending retries and cannot replay a stale scheduled snapshot", (context) => {
  for (const operation of ["flush", "import"]) {
    const f = fixture(context); f.store.activateAccount("fixture-import-account");
    f.store.storage.atomicWrite = () => { throw failure(); };
    f.store.set("settings.theme", "light"); f.tick(200); assert.ok(f.store.persistenceRetryTimer);
    f.store.storage.atomicWrite = f.atomicWrite;
    if (operation === "import") {
      const imported = f.store.getState(); imported.settings.theme = "dark"; f.store.importState(imported);
    } else f.store.flush();
    assert.equal(f.store.persistenceRetryTimer, null); assert.equal(f.store.getPersistenceStatus().pending, false);
    const content = fs.readFileSync(f.store.filePath, "utf8"); f.tick(60000);
    assert.equal(fs.readFileSync(f.store.filePath, "utf8"), content);
    assert.equal(saved(f.store).settings.theme, operation === "import" ? "dark" : "light");
  }
});

test("diagnostic callbacks cannot throw through persistence and never receive an Error, filename or state", (context) => {
  const f = fixture(context, { onPersistenceStatus: () => { throw new Error("fixture-listener"); } });
  f.store.storage.atomicWrite = () => { throw failure("EPERM/private-sensitive"); };
  f.store.set("settings.theme", "light"); assert.doesNotThrow(() => f.tick(200));
  assert.deepEqual(f.statuses.at(-1), { pending: true, errorCode: "PERSISTENCE_WRITE_FAILED", retryScheduled: false, attempts: 0 });
  for (const status of f.statuses) assert.deepEqual(Object.keys(status).sort(), ["attempts", "errorCode", "pending", "retryScheduled"]);
  assert.equal(JSON.stringify(f.warnings.mock.calls).includes("private-sensitive"), false);
});

test("a failed import preserves the original pending retry and cannot later commit the rejected imported settings", (context) => {
  const f = fixture(context); f.store.activateAccount("fixture-import-account");
  f.store.storage.atomicWrite = () => { throw failure(); };
  f.store.set("settings.theme", "light"); f.tick(200); const timer = f.store.persistenceRetryTimer;
  const before = structuredClone(f.store.state), imported = f.store.getState(); imported.settings.theme = "dark";
  assert.throws(() => f.store.importState(imported), { code: "EPERM" });
  assert.deepEqual(f.store.state, before); assert.equal(f.store.persistenceRetryTimer, timer);
  f.store.storage.atomicWrite = f.atomicWrite; f.tick(250);
  assert.equal(saved(f.store).settings.theme, "light"); assert.equal(f.store.getPersistenceStatus().pending, false);
});
