"use strict";

const { once } = require("node:events");
const {
  SimpleTcpServerBridge
} = require("../src/main/simple-tcp-server-bridge");

const gameId = String(process.argv[2] || "").trim();
const port = Number(process.argv[3] || 0);
const label = String(process.argv[4] || gameId || "Le jeu").trim();
const timeoutMs = Math.max(
  5_000,
  Number(process.argv[5] || 90_000)
);

if (!gameId || !Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write(
    "Usage : node verify-simple-tcp-game-bridge.js <game-id> <port> [libellé] [délai-ms]\n"
  );
  process.exit(2);
}

const bridge = new SimpleTcpServerBridge({
  host: "127.0.0.1",
  port,
  timeoutMs: 12_000,
  label
});

main().catch(async (error) => {
  process.stderr.write(`${error.message}\n`);
  await bridge.close().catch(() => {});
  process.exitCode = 1;
});

async function main() {
  const status = await bridge.start();
  process.stdout.write(
    `LISTENING ${gameId} ${status.host}:${status.port}\n`
  );
  if (!status.connected) {
    let timeout;
    try {
      await Promise.race([
        once(bridge, "connected"),
        new Promise((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(
                  `${label} ne s’est pas connecté au bridge dans le délai prévu.`
                )
              ),
            timeoutMs
          );
        })
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }
  process.stdout.write(
    `CONNECTED ${gameId} ${JSON.stringify(bridge.status())}\n`
  );
  await bridge.close();
}
