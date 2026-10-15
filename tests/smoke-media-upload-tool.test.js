"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { cloneEncryptionProfile, fixtures, isEntryPoint, memoryAccountStore, removeSmokeProfile, safeFailure, sha256 } = require("../scripts/smoke-media-upload");

test("le point d'entrée reconnaît le bootstrap Electron sans démarrer lors d'un import de test", () => {
  assert.equal(isEntryPoint({ nodeMain: false, processType: "browser", argv: ["electron.exe", "C:/smoke.js"], scriptPath: "C:/smoke.js" }), true);
  assert.equal(isEntryPoint({ nodeMain: false, argv: ["node.exe", "tests/tool.test.js"], scriptPath: "C:/smoke.js" }), false);
  assert.equal(isEntryPoint({ nodeMain: false, processType: "browser", argv: ["electron.exe", "other.js"], scriptPath: "C:/smoke.js" }), false);
  assert.equal(isEntryPoint({ nodeMain: true }), true);
});

test("les fixtures QA sont un WAV silencieux et un GIF minuscule déterministes", () => {
  const [wav, gif] = fixtures();
  assert.equal(wav.body.length, 204);
  assert.equal(wav.body.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.body.toString("ascii", 8, 12), "WAVE");
  assert.ok(wav.body.subarray(44).every((value) => value === 0));
  assert.equal(gif.body.toString("ascii", 0, 6), "GIF89a");
  assert.equal(gif.body.readUInt16LE(6), 1);
  assert.equal(gif.body.readUInt16LE(8), 1);
  assert.ok(gif.body.length < 100);
  assert.deepEqual(fixtures().map((item) => sha256(item.body)), [sha256(wav.body), sha256(gif.body)]);
});

test("le store du smoke ne déchiffre que le jeton actif et renouvelle uniquement en mémoire", () => {
  const state = { activeAccountUid: "ordinary-user", settings: { account: { uid: "ordinary-user", refreshTokenSecretId: "active-ref" } } };
  const secrets = {
    "active-ref": { encrypted: true, value: Buffer.from("ciphertext").toString("base64") },
    "b2-admin": { encrypted: true, value: "do-not-decrypt" }
  };
  const before = JSON.stringify({ state, secrets });
  let decryptions = 0;
  const store = memoryAccountStore(state, secrets, {
    isEncryptionAvailable: () => true,
    decryptString(buffer) {
      decryptions++;
      assert.equal(buffer.toString(), "ciphertext");
      return "test-refresh-token";
    }
  });
  assert.equal(decryptions, 1);
  assert.equal(store.getSecret("b2-admin"), "");
  assert.equal(store.getSecret("active-ref"), "test-refresh-token");
  store.setSecret("active-ref", "rotated-test-token");
  assert.equal(store.getSecret("active-ref"), "rotated-test-token");
  assert.throws(() => store.setSecret("b2-admin", "forbidden"), /UNEXPECTED_SECRET_WRITE/);
  store.getAccountSession().uid = "not-applied";
  store.getState().settings.account.uid = "not-applied";
  assert.equal(store.getActiveAccountUid(), "ordinary-user");
  assert.equal(store.getAccountSession().uid, "ordinary-user");
  assert.equal(JSON.stringify({ state, secrets }), before);
});

test("le smoke refuse une session absente, un mauvais compte ou un coffre indisponible", () => {
  const state = { activeAccountUid: "a", settings: { account: { uid: "b", refreshTokenSecretId: "r" } } };
  assert.throws(() => memoryAccountStore(state, {}), /SESSION_MISSING/);
  state.settings.account.uid = "a";
  assert.throws(() => memoryAccountStore(state, {}), /SESSION_MISSING/);
  assert.throws(() => memoryAccountStore(state, { r: { encrypted: true, value: "YQ==" } }, {
    isEncryptionAvailable: () => false
  }), /DECRYPTION_UNAVAILABLE/);
});

test("les erreurs du smoke ne révèlent ni jetons ni URL protégées", () => {
  assert.equal(safeFailure(new Error("fetch failed https://example.com/?secret=private-token")), "CHECK_FAILED");
  assert.equal(safeFailure(new Error("SESSION_MISSING")), "SESSION_MISSING");
});

test("un échec de déchiffrement reste identifiable sans diagnostic cryptographique privé", () => {
  const state = { activeAccountUid: "a", settings: { account: { uid: "a", refreshTokenSecretId: "r" } } };
  assert.throws(() => memoryAccountStore(state, { r: { encrypted: true, value: "YQ==" } }, {
    isEncryptionAvailable: () => true,
    decryptString() { throw new Error("private-key-material-must-not-be-logged"); }
  }), (error) => error.message === "DECRYPTION_FAILED" && safeFailure(error) === "DECRYPTION_FAILED");
});

test("le profil isolé copie seulement Local State sans modifier la source", () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-profile-source-"));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-media-smoke-"));
  try {
    const bytes = Buffer.from('{"os_crypt":{"encrypted_key":"fake-encrypted-key"}}');
    fs.writeFileSync(path.join(source, "Local State"), bytes);
    fs.writeFileSync(path.join(source, "Cookies"), "do-not-copy");
    assert.equal(cloneEncryptionProfile(source, target), sha256(bytes));
    assert.deepEqual(fs.readdirSync(target), ["Local State"]);
    assert.deepEqual(fs.readFileSync(path.join(source, "Local State")), bytes);
    assert.deepEqual(fs.readFileSync(path.join(target, "Local State")), bytes);
    assert.throws(() => cloneEncryptionProfile(source, target), /EEXIST/);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("le nettoyage refuse un dossier large, non marqué, imbriqué ou encore utilisé", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-media-smoke-"));
  const other = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-tool-test-"));
  try {
    assert.throws(() => removeSmokeProfile(os.tmpdir()), /CLEANUP_PATH_INVALID/);
    assert.throws(() => removeSmokeProfile(other), /CLEANUP_PATH_INVALID/);
    assert.throws(() => removeSmokeProfile(target), /CLEANUP_PATH_INVALID/);
    fs.writeFileSync(path.join(target, ".shenpulse-media-smoke-owned"), JSON.stringify({ kind: "shenpulse-media-smoke-v1", pid: 12345 }));
    assert.throws(() => removeSmokeProfile(target, { isProcessAlive: () => true }), /CLEANUP_PROCESS_RUNNING/);
    const nested = path.join(other, "shenpulse-media-smoke-nested");
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(nested, ".shenpulse-media-smoke-owned"), JSON.stringify({ kind: "shenpulse-media-smoke-v1", pid: 12345 }));
    assert.throws(() => removeSmokeProfile(nested, { isProcessAlive: () => false }), /CLEANUP_PATH_INVALID/);
    removeSmokeProfile(target, { isProcessAlive: () => false });
    assert.equal(fs.existsSync(target), false);
    assert.equal(fs.existsSync(other), true);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(other, { recursive: true, force: true });
  }
});
