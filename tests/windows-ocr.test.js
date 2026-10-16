"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const fs = require("node:fs");
const { createWindowsOcr } = require("../src/main/matches/windows-ocr");

function png(width = 800, height = 200) {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(13, 8); bytes.write("IHDR", 12); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  return bytes; // Header-only fixture is enough for wrapper validation, never sent to an actual decoder.
}
function fixture(context, options = {}) {
  let now = 100000, timerSequence = 0;
  const spawned = [], timers = new Map();
  const spawnImpl = (...arguments_) => {
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.writes = []; child.killed = 0; child.destroyed = 0;
    child.stdin = new EventEmitter();
    child.stdin.write = (value) => { child.writes.push(JSON.parse(value)); return true; };
    child.stdin.destroy = () => { child.destroyed += 1; };
    child.kill = () => { child.killed += 1; };
    child.reply = (value) => child.stdout.emit("data", Buffer.from(JSON.stringify(value) + "\n"));
    spawned.push({ child, arguments_ }); return child;
  };
  const ocr = createWindowsOcr({ spawnImpl, platform: "win32", resourcePath: path.resolve("resources/match-vision/ocr.ps1"),
    now: () => now, setTimeoutImpl: (callback, delay) => {
      const key = ++timerSequence; timers.set(key, { callback, at: now + delay }); return key;
    }, clearTimeoutImpl: (key) => timers.delete(key), ...options });
  context.after(() => ocr.close());
  const advance = (milliseconds) => {
    now += milliseconds;
    for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.callback(); }
  };
  return { ocr, spawned, timers, advance, child: () => spawned.at(-1)?.child };
}
const response = (id = 1, text = "Points cadeaux x2 | 30s") => ({ id, available: true,
  lines: [{ text, bbox: { x: 4, y: 7, width: 220, height: 25 } }] });

test("Windows OCR: disabled construction and unsupported systems start no process", async (context) => {
  const f = fixture(context); assert.equal(f.spawned.length, 0);
  f.ocr.close(); assert.equal((await f.ocr.recognize(png())).reason, "closed"); assert.equal(f.spawned.length, 0);
  const other = fixture(context, { platform: "linux" });
  assert.deepEqual(await other.ocr.recognize(png()), { available: false, lines: [], reason: "unsupported" });
  assert.equal(other.spawned.length, 0);
});

test("Windows OCR: only bounded PNG memory is accepted before a worker can start", async (context) => {
  const f = fixture(context);
  for (const bytes of [null, "path.png", Buffer.alloc(0), Buffer.alloc(34), png(0), png(2601), png(2600, 2600),
    Buffer.alloc(2 * 1024 * 1024 + 1), new Uint8Array([1, 2, 3])]) {
    assert.equal((await f.ocr.recognize(bytes)).reason, "invalid-image");
  }
  const changed = png(); changed.write("IDAT", 12);
  assert.equal((await f.ocr.recognize(changed)).reason, "invalid-image");
  assert.equal(f.spawned.length, 0);
});

test("Windows OCR: fixed hidden PowerShell receives JSON bytes, is reused, and returns a stripped bounded result", async (context) => {
  const f = fixture(context), pending = f.ocr.recognize(png());
  assert.equal(f.spawned.length, 1);
  const [executable, arguments_, options] = f.spawned[0].arguments_;
  assert.match(executable, /System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/);
  assert.deepEqual(arguments_.slice(0, 5), ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", path.resolve("resources/match-vision/ocr.ps1")]);
  assert.equal(arguments_.some((argument) => /Bypass|EncodedCommand/i.test(argument)), false);
  assert.equal(options.windowsHide, true); assert.equal(options.shell, false);
  assert.deepEqual(Object.keys(f.child().writes[0]), ["id", "png"]);
  assert.equal(f.child().writes[0].png, png().toString("base64"));
  f.child().reply({ ...response(), arbitrary: "not exposed" });
  assert.deepEqual(await pending, { available: true, lines: response().lines });
  const next = f.ocr.recognize(png()); assert.equal(f.spawned.length, 1);
  f.child().reply(response(2, "Points cadeaux x3"));
  assert.equal((await next).lines[0].text, "Points cadeaux x3");
  assert.equal(f.timers.size, 0);
});

test("Windows OCR: UTF-8 response split inside an accented character is decoded without corruption", async (context) => {
  const f = fixture(context), pending = f.ocr.recognize(png());
  const bytes = Buffer.from(JSON.stringify(response(1, "multiplicateur déclenché")) + "\n");
  const split = bytes.indexOf(Buffer.from("é")) + 1;
  f.child().stdout.emit("data", bytes.subarray(0, split)); f.child().stdout.emit("data", bytes.subarray(split));
  assert.equal((await pending).lines[0].text, "multiplicateur déclenché");
});

test("Windows OCR: concurrent capture is refused without keeping an image queue", async (context) => {
  const f = fixture(context), pending = f.ocr.recognize(png());
  assert.equal((await f.ocr.recognize(png())).reason, "busy");
  assert.equal(f.child().writes.length, 1);
  f.child().reply(response()); assert.equal((await pending).available, true);
});

test("Windows OCR: cancellation kills the in-flight helper and late data cannot complete a newer request", async (context) => {
  const f = fixture(context), controller = new AbortController(); controller.abort();
  assert.equal((await f.ocr.recognize(png(), { signal: controller.signal })).reason, "cancelled");
  assert.equal(f.spawned.length, 0);
  const nextController = new AbortController(), pending = f.ocr.recognize(png(), { signal: nextController.signal });
  const old = f.child(); nextController.abort(); assert.equal((await pending).reason, "cancelled");
  assert.equal(old.killed, 1); assert.equal(f.timers.size, 0);
  const next = f.ocr.recognize(png()); old.reply(response());
  f.child().reply(response(2)); assert.equal((await next).available, true);
});

test("Windows OCR: deadline, exit and OS errors return only generic reasons and apply a restart backoff", async (context) => {
  for (const failure of ["timeout", "error", "exit", "stdin-error", "stdout-error", "stderr-error"]) {
    const f = fixture(context), pending = f.ocr.recognize(png()); const child = f.child();
    if (failure === "timeout") f.advance(3000);
    else if (failure.endsWith("-error")) child[failure.split("-")[0]].emit("error", new Error("private details"));
    else child.emit(failure, new Error("private details"));
    assert.deepEqual(await pending, { available: false, lines: [], reason: failure === "timeout" ? "timeout" : "unavailable" });
    assert.equal(child.killed, 1);
    assert.equal((await f.ocr.recognize(png())).available, false); assert.equal(f.spawned.length, 1);
    f.advance(30000);
    const retry = f.ocr.recognize(png()); assert.equal(f.spawned.length, 2);
    f.child().reply(response(2)); assert.equal((await retry).available, true);
  }
});

test("Windows OCR: malformed, excessive or mismatched worker output is rejected without exposing it", async (context) => {
  const invalid = [response(99), { id: 1, available: true, lines: Array(65).fill(response().lines[0]) },
    { id: 1, available: true, lines: [{ ...response().lines[0], text: "x".repeat(513) }] },
    { id: 1, available: true, lines: [{ text: "ok", bbox: { x: -1, y: 1, width: 1, height: 1 } }] },
    { id: 1, available: true, lines: [{ text: "ok", bbox: { x: 799, y: 1, width: 3, height: 1 } }] },
    { id: 1, available: true, lines: [{ ...response().lines[0], text: "bad\0text" }] }];
  for (const value of invalid) {
    const f = fixture(context), pending = f.ocr.recognize(png()); f.child().reply(value);
    assert.deepEqual(await pending, { available: false, lines: [], reason: "protocol" });
    assert.equal(f.child().killed, 1);
  }
  for (const bytes of [Buffer.from("private unparseable output\n"), Buffer.alloc(65537, 65)]) {
    const f = fixture(context), pending = f.ocr.recognize(png()); f.child().stdout.emit("data", bytes);
    assert.equal((await pending).reason, "protocol"); assert.equal(f.child().killed, 1);
  }
});

test("Windows OCR: missing local recognizer, spawn failure and close are graceful without diagnostics", async (context) => {
  const f = fixture(context), pending = f.ocr.recognize(png()); f.child().reply({ id: 1, available: false, lines: [] });
  assert.deepEqual(await pending, { available: false, lines: [], reason: "unavailable" });
  const broken = fixture(context, { spawnImpl: () => { throw new Error("private path"); } });
  assert.equal((await broken.ocr.recognize(png())).reason, "unavailable");
  const closing = fixture(context), stopped = closing.ocr.recognize(png()); closing.ocr.close();
  assert.equal((await stopped).reason, "closed"); assert.equal(closing.child().killed, 1);
  assert.equal((await closing.ocr.recognize(png())).reason, "closed");
});

test("Windows OCR worker: memory-only API contract and no capture, image files, network or policy changes", () => {
  const script = fs.readFileSync(path.resolve(__dirname, "../resources/match-vision/ocr.ps1"), "utf8");
  for (const api of ["Windows.Media.Ocr.OcrEngine", "InMemoryRandomAccessStream", "GetSoftwareBitmapAsync", "RecognizeAsync", "BoundingRect"]) assert.ok(script.includes(api));
  assert.equal(/CopyFromScreen|desktopCapturer|GetWindow|BitBlt|WriteAllBytes|ReadAllBytes|Set-Content|Out-File|Invoke-WebRequest|Invoke-RestMethod|HttpClient|ExecutionPolicy|Set-MpPreference/i.test(script), false);
});
