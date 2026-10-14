"use strict";

const { jsonRequest, connect } = require("./lib/cdp-client");

const http = require("node:http");
const WebSocket = require("ws");

const debugPort = Number(process.argv[2] || 9222);

async function main() {
  const pages = await jsonRequest(`http://127.0.0.1:${debugPort}/json`);
  const page = pages.find((entry) => entry.type === "page");
  if (!page?.webSocketDebuggerUrl) {
    throw new Error("Fenêtre ShenPulse introuvable.");
  }
  const client = await connect(page.webSocketDebuggerUrl);
  try {
    await client.call("Runtime.enable");
    const result = await client.evaluate(`
      (async () => {
        const packId = "minecraft-bedrock-box";
        const otherPackId = "minecraft-sandbox-3";
        const original =
          snapshot.state.game.roundSettingsByPack?.[packId] || {
            durationMinutes: 10,
            autoRestart: false
          };
        let verification = {};
        try {
          await api.saveGameRoundSettings(packId, {
            durationMinutes: 10,
            autoRestart: false
          });
          const launch = await api.launchGame(packId);
          if (launch?.snapshot) acceptSnapshot(launch.snapshot);
          const active = await api.getSnapshot();
          const runtime = await api.getGameRuntimeStatus(packId);
          let conflict = "";
          try {
            await api.selectGame(otherPackId);
          } catch (error) {
            conflict = error?.message || String(error);
          }
          syncChrome();
          gameSessionStop.click();
          const stopDeadline = Date.now() + 20_000;
          let stoppedSnapshot = null;
          let stoppedRuntime = null;
          while (Date.now() < stopDeadline) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            stoppedSnapshot = await api.getSnapshot();
            stoppedRuntime = await api.getGameRuntimeStatus(packId);
            if (
              stoppedSnapshot.state.session.game?.running !== true &&
              stoppedRuntime.serverRunning === false
            ) {
              break;
            }
          }
          verification = {
            conflict,
            roundDurationSeconds:
              active.state.session.game?.roundDurationSeconds,
            roundEndsAt: active.state.session.game?.roundEndsAt,
            roundStatus: active.state.session.game?.roundStatus,
            serverRunning: runtime.serverRunning === true,
            sessionPackId: active.state.session.game?.packId,
            serverStoppedByTopButton:
              stoppedRuntime?.serverRunning === false,
            sessionStoppedByTopButton:
              stoppedSnapshot?.state.session.game?.running !== true
          };
        } finally {
          const stopped = await api.stopGameSession().catch(() => null);
          if (stopped) acceptSnapshot(stopped);
          await api.saveGameRoundSettings(packId, original).catch(() => {});
        }
        const stoppedRuntime = await api.getGameRuntimeStatus(packId);
        const stoppedSnapshot = await api.getSnapshot();
        return {
          ...verification,
          serverStopped: stoppedRuntime.serverRunning === false,
          sessionStopped:
            stoppedSnapshot.state.session.game?.running !== true
        };
      })()
    `, true);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
