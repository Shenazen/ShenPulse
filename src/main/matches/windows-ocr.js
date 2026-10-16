"use strict";

// Local bytes-only OCR adapter. Constructing it performs no capture, process,
// network access or disk write. The caller alone controls image acquisition.
const { spawn } = require("node:child_process");
const path = require("node:path");
const { StringDecoder } = require("node:string_decoder");

const MAX_PNG_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_DIMENSION = 2600;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const unavailable = (reason) => ({ available: false, lines: [], reason });

function pngSize(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 33 || bytes.byteLength > MAX_PNG_BYTES) return null;
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE) || buffer.readUInt32BE(8) !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 && width <= MAX_DIMENSION && height <= MAX_DIMENSION && width * height <= 4000000
    ? { width, height } : null;
}

function safeResult(value, size) {
  if (!value || typeof value !== "object" || value.available !== true) return unavailable("unavailable");
  if (!Array.isArray(value.lines) || value.lines.length > 64) return null;
  const lines = [];
  for (const line of value.lines) {
    const box = line?.bbox;
    if (typeof line?.text !== "string" || line.text.length > 512 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(line.text) || !box ||
      ![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.x < 0 || box.y < 0 || box.width < 0 || box.height < 0 ||
      box.x + box.width > size.width + 1 || box.y + box.height > size.height + 1) return null;
    lines.push({ text: line.text, bbox: { x: box.x, y: box.y, width: box.width, height: box.height } });
  }
  return { available: true, lines };
}

function createWindowsOcr({ spawnImpl = spawn, platform = process.platform,
  resourcePath = path.resolve(__dirname, "../../../resources/match-vision/ocr.ps1"),
  timeoutMs = 3000, now = Date.now, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  const timeout = Number.isSafeInteger(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 15000 ? timeoutMs : 3000;
  let worker = null, pending = null, closed = false, sequence = 0, retryAt = 0;

  function finish(result) {
    if (!pending) return;
    const operation = pending; pending = null;
    clearTimeoutImpl(operation.timer); operation.signal?.removeEventListener("abort", operation.abort);
    operation.resolve(result);
  }
  function stop(reason, backoff = false) {
    const child = worker; worker = null;
    if (backoff) retryAt = now() + 30000;
    finish(unavailable(reason));
    try { child?.stdin?.destroy(); child?.kill(); } catch { /* No raw errors or image bytes escape. */ }
  }
  function start() {
    let child;
    try {
      if (typeof resourcePath !== "string" || !path.isAbsolute(resourcePath) || !resourcePath.endsWith(".ps1")) return false;
      const executable = path.win32.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
      child = spawnImpl(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", resourcePath],
        { windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"] });
      if (!child?.stdin?.write || !child?.stdout?.on || !child?.on) throw new Error("Unavailable worker");
    } catch { retryAt = now() + 30000; return false; }
    worker = child;
    const decoder = new StringDecoder("utf8"); let output = "", outputBytes = 0;
    child.stdout.on("data", (chunk) => {
      if (worker !== child) return;
      if (!(chunk instanceof Uint8Array) && typeof chunk !== "string") { stop("protocol", true); return; }
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > MAX_OUTPUT_BYTES) { stop("protocol", true); return; }
      output += typeof chunk === "string" ? chunk : decoder.write(chunk);
      let newline;
      while ((newline = output.indexOf("\n")) >= 0) {
        const line = output.slice(0, newline); output = output.slice(newline + 1);
        outputBytes = Buffer.byteLength(output);
        let response;
        try { response = JSON.parse(line); } catch { stop("protocol", true); return; }
        if (!pending || response?.id !== pending.id) { stop("protocol", true); return; }
        const result = safeResult(response, pending.size);
        if (!result) { stop("protocol", true); return; }
        if (!result.available) { stop("unavailable", true); return; }
        finish(result);
      }
    });
    // Drain, never retain or log diagnostic output from an OS component.
    child.stderr?.on("data", () => {});
    child.stdout.on("error", () => { if (worker === child) stop("unavailable", true); });
    child.stderr?.on("error", () => { if (worker === child) stop("unavailable", true); });
    child.stdin.on?.("error", () => { if (worker === child) stop("unavailable", true); });
    child.on("error", () => { if (worker === child) stop("unavailable", true); });
    child.on("exit", () => { if (worker === child) stop("unavailable", true); });
    return true;
  }
  function recognize(bytes, { signal } = {}) {
    if (closed) return Promise.resolve(unavailable("closed"));
    if (platform !== "win32") return Promise.resolve(unavailable("unsupported"));
    if (signal?.aborted) return Promise.resolve(unavailable("cancelled"));
    const size = pngSize(bytes);
    if (!size) return Promise.resolve(unavailable("invalid-image"));
    if (pending) return Promise.resolve(unavailable("busy"));
    if (retryAt > now()) return Promise.resolve(unavailable("unavailable"));
    if (!worker && !start()) return Promise.resolve(unavailable("unavailable"));
    return new Promise((resolve) => {
      const id = ++sequence;
      const operation = { id, size, resolve, signal, abort: () => stop("cancelled"), timer: null };
      pending = operation;
      operation.timer = setTimeoutImpl(() => stop("timeout", true), timeout); operation.timer?.unref?.();
      signal?.addEventListener("abort", operation.abort, { once: true });
      try { worker.stdin.write(JSON.stringify({ id, png: Buffer.from(bytes).toString("base64") }) + "\n"); }
      catch { stop("unavailable", true); }
    });
  }
  function close() { if (!closed) { closed = true; stop("closed"); } }
  return { recognize, close };
}

module.exports = { createWindowsOcr };
