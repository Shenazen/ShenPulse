"use strict";

/** shelly : module « processes », sans initialisation externe au chargement. */
const { execFile } = require("node:child_process");

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(task, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await task().catch(() => null);
    if (value) return value;
    await delay(intervalMs);
  }
  return null;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout || ""))
    );
  });
}

module.exports = { delay, waitFor, runCommand };

