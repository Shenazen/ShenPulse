"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const gameRoot = path.join(
  process.env.APPDATA || "",
  "ShenPulse",
  "games",
  "minecraft-bedrock-box"
);
const javaPath = path.join(
  gameRoot,
  "runtime",
  "java",
  "jdk-21.0.11+10-jre",
  "bin",
  "java.exe"
);
const serverJar = "paper-1.21-130.jar";
const requestedCounter = Number(
  String(process.argv.find((arg) => arg.startsWith("--counter=")) || "").split("=")[1]
);
const originalCounter = Number.isSafeInteger(requestedCounter)
  ? requestedCounter
  : readCurrentCounter();
const transcript = [];
const phases = [];
let serverReady = false;
let stopped = false;
let activeServer = null;

main().catch((error) => {
  activeServer?.kill();
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});

async function main() {
  if (!fs.existsSync(javaPath)) {
    throw new Error(`Java Minecraft introuvable : ${javaPath}`);
  }

  const server = spawn(
    javaPath,
    ["-Xms1024M", "-Xmx2048M", "-jar", serverJar, "nogui"],
    {
      cwd: gameRoot,
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  activeServer = server;

  const consume = (chunk) => {
    const text = String(chunk || "");
    process.stdout.write(text);
    transcript.push(...text.split(/\r?\n/).filter(Boolean));
    if (/\bDone \([^)]+\)!/i.test(text)) {
      serverReady = true;
    }
  };
  server.stdout.on("data", consume);
  server.stderr.on("data", consume);

  const exitPromise = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("close", (code) => resolve(code));
  });

  await waitUntil(() => serverReady, 90_000, "démarrage du serveur");
  await delay(2_000);
  send(server, `shenpulse_win set ${originalCounter}`);
  await delay(1_000);
  send(server, "bedrock clear");
  await delay(1_000);

  phases.push({ name: "interrupted", start: transcript.length });
  send(server, "bedrock fill");
  // The configured 15-second counter completes natively around 18 seconds:
  // break the cube at 16 seconds, during its intentionally elongated ending.
  await delay(16_000);
  send(server, "bedrock clear");
  phases[0].end = transcript.length;
  await delay(8_000);

  phases.push({ name: "native", start: transcript.length });
  send(server, "bedrock fill");
  await waitUntil(
    () => linesFor("native").some((line) => /\[s2e-bedrock-box\] win-up\b/.test(line)),
    90_000,
    "signal natif win-up"
  );
  await waitUntil(
    () =>
      linesFor("native").some(
        (line) => /SHENPULSE_WIN_COUNTER\b.*\bsource=bedrock-win\b/.test(line)
      ),
    15_000,
    "compteur ShenPulse après win-up"
  );
  phases[1].end = transcript.length;

  phases.push({ name: "gift", start: transcript.length });
  send(server, "bedrock win 1");
  await waitUntil(
    () =>
      linesFor("gift").some(
        (line) => /SHENPULSE_WIN_COUNTER\b.*\bsource=bedrock-win\b/.test(line)
      ),
    15_000,
    "cadeau WIN"
  );
  phases[2].end = transcript.length;

  send(server, `shenpulse_win set ${originalCounter}`);
  await delay(1_000);
  send(server, "stop");
  stopped = true;
  const exitCode = await Promise.race([
    exitPromise,
    delay(30_000).then(() => {
      server.kill();
      throw new Error("Le serveur Minecraft ne s'est pas arrêté.");
    })
  ]);
  if (exitCode !== 0) {
    throw new Error(`Le serveur Minecraft s'est arrêté avec le code ${exitCode}.`);
  }
  activeServer = null;

  verifyTranscript();
  process.stdout.write(
    `\nMinecraft native WIN runtime: OK (compteur restauré à ${originalCounter})\n`
  );
}

function verifyTranscript() {
  const all = transcript.join("\n");
  if (/SHENPULSE_WIN_COUNTER\b.*\bsource=auto-win\b/.test(all)) {
    throw new Error("Une victoire anticipée auto-win a encore été détectée.");
  }

  const interrupted = linesFor("interrupted");
  if (
    interrupted.some(
      (line) =>
        /\[s2e-bedrock-box\] win-up\b/.test(line) ||
        /SHENPULSE_WIN_COUNTER\b.*\bsource=bedrock-win\b/.test(line)
    )
  ) {
    throw new Error("Le cube interrompu a produit une WIN.");
  }

  const native = linesFor("native");
  if (
    native.filter((line) => /\[s2e-bedrock-box\] win-up\b/.test(line)).length !== 1 ||
    native.filter((line) =>
      /SHENPULSE_WIN_COUNTER\b.*\bsource=bedrock-win\b/.test(line)
    ).length !== 1
  ) {
    throw new Error("La vraie victoire native n'a pas produit exactement une WIN.");
  }

  const gift = linesFor("gift");
  if (
    gift.some((line) => /\[s2e-bedrock-box\] win-up\b/.test(line)) ||
    gift.filter((line) =>
      /SHENPULSE_WIN_COUNTER\b.*\bsource=bedrock-win\b/.test(line)
    ).length !== 1
  ) {
    throw new Error("Le cadeau WIN n'a pas été compté exactement une fois.");
  }
}

function linesFor(name) {
  const phase = phases.find((entry) => entry.name === name);
  if (!phase) return [];
  return transcript.slice(phase.start, phase.end || transcript.length);
}

function send(server, command) {
  if (!server.stdin.writable) {
    throw new Error(`Console Minecraft indisponible avant '${command}'.`);
  }
  process.stdout.write(`\n[TEST] ${command}\n`);
  server.stdin.write(`${command}\n`);
}

function readCurrentCounter() {
  const filePath = path.join(
    gameRoot,
    "plugins",
    "ShenPulseBedrockGuard",
    "win-counter.properties"
  );
  const content = fs.readFileSync(filePath, "utf8");
  const current = Number(content.match(/^current=(-?\d+)$/m)?.[1]);
  return Number.isSafeInteger(current) ? current : 0;
}

async function waitUntil(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`Délai dépassé pendant ${label}.`);
    }
    await delay(250);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

process.on("exit", () => {
  if (!stopped) {
    // The spawned server is tied to this process' pipes and exits with it.
  }
});
