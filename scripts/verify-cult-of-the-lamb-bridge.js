"use strict";

const { once } = require("node:events");
const {
  SimpleTcpServerBridge
} = require("../src/main/simple-tcp-server-bridge");

const timeoutMs = Math.max(
  5_000,
  Number(process.argv[2] || 90_000)
);
const bridge = new SimpleTcpServerBridge({
  host: "127.0.0.1",
  port: 58431,
  timeoutMs: 12_000,
  label: "Cult of the Lamb"
});

main().catch(async (error) => {
  process.stderr.write(`${error.message}\n`);
  await bridge.close().catch(() => {});
  process.exitCode = 1;
});

async function main() {
  const status = await bridge.start();
  process.stdout.write(
    `LISTENING ${status.host}:${status.port}\n`
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
                  "Le mod Cult of the Lamb ne s’est pas connecté au bridge dans le délai prévu."
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
    `CONNECTED ${JSON.stringify(bridge.status())}\n`
  );
  await bridge.close();
}
