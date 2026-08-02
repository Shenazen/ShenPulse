"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  configureMinecraftServerCommandFeedback,
  parseMinecraftWinCounterLine
} = require("../src/main/game-runtime");

const installationPath = path.resolve(
  process.argv[2] ||
    path.join(
      process.env.APPDATA || "",
      "ShenPulse",
      "games",
      "minecraft-bedrock-box"
    )
);

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});

async function main() {
  await configureMinecraftServerCommandFeedback(installationPath);
  const properties = fs.readFileSync(
    path.join(installationPath, "server.properties"),
    "utf8"
  );
  assert.match(properties, /^gamemode=creative$/m);
  assert.match(properties, /^force-gamemode=true$/m);
  assert.match(properties, /^allow-flight=true$/m);

  const javaPath = await findNamedFile(
    path.join(installationPath, "runtime", "java"),
    "java.exe"
  );
  const serverPath = path.join(installationPath, "paper-1.21-130.jar");
  assert.equal(fs.statSync(serverPath).isFile(), true);

  const child = spawn(
    javaPath,
    [
      "-Xms1024M",
      "-Xmx2048M",
      "-Dfile.encoding=UTF-8",
      "-jar",
      serverPath,
      "nogui"
    ],
    {
      cwd: installationPath,
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  let output = "";
  const append = (chunk) => {
    output = `${output}${String(chunk || "")}`.slice(-200_000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);

  try {
    await waitFor(() => /\bDone \(.+\)! For help, type/i.test(output), 300_000);
    for (const command of [
      "gamerule sendCommandFeedback false",
      "defaultgamemode creative",
      "gamemode creative @a",
      "shenpulse_win set 3",
      "shenpulse_win timer 600",
      "shenpulse_win show",
      "bedrock win 1"
    ]) {
      child.stdin.write(`${command}\r\n`);
    }
    await waitFor(
      () =>
        /SHENPULSE_WIN_COUNTER current=4\b[\s\S]*?\bvisible=true\b[\s\S]*?\bsource=bedrock-win/i.test(
          output
        ),
      30_000
    );
    const nativeLine = output
      .split(/\r?\n/)
      .find((line) => /source=bedrock-win/i.test(line));
    assert.deepEqual(parseMinecraftWinCounterLine(nativeLine), {
      current: 4,
      outcome: "win",
      source: "bedrock-win"
    });
    assert.match(
      output,
      /SHENPULSE_WIN_COUNTER current=3\b[\s\S]*?\bvisible=true\b[\s\S]*?\btimerTotal=600\b[\s\S]*?\bsource=show/i
    );
    process.stdout.write(
      "PaperMC prêt, mode créatif forcé et compteur WINS natif 3 → 4 validé.\n"
    );
  } finally {
    await stopServer(child);
  }
}

async function findNamedFile(directory, name) {
  const entries = await fs.promises.readdir(directory, {
    withFileTypes: true
  });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
      return candidate;
    }
    if (entry.isDirectory()) {
      const found = await findNamedFile(candidate, name).catch(() => "");
      if (found) return found;
    }
  }
  throw new Error(`${name} est introuvable dans ${directory}`);
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Le serveur Minecraft n’a pas produit le résultat attendu.");
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.stdin.write("stop\r\n");
  child.stdin.end();
  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 20_000))
  ]);
  if (!graceful && child.exitCode === null) child.kill();
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 3_000))
  ]);
}
